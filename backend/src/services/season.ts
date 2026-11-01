import { query } from '../config/database';

// The season the app is in: the calendar year (UTC), held back to the newest season we have races
// for. Points tables and the data pages open on it. On 1 January the new season starts with
// everybody on zero, provided its calendar is loaded; if it is not, nothing breaks and the old
// season stays on show. Older seasons stay viewable through ?season=.
export const activeSeason = async (now: Date = new Date()): Promise<number> => {
  const year = now.getUTCFullYear();
  const result = await query('SELECT MAX(season) AS newest FROM races');
  const newest = result.rows[0]?.newest;
  return newest == null ? year : Math.min(year, Number(newest));
};

// Every season we have races for, newest first.
export const listSeasons = async (): Promise<number[]> => {
  const result = await query('SELECT DISTINCT season FROM races ORDER BY season DESC');
  return result.rows.map((r: any) => Number(r.season));
};

// The season a request asks for (?season=2026): used when we have races for it, otherwise the
// active season, so a typo or an old link never shows an empty page.
export const seasonFromQuery = async (raw: unknown): Promise<number> => {
  if (typeof raw === 'string' && /^\d{4}$/.test(raw)) {
    const asked = Number(raw);
    if ((await listSeasons()).includes(asked)) return asked;
  }
  return activeSeason();
};

// The season an admin sync should load: ?season= when it is a plausible year, otherwise the
// calendar year. Unlike the active season this is not held back to what we have, because loading
// a new season is how we come to have it.
export const seasonToLoad = (raw: unknown, now: Date = new Date()): number => {
  if (typeof raw === 'string' && /^\d{4}$/.test(raw)) {
    const asked = Number(raw);
    if (asked >= 2020 && asked <= now.getUTCFullYear() + 1) return asked;
  }
  return now.getUTCFullYear();
};
