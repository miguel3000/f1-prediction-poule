import { useState, useEffect, useRef } from 'react';
import { getLiveTiming } from '../services/api';
import InfoBannerRows, { InfoBannerRow } from '../components/InfoBannerRows';
import { useLang, TranslationKey } from '../i18n/LanguageContext';

interface DriverInfo {
  RacingNumber: string;
  BroadcastName: string;
  FullName: string;
  Tla: string;
  TeamName: string;
  TeamColour: string;
  Line: number;
}

interface SectorInfo {
  Value: string;
  OverallFastest: boolean;
  PersonalFastest: boolean;
}

interface TimingLine {
  Position: string;
  GapToLeader?: string;
  IntervalToPositionAhead?: { Value: string };
  RacingNumber: string;
  Retired: boolean;
  InPit: boolean;
  PitOut: boolean;
  Stopped: boolean;
  Sectors?: SectorInfo[];
  BestLapTime?: { Value: string };
  LastLapTime?: { Value: string; OverallFastest?: boolean; PersonalFastest?: boolean };
  NumberOfLaps?: number;
}

interface Stint {
  Compound?: string;
  New?: string;
  TotalLaps?: number;
}

interface SessionInfo {
  Meeting?: { Name: string; Location?: string; Circuit?: { ShortName: string } };
  Name: string;
  Type: string;
  StartDate?: string;
  ArchiveStatus?: { Status: string };
}

interface TrackStatus {
  Status: string;
  Message: string;
}

interface WeatherData {
  AirTemp: string;
  TrackTemp: string;
  Humidity: string;
  WindSpeed: string;
  Rainfall: string;
}

interface ExtrapolatedClock {
  Utc?: string;
  Remaining: string;
  Extrapolating: boolean;
}

interface RCMessage {
  Utc: string;
  Message: string;
  Category: string;
  Flag?: string;
}

interface LiveTimingData {
  SessionInfo?: SessionInfo;
  TrackStatus?: TrackStatus;
  WeatherData?: WeatherData;
  ExtrapolatedClock?: ExtrapolatedClock;
  DriverList?: Record<string, DriverInfo>;
  TimingData?: { Lines: Record<string, TimingLine> };
  TimingAppData?: { Lines: Record<string, { Stints?: Stint[] }> };
  RaceControlMessages?: { Messages: RCMessage[] | Record<string, RCMessage> };
}

interface Snapshot {
  status: 'connecting' | 'connected' | 'disconnected';
  lastMessageAt: string | null;
  serverTime?: string;
  isLive: boolean;
  data: LiveTimingData;
}

const COMPOUND_STYLE: Record<string, { label: string; className: string }> = {
  SOFT: { label: 'S', className: 'bg-red-600 text-white' },
  MEDIUM: { label: 'M', className: 'bg-yellow-400 text-black' },
  HARD: { label: 'H', className: 'bg-white text-black border border-f1-neutral-400' },
  INTERMEDIATE: { label: 'I', className: 'bg-green-600 text-white' },
  WET: { label: 'W', className: 'bg-blue-600 text-white' },
};

const sectorClass = (s?: SectorInfo) => {
  if (!s || !s.Value) return 'text-white/40';
  if (s.OverallFastest) return 'text-purple-400 font-bold';
  if (s.PersonalFastest) return 'text-green-400 font-bold';
  return 'text-white';
};

type Translate = (key: TranslationKey, vars?: Record<string, string | number>) => string;

const timeAgo = (iso: string | null, t: Translate) => {
  if (!iso) return t('live.never');
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return t('live.secondsAgo', { n: seconds });
  return t('live.minutesAgo', { n: Math.floor(seconds / 60) });
};

// Session and track-status names arrive from the feed in English.
const sessionLabel = (name: string | undefined, t: Translate): string => {
  if (!name) return '';
  const practice = /^Practice (\d)$/.exec(name);
  if (practice) return t('live.practice', { n: practice[1] });
  const known: Record<string, TranslationKey> = {
    Qualifying: 'live.sessionQualifying',
    'Sprint Qualifying': 'live.sessionSprintQualifying',
    'Sprint Shootout': 'live.sessionSprintQualifying',
    Sprint: 'live.sessionSprint',
    Race: 'live.sessionRace',
  };
  return known[name] ? t(known[name]) : name;
};

