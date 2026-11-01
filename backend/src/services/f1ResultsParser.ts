// Reads formula1.com's results pages: the list of races (for the race id in each URL) and a
// starting-grid page. Pure functions, no network: tested on real pages saved as fixtures.

export interface GridRow {
  driver_number: number;
  position: number;
}

export interface IndexedRace {
  id: number;
  slug: string;
}

const MIN_GRID_DRIVERS = 18;

const collapse = (s: string): string => s.replace(/\s+/g, ' ').trim();
const cellText = (cell: string): string => collapse(cell.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' '));

// The results index links every race twice (menu and table), in calendar order. Race ids are not
// in calendar order (Bahrain's comes after Mexico's neighbours), so the id is taken from the link.
export const parseRaceIndex = (html: string, season: number): IndexedRace[] => {
  const link = new RegExp(`href="/en/results/${season}/races/(\\d+)/([a-z0-9-]+)/race-result"`, 'g');
  const races: IndexedRace[] = [];
  for (const m of html.matchAll(link)) {
    const id = Number(m[1]);
    if (!races.some((r) => r.id === id)) races.push({ id, slug: m[2] });
  }
  return races;
};

// Null unless the page holds a complete grid: a Pos. and a No. column, at least 18 cars, every
// number once, and the numbered places running 1, 2, 3 ... without a gap or a repeat. A car with
// no numbered place (a pit-lane start, say) goes behind the others in the order the page lists it.
export const parseStartingGridPage = (html: string): GridRow[] | null => {
  const start = html.indexOf('<table');
  if (start === -1) return null;
  const end = html.indexOf('</table>', start);
  const table = html.slice(start, end === -1 ? undefined : end);

  const trs = table.match(/<tr[\s\S]*?<\/tr>/g);
  if (!trs) return null;
  const headings = [...trs[0].matchAll(/<th[^>]*>([\s\S]*?)<\/th>/g)].map((m) => cellText(m[1]));
  const posColumn = headings.findIndex((h) => /^pos/i.test(h));
  const numberColumn = headings.findIndex((h) => /^no\b/i.test(h));
  if (posColumn === -1 || numberColumn === -1) return null;

  const placed: GridRow[] = [];
  const behind: number[] = [];
  const seen = new Set<number>();
  for (const tr of trs.slice(1)) {
    const cells = [...tr.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((m) => cellText(m[1]));
    if (cells.length === 0) continue;
    const number = cells[numberColumn];
    if (!number || !/^\d+$/.test(number)) return null;
    const driverNumber = Number(number);
    if (seen.has(driverNumber)) return null;
    seen.add(driverNumber);

    const place = cells[posColumn] ?? '';
    if (/^\d+$/.test(place)) placed.push({ driver_number: driverNumber, position: Number(place) });
    else behind.push(driverNumber);
  }

  if (placed.length === 0 || placed.length + behind.length < MIN_GRID_DRIVERS) return null;
  if (!placed.every((row, i) => row.position === i + 1)) return null;
  return [...placed, ...behind.map((driver_number, i) => ({ driver_number, position: placed.length + i + 1 }))];
};
