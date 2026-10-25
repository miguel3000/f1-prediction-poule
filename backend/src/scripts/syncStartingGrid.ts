import { query } from '../config/database';
import { fetchStartingGrid, getStoredGrid, storeStartingGrid } from '../services/startingGridService';

// Runs every few minutes. For a race or sprint that starts within the next 3 hours it looks for
// the real starting grid and stores it (again, if it changed) so the prediction list can show it.
// It prints only when it does something.
//
//   node dist/scripts/syncStartingGrid.js                     normal run
//   node dist/scripts/syncStartingGrid.js --race <id>         look up one race (even a past one) and print the grid
//   node dist/scripts/syncStartingGrid.js --race <id> --store the same, and store it

const arg = (name: string) => {
  const i = process.argv.indexOf(name);
  return i === -1 ? undefined : process.argv[i + 1];
};

async function main() {
  const forced = arg('--race');
  const storeForced = process.argv.includes('--store');

  const racesResult = forced
    ? await query('SELECT id, season, round, race_name, race_date, race_type FROM races WHERE id = $1', [parseInt(forced, 10)])
    : await query(
        `SELECT id, season, round, race_name, race_date, race_type FROM races
         WHERE race_date > NOW() AND race_date <= NOW() + INTERVAL '3 hours'
         ORDER BY race_date`
      );

  for (const race of racesResult.rows) {
    try {
      const grid = await fetchStartingGrid(race);
      if (grid.length === 0) {
        if (forced) console.log(`[CRON] ${race.race_name} (${race.race_type}): no complete starting grid available`);
        continue;
      }

      const names = await query('SELECT driver_number, name_acronym FROM drivers WHERE season = $1', [race.season]);
      const acronym = new Map(names.rows.map((d: any) => [d.driver_number, d.name_acronym]));
      const line = grid.map((g) => `${g.position} ${acronym.get(g.driver_number) ?? '#' + g.driver_number}`).join(', ');

      if (forced && !storeForced) {
        console.log(`[CRON] ${race.race_name} (${race.race_type}) grid: ${line}`);
        continue;
      }

      const stored = await getStoredGrid(race.id);
      const unchanged = grid.every((g) => stored.get(g.driver_number) === g.position) && stored.size >= grid.length;
      if (unchanged) continue;

      const result = await storeStartingGrid(race, grid);
      console.log(`[CRON] Starting grid stored for ${race.race_name} (${race.race_type}): ${line} [${result.stored} stored, ${result.unknown} unknown]`);
    } catch (error) {
      console.error(`[CRON] Starting grid failed for ${race.race_name}:`, error);
    }
  }
  process.exit(0);
}

main().catch((error) => {
  console.error('[CRON] Starting grid sync failed:', error);
  process.exit(1);
});
