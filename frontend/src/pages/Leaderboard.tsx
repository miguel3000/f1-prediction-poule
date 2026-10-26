import { useState, useEffect, useContext } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { getLeaderboard, getSeasonHistory, getPlayerStats, getMyGroups } from '../services/api';
import { useLang } from '../i18n/LanguageContext';
import { ordinal } from '../i18n/format';
import { AuthContext } from '../context/AuthContext';
import ShareButton from '../components/ShareButton';
import PouleSelector, { PouleOption } from '../components/PouleSelector';
import PoulePredictions from '../components/PoulePredictions';
import SeasonReplay from '../components/progress/SeasonReplay';
import type { SeasonRace, SeasonUser } from '../components/progress/types';

interface LeaderboardEntry {
  id: number;
  nickname: string;
  avatar_url?: string;
  total_points: number;
  rank: number;
  last_race_points: number;
  last_race_rank: number | null;
  best_race_points: number;
  best_race_name: string | null;
  diff_to_leader: number;
}

interface PlayerStat {
  id: number;
  nickname: string;
  total_points: number;
  predictions_made: number;
  avg_points_per_race: number;
  accuracy_pct: number;
  exact_picks: number;
  current_streak: number;
  best_race: { name: string; points: number } | null;
}

const getRankColor = (rank: number) => {
  if (rank === 1) return 'bg-yellow-500 text-black';
  if (rank === 2) return 'bg-gray-300 text-black';
  if (rank === 3) return 'bg-f1-yellow-500 text-black';
  return 'bg-gray-700 text-white';
};

