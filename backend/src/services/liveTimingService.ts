import axios from 'axios';
import WebSocket from 'ws';

// Connects to F1's own live timing feed — the same unofficial SignalR stream
// that every open-source F1 dashboard (f1-dash, FastF1's livetiming module,
// etc.) uses, since Jolpi/Ergast only has final results after a session ends.
// Protocol reverse-engineered by that community and confirmed against
// slowlydev/f1-dash's actual client source (github.com/slowlydev/f1-dash,
// signalr/src/lib.rs + realtime/src/f1.rs) — SignalR's JSON transport over a
// plain WebSocket, not the raw feed's "negotiate" REST API in the usual sense.
const BASE_URL = 'livetiming.formula1.com/signalrcore';
const RECORD_SEPARATOR = '\x1e';
const INVOCATION = 1;
const COMPLETION = 3;

// Deliberately excludes CarData.z / Position.z (zlib-compressed car telemetry
// and track-position coordinates — the 3D tracking this feature explicitly
// skips) and TeamRadio/ChampionshipPrediction (audio clips and end-of-season
// point projections, not relevant to a practice-session leaderboard).
const TOPICS = [
  'Heartbeat',
  'ExtrapolatedClock',
  'TimingStats',
  'TimingAppData',
  'WeatherData',
  'TrackStatus',
  'SessionStatus',
  'DriverList',
  'RaceControlMessages',
  'SessionInfo',
  'SessionData',
  'LapCount',
  'TimingData',
];

// F1's feed sends an initial full snapshot on subscribe, then a stream of
// partial per-topic updates that must be deep-merged in — exactly the merge
// f1-dash's state_service.rs implements, ported here. A plain object update
// applied onto an array (the feed sometimes patches an array-shaped field
// via numeric-string keys, e.g. {"0": {...}, "2": {...}}) patches matching
// indexes and appends anything beyond the array's current length.
function merge(base: any, update: any): any {
  if (isPlainObject(base) && isPlainObject(update)) {
    for (const key of Object.keys(update)) {
      base[key] = merge(base[key], update[key]);
    }
    return base;
  }
  if (Array.isArray(base) && isPlainObject(update)) {
    for (const key of Object.keys(update)) {
      const index = Number(key);
      if (!Number.isInteger(index)) continue;
      if (index < base.length) {
        base[index] = merge(base[index], update[key]);
      } else {
        base.push(update[key]);
      }
    }
    return base;
  }
  return update;
}

function isPlainObject(value: any): boolean {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

type ConnectionStatus = 'connecting' | 'connected' | 'disconnected';

let state: Record<string, any> = {};
let status: ConnectionStatus = 'disconnected';
let lastMessageAt: string | null = null;
let ws: WebSocket | null = null;

export const getLiveTimingSnapshot = () => ({
  status,
  lastMessageAt,
  // Lets the client correct for a wrong device clock when ticking the countdown.
  serverTime: new Date().toISOString(),
  // The feed keeps serving the last completed session's full data on
  // subscribe even when nothing is happening (confirmed live: it handed
  // back the prior race in full outside a session) — ArchiveStatus.Status
  // is the feed's own signal for "this is a replay, not live right now".
  isLive: status === 'connected' && state?.SessionInfo?.ArchiveStatus?.Status !== 'Complete',
  data: state,
});

async function negotiate(): Promise<{ connectionToken: string; cookie: string }> {
  const negotiateUrl = `https://${BASE_URL}/negotiate`;

  const optionsRes = await axios.request({
    method: 'OPTIONS',
    url: negotiateUrl,
    validateStatus: () => true,
  });
  const setCookie: string[] = optionsRes.headers['set-cookie'] || [];
  const albCookie = setCookie.find((c) => c.startsWith('AWSALBCORS='));
  const cookie = albCookie ? albCookie.split(';')[0] : '';

  const res = await axios.post(negotiateUrl, null, {
    params: { negotiateVersion: 1 },
    headers: cookie ? { Cookie: cookie } : undefined,
  });

  const connectionToken = res.data?.connectionToken;
  if (!connectionToken) {
    throw new Error('SignalR negotiate did not return a connectionToken');
  }

  return { connectionToken, cookie };
}

function connect() {
  status = 'connecting';
  negotiate()
    .then(({ connectionToken, cookie }) => {
      const wsUrl = `wss://${BASE_URL}?id=${encodeURIComponent(connectionToken)}`;
      ws = new WebSocket(wsUrl, {
        headers: {
          'User-Agent': 'BestHTTP',
          'Accept-Encoding': 'gzip,identity',
          ...(cookie ? { Cookie: cookie } : {}),
        },
      });

      ws.on('open', () => {
        ws!.send(JSON.stringify({ protocol: 'json', version: 1 }) + RECORD_SEPARATOR);
      });

      let subscribed = false;

      ws.on('message', (raw) => {
        const frames = raw
          .toString()
          .split(RECORD_SEPARATOR)
          .map((f) => f.trim())
          .filter(Boolean);

        for (const frame of frames) {
          let msg: any;
          try {
            msg = JSON.parse(frame);
          } catch {
            continue;
          }

          // Empty object {} is the handshake ack — subscribe right after it.
          if (!subscribed && Object.keys(msg).length === 0) {
            subscribed = true;
            const invocationId = `subscribe-${Date.now()}`;
            ws!.send(
              JSON.stringify({
                type: INVOCATION,
                invocationId,
                target: 'Subscribe',
                arguments: [TOPICS],
              }) + RECORD_SEPARATOR
            );
            continue;
          }

          if (msg.type === COMPLETION && msg.result) {
            state = msg.result;
            status = 'connected';
            lastMessageAt = new Date().toISOString();
            continue;
          }

          if (msg.type === INVOCATION && msg.target === 'feed' && Array.isArray(msg.arguments)) {
            const [topic, data] = msg.arguments;

            // The feed stays on one connection across the whole weekend
            // (FP1 -> FP2 -> FP3 -> Quali -> Race). A SessionInfo push after
            // the initial snapshot means a new session just started, so a
            // fresh full resubscribe is needed — otherwise stale per-driver
            // timing data from the previous session would stick around,
            // merged under driver numbers that may mean something different
            // in the new session. Same restart f1-dash's ingest loop does.
            if (topic === 'SessionInfo' && data?.Name) {
              console.log('[live-timing] New session detected, reconnecting for a fresh snapshot...');
              ws?.close();
              continue;
            }

            state = merge(state, { [topic]: data });
            lastMessageAt = new Date().toISOString();
          }
        }
      });

      ws.on('error', (err) => {
        console.error('[live-timing] WebSocket error:', err.message);
      });

      ws.on('close', () => {
        status = 'disconnected';
        ws = null;
        // F1's feed is up year-round but quiet outside sessions — keep
        // retrying on a steady interval rather than giving up.
        setTimeout(connect, 15_000);
      });
    })
    .catch((err) => {
      console.error('[live-timing] Failed to connect:', err.message);
      status = 'disconnected';
      setTimeout(connect, 15_000);
    });
}

export const startLiveTimingIngest = () => {
  connect();
};
