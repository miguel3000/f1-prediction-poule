import { query } from '../config/database';
import { parseRaceIndex, parseStartingGridPage } from './f1ResultsParser';
import { getStoredGrid, storeStartingGrid } from './startingGridService';

// The real starting grid (penalties applied) from formula1.com's results pages. It is on the page
// as soon as qualifying (or sprint qualifying) is over, so it arrives many hours before the live
// feed (about an hour before the start) or OpenF1 (after the session). It is refreshed while the
// start is more than STOP_BEFORE_START away, so penalties announced the next morning are picked
// up; after that the live feed takes over and this source leaves the stored grid alone.

export const WINDOW = 30 * 3600_000;
export const STOP_BEFORE_START = 75 * 60_000;
const MIN_KNOWN_DRIVERS = 18;
const INDEX_URL = (season: number) => `https://www.formula1.com/en/results/${season}/races`;
const GRID_URL = (season: number, id: number, slug: string, kind: 'main' | 'sprint') =>
  `https://www.formula1.com/en/results/${season}/races/${id}/${slug}/${kind === 'sprint' ? 'sprint-grid' : 'starting-grid'}`;

export interface SyncDeps {
  // The page's HTML, null when formula1.com has no such page, an error for anything else.
  fetchPage: (url: string) => Promise<string | null>;
}

export interface SyncOutcome {
  raceId: number;
  raceName: string;
  kind: 'main' | 'sprint';
  // stored: the grid was written; unchanged: it is already what we have; no-grid: the page has no
  // complete grid we know the cars of (yet); unmapped: the race list on formula1.com does not match our calendar
  result: 'stored' | 'unchanged' | 'no-grid' | 'unmapped';
  stored?: number;
  unknown?: number;
}

const utc = (ms: number): string => new Date(ms).toISOString().slice(0, 19).replace('T', ' ');

export const syncGridFromF1Site = async (now: Date, deps: SyncDeps): Promise<SyncOutcome[]> => {
  const races = await query(
    `SELECT id, season, round, race_name, race_date, race_type FROM races
     WHERE race_date > $1::timestamp AND race_date <= $2::timestamp ORDER BY race_date`,
    [utc(now.getTime() + STOP_BEFORE_START), utc(now.getTime() + WINDOW)]
  );

  const outcomes: SyncOutcome[] = [];
  const indexBySeason = new Map<number, Array<{ id: number; slug: string }> | null>();

  for (const race of races.rows) {
    const base = { raceId: race.id as number, raceName: race.race_name as string, kind: race.race_type as 'main' | 'sprint' };

    // The race's number in formula1.com's list is its round, but only while the list and our
    // calendar are the same length (a cancelled or added race would shift every later one).
    if (!indexBySeason.has(race.season)) {
      const html = await deps.fetchPage(INDEX_URL(race.season));
      const rounds = await query('SELECT COUNT(DISTINCT round) AS n, MAX(round) AS last FROM races WHERE season = $1', [race.season]);
      const listed = html ? parseRaceIndex(html, race.season) : [];
      const matches = listed.length > 0 && listed.length === Number(rounds.rows[0].n) && listed.length === Number(rounds.rows[0].last);
      indexBySeason.set(race.season, matches ? listed : null);
    }
    const listed = indexBySeason.get(race.season);
    const entry = listed?.[race.round - 1];
    if (!entry) {
      outcomes.push({ ...base, result: 'unmapped' });
      continue;
    }

    const html = await deps.fetchPage(GRID_URL(race.season, entry.id, entry.slug, base.kind));
    const grid = html ? parseStartingGridPage(html) : null;
    const drivers = await query('SELECT driver_number FROM drivers WHERE season = $1', [race.season]);
    const known = new Set<number>(drivers.rows.map((d: any) => d.driver_number));
    const usable = grid?.filter((g) => known.has(g.driver_number)) ?? [];
    if (!grid || usable.length < MIN_KNOWN_DRIVERS) {
      outcomes.push({ ...base, result: 'no-grid' });
      continue;
    }

    const stored = await getStoredGrid(race.id);
    if (stored.size === usable.length && usable.every((g) => stored.get(g.driver_number) === g.position)) {
      outcomes.push({ ...base, result: 'unchanged' });
      continue;
    }
    const result = await storeStartingGrid(race, grid);
    outcomes.push({ ...base, result: 'stored', stored: result.stored, unknown: result.unknown });
  }
  return outcomes;
};