const Leaderboard = () => {
  const { t, lang } = useLang();
  const { user } = useContext(AuthContext);
  const [searchParams, setSearchParams] = useSearchParams();
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [seasonRaces, setSeasonRaces] = useState<SeasonRace[]>([]);
  const [seasonUsers, setSeasonUsers] = useState<SeasonUser[]>([]);
  const [playerStats, setPlayerStats] = useState<PlayerStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);

  // The poules this player can look at: the main poule (unless they play only in groups), then
  // their groups by name. null while loading; `failed` falls back to the server's default poule.
  const [poules, setPoules] = useState<PouleOption[] | null>(null);
  const [poulesFailed, setPoulesFailed] = useState(false);
  useEffect(() => {
    getMyGroups()
      .then((res) => {
        const options: PouleOption[] = res.data.groups.map((g) => ({ id: String(g.id), label: g.name }));
        if (res.data.playsInMain) options.unshift({ id: 'main', label: t('groups.mainPoule') });
        setPoules(options);
      })
      .catch(() => {
        setPoulesFailed(true);
        setPoules([]);
      });
    // the main poule's label is translated below, so a language switch does not need a reload
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const pouleOptions = (poules ?? []).map((p) => (p.id === 'main' ? { ...p, label: t('groups.mainPoule') } : p));

  const requested = searchParams.get('poule');
  const selected = requested ?? pouleOptions[0]?.id;
  const noPoule = poules !== null && !poulesFailed && pouleOptions.length === 0;
  const badPoule = poules !== null && !poulesFailed && !noPoule && !pouleOptions.some((p) => p.id === selected);
  const ready = poules !== null && !noPoule && !badPoule;
  // Without a usable list the server decides (it answers with the default poule).
  const pouleParam = poulesFailed ? undefined : selected;

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    setLoading(true);
    setHistoryLoading(true);
    setStatsLoading(true);
    getLeaderboard(pouleParam)
      .then((res) => { if (!cancelled) setLeaderboard(res.data); })
      .catch((error) => { if (!cancelled) { setLeaderboard([]); console.error('Failed to fetch leaderboard:', error); } })
      .finally(() => { if (!cancelled) setLoading(false); });
    getSeasonHistory(pouleParam)
      .then((res) => { if (!cancelled) { setSeasonRaces(res.data.races); setSeasonUsers(res.data.users); } })
      .catch((error) => { if (!cancelled) { setSeasonRaces([]); setSeasonUsers([]); console.error('Failed to fetch season history:', error); } })
      .finally(() => { if (!cancelled) setHistoryLoading(false); });
    getPlayerStats(pouleParam)
      .then((res) => { if (!cancelled) setPlayerStats(res.data); })
      .catch((error) => { if (!cancelled) { setPlayerStats([]); console.error('Failed to fetch player stats:', error); } })
      .finally(() => { if (!cancelled) setStatsLoading(false); });
    return () => { cancelled = true; };
  }, [ready, pouleParam]);

  if (poules === null) {
    return (
      <div className="text-center py-16">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-f1-yellow-500 mx-auto"></div>
        <p className="mt-4 text-white">{t('lb.loading')}</p>
      </div>
    );
  }

  const selectedLabel = pouleOptions.find((p) => p.id === selected)?.label;

  return (
    <div>
      <h1 className="text-4xl md:text-display-xl font-bold mb-4 text-center text-f1-yellow-500">{t('lb.title')}</h1>
      <div className="flex justify-center mb-8">
        <ShareButton />
      </div>

      {pouleOptions.length > 1 && selected && (
        <div className="max-w-5xl mx-auto mb-8">
          <PouleSelector
            poules={pouleOptions}
            value={selected}
            onChange={(id) => setSearchParams({ poule: id })}
            label={t('groups.selector.label')}
          />
        </div>
      )}
      {pouleOptions.length === 1 && selectedLabel && (
        <p className="text-center text-white/80 text-sm uppercase tracking-wider -mt-4 mb-8 break-words">
          {t('groups.standingsFor', { poule: selectedLabel })}
        </p>
      )}

      {noPoule && (
        <div className="max-w-3xl mx-auto card-f1 p-8 text-center">
          <h2 className="text-xl font-bold text-f1-yellow-500 mb-3">{t('groups.noPoule.title')}</h2>
          <p className="text-white mb-6">{t('groups.noPoule.text')}</p>
          <Link to="/profile" className="btn-f1-primary inline-block">{t('groups.noPoule.profile')}</Link>
        </div>
      )}

      {badPoule && (
        <div className="max-w-3xl mx-auto card-f1 p-8 text-center">
          <p className="text-white mb-6">{t('groups.badPoule')}</p>
          <Link to="/leaderboard" className="btn-f1-primary inline-block">{t('groups.badPoule.back')}</Link>
        </div>
      )}

      {ready && (
        <>
      {/* Season Points Chart */}
      <div className="max-w-5xl mx-auto mb-10">
        <h2 className="text-2xl font-bold mb-6 racing-stripe pl-6">{t('lb.progression')}</h2>

        {historyLoading ? (
          <div className="bg-gray-900 p-8 flex items-center justify-center">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-f1-yellow-500"></div>
          </div>
        ) : seasonRaces.length === 0 ? (
          <div className="bg-gray-900 p-8 text-center text-white">
            {t('lb.afterFirstRace')}
          </div>
        ) : (
          <div className="max-w-3xl">
            <p className="text-sm text-white/80 mb-3">{t('lb.replay.hint')}</p>
            <SeasonReplay key={selected} races={seasonRaces} users={seasonUsers} meId={user?.id} />
          </div>
        )}
      </div>

      {/* Full Leaderboard Table */}
      <div className="max-w-5xl mx-auto">
        <h2 className="text-2xl font-bold mb-6 racing-stripe pl-6">{t('lb.fullStandings')}</h2>

        {loading ? (
          <div className="bg-gray-900 p-8 flex items-center justify-center">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-f1-yellow-500"></div>
          </div>
        ) : leaderboard.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-white text-lg">{t('lb.noUsers')}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {leaderboard.map((entry) => (
              <div key={entry.id} className="flex items-stretch">
                {/* Rank badge — flat square, podium colors only */}
                <div
                  className={`w-14 shrink-0 flex items-center justify-center font-f1-badge font-bold text-2xl ${getRankColor(
                    Number(entry.rank)
                  )}`}
                >
                  {entry.rank}
                </div>

                {/* Name bar — big blue block, nickname as large as possible */}
                <div className="flex-1 min-w-0 bg-f1-blue flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0 flex items-center gap-3">
                    {entry.avatar_url ? (
                      <img
                        src={entry.avatar_url}
                        alt={entry.nickname}
                        className="w-9 h-9 shrink-0 object-cover"
                      />
                    ) : (
                      <div className="w-9 h-9 shrink-0 bg-f1-blue-dark flex items-center justify-center text-sm">
                        👤
                      </div>
                    )}
                    <div className="min-w-0">
                      <h3 className="font-f1 font-bold text-white text-xl sm:text-2xl uppercase tracking-wide leading-tight truncate">
                        {entry.nickname}
                      </h3>
                      <div className="flex flex-wrap items-center gap-x-3 text-xs text-white/70">
                        <span>
                          {t('lb.last', { pts: entry.last_race_points })}
                          {entry.last_race_rank && ` (${ordinal(entry.last_race_rank, lang)})`}
                        </span>
                        {entry.best_race_name && (
                          <span className="hidden md:inline">
                            {t('lb.best', { pts: entry.best_race_points, name: entry.best_race_name })}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <p className="text-2xl sm:text-3xl font-f1-badge font-bold text-f1-yellow-400">{entry.total_points}</p>
                    <p className="text-[10px] text-white/70 uppercase tracking-widest">
                      {Number(entry.rank) === 1 ? t('lb.leader') : `-${entry.diff_to_leader}`}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <PoulePredictions poule={pouleParam} meId={user?.id} />

      {/* Player Stats — deeper per-player breakdown beyond the totals column above */}
      <div className="max-w-5xl mx-auto mt-10">
        <h2 className="text-2xl font-bold mb-6 racing-stripe pl-6">{t('lb.playerStats')}</h2>

        {statsLoading ? (
          <div className="bg-gray-900 p-8 flex items-center justify-center">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-f1-yellow-500"></div>
          </div>
        ) : playerStats.length === 0 ? (
          <div className="card-f1 p-8 text-center text-white">
            {t('lb.statsAfterFirstRace')}
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {playerStats.map((stat) => (
              <div key={stat.id} className="card-f1">
                <div className="-mx-6 -mt-6 mb-4 bg-f1-blue px-4 py-3">
                  <h3 className="font-f1 font-bold text-white text-lg uppercase tracking-wide truncate">
                    {stat.nickname}
                  </h3>
                  {stat.best_race && (
                    <p className="text-xs text-white/70 truncate">
                      {t('lb.bestRacePre')} <span className="font-bold text-white">{stat.best_race.points} {t('races.pts')}</span> ({stat.best_race.name})
                    </p>
                  )}
                </div>

                {stat.predictions_made === 0 ? (
                  <p className="text-white text-sm">{t('lb.noPredictions')}</p>
                ) : (
                  <div className="grid grid-cols-4 gap-2 text-center">
                    <div className="bg-f1-neutral-800 p-2">
                      <p className="text-xl font-f1-badge font-bold text-f1-yellow-400">{stat.avg_points_per_race}</p>
                      <p className="text-[9px] text-white uppercase tracking-wider mt-1">{t('lb.avgRace')}</p>
                    </div>
                    <div className="bg-f1-neutral-800 p-2">
                      <p className="text-xl font-f1-badge font-bold text-f1-blue">{stat.accuracy_pct}</p>
                      <p className="text-[9px] text-white uppercase tracking-wider mt-1">{t('lb.accuracy')}</p>
                    </div>
                    <div className="bg-f1-neutral-800 p-2">
                      <p className="text-xl font-f1-badge font-bold text-f1-yellow-400">{stat.exact_picks}</p>
                      <p className="text-[9px] text-white uppercase tracking-wider mt-1">{t('lb.exact')}</p>
                    </div>
                    <div className="bg-f1-neutral-800 p-2">
                      <p className="text-xl font-f1-badge font-bold text-f1-blue">{stat.current_streak}</p>
                      <p className="text-[9px] text-white uppercase tracking-wider mt-1">{t('lb.streak')}</p>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
        </>
      )}
    </div>
  );
};

export default Leaderboard;
