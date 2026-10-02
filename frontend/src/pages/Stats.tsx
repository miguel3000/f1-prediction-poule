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
import { useLang } from '../i18n/LanguageContext';

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
        <p className="text-xs text-white">{team}</p>
      </div>
      {suffix && <span className="text-xs text-white ml-auto flex-shrink-0">{suffix}</span>}
    </div>
  );
};

// ── Stat card wrapper ─────────────────────────────────────────────────────────
const StatCard = ({ emoji, title, children, isEmpty }: {
  emoji: string; title: string; children: React.ReactNode; isEmpty?: boolean;
}) => {
  const { t } = useLang();
  return (
  <div className="card-f1 p-0 overflow-hidden">
    <div className="px-4 py-3 bg-f1-neutral-850 border-b border-f1-neutral-800 flex items-center gap-2">
      <span className="text-lg">{emoji}</span>
      <h3 className="font-bold text-sm text-white uppercase tracking-widest">{title}</h3>
    </div>
    <div className="p-4">
      {isEmpty
        ? <p className="text-white text-sm text-center py-2">{t('stats.noData')}</p>
        : children}
    </div>
  </div>
  );
};

const Stats = () => {
  const { t } = useLang();
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
        const latest = mainRaces[mainRaces.length - 1];
        setSelectedRound(latest.round);
        // Weekend still in progress — land on FP1 instead of the (empty) Race tab
        if (latest.status === 'upcoming') {
          setSelectedSession('fp1');
        }
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

  // While the selected weekend is still in progress, keep the table fresh
  // without the loading spinner so practice standings update as laps are set.
  useEffect(() => {
    const race = races.find(r => r.round === selectedRound && r.race_type === 'main');
    if (selectedRound === null || race?.status !== 'upcoming') return;
    const timer = setInterval(() => {
      if (!document.hidden) fetchSessionResults(true);
    }, 20000);
    return () => clearInterval(timer);
  }, [races, selectedRound, selectedSession]);

  const fetchSessionResults = async (silent = false) => {
    if (selectedRound === null) return;
    if (!silent) setLoadingSession(true);
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
      // A silent refresh must never blank a table that already has rows.
      if (!silent || response.data.length > 0) setSessionResults(response.data);
    } catch {
      if (!silent) setSessionResults([]);
    } finally {
      if (!silent) setLoadingSession(false);
    }
  };

  const getSelectedRace = () => races.find(r => r.round === selectedRound && r.race_type === 'main');
  const hasSprintRound = (round: number) => races.some(r => r.round === round && r.race_type === 'sprint');

  const getPositionColor = (pos: number) => {
    if (pos === 1) return 'bg-yellow-500 text-black';
    if (pos === 2) return 'bg-f1-neutral-300 text-black';
    if (pos === 3) return 'bg-f1-yellow-500 text-black';
    return 'bg-f1-neutral-700 text-white';
  };

  const sessionLabel: Record<SessionType, string> = {
    fp1: 'FP1', fp2: 'FP2', fp3: 'FP3',
    qualifying: t('stats.session.qualifying'),
    sprint_qualifying: t('stats.session.sprint_qualifying'),
    sprint: t('stats.session.sprint'),
    race: t('stats.session.race'),
  };

  const isQualiSession = selectedSession === 'qualifying' || selectedSession === 'sprint_qualifying';
  const isSQSession = selectedSession === 'sprint_qualifying';

  if (loading) {
    return (
      <div className="text-center py-16">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-f1-yellow-500 mx-auto" />
        <p className="mt-4 text-white">{t('stats.loading')}</p>
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
      <h1 className="text-4xl md:text-display-xl font-bold mb-8 text-center text-f1-yellow-500">
        {t('stats.title', { year: 2026 })}
      </h1>

      {/* Season Summary */}
      {seasonStats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-10">
          <div className="bg-f1-blue p-4 text-center">
            <p className="text-3xl font-f1-badge font-black tabular-nums text-f1-yellow-400">{seasonStats.races.completed_races}</p>
            <p className="text-xs text-white/70 uppercase tracking-wider mt-1">{t('stats.racesCompleted')}</p>
          </div>
          <div className="bg-f1-blue p-4 text-center">
            <p className="text-3xl font-f1-badge font-black tabular-nums text-f1-yellow-400">{seasonStats.races.completed_sprints}</p>
            <p className="text-xs text-white/70 uppercase tracking-wider mt-1">{t('stats.sprintsCompleted')}</p>
          </div>
          <div className="bg-f1-blue p-4 text-center">
            <p className="text-3xl font-f1-badge font-black tabular-nums text-f1-yellow-400">{seasonStats.predictions.main_predictions}</p>
            <p className="text-xs text-white/70 uppercase tracking-wider mt-1">{t('stats.racePredictions')}</p>
          </div>
          <div className="bg-f1-blue p-4 text-center">
            <p className="text-3xl font-f1-badge font-black tabular-nums text-f1-yellow-400">{seasonStats.predictions.sprint_predictions}</p>
            <p className="text-xs text-white/70 uppercase tracking-wider mt-1">{t('stats.sprintPredictions')}</p>
          </div>
        </div>
      )}

      {/* ── Fun Stats Section ──────────────────────────────────────────────── */}
      <div className="mb-4 flex items-center gap-3">
        <div className="w-1 h-6 bg-f1-yellow-500 flex-shrink-0" />
        <div>
          <h2 className="text-xl font-bold text-white uppercase tracking-wide">{t('stats.highlights')}</h2>
          <p className="text-white text-xs">{t('stats.highlightsSub', { year: 2026 })}</p>
        </div>
      </div>
      {loadingFun ? (
        <div className="flex items-center gap-3 py-8 text-white">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-f1-yellow-500 flex-shrink-0" />
          <span>{t('stats.crunching')}</span>
        </div>
      ) : !funStats ? (
        <p className="text-white text-sm">{t('stats.unavailable')}</p>
      ) : (
        <>
          {/* Poule stats: prediction accuracy */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">

            <StatCard emoji="🔮" title={t('stats.crystalBall')}
              isEmpty={funStats.crystalBall.length === 0}>
              <div className="space-y-2">
                {funStats.crystalBall.map((u, i) => (
                  <div key={u.nickname} className="flex items-center gap-3 py-1">
                    <span className={`text-sm font-black w-6 text-center ${
                      i === 0 ? 'text-yellow-400' : i === 1 ? 'text-f1-neutral-300' : i === 2 ? 'text-f1-yellow-400' : 'text-white'
                    }`}>{i + 1}</span>
                    <span className="font-semibold text-white flex-1">{u.nickname}</span>
                    <span className="font-mono text-f1-yellow-500 font-black">
                      {t('stats.correct', { n: u.count ?? 0 })}
                    </span>
                  </div>
                ))}
              </div>
            </StatCard>

            <StatCard emoji="📈" title={t('stats.consistent')}
              isEmpty={funStats.consistency.length === 0}>
              <div className="space-y-2">
                {funStats.consistency.map((u, i) => (
                  <div key={u.nickname} className="flex items-center gap-3 py-1">
                    <span className={`text-sm font-black w-6 text-center ${
                      i === 0 ? 'text-yellow-400' : i === 1 ? 'text-f1-neutral-300' : i === 2 ? 'text-f1-yellow-400' : 'text-white'
                    }`}>{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-white">{u.nickname}</p>
                      <p className="text-xs text-white">{t('stats.consistentSub', { races: u.races ?? 0, best: u.best_race ?? 0 })}</p>
                    </div>
                    <span className="font-mono text-green-400 font-black">
                      {t('stats.avg', { n: u.avg_points ?? 0 })}
                    </span>
                  </div>
                ))}
              </div>
            </StatCard>
          </div>

          {/* Poule stats: fan favorite & biggest upset */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <StatCard emoji="❤️" title={t('stats.fanFavorite')}
              isEmpty={funStats.predictedWinners.length === 0}>
              <div className="space-y-2">
                {funStats.predictedWinners.slice(0, 3).map((d) => (
                  <DriverChip key={d.name} name={d.name} team={d.team}
                    count={d.count} suffix={t('stats.picks')} />
                ))}
                {funStats.predictedWinners.length === 0 && (
                  <p className="text-white text-sm text-center">{t('stats.noPredictionsYet')}</p>
                )}
              </div>
            </StatCard>

            <StatCard emoji="😱" title={t('stats.biggestUpset')} isEmpty={!funStats.biggestUpset}>
              {funStats.biggestUpset && (() => {
                const upset = funStats.biggestUpset!;
                const tc = getTeamColor(upset.winner_team);
                return (
                  <div>
                    <p className="text-white font-bold mb-1">{upset.race_name}</p>
                    <div className={`flex items-center gap-2 my-2 border-l-4 px-3 py-2 bg-f1-neutral-850 ${tc.border}`}>
                      <span className={`font-black text-lg ${tc.text}`}>{upset.winner_acronym}</span>
                      <span className="text-white text-sm">{t('stats.won', { name: upset.winner_name })}</span>
                    </div>
                    <p className="text-white text-sm">
                      {t('stats.upsetPre')}{' '}
                      <span className="text-f1-yellow-500 font-bold">{upset.correct}</span>
                      {' '}{t('stats.upsetOf')}{' '}
                      <span className="font-bold text-white">{upset.total}</span>
                      {' '}{t('stats.upsetPost')}
                      {' '}{t('stats.upsetAccuracy', { pct: Number(upset.accuracy_pct).toFixed(1) })}
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
        <label className="block text-xs font-bold text-white uppercase tracking-wider mb-2">{t('stats.selectRace')}</label>
        <select
          value={selectedRound || ''}
          onChange={(e) => setSelectedRound(parseInt(e.target.value))}
          className="input-f1 w-full"
        >
          {uniqueRounds.map(round => {
            const race = races.find(r => r.round === round && r.race_type === 'main');
            return (
              <option key={round} value={round}>
                {t('stats.roundOption', { round, name: race?.race_name ?? '' })}
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
            <span className={`w-1 h-5 flex-shrink-0 ${selectedSession === 'sprint' || selectedSession === 'sprint_qualifying' ? 'bg-f1-blue' : 'bg-f1-yellow-500'}`} />
            <h2 className="text-lg font-bold">
              {getSelectedRace()?.race_name} — {sessionLabel[selectedSession]}
            </h2>
          </div>

          {loadingSession ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-f1-yellow-500 mx-auto" />
              <p className="mt-2 text-white">{t('stats.loadingResults')}</p>
            </div>
          ) : sessionResults.length === 0 ? (
            <div className="p-8 text-center text-white">{t('stats.noResults')}</div>
          ) : (
            <>
              {/* Desktop/tablet: full table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-f1-neutral-850">
                    <tr>
                      <th className="px-0 py-3 text-left text-xs font-semibold text-white uppercase">{t('stats.colDriver')}</th>
                      {isQualiSession ? (
                        <>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase">{isSQSession ? 'SQ1' : 'Q1'}</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase">{isSQSession ? 'SQ2' : 'Q2'}</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase">{isSQSession ? 'SQ3' : 'Q3'}</th>
                        </>
                      ) : selectedSession === 'race' || selectedSession === 'sprint' ? (
                        <>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase">{t('stats.colTime')}</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase">{t('stats.colPts')}</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase">{t('stats.colStatus')}</th>
                        </>
                      ) : (
                        <>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase">{t('stats.colTime')}</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase">{t('stats.colLaps')}</th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-f1-neutral-800">
                    {sessionResults.map((result, index) => (
                      <tr key={index}>
                        <td className="p-0">
                          <div className="flex items-stretch">
                            <span className={`w-12 shrink-0 flex items-center justify-center font-f1-badge font-bold text-lg ${getPositionColor(result.position)}`}>
                              {result.position}
                            </span>
                            <div className="flex-1 min-w-0 bg-f1-blue flex flex-col justify-center px-3 py-2">
                              <span className="font-f1-badge text-f1-yellow-400 text-[10px]">#{result.driverNumber}</span>
                              <p className="font-f1 font-bold text-white text-base sm:text-lg uppercase tracking-wide leading-tight truncate">
                                {result.driverName}
                              </p>
                              <p className="text-[10px] text-white/70 uppercase tracking-wide truncate">{result.team}</p>
                            </div>
                          </div>
                        </td>
                        {isQualiSession ? (
                          <>
                            <td className="px-4 py-3 font-mono text-sm">{result.q1 || '—'}</td>
                            <td className="px-4 py-3 font-mono text-sm">{result.q2 || '—'}</td>
                            <td className="px-4 py-3 font-mono text-sm text-f1-yellow-500 font-bold">{result.q3 || '—'}</td>
                          </>
                        ) : selectedSession === 'race' || selectedSession === 'sprint' ? (
                          <>
                            <td className="px-4 py-3 font-mono text-sm">{result.time || '—'}</td>
                            <td className="px-4 py-3 font-bold">{result.points ?? '—'}</td>
                            <td className="px-4 py-3">
                              <span className={`text-xs px-2 py-1 ${
                                result.status === 'Finished' ? 'bg-green-600/30 text-green-400' : 'bg-red-600/30 text-red-400'
                              }`}>
                                {result.status}
                              </span>
                            </td>
                          </>
                        ) : (
                          <>
                            <td className="px-4 py-3 font-mono text-sm">{result.time || t('stats.noTime')}</td>
                            <td className="px-4 py-3">{result.laps}</td>
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile: stacked cards, no horizontal scrolling */}
              <div className="md:hidden space-y-2 p-2">
                {sessionResults.map((result, index) => (
                  <div key={index} className="flex items-stretch">
                    <span className={`w-12 shrink-0 flex items-center justify-center font-f1-badge font-bold text-lg ${getPositionColor(result.position)}`}>
                      {result.position}
                    </span>
                    <div className="flex-1 min-w-0 bg-f1-blue flex items-center justify-between gap-3 px-3 py-2">
                      <div className="min-w-0">
                        <span className="font-f1-badge text-f1-yellow-400 text-[10px]">#{result.driverNumber}</span>
                        <p className="font-f1 font-bold text-white text-lg uppercase tracking-wide leading-tight truncate">
                          {result.driverName}
                        </p>
                        <p className="text-[10px] text-white/70 uppercase tracking-wide truncate">{result.team}</p>
                      </div>
                      <div className="text-right shrink-0">
                        {isQualiSession ? (
                          <p className="font-mono text-sm text-f1-yellow-400 font-bold">{result.q3 || result.q2 || result.q1 || '—'}</p>
                        ) : selectedSession === 'race' || selectedSession === 'sprint' ? (
                          <>
                            <p className="font-bold text-sm text-white">{result.points ?? '—'} {t('races.pts')}</p>
                            <span className={`text-xs px-2 py-0.5 ${
                              result.status === 'Finished' ? 'bg-green-600/30 text-green-300' : 'bg-red-600/30 text-red-300'
                            }`}>
                              {result.status}
                            </span>
                          </>
                        ) : (
                          <>
                            <p className="font-mono text-sm text-white">{result.time || t('stats.noTime')}</p>
                            <p className="text-[10px] text-white/70">{t('stats.laps', { n: result.laps ?? 0 })}</p>
                          </>
                        )}
                      </div>
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

          <StatCard emoji="🏆" title={t('stats.raceWins')} isEmpty={funStats.wins.length === 0}>
            <div className="space-y-2">
              {funStats.wins.map((d) => (
                <DriverChip key={d.name} name={d.name} team={d.team}
                  count={d.count} suffix={d.count !== 1 ? t('stats.wins') : t('stats.win')} />
              ))}
            </div>
          </StatCard>

          <StatCard emoji="⚡" title={t('stats.polePositions')} isEmpty={funStats.poles.length === 0}>
            <div className="space-y-2">
              {funStats.poles.map((d) => (
                <DriverChip key={d.name} name={d.name} team={d.team}
                  count={d.count} suffix={d.count !== 1 ? t('stats.poles') : t('stats.pole')} />
              ))}
            </div>
          </StatCard>

          <StatCard emoji="⏱️" title={t('stats.fastestQuali')} isEmpty={!funStats.bestLap}>
            {funStats.bestLap && (() => {
              const tc = getTeamColor(funStats.bestLap!.team);
              return (
                <div>
                  <p className={`font-mono font-black text-3xl ${tc.text} mb-1`}>
                    {funStats.bestLap.lap_time}
                  </p>
                  <p className="font-bold text-white">{funStats.bestLap.name}</p>
                  <p className="text-xs text-white">{funStats.bestLap.team}</p>
                  <p className="text-xs text-white mt-1">
                    {t('stats.roundRace', { round: funStats.bestLap.round, name: funStats.bestLap.race_name })}
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
