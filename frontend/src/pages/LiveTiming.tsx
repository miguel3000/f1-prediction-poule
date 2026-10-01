import { useState, useEffect, useRef } from 'react';
import { getLiveTiming } from '../services/api';

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
  isLive: boolean;
  data: LiveTimingData;
}

const TRACK_STATUS_COLOR: Record<string, string> = {
  AllClear: 'bg-green-600/30 text-green-400',
  Clear: 'bg-green-600/30 text-green-400',
  Yellow: 'bg-yellow-600/30 text-yellow-400',
  'Double Yellow': 'bg-yellow-600/30 text-yellow-400',
  SCDeployed: 'bg-orange-600/30 text-orange-400',
  VSCDeployed: 'bg-orange-600/30 text-orange-400',
  VSCEnding: 'bg-orange-600/30 text-orange-400',
  Red: 'bg-red-600/30 text-red-400',
};

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

const timeAgo = (iso: string | null) => {
  if (!iso) return 'never';
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  return `${Math.floor(seconds / 60)}m ago`;
};

const LiveTiming = () => {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchSnapshot = async () => {
    try {
      const res = await getLiveTiming();
      setSnapshot(res.data);
    } catch (error) {
      console.error('Failed to fetch live timing:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSnapshot();
    pollRef.current = setInterval(fetchSnapshot, 3000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  if (loading) {
    return (
      <div className="text-center py-16">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-f1-yellow-500 mx-auto" />
        <p className="mt-4 text-white">Connecting to live timing...</p>
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

  const trackStatusClass = trackStatus ? TRACK_STATUS_COLOR[trackStatus.Message] || 'bg-f1-neutral-700 text-white' : '';

  return (
    <div className="max-w-6xl mx-auto">
      <h1 className="text-4xl md:text-display-xl font-bold mb-2 text-center text-f1-yellow-500">
        Live Timing
      </h1>
      <p className="text-center text-white text-xs mb-8">
        Direct from F1's own live timing feed — not an official F1 product.
      </p>

      {/* Connection / session status */}
      <div className="card-f1 p-4 mb-6">
        {snapshot?.status !== 'connected' ? (
          <div className="flex items-center gap-3 text-white">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-f1-yellow-500 flex-shrink-0" />
            <span>Reconnecting to F1 live timing...</span>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                {snapshot?.isLive ? (
                  <span className="flex items-center gap-1.5 px-2 py-0.5 bg-red-600 text-white text-xs font-bold uppercase tracking-wider">
                    <span className="w-1.5 h-1.5 bg-white animate-pulse" />
                    Live
                  </span>
                ) : (
                  <span className="px-2 py-0.5 bg-f1-neutral-700 text-white text-xs font-bold uppercase tracking-wider">
                    Last Session
                  </span>
                )}
                <h2 className="font-bold text-white">
                  {session?.Meeting?.Name || 'Unknown Session'} — {session?.Name}
                </h2>
              </div>
              <p className="text-xs text-white/60 mt-1">
                {session?.Meeting?.Circuit?.ShortName || session?.Meeting?.Location}
                {' · '}Updated {timeAgo(snapshot?.lastMessageAt ?? null)}
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {trackStatus && (
                <span className={`text-xs px-2 py-1 font-bold uppercase tracking-wide ${trackStatusClass}`}>
                  {trackStatus.Message}
                </span>
              )}
              {clock?.Remaining && (
                <span className="text-xs px-2 py-1 bg-f1-blue text-white font-mono font-bold">
                  ⏱ {clock.Remaining}
                </span>
              )}
            </div>
          </div>
        )}
        {!snapshot?.isLive && snapshot?.status === 'connected' && (
          <p className="text-xs text-white/50 mt-3 border-t border-f1-neutral-800 pt-3">
            No session is live right now — showing the last completed session. This page updates
            automatically once FP1 (or any session) goes green.
          </p>
        )}
      </div>

      {/* Weather */}
      {weather && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-6">
          <div className="bg-f1-neutral-850 p-3 text-center">
            <p className="text-lg font-f1-badge font-black text-f1-yellow-400">{weather.AirTemp}°</p>
            <p className="text-[10px] text-white/60 uppercase tracking-wider">Air</p>
          </div>
          <div className="bg-f1-neutral-850 p-3 text-center">
            <p className="text-lg font-f1-badge font-black text-f1-yellow-400">{weather.TrackTemp}°</p>
            <p className="text-[10px] text-white/60 uppercase tracking-wider">Track</p>
          </div>
          <div className="bg-f1-neutral-850 p-3 text-center">
            <p className="text-lg font-f1-badge font-black text-f1-yellow-400">{weather.Humidity}%</p>
            <p className="text-[10px] text-white/60 uppercase tracking-wider">Humidity</p>
          </div>
          <div className="bg-f1-neutral-850 p-3 text-center">
            <p className="text-lg font-f1-badge font-black text-f1-yellow-400">{weather.WindSpeed}</p>
            <p className="text-[10px] text-white/60 uppercase tracking-wider">Wind m/s</p>
          </div>
          <div className="bg-f1-neutral-850 p-3 text-center">
            <p className="text-lg font-f1-badge font-black text-f1-yellow-400">{weather.Rainfall === '1' ? 'Yes' : 'No'}</p>
            <p className="text-[10px] text-white/60 uppercase tracking-wider">Rain</p>
          </div>
        </div>
      )}

      {/* Leaderboard */}
      <div className="card-f1 p-0 overflow-hidden mb-8">
        <div className="p-4 border-b border-f1-neutral-800 flex items-center gap-2">
          <span className="w-1 h-5 bg-f1-yellow-500 flex-shrink-0" />
          <h2 className="text-lg font-bold">Timing</h2>
        </div>

        {sortedDrivers.length === 0 ? (
          <div className="p-8 text-center text-white">No timing data available right now</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-f1-neutral-850">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-white uppercase">Pos</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-white uppercase">Driver</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-white uppercase">Tyre</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-white uppercase">Gap</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-white uppercase">Last Lap</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-white uppercase">Best Lap</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-white uppercase">S1</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-white uppercase">S2</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-white uppercase">S3</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-f1-neutral-800">
                {sortedDrivers.map((line) => {
                  const driver = driverList[line.RacingNumber];
                  const stints = appDataLines[line.RacingNumber]?.Stints;
                  const currentStint = stints && stints.length > 0 ? stints[stints.length - 1] : null;
                  const compound = currentStint?.Compound ? COMPOUND_STYLE[currentStint.Compound] : null;

                  return (
                    <tr key={line.RacingNumber}>
                      <td className="px-3 py-2 font-f1-badge font-bold text-lg">{line.Position}</td>
                      <td className="px-3 py-2">
                        <div
                          className="flex items-center gap-2 border-l-4 pl-2"
                          style={{ borderColor: driver ? `#${driver.TeamColour}` : '#666' }}
                        >
                          <div className="min-w-0">
                            <p className="font-bold text-white truncate">{driver?.Tla || line.RacingNumber}</p>
                            <p className="text-[10px] text-white/60 truncate">{driver?.TeamName}</p>
                          </div>
                          {line.Retired && <span className="text-[10px] px-1.5 py-0.5 bg-red-600/30 text-red-400 flex-shrink-0">OUT</span>}
                          {line.InPit && <span className="text-[10px] px-1.5 py-0.5 bg-f1-blue/50 text-white flex-shrink-0">PIT</span>}
                          {line.Stopped && !line.Retired && <span className="text-[10px] px-1.5 py-0.5 bg-orange-600/30 text-orange-400 flex-shrink-0">STOP</span>}
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
                      <td className="px-3 py-2 font-mono text-xs">{line.GapToLeader || '—'}</td>
                      <td className={`px-3 py-2 font-mono text-xs ${line.LastLapTime?.OverallFastest ? 'text-purple-400 font-bold' : line.LastLapTime?.PersonalFastest ? 'text-green-400 font-bold' : ''}`}>
                        {line.LastLapTime?.Value || '—'}
                      </td>
                      <td className="px-3 py-2 font-mono text-xs">{line.BestLapTime?.Value || '—'}</td>
                      <td className={`px-3 py-2 font-mono text-xs ${sectorClass(line.Sectors?.[0])}`}>{line.Sectors?.[0]?.Value || '—'}</td>
                      <td className={`px-3 py-2 font-mono text-xs ${sectorClass(line.Sectors?.[1])}`}>{line.Sectors?.[1]?.Value || '—'}</td>
                      <td className={`px-3 py-2 font-mono text-xs ${sectorClass(line.Sectors?.[2])}`}>{line.Sectors?.[2]?.Value || '—'}</td>
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
          <h2 className="text-lg font-bold">Race Control</h2>
        </div>
        {recentMessages.length === 0 ? (
          <div className="p-8 text-center text-white">No messages yet</div>
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
