import { useEffect, useMemo, useState } from 'react';
import { useLang } from '../../i18n/LanguageContext';
import { SeasonRace, SeasonUser, cumulative, fullName, roundLabels } from './types';

// Season progression: step through the races (or press play) and the standings re-sort with
// the same yellow number square + blue bar used across the site, showing the points gained
// that weekend and the places won or lost. Only players who have scored by that race are
// listed; a player's first appearance is marked NEW.

interface Props {
  races: SeasonRace[];
  users: SeasonUser[];
  meId?: number;
}

const ROW = 44; // row height plus gap, in px
const STEP_MS = 900; // pause between races while playing

// Rank among the players who have scored by race i, in standings order (points, then nickname).
const rankAt = (users: SeasonUser[], cum: Map<number, number[]>, i: number) => {
  const sorted = users
    .filter((u) => (cum.get(u.id)?.[i] ?? 0) > 0)
    .sort((a, b) => cum.get(b.id)![i] - cum.get(a.id)![i] || a.nickname.localeCompare(b.nickname));
  return new Map(sorted.map((u, r) => [u.id, r + 1]));
};

const SeasonReplay = ({ races, users, meId }: Props) => {
  const { t } = useLang();
  const last = races.length - 1;
  const [idx, setIdx] = useState(last);
  const [playing, setPlaying] = useState(false);
  const labels = useMemo(() => roundLabels(races), [races]);
  const cum = useMemo(() => new Map(users.map((u) => [u.id, cumulative(u.points_per_race)])), [users]);

  // The data can grow while the page is open (a new race completes): keep the slider on a valid race.
  useEffect(() => {
    setIdx((i) => Math.min(i, Math.max(0, races.length - 1)));
  }, [races.length]);

  const now = useMemo(() => rankAt(users, cum, idx), [users, cum, idx]);
  const before = useMemo(() => (idx > 0 ? rankAt(users, cum, idx - 1) : null), [users, cum, idx]);
  // Bars are scaled to the final leader so they visibly grow while you move through the season.
  const maxFinal = Math.max(...users.map((u) => cum.get(u.id)?.[last] ?? 0), 1);

  useEffect(() => {
    if (!playing) return;
    if (idx >= last) {
      setPlaying(false);
      return;
    }
    const timer = window.setTimeout(() => setIdx((i) => i + 1), STEP_MS);
    return () => window.clearTimeout(timer);
  }, [playing, idx, last]);

  const jump = (to: number) => {
    setPlaying(false);
    setIdx(Math.min(last, Math.max(0, to)));
  };
  const play = () => {
    if (idx >= last) setIdx(0);
    setPlaying((p) => !p);
  };

  if (races.length === 0) return null;
  const sprintWord = t('lb.replay.sprint');

  return (
    <div className="bg-f1-neutral-900 border border-f1-neutral-800 p-3 sm:p-4">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => jump(idx - 1)}
          disabled={idx === 0}
          className="w-10 h-10 shrink-0 bg-f1-blue-dark text-white font-bold disabled:opacity-30"
          aria-label={t('lb.replay.prev')}
        >
          ◀
        </button>
        <input
          type="range"
          min={0}
          max={last}
          value={idx}
          onChange={(e) => jump(Number(e.target.value))}
          className="flex-1 min-w-0 accent-f1-yellow-500 h-10"
          aria-label={t('lb.replay.slider')}
          aria-valuetext={fullName(races[idx], sprintWord)}
        />
        <button
          type="button"
          onClick={() => jump(idx + 1)}
          disabled={idx === last}
          className="w-10 h-10 shrink-0 bg-f1-blue-dark text-white font-bold disabled:opacity-30"
          aria-label={t('lb.replay.next')}
        >
          ▶
        </button>
      </div>

      <div className="mt-2 mb-3">
        <p
          className="font-brand text-xl uppercase tracking-wide text-f1-yellow-500 leading-none truncate"
          aria-live="polite"
        >
          {fullName(races[idx], sprintWord)}
        </p>
        <div className="flex items-center justify-between gap-3 mt-2">
          <p className="text-[11px] text-f1-neutral-300 min-w-0">
            {t('lb.replay.position', { round: labels[idx], n: idx + 1, total: races.length })}
          </p>
          <button
            type="button"
            onClick={play}
            className="shrink-0 px-3 py-1.5 text-xs font-bold uppercase tracking-wider bg-f1-yellow-500 text-black"
          >
            {playing ? t('lb.replay.pause') : t('lb.replay.play')}
          </button>
        </div>
      </div>

      {now.size === 0 ? (
        <p className="py-6 text-center text-white">{t('lb.replay.nobody')}</p>
      ) : (
        <div className="relative" style={{ height: now.size * ROW }}>
          {users
            .filter((u) => now.has(u.id))
            .map((u) => {
              const rank = now.get(u.id)!;
              const pts = cum.get(u.id)![idx];
              const gained = u.points_per_race[idx] ?? 0;
              const isNew = before != null && !before.has(u.id);
              const moved = before && !isNew ? before.get(u.id)! - rank : 0;
              return (
                <div
                  key={u.id}
                  className="absolute left-0 right-0 flex items-stretch gap-1.5 transition-transform duration-500 ease-out motion-reduce:transition-none"
                  style={{ height: ROW - 6, transform: `translateY(${(rank - 1) * ROW}px)` }}
                >
                  <span className="min-w-[2.25rem] px-1 shrink-0 flex items-center justify-center bg-f1-yellow-500 text-black font-f1-badge font-bold text-sm">
                    {rank}
                  </span>
                  <div className={`relative flex-1 min-w-0 bg-f1-blue-dark ${u.id === meId ? 'outline outline-2 outline-white' : ''}`}>
                    <div
                      className="absolute inset-y-0 left-0 bg-f1-blue transition-[width] duration-500 ease-out motion-reduce:transition-none"
                      style={{ width: `${(pts / maxFinal) * 100}%` }}
                    />
                    <div className="relative h-full flex items-center justify-between gap-2 px-2.5">
                      <span className="font-f1 font-bold uppercase tracking-wide text-white text-sm truncate">{u.nickname}</span>
                      <span className="font-f1-badge text-xs text-white tabular-nums">{pts}</span>
                    </div>
                  </div>
                  <div className="w-14 shrink-0 flex flex-col items-end justify-center leading-tight text-[11px] font-bold tabular-nums">
                    <span className={gained > 0 ? 'text-f1-yellow-500' : 'text-f1-neutral-500'}>{gained > 0 ? `+${gained}` : '0'}</span>
                    <span
                      className={
                        isNew ? 'text-f1-yellow-500' : moved > 0 ? 'text-white' : moved < 0 ? 'text-f1-neutral-400' : 'text-f1-neutral-600'
                      }
                    >
                      {isNew ? t('lb.replay.new') : moved > 0 ? `▲${moved}` : moved < 0 ? `▼${-moved}` : '–'}
                    </span>
                  </div>
                </div>
              );
            })}
        </div>
      )}
    </div>
  );
};

export default SeasonReplay;