const trackStatusLabel = (message: string, t: Translate): string => {
  const known: Record<string, TranslationKey> = {
    AllClear: 'live.track.AllClear',
    Yellow: 'live.track.Yellow',
    Red: 'live.track.Red',
    SCDeployed: 'live.track.SCDeployed',
    VSCDeployed: 'live.track.VSCDeployed',
    VSCEnding: 'live.track.VSCEnding',
  };
  return known[message] ? t(known[message]) : message;
};

const pad2 = (n: number) => String(n).padStart(2, '0');

const parseHMS = (s: string): number | null => {
  const m = /^(\d+):(\d{2}):(\d{2})/.exec(s);
  return m ? Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]) : null;
};

// The feed only re-sends ExtrapolatedClock when it changes: Remaining is the
// time left as of Utc, and while Extrapolating the clock is meant to keep
// running on the client. nowMs is the server-corrected current time.
const formatRemaining = (clock: ExtrapolatedClock | undefined, nowMs: number): string => {
  if (!clock?.Remaining) return '—';
  const base = parseHMS(clock.Remaining);
  if (base === null) return clock.Remaining;
  let secs = base;
  if (clock.Extrapolating && clock.Utc) {
    // The feed sends 7 fractional digits; trim to 3 so Safari can parse it.
    const sentAt = Date.parse(clock.Utc.replace(/(\.\d{3})\d+/, '$1'));
    if (!Number.isNaN(sentAt)) secs = Math.max(0, base - Math.floor((nowMs - sentAt) / 1000));
  }
  return `${pad2(Math.floor(secs / 3600))}:${pad2(Math.floor((secs % 3600) / 60))}:${pad2(secs % 60)}`;
};

