import { query } from '../config/database';
import { storeStartingGrid, getStoredGrid } from './startingGridService';

// The real starting grid (penalties applied) from F1's own live timing feed, which the app is
// already connected to: TimingAppData carries a GridPos per car once the race or sprint is the
// current session, about an hour before the start. This is the source that works before the
// start; OpenF1's free API only has a session's data afterwards (see syncStartingGrid).

interface GridJob {
  kind: 'main' | 'sprint';
  startMs: number;
  rows: Array<{ driver_number: number; position: number }>;
}

const MIN_DRIVERS = 18;

// SessionInfo.StartDate is local wall-clock time and GmtOffset its UTC offset.
function sessionStartUtcMs(startDate: string, gmtOffset?: string): number | null {
  const wallClock = Date.parse(startDate.endsWith('Z') ? startDate : `${startDate}Z`);
  if (Number.isNaN(wallClock)) return null;
  const m = /^(-?)(\d+):(\d{2})(?::(\d{2}))?$/.exec(gmtOffset || '00:00:00');
  const offsetMs = m
    ? (m[1] ? -1 : 1) * (Number(m[2]) * 3600 + Number(m[3]) * 60 + Number(m[4] || 0)) * 1000
    : 0;
  return wallClock - offsetMs;
}

let warnedFor = '';

// Reads the live state SYNCHRONOUSLY into plain values (the feed merge mutates the state object
// in place, so nothing may hold a reference across an await).
export function buildGridJob(state: any): GridJob | null {
  const info = state?.SessionInfo;
  if (info?.Type !== 'Race' || !info.StartDate) return null;
  const kind = info.Name === 'Race' ? 'main' : info.Name === 'Sprint' ? 'sprint' : null;
  if (!kind) return null;

  const startMs = sessionStartUtcMs(info.StartDate, info.GmtOffset);
  const lines = state?.TimingAppData?.Lines;
  if (startMs === null || !lines || typeof lines !== 'object') return null;

  // GridPos is a string. A car that starts from the pit lane has no real place, so it goes behind
  // everyone else, in the order the feed lists them.
  const placed: Array<{ driver_number: number; grid: number }> = [];
  const behind: number[] = [];
  for (const [num, line] of Object.entries<any>(lines)) {
    if (!/^\d+$/.test(num) || !line || typeof line !== 'object') continue;
    const grid = parseInt(line.GridPos, 10);
    if (Number.isInteger(grid) && grid > 0) placed.push({ driver_number: parseInt(num, 10), grid });
    else if (line.GridPos !== undefined) behind.push(parseInt(num, 10));
  }

  const total = placed.length + behind.length;
  if (total < MIN_DRIVERS || placed.length === 0) {
    // Say once per session what the feed does contain, so a format surprise is visible in the log.
    const marker = `${startMs}:${kind}`;
    if (warnedFor !== marker && Object.keys(lines).length >= MIN_DRIVERS) {
      warnedFor = marker;
      const sample = Object.entries<any>(lines)
        .slice(0, 3)
        .map(([n, l]) => `${n}: GridPos ${JSON.stringify(l?.GridPos)}, TimingData position ${JSON.stringify(state?.TimingData?.Lines?.[n]?.Position)}`);
      console.log(`[starting-grid] ${kind} session in the feed but no usable GridPos yet (${sample.join(' | ')}; status ${state?.SessionStatus?.Status})`);
    }
    return null;
  }

  placed.sort((a, b) => a.grid - b.grid || a.driver_number - b.driver_number);
  const rows = placed.map((p, i) => ({ driver_number: p.driver_number, position: i + 1 }));
  behind.sort((a, b) => a - b).forEach((n, i) => rows.push({ driver_number: n, position: placed.length + i + 1 }));
  return { kind, startMs, rows };
}

let writeQueue: Promise<void> = Promise.resolve();
const lastWritten = new Map<string, string>();

export function persistStartingGridFromState(state: any): void {
  const job = buildGridJob(state);
  if (!job) return;

  const memoKey = `${job.startMs}:${job.kind}`;
  const signature = JSON.stringify(job.rows);
  if (lastWritten.get(memoKey) === signature) return;

  writeQueue = writeQueue
    .then(async () => {
      const wallClock = new Date(job.startMs).toISOString().slice(0, 19).replace('T', ' ');
      const race = await query(
        `SELECT id, season, race_date, race_type FROM races
         WHERE race_type = $1
           AND race_date >= ($2::timestamp - INTERVAL '3 hours') AND race_date <= ($2::timestamp + INTERVAL '3 hours')
         ORDER BY ABS(EXTRACT(EPOCH FROM (race_date - $2::timestamp))) LIMIT 1`,
        [job.kind, wallClock]
      );
      if (race.rows.length === 0) {
        console.log(`[starting-grid] No race row for the ${job.kind} that starts ${new Date(job.startMs).toISOString()}, not saving`);
      } else {
        const stored = await getStoredGrid(race.rows[0].id);
        const same = job.rows.every((r) => stored.get(r.driver_number) === r.position) && stored.size >= job.rows.length;
        if (!same) {
          const result = await storeStartingGrid(race.rows[0], job.rows);
          console.log(`[starting-grid] Saved ${job.kind} grid from the live feed (${result.stored} drivers, ${result.unknown} unknown)`);
        }
      }
      lastWritten.set(memoKey, signature);
    })
    .catch((error) => {
      console.error('[starting-grid] Failed to persist the starting grid:', error?.message || error);
    });
}
