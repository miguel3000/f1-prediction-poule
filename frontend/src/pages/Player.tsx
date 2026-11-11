import { useContext, useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { useSeason } from '../context/SeasonContext';
import { useLang } from '../i18n/LanguageContext';
import { ordinal } from '../i18n/format';
import {
  getPlayerPredictions,
  getLeaderboard,
  PlayerPageData,
  PlayerRace,
  PlayerDriver,
  PlayerFinished,
  PickHit,
} from '../services/api';

// One player's predictions against the real results, built for a phone first. Every pick arrives
// already marked exact / one place off / miss by the server (the rule that scores it); this page
// only draws. Colours: green exact, our yellow one place off, dark grey a miss.
const HIT_CLASS: Record<PickHit | 'none', string> = {
  exact: 'bg-green-800 text-green-100',
  near: 'bg-f1-yellow-500 text-black',
  miss: 'bg-f1-neutral-800 text-f1-neutral-400',
  none: 'bg-f1-blue-dark text-white',
};

const shortName = (driver: PlayerDriver | null): string => {
  if (!driver) return '–';
  if (driver.name_acronym) return driver.name_acronym;
  const last = driver.name.split(' ').pop() ?? driver.name;
  return last.slice(0, 3).toUpperCase();
};

// Where a driver really finished, as a short label under the pick: P4, DNF, DNS, DSQ.
const finishedLabel = (finished: PlayerFinished | null): string => {
  if (!finished) return '';
  if (finished.status === 'dnf') return 'DNF';
  if (finished.status === 'dns') return 'DNS';
  if (finished.status === 'dsq') return 'DSQ';
  return `P${finished.position}`;
};

type CompareMode = 'me' | 'nobody' | number;

interface Member { id: number; nickname: string }

const Cell = ({ driver, hit, finished, title }: { driver: PlayerDriver | null; hit: PickHit | null; finished: PlayerFinished | null; title?: string }) => (
  <div
    className={`h-[42px] flex flex-col items-center justify-center leading-none ${HIT_CLASS[hit ?? 'none']}`}
    title={title ?? driver?.name}
  >
    <span className="text-sm font-black tracking-wide">{shortName(driver)}</span>
    <span className="text-[9px] font-bold opacity-75 mt-0.5">{finishedLabel(finished)}</span>
  </div>
);

const Empty = ({ title }: { title: string }) => (
  <div className="h-[42px] flex items-center justify-center bg-f1-neutral-800 text-f1-neutral-400 text-sm" title={title}>–</div>
);

interface RaceCardProps {
  race: PlayerRace;
  compare: PlayerRace | null | undefined; // undefined: not comparing; null: the other player has no pick here
  playerName: string;
  compareName: string;
  open: boolean;
  onToggle: () => void;
}

const RaceCard = ({ race, compare, playerName, compareName, open, onToggle }: RaceCardProps) => {
  const { t } = useLang();
  const { prediction, result } = race;
  const isSprint = race.race.race_type === 'sprint';
  const comparing = compare !== undefined;
  const columns = `2rem repeat(${comparing ? 3 : 2}, minmax(0, 1fr))`;
  const dnf = prediction.dnf_pick;
  const cmpDnf = compare?.prediction.dnf_pick ?? null;

  return (
    <div className="bg-f1-neutral-900 mb-1.5">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="w-full min-h-[44px] flex items-center justify-between gap-3 px-3 pt-3 pb-2 text-left"
      >
        <span className="min-w-0 flex items-center gap-2">
          <span className="text-xs font-bold text-f1-neutral-400">R{race.race.round}</span>
          <span className="font-bold text-white truncate">{race.race.race_name.replace(/ Grand Prix$/, '').replace(/ Sprint$/, '')}</span>
          {isSprint && (
            <span className="shrink-0 bg-f1-blue-dark text-white text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5">
              {t('pl.sprint')}
            </span>
          )}
        </span>
        <span className="shrink-0 flex items-center gap-2">
          <span className="text-base font-f1-badge font-bold text-f1-yellow-400">{prediction.points ?? '–'}</span>
          <span className="text-xs text-f1-neutral-400" aria-hidden="true">{open ? '▾' : '▸'}</span>
        </span>
      </button>

      {!open ? (
        <div className="px-3 pb-3 flex gap-[3px]" aria-hidden="true">
          {prediction.picks.map((p) => (
            <span key={p.position} className={`flex-1 h-[26px] ${HIT_CLASS[p.hit ?? 'none']}`} />
          ))}
          {dnf && <span className={`flex-1 h-[26px] ml-1.5 ${HIT_CLASS[dnf.hit === null ? 'none' : dnf.hit ? 'exact' : 'miss']}`} />}
        </div>
      ) : (
        <div className="px-3 pb-3">
          {!result && <p className="text-xs text-f1-neutral-400 mb-2">{t('pl.waiting')}</p>}
          <div className="grid gap-1 mb-1 text-[10px] font-bold uppercase tracking-wider text-f1-neutral-400 text-center" style={{ gridTemplateColumns: columns }}>
            <span />
            <span>{t('pl.result')}</span>
            <span className="text-f1-yellow-400 truncate">{playerName}</span>
            {comparing && <span className="text-f1-yellow-400 truncate">{compareName}</span>}
          </div>
          <div className="space-y-1">
            {prediction.picks.map((pick, i) => {
              const other = compare?.prediction.picks[i];
              const top = result?.top[i]?.driver ?? null;
              return (
                <div key={pick.position} className="grid gap-1 items-center" style={{ gridTemplateColumns: columns }}>
                  <span className="text-[11px] font-bold text-f1-neutral-400">P{pick.position}</span>
                  <div className="h-[42px] flex items-center justify-center bg-f1-blue-dark text-white text-sm font-black tracking-wide" title={top?.name}>
                    {result ? shortName(top) : '–'}
                  </div>
                  <Cell driver={pick.driver} hit={pick.hit} finished={pick.finished} />
                  {comparing &&
                    (other ? <Cell driver={other.driver} hit={other.hit} finished={other.finished} /> : <Empty title={t('pl.noCompare')} />)}
                </div>
              );
            })}
            {!isSprint && (
              <div className="grid gap-1 items-center pt-2" style={{ gridTemplateColumns: columns }}>
                <span className="text-[9px] font-bold leading-tight text-f1-neutral-400 uppercase">{t('pl.firstOut')}</span>
                <div className="h-[42px] flex items-center justify-center bg-f1-blue-dark text-white text-sm font-black tracking-wide" title={result?.first_out?.name}>
                  {result ? shortName(result.first_out) : '–'}
                </div>
                {dnf ? (
                  <Cell driver={dnf.driver} hit={dnf.hit === null ? null : dnf.hit ? 'exact' : 'miss'} finished={dnf.finished} />
                ) : (
                  <Empty title={t('pl.noCompare')} />
                )}
                {comparing &&
                  (cmpDnf ? (
                    <Cell driver={cmpDnf.driver} hit={cmpDnf.hit === null ? null : cmpDnf.hit ? 'exact' : 'miss'} finished={cmpDnf.finished} />
                  ) : (
                    <Empty title={t('pl.noCompare')} />
                  ))}
              </div>
            )}
            <div className="grid gap-1 items-center pt-2" style={{ gridTemplateColumns: columns }}>
              <span className="text-[9px] font-bold text-f1-neutral-400 uppercase">{t('pl.pts')}</span>
              <span />
              <span className="text-center text-lg font-f1-badge font-bold text-f1-yellow-400">{prediction.points ?? '–'}</span>
              {comparing && (
                <span className="text-center text-lg font-f1-badge font-bold text-f1-yellow-400">{compare?.prediction.points ?? '–'}</span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const Player = () => {
  const { id } = useParams();
  const { user } = useContext(AuthContext);
  const { t, tError, lang } = useLang();
  const { season, ready } = useSeason();
  const [searchParams] = useSearchParams();
  const poule = searchParams.get('poule') ?? undefined;
  const playerId = Number(id);
  const isMe = user?.id === playerId;

  const [page, setPage] = useState<PlayerPageData | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<CompareMode>(isMe ? 'nobody' : 'me');
  const [other, setOther] = useState<PlayerPageData | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [open, setOpen] = useState<Set<number>>(new Set());

  // Looking at a different player: start again from the default comparison
  useEffect(() => {
    setMode(user?.id === playerId ? 'nobody' : 'me');
  }, [playerId, user?.id]);

  useEffect(() => {
    if (!ready || !Number.isInteger(playerId)) return;
    let cancelled = false;
    setLoading(true);
    setError('');
    getPlayerPredictions(playerId, poule, season)
      .then((res) => {
        if (cancelled) return;
        setPage(res.data);
        // the newest race is open to begin with
        if (res.data.races[0]) setOpen(new Set([res.data.races[0].race.id]));
      })
      .catch((err) => {
        if (cancelled) return;
        setPage(null);
        setError(tError(err?.response?.data?.error, 'pl.loadFailed'));
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playerId, poule, season, ready]);

  // Who the viewed player can be compared with: everyone in the poule
  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    getLeaderboard(poule, season)
      .then((res) => { if (!cancelled) setMembers((res.data as Member[]).map((m) => ({ id: m.id, nickname: m.nickname }))); })
      .catch(() => { if (!cancelled) setMembers([]); });
    return () => { cancelled = true; };
  }, [poule, season, ready]);

  const compareId = mode === 'me' ? (isMe ? null : user?.id ?? null) : mode === 'nobody' ? null : mode;
  useEffect(() => {
    if (!ready || compareId === null) {
      setOther(null);
      return;
    }
    let cancelled = false;
    getPlayerPredictions(compareId, poule, season)
      .then((res) => { if (!cancelled) setOther(res.data); })
      .catch(() => { if (!cancelled) setOther(null); });
    return () => { cancelled = true; };
  }, [compareId, poule, season, ready]);

  const backTo = `/leaderboard${poule ? `?poule=${encodeURIComponent(poule)}` : ''}`;
  const toggle = (raceId: number) =>
    setOpen((current) => {
      const next = new Set(current);
      if (next.has(raceId)) next.delete(raceId);
      else next.add(raceId);
      return next;
    });

  if (loading) {
    return (
      <div className="text-center py-16">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-f1-yellow-500 mx-auto" />
        <p className="mt-4 text-white">{t('common.loading')}</p>
      </div>
    );
  }

  if (!page) {
    return (
      <div className="max-w-xl mx-auto">
        <Link to={backTo} className="text-sm text-f1-neutral-400 hover:text-white">‹ {t('pl.back')}</Link>
        <div className="card-f1 p-6 mt-4 text-center text-white" role="alert">{error || t('pl.loadFailed')}</div>
      </div>
    );
  }

  const { player, stats } = page;
  const comparing = other !== null && compareId !== null;
  const compareName = !comparing ? '' : compareId === user?.id ? t('pl.you') : other.player.nickname;
  const otherRaces = new Map((other?.races ?? []).map((r) => [r.race.id, r]));
  const segment = (active: boolean) =>
    `min-h-[40px] px-4 text-xs font-bold ${active ? 'bg-f1-yellow-500 text-black' : 'bg-f1-neutral-800 text-white hover:brightness-125'}`;
  const tile = (big: string | number, label: string) => (
    <div className="flex-1 bg-f1-neutral-900 py-2.5 px-2 text-center">
      <p className="text-2xl font-f1-badge font-bold text-f1-yellow-400 leading-none">{big}</p>
      <p className="text-[9px] font-bold uppercase tracking-wider text-f1-neutral-400 mt-1.5">{label}</p>
    </div>
  );
  const legend = (hit: PickHit, label: string) => (
    <span className="inline-flex items-center gap-1.5 mr-3">
      <span className={`inline-block w-3 h-3 ${HIT_CLASS[hit]}`} />{label}
    </span>
  );

  return (
    <div className="max-w-xl mx-auto">
      <Link to={backTo} className="inline-block text-sm text-f1-neutral-400 hover:text-white mb-3">‹ {t('pl.back')}</Link>

      <div className="flex items-center gap-3 mb-4">
        {player.avatar_url ? (
          <img src={player.avatar_url} alt={player.nickname} className="w-14 h-14 shrink-0 object-cover border border-f1-neutral-700" />
        ) : (
          <div className="w-14 h-14 shrink-0 bg-f1-neutral-850 border border-f1-neutral-700 flex items-center justify-center text-2xl font-black text-white">
            {player.nickname.charAt(0).toUpperCase()}
          </div>
        )}
        <div className="min-w-0">
          <h1 className="text-2xl font-black text-white leading-tight truncate">{player.nickname}</h1>
          <p className="text-sm text-white/70">
            {t('pl.rankOf', { rank: ordinal(player.rank, lang), n: page.poule_size })} ·{' '}
            <span className="font-bold text-f1-yellow-400">{player.total_points} {t('common.points')}</span>
          </p>
        </div>
      </div>

      <div className="flex gap-1.5 mb-4">
        {tile(stats.exact, t('pl.statExact'))}
        {tile(stats.near, t('pl.statNear'))}
        {tile(`${stats.first_retirement_right}/${stats.first_retirement_races}`, t('pl.statFirstOut'))}
      </div>

      {page.races.length === 0 ? (
        <div className="card-f1 p-6 text-center text-white">{t('pl.noRaces', { name: player.nickname })}</div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <span className="text-[11px] font-bold uppercase tracking-wider text-f1-neutral-400">{t('pl.compare')}</span>
            <div className="flex gap-px">
              {!isMe && (
                <button type="button" className={segment(mode === 'me')} aria-pressed={mode === 'me'} onClick={() => setMode('me')}>
                  {t('pl.compareMe')}
                </button>
              )}
              <button type="button" className={segment(mode === 'nobody')} aria-pressed={mode === 'nobody'} onClick={() => setMode('nobody')}>
                {t('pl.compareNobody')}
              </button>
              <select
                aria-label={t('pl.comparePlayer')}
                value={typeof mode === 'number' ? mode : ''}
                onChange={(e) => (e.target.value ? setMode(Number(e.target.value)) : undefined)}
                className={`${segment(typeof mode === 'number')} appearance-none`}
              >
                <option value="">{t('pl.comparePlayer')} ▾</option>
                {members
                  .filter((m) => m.id !== playerId)
                  .map((m) => (
                    <option key={m.id} value={m.id}>{m.nickname}</option>
                  ))}
              </select>
            </div>
          </div>

          {page.races.map((race, index) => (
            <div key={race.race.id}>
              {index === 1 && (
                <p className="text-[10px] font-bold uppercase tracking-wider text-f1-neutral-400 mt-5 mb-1.5">{t('pl.earlier')}</p>
              )}
              <RaceCard
                race={race}
                compare={comparing ? otherRaces.get(race.race.id) ?? null : undefined}
                playerName={player.nickname.toUpperCase().slice(0, 11)}
                compareName={compareName.toUpperCase().slice(0, 11)}
                open={open.has(race.race.id)}
                onToggle={() => toggle(race.race.id)}
              />
            </div>
          ))}

          <p className="text-[11px] text-white/70 mt-3">
            {legend('exact', t('pl.legendExact'))}{legend('near', t('pl.legendNear'))}{legend('miss', t('pl.legendMiss'))}
          </p>
        </>
      )}
    </div>
  );
};

export default Player;
