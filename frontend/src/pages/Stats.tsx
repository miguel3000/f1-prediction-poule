import { useState, useEffect } from 'react';
import {
  getCompletedRaces,
  getSeasonStats,
  getPracticeResults,
  getQualifyingResultsStats,
  getSprintQualifyingResultsStats,
  getRaceResultsStats,
  getSprintResultsStats,
  getFunStats,
} from '../services/api';
import { getTeamColor } from '../utils/teamColors';
import SegmentedTabs from '../components/SegmentedTabs';

interface Race {
  id: number;
  round: number;
  race_name: string;
  circuit_name: string;
  country: string;
  race_date: string;
  race_type: 'sprint' | 'main';
  status: string;
}

interface SessionResult {
  position: number;
  driverNumber: string;
  driverName: string;
  driverCode: string;
  team: string;
  time?: string | null;
  laps?: number;
  q1?: string | null;
  q2?: string | null;
  q3?: string | null;
  points?: number;
  status?: string;
  fastestLap?: string | null;
  fastestLapRank?: number | null;
}

interface SeasonStats {
  races: {
    completed_races: number;
    upcoming_races: number;
    completed_sprints: number;
    upcoming_sprints: number;
  };
  topScorers: Array<{ nickname: string; total_points: number }>;
  predictions: {
    main_predictions: number;
    sprint_predictions: number;
  };
}

interface FunStatsDriver {
  name: string;
  name_acronym: string;
  team: string;
  count: number;
}

interface FunStatsUser {
  nickname: string;
  count?: number;
  avg_points?: number;
  races?: number;
  best_race?: number;
}

interface FunStats {
  poles: FunStatsDriver[];
  wins: FunStatsDriver[];
  predictedWinners: FunStatsDriver[];
  crystalBall: FunStatsUser[];
  biggestUpset: {
    race_name: string;
    round: number;
    total: number;
    correct: number;
    accuracy_pct: number;
    winner_name: string;
    winner_acronym: string;
    winner_team: string;
  } | null;
  bestLap: {
    name: string;
    name_acronym: string;
    team: string;
    race_name: string;
    round: number;
    lap_time: string;
  } | null;
  consistency: FunStatsUser[];
}

type SessionType = 'fp1' | 'fp2' | 'fp3' | 'qualifying' | 'sprint_qualifying' | 'sprint' | 'race';

// ── Small driver chip with team color accent ──────────────────────────────────
const DriverChip = ({ name, team, count, suffix = '' }: {
  name: string; team: string; count: number; suffix?: string;
}) => {
  const tc = getTeamColor(team);
  return (
    <div className={`flex items-center gap-2 px-3 py-2 border-l-4 bg-f1-neutral-850 ${tc.border}`}>
      <span className={`font-mono font-black text-xl tabular-nums ${tc.text}`}>{count}</span>
      <div className="min-w-0">
        <p className="font-bold text-white text-sm truncate">{name}</p>
        <p className="text-xs text-f1-gray">{team}</p>
      </div>
      {suffix && <span className="text-xs text-f1-gray ml-auto flex-shrink-0">{suffix}</span>}
    </div>
  );
};

// ── Stat card wrapper ─────────────────────────────────────────────────────────
const StatCard = ({ emoji, title, children, isEmpty }: {
  emoji: string; title: string; children: React.ReactNode; isEmpty?: boolean;
}) => (
  <div className="card-f1 p-0 overflow-hidden">
    <div className="px-4 py-3 bg-f1-neutral-850 border-b border-f1-neutral-800 flex items-center gap-2">
      <span className="text-lg">{emoji}</span>
      <h3 className="font-bold text-sm text-white uppercase tracking-widest">{title}</h3>
    </div>
    <div className="p-4">
      {isEmpty
        ? <p className="text-f1-gray text-sm text-center py-2">No data yet this season</p>
        : children}
    </div>
  </div>
);