const LiveTiming = () => {
  const { t } = useLang();
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [, setTick] = useState(0);
  const isLiveRef = useRef(false);
  const backoffRef = useRef(0);
  // serverTime - device time at the last fetch, so the countdown is right even
  // when the device clock is off.
  const skewRef = useRef(0);

  const fetchSnapshot = async (manual = false) => {
    if (manual) setRefreshing(true);
    try {
      const res = await getLiveTiming();
      setSnapshot(res.data);
      isLiveRef.current = !!res.data.isLive;
      backoffRef.current = 0;
      if (res.data.serverTime) skewRef.current = Date.parse(res.data.serverTime) - Date.now();
    } catch (error: any) {
      console.error('Failed to fetch live timing:', error);
      if (error?.response?.status === 429) backoffRef.current = Math.min(backoffRef.current + 1, 4);
    } finally {
      setLoading(false);
      if (manual) setRefreshing(false);
    }
  };

  // Poll fast while a session is live, slowly otherwise; skip while the tab is
  // hidden and back off after a 429 so this page can never starve other calls.
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    let first = true;
    const loop = async () => {
      // Always load once so the page has data; after that, skip while hidden.
      if (first || !document.hidden) await fetchSnapshot();
      first = false;
      if (cancelled) return;
      const base = isLiveRef.current ? 3000 : 15000;
      timer = setTimeout(loop, base * 2 ** backoffRef.current);
    };
    const onVisible = () => {
      if (!document.hidden) fetchSnapshot();
    };

    document.addEventListener('visibilitychange', onVisible);
    loop();
    return () => {
      cancelled = true;
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  // Re-render every second only while a running session clock needs it.
  const needsTick = !!(snapshot?.isLive && snapshot.data.ExtrapolatedClock?.Extrapolating);
  useEffect(() => {
    if (!needsTick) return;
    const t = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [needsTick]);

  if (loading) {
    return (
      <div className="text-center py-16">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-f1-yellow-500 mx-auto" />
        <p className="mt-4 text-white">{t('live.connecting')}</p>
      </div>
    );
  }

  const data = snapshot?.data || {};
  const session = data.SessionInfo;
  const driverList = data.DriverList || {};
  const timingLines = data.TimingData?.Lines || {};
  const appDataLines = data.TimingAppData?.Lines || {};
  const trackStatus = data.TrackStatus;
  const weather = data.WeatherData;
  const clock = data.ExtrapolatedClock;

  const rawMessages = data.RaceControlMessages?.Messages;
  const messages: RCMessage[] = Array.isArray(rawMessages)
    ? rawMessages
    : rawMessages
    ? Object.values(rawMessages)
    : [];
  const recentMessages = [...messages].reverse().slice(0, 8);

  const sortedDrivers = Object.values(timingLines).sort(
    (a, b) => (parseInt(a.Position) || 999) - (parseInt(b.Position) || 999)
  );

  // All the session/track/weather info as one banner-row stack, same full-bleed
  // skewed-divider motif as the homepage countdown banner — just generalized to
  // however many label/value pairs there are instead of a fixed 3 rows.
  const infoRows: InfoBannerRow[] = [];
  if (snapshot?.status === 'connected') {
    infoRows.push({
      label: snapshot.isLive ? t('live.liveNow') : t('live.lastSession'),
      value: `${session?.Meeting?.Name || t('live.unknown')} — ${sessionLabel(session?.Name, t)}`,
    });
    if (trackStatus) infoRows.push({ label: t('live.trackStatus'), value: trackStatusLabel(trackStatus.Message, t) });
    infoRows.push({ label: t('live.timeRemaining'), value: formatRemaining(clock, Date.now() + skewRef.current) });
    infoRows.push({
      label: t('live.location'),
      value: session?.Meeting?.Circuit?.ShortName || session?.Meeting?.Location || '—',
    });
    if (weather) {
      infoRows.push({ label: t('live.temps'), value: `${weather.TrackTemp}° / ${weather.AirTemp}°` });
      infoRows.push({
        label: t('live.humidityWind'),
        value: `${weather.Humidity}% / ${weather.WindSpeed} m/s${weather.Rainfall === '1' ? ` · ${t('live.rain')}` : ''}`,
      });
    }
  }

  return (
    <div className="max-w-6xl mx-auto">
      <h1 className="text-4xl md:text-display-xl font-bold mb-2 text-center text-f1-yellow-500">
        {t('live.title')}
      </h1>
      <p className="text-center text-white text-xs mb-8">
        {t('live.subtitle')}
      </p>

      {/* Connection / session status */}
      {snapshot?.status !== 'connected' ? (
        <div className="card-f1 p-4 mb-6 flex items-center gap-3 text-white">
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-f1-yellow-500 flex-shrink-0" />
          <span>{t('live.reconnecting')}</span>
        </div>
      ) : (
        <div className="mb-6">
          <InfoBannerRows rows={infoRows} />
          <p className="text-center text-white/50 text-xs mt-2">
            {t('live.updated', { ago: timeAgo(snapshot?.lastMessageAt ?? null, t) })}
            {!snapshot?.isLive && ` · ${t('live.notLive')}`}
          </p>
          <div className="flex justify-center mt-3">
            <button
              onClick={() => fetchSnapshot(true)}
              disabled={refreshing}
              className="btn-f1-primary px-6 py-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {refreshing ? t('live.refreshing') : t('live.refresh')}
            </button>
          </div>
        </div>
      )}

      {/* Leaderboard */}
      <div className="card-f1 p-0 overflow-hidden mb-8">
        <div className="p-4 border-b border-f1-neutral-800 flex items-center gap-2">
          <span className="w-1 h-5 bg-f1-yellow-500 flex-shrink-0" />
          <h2 className="text-lg font-bold">{t('live.timing')}</h2>
        </div>

        {sortedDrivers.length === 0 ? (
          <div className="p-8 text-center text-white">{t('live.noTiming')}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-f1-yellow-500">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-bold text-black uppercase tracking-wider">{t('live.colPos')}</th>
                  <th className="px-3 py-2 text-left text-xs font-bold text-black uppercase tracking-wider">{t('live.colDriver')}</th>
                  <th className="px-3 py-2 text-left text-xs font-bold text-black uppercase tracking-wider">{t('live.colTyre')}</th>
                  <th className="px-3 py-2 text-left text-xs font-bold text-black uppercase tracking-wider">{t('live.colGap')}</th>
                  <th className="px-3 py-2 text-left text-xs font-bold text-black uppercase tracking-wider">{t('live.colLast')}</th>
                  <th className="px-3 py-2 text-left text-xs font-bold text-black uppercase tracking-wider">{t('live.colBest')}</th>
                  <th className="px-3 py-2 text-left text-xs font-bold text-black uppercase tracking-wider">S1</th>
                  <th className="px-3 py-2 text-left text-xs font-bold text-black uppercase tracking-wider">S2</th>
                  <th className="px-3 py-2 text-left text-xs font-bold text-black uppercase tracking-wider">S3</th>
                </tr>
              </thead>
              <tbody>
                {sortedDrivers.map((line, i) => {
                  const driver = driverList[line.RacingNumber];
                  const stints = appDataLines[line.RacingNumber]?.Stints;
                  const currentStint = stints && stints.length > 0 ? stints[stints.length - 1] : null;
                  const compound = currentStint?.Compound ? COMPOUND_STYLE[currentStint.Compound] : null;
                  const rowBg = i % 2 === 0 ? 'bg-f1-blue' : 'bg-f1-blue-dark';

                  return (
                    <tr key={line.RacingNumber} className={rowBg}>
                      <td className="px-3 py-2 font-f1-badge font-bold text-lg text-white/80">{line.Position}</td>
                      <td className="px-3 py-2">
                        <div
                          className="flex items-center gap-2 border-l-4 pl-2"
                          style={{ borderColor: driver ? `#${driver.TeamColour}` : '#666' }}
                        >
                          <div className="min-w-0">
                            <p className="font-bold text-white truncate">{driver?.Tla || line.RacingNumber}</p>
                            <p className="text-[10px] text-white/70 truncate">{driver?.TeamName}</p>
                          </div>
                          {line.Retired && <span className="text-[10px] px-1.5 py-0.5 bg-black/30 text-white flex-shrink-0">{t('live.out')}</span>}
                          {line.InPit && <span className="text-[10px] px-1.5 py-0.5 bg-f1-yellow-500 text-black font-bold flex-shrink-0">{t('live.pit')}</span>}
                          {line.Stopped && !line.Retired && <span className="text-[10px] px-1.5 py-0.5 bg-black/30 text-white flex-shrink-0">{t('live.stop')}</span>}
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        {compound ? (
                          <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-black ${compound.className}`}>
                            {compound.label}
                          </span>
                        ) : (
                          <span className="text-white/40">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2 font-mono text-base font-bold text-white/90">{line.GapToLeader || '—'}</td>
                      <td className={`px-3 py-2 font-mono text-base font-bold ${line.LastLapTime?.OverallFastest ? 'text-purple-400' : line.LastLapTime?.PersonalFastest ? 'text-green-400' : 'text-white/90'}`}>
                        {line.LastLapTime?.Value || '—'}
                      </td>
                      <td className="px-3 py-2 font-mono text-base font-bold text-white/90">{line.BestLapTime?.Value || '—'}</td>
                      <td className={`px-3 py-2 font-mono text-base font-bold ${sectorClass(line.Sectors?.[0])}`}>{line.Sectors?.[0]?.Value || '—'}</td>
                      <td className={`px-3 py-2 font-mono text-base font-bold ${sectorClass(line.Sectors?.[1])}`}>{line.Sectors?.[1]?.Value || '—'}</td>
                      <td className={`px-3 py-2 font-mono text-base font-bold ${sectorClass(line.Sectors?.[2])}`}>{line.Sectors?.[2]?.Value || '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Race control feed */}
      <div className="card-f1 p-0 overflow-hidden mb-8">
        <div className="p-4 border-b border-f1-neutral-800 flex items-center gap-2">
          <span className="w-1 h-5 bg-f1-yellow-500 flex-shrink-0" />
          <h2 className="text-lg font-bold">{t('live.raceControl')}</h2>
        </div>
        {recentMessages.length === 0 ? (
          <div className="p-8 text-center text-white">{t('live.noMessages')}</div>
        ) : (
          <div className="divide-y divide-f1-neutral-800">
            {recentMessages.map((m, i) => (
              <div key={i} className="px-4 py-3 flex items-start gap-3">
                <span className="text-[10px] text-white/50 font-mono flex-shrink-0 w-16">
                  {m.Utc?.slice(11, 19) || ''}
                </span>
                <p className="text-sm text-white">{m.Message}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default LiveTiming;