const Stats = () => {
  const [races, setRaces] = useState<Race[]>([]);
  const [seasonStats, setSeasonStats] = useState<SeasonStats | null>(null);
  const [selectedRound, setSelectedRound] = useState<number | null>(null);
  const [selectedSession, setSelectedSession] = useState<SessionType>('race');
  const [sessionResults, setSessionResults] = useState<SessionResult[]>([]);
  const [funStats, setFunStats] = useState<FunStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingSession, setLoadingSession] = useState(false);
  const [loadingFun, setLoadingFun] = useState(true);

  useEffect(() => {
    fetchData();
    fetchFunStats();
  }, []);

  const fetchData = async () => {
    try {
      const [racesRes, statsRes] = await Promise.all([
        getCompletedRaces(2026),
        getSeasonStats(2026),
      ]);
      setRaces(racesRes.data);
      setSeasonStats(statsRes.data);

      const mainRaces = racesRes.data.filter((r: Race) => r.race_type === 'main');
      if (mainRaces.length > 0) {
        setSelectedRound(mainRaces[mainRaces.length - 1].round);
      }
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchFunStats = async () => {
    try {
      const res = await getFunStats(2026);
      setFunStats(res.data);
    } catch (error) {
      console.error('Failed to fetch fun stats:', error);
    } finally {
      setLoadingFun(false);
    }
  };

  useEffect(() => {
    if (selectedRound !== null) fetchSessionResults();
  }, [selectedRound, selectedSession]);

  const fetchSessionResults = async () => {
    if (selectedRound === null) return;
    setLoadingSession(true);
    try {
      let response;
      switch (selectedSession) {
        case 'fp1': response = await getPracticeResults(selectedRound, 1, 2026); break;
        case 'fp2': response = await getPracticeResults(selectedRound, 2, 2026); break;
        case 'fp3': response = await getPracticeResults(selectedRound, 3, 2026); break;
        case 'qualifying': response = await getQualifyingResultsStats(selectedRound, 2026); break;
        case 'sprint_qualifying': response = await getSprintQualifyingResultsStats(selectedRound, 2026); break;
        case 'sprint': response = await getSprintResultsStats(selectedRound, 2026); break;
        case 'race': default: response = await getRaceResultsStats(selectedRound, 2026); break;
      }
      setSessionResults(response.data);
    } catch {
      setSessionResults([]);
    } finally {
      setLoadingSession(false);
    }
  };

  const getSelectedRace = () => races.find(r => r.round === selectedRound && r.race_type === 'main');
  const hasSprintRound = (round: number) => races.some(r => r.round === round && r.race_type === 'sprint');

  const getPositionColor = (pos: number) => {
    if (pos === 1) return 'bg-yellow-500 text-black';
    if (pos === 2) return 'bg-f1-neutral-300 text-black';
    if (pos === 3) return 'bg-f1-pink-gradient text-white';
    return 'bg-f1-neutral-700 text-white';
  };

  const sessionLabel: Record<SessionType, string> = {
    fp1: 'FP1', fp2: 'FP2', fp3: 'FP3',
    qualifying: 'Qualifying',
    sprint_qualifying: 'Sprint Quali',
    sprint: 'Sprint',
    race: 'Race',
  };

  const isQualiSession = selectedSession === 'qualifying' || selectedSession === 'sprint_qualifying';
  const isSQSession = selectedSession === 'sprint_qualifying';

  if (loading) {
    return (
      <div className="text-center py-16">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-f1-pink-500 mx-auto" />
        <p className="mt-4 text-f1-gray">Loading statistics...</p>
      </div>
    );
  }

  const uniqueRounds = [...new Set(races.filter(r => r.race_type === 'main').map(r => r.round))];

  const sessions: SessionType[] = [
    'fp1', 'fp2', 'fp3', 'qualifying',
    ...(selectedRound && hasSprintRound(selectedRound) ? ['sprint_qualifying' as SessionType, 'sprint' as SessionType] : []),
    'race',
  ];

  return (
    <div className="max-w-6xl mx-auto">
      <h1 className="text-4xl md:text-display-xl font-bold mb-8 text-center text-gradient-pink">
        2026 Season Statistics
      </h1>

      {/* Season Summary */}
      {seasonStats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-10">
          <div className="card-f1 p-4 text-center">
            <p className="text-3xl font-black font-mono tabular-nums text-f1-pink-500">{seasonStats.races.completed_races}</p>
            <p className="text-xs text-f1-gray uppercase tracking-wider mt-1">Races Completed</p>
          </div>
          <div className="card-f1 p-4 text-center">
            <p className="text-3xl font-black font-mono tabular-nums text-f1-pink-500">{seasonStats.races.completed_sprints}</p>
            <p className="text-xs text-f1-gray uppercase tracking-wider mt-1">Sprints Completed</p>
          </div>
          <div className="card-f1 p-4 text-center">
            <p className="text-3xl font-black font-mono tabular-nums text-green-400">{seasonStats.predictions.main_predictions}</p>
            <p className="text-xs text-f1-gray uppercase tracking-wider mt-1">Race Predictions</p>
          </div>
          <div className="card-f1 p-4 text-center">
            <p className="text-3xl font-black font-mono tabular-nums text-f1-teal-400">{seasonStats.predictions.sprint_predictions}</p>
            <p className="text-xs text-f1-gray uppercase tracking-wider mt-1">Sprint Predictions</p>
          </div>
        </div>
      )}

      {/* ── Fun Stats Section ──────────────────────────────────────────────── */}
      <div className="mb-4 flex items-center gap-3">
        <div className="w-1 h-6 bg-f1-pink-500 flex-shrink-0" />
        <div>
          <h2 className="text-xl font-bold text-white uppercase tracking-wide">Season Highlights</h2>
          <p className="text-f1-gray text-xs">Fun facts and stats from the 2026 season so far</p>
        </div>
      </div>
      {loadingFun ? (
        <div className="flex items-center gap-3 py-8 text-f1-gray">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-f1-pink-500 flex-shrink-0" />
          <span>Crunching the numbers...</span>
        </div>
      ) : !funStats ? (
        <p className="text-f1-gray text-sm">Stats unavailable</p>
      ) : (
        <>
          {/* Poule stats: prediction accuracy */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">

            <StatCard emoji="🔮" title="Crystal Ball — Most P1 Predictions Correct"
              isEmpty={funStats.crystalBall.length === 0}>
              <div className="space-y-2">
                {funStats.crystalBall.map((u, i) => (
                  <div key={u.nickname} className="flex items-center gap-3 py-1">
                    <span className={`text-sm font-black w-6 text-center ${
                      i === 0 ? 'text-yellow-400' : i === 1 ? 'text-f1-neutral-300' : i === 2 ? 'text-f1-pink-400' : 'text-f1-gray'
                    }`}>{i + 1}</span>
                    <span className="font-semibold text-white flex-1">{u.nickname}</span>
                    <span className="font-mono text-f1-pink-500 font-black">
                      {u.count}× correct
                    </span>
                  </div>
                ))}
              </div>
            </StatCard>

            <StatCard emoji="📈" title="Most Consistent Predictor"
              isEmpty={funStats.consistency.length === 0}>
              <div className="space-y-2">
                {funStats.consistency.map((u, i) => (
                  <div key={u.nickname} className="flex items-center gap-3 py-1">
                    <span className={`text-sm font-black w-6 text-center ${
                      i === 0 ? 'text-yellow-400' : i === 1 ? 'text-f1-neutral-300' : i === 2 ? 'text-f1-pink-400' : 'text-f1-gray'
                    }`}>{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-white">{u.nickname}</p>
                      <p className="text-xs text-f1-gray">{u.races} races · best: {u.best_race} pts</p>
                    </div>
                    <span className="font-mono text-green-400 font-black">
                      {u.avg_points} avg
                    </span>
                  </div>
                ))}
              </div>
            </StatCard>
          </div>

          {/* Poule stats: fan favorite & biggest upset */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <StatCard emoji="❤️" title="Fan Favorite — Most Picked as Winner"
              isEmpty={funStats.predictedWinners.length === 0}>
              <div className="space-y-2">
                {funStats.predictedWinners.slice(0, 3).map((d) => (
                  <DriverChip key={d.name} name={d.name} team={d.team}
                    count={d.count} suffix="picks" />
                ))}
                {funStats.predictedWinners.length === 0 && (
                  <p className="text-f1-gray text-sm text-center">No predictions yet</p>
                )}
              </div>
            </StatCard>

            <StatCard emoji="😱" title="Biggest Upset" isEmpty={!funStats.biggestUpset}>
              {funStats.biggestUpset && (() => {
                const upset = funStats.biggestUpset!;
                const tc = getTeamColor(upset.winner_team);
                return (
                  <div>
                    <p className="text-white font-bold mb-1">{upset.race_name}</p>
                    <div className={`flex items-center gap-2 my-2 border-l-4 px-3 py-2 bg-f1-neutral-850 ${tc.border}`}>
                      <span className={`font-black text-lg ${tc.text}`}>{upset.winner_acronym}</span>
                      <span className="text-white text-sm">{upset.winner_name} won</span>
                    </div>
                    <p className="text-f1-gray text-sm">
                      Only{' '}
                      <span className="text-f1-pink-500 font-bold">{upset.correct}</span>
                      {' '}of{' '}
                      <span className="font-bold text-white">{upset.total}</span>
                      {' '}players predicted it
                      {' '}({Number(upset.accuracy_pct).toFixed(1)}% accuracy)
                    </p>
                  </div>
                );
              })()}
            </StatCard>
          </div>
        </>
      )}

      {/* Race Selector */}
      <div className="mb-4 mt-10">
        <label className="block text-xs font-bold text-f1-gray uppercase tracking-wider mb-2">Select Race</label>
        <select
          value={selectedRound || ''}
          onChange={(e) => setSelectedRound(parseInt(e.target.value))}
          className="input-f1 w-full"
        >
          {uniqueRounds.map(round => {
            const race = races.find(r => r.round === round && r.race_type === 'main');
            return (
              <option key={round} value={round}>
                Round {round}: {race?.race_name}
              </option>
            );
          })}
        </select>
      </div>

      {/* Session Tabs */}
      {selectedRound && (
        <div className="mb-4">
          <SegmentedTabs
            options={sessions.map(s => ({ value: s, label: sessionLabel[s] }))}
            value={selectedSession}
            onChange={setSelectedSession}
            scrollable
          />
        </div>
      )}

      {/* Session Results Table */}
      {selectedRound && (
        <div className="card-f1 p-0 overflow-hidden mb-8">
          <div className="p-4 border-b border-f1-neutral-800 flex items-center gap-2">
            <span className={`w-1 h-5 flex-shrink-0 ${selectedSession === 'sprint' || selectedSession === 'sprint_qualifying' ? 'bg-f1-teal-400' : 'bg-f1-pink-500'}`} />
            <h2 className="text-lg font-bold">
              {getSelectedRace()?.race_name} — {sessionLabel[selectedSession]}
            </h2>
          </div>

          {loadingSession ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-f1-pink-500 mx-auto" />
              <p className="mt-2 text-f1-gray">Loading results...</p>
            </div>
          ) : sessionResults.length === 0 ? (
            <div className="p-8 text-center text-f1-gray">No results available for this session</div>
          ) : (
            <>
              {/* Desktop/tablet: full table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-f1-neutral-850">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-f1-gray uppercase">Pos</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-f1-gray uppercase">Driver</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-f1-gray uppercase">Team</th>
                      {isQualiSession ? (
                        <>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-f1-gray uppercase">{isSQSession ? 'SQ1' : 'Q1'}</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-f1-gray uppercase">{isSQSession ? 'SQ2' : 'Q2'}</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-f1-gray uppercase">{isSQSession ? 'SQ3' : 'Q3'}</th>
                        </>
                      ) : selectedSession === 'race' || selectedSession === 'sprint' ? (
                        <>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-f1-gray uppercase">Time</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-f1-gray uppercase">Pts</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-f1-gray uppercase">Status</th>
                        </>
                      ) : (
                        <>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-f1-gray uppercase">Time</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-f1-gray uppercase">Laps</th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-f1-neutral-800">
                    {sessionResults.map((result, index) => (
                      <tr key={index} className="hover:bg-f1-neutral-850/60 transition-colors">
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold ${getPositionColor(result.position)}`}>
                            {result.position}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className="text-f1-pink-500 font-bold">#{result.driverNumber}</span>
                            <span className="font-semibold">{result.driverName}</span>
                            <span className="text-xs text-f1-gray hidden sm:inline">({result.driverCode})</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-f1-gray text-sm">{result.team}</td>
                        {isQualiSession ? (
                          <>
                            <td className="px-4 py-3 font-mono text-sm">{result.q1 || '—'}</td>
                            <td className="px-4 py-3 font-mono text-sm">{result.q2 || '—'}</td>
                            <td className="px-4 py-3 font-mono text-sm text-f1-pink-500 font-bold">{result.q3 || '—'}</td>
                          </>
                        ) : selectedSession === 'race' || selectedSession === 'sprint' ? (
                          <>
                            <td className="px-4 py-3 font-mono text-sm">{result.time || '—'}</td>
                            <td className="px-4 py-3 font-bold">{result.points ?? '—'}</td>
                            <td className="px-4 py-3">
                              <span className={`text-xs px-2 py-1 rounded ${
                                result.status === 'Finished' ? 'bg-green-600/30 text-green-400' : 'bg-red-600/30 text-red-400'
                              }`}>
                                {result.status}
                              </span>
                            </td>
                          </>
                        ) : (
                          <>
                            <td className="px-4 py-3 font-mono text-sm">{result.time || 'No time'}</td>
                            <td className="px-4 py-3">{result.laps}</td>
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile: stacked cards, no horizontal scrolling */}
              <div className="md:hidden divide-y divide-f1-neutral-800">
                {sessionResults.map((result, index) => (
                  <div key={index} className="flex items-center gap-3 px-4 py-3">
                    <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold flex-shrink-0 ${getPositionColor(result.position)}`}>
                      {result.position}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-f1-pink-500 font-bold text-sm">#{result.driverNumber}</span>
                        <span className="font-semibold truncate">{result.driverName}</span>
                      </div>
                      <p className="text-xs text-f1-gray truncate">{result.team}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      {isQualiSession ? (
                        <p className="font-mono text-sm text-f1-pink-500 font-bold">{result.q3 || result.q2 || result.q1 || '—'}</p>
                      ) : selectedSession === 'race' || selectedSession === 'sprint' ? (
                        <>
                          <p className="font-bold text-sm">{result.points ?? '—'} pts</p>
                          <span className={`text-xs px-2 py-0.5 rounded ${
                            result.status === 'Finished' ? 'bg-green-600/30 text-green-400' : 'bg-red-600/30 text-red-400'
                          }`}>
                            {result.status}
                          </span>
                        </>
                      ) : (
                        <>
                          <p className="font-mono text-sm">{result.time || 'No time'}</p>
                          <p className="text-xs text-f1-gray">{result.laps} laps</p>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* Driver performance */}
      {funStats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">

          <StatCard emoji="🏆" title="Race Wins" isEmpty={funStats.wins.length === 0}>
            <div className="space-y-2">
              {funStats.wins.map((d) => (
                <DriverChip key={d.name} name={d.name} team={d.team}
                  count={d.count} suffix={`win${d.count !== 1 ? 's' : ''}`} />
              ))}
            </div>
          </StatCard>

          <StatCard emoji="⚡" title="Pole Positions" isEmpty={funStats.poles.length === 0}>
            <div className="space-y-2">
              {funStats.poles.map((d) => (
                <DriverChip key={d.name} name={d.name} team={d.team}
                  count={d.count} suffix={`pole${d.count !== 1 ? 's' : ''}`} />
              ))}
            </div>
          </StatCard>

          <StatCard emoji="⏱️" title="Fastest Qualifying Lap" isEmpty={!funStats.bestLap}>
            {funStats.bestLap && (() => {
              const tc = getTeamColor(funStats.bestLap!.team);
              return (
                <div>
                  <p className={`font-mono font-black text-3xl ${tc.text} mb-1`}>
                    {funStats.bestLap.lap_time}
                  </p>
                  <p className="font-bold text-white">{funStats.bestLap.name}</p>
                  <p className="text-xs text-f1-gray">{funStats.bestLap.team}</p>
                  <p className="text-xs text-f1-gray mt-1">
                    Round {funStats.bestLap.round} — {funStats.bestLap.race_name}
                  </p>
                </div>
              );
            })()}
          </StatCard>
        </div>
      )}

    </div>
  );
};

export default Stats;
