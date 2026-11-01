import { query } from '../config/database';
import { sendAdminAlert } from '../services/emailService';
import { fetchStartingGrid, getStoredGrid, storeStartingGrid } from '../services/startingGridService';
import { syncGridFromF1Site } from '../services/f1SiteGridService';
import { fetchF1Page } from '../services/f1SiteIo';

// Runs every few minutes. First the formula1.com source (services/f1SiteGridService.ts): every
// 15 minutes, for a race or sprint that starts in 75 minutes to 30 hours, it stores the starting
// grid from formula1.com's results page (available once qualifying is over) and refreshes it when
// penalties change it. Then, as a fallback for the live feed, for a race or sprint that starts
// within the next 3 hours without a stored starting grid it asks OpenF1 for one. OpenF1's free tier
// only serves a session's data once the session is over, so this mostly helps after the fact; the
// live feed (services/startingGridFromFeed.ts) is what fills the grid in the last hour.
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

  // One request pair per quarter hour is plenty: a grid changes when stewards decide, not by the minute.
  if (!forced && new Date().getUTCMinutes() % 15 < 5) {
    try {
      for (const o of await syncGridFromF1Site(new Date(), { fetchPage: fetchF1Page })) {
        if (o.result === 'stored') {
          console.log(`[CRON] Starting grid stored from formula1.com for ${o.raceName} (${o.kind}) [${o.stored} stored, ${o.unknown} unknown]`);
        } else if (o.result === 'unmapped') {
          console.log(`[CRON] formula1.com's race list does not match our calendar, no grid read for ${o.raceName} (${o.kind})`);
        }
      }
    } catch (error) {
      console.error('[CRON] Starting grid from formula1.com failed:', error instanceof Error ? error.message : error);
    }
  }

  const racesResult = forced
    ? await query('SELECT id, season, round, race_name, race_date, race_type FROM races WHERE id = $1', [parseInt(forced, 10)])
    : await query(
        `SELECT id, season, round, race_name, race_date, race_type, grid_alert_sent FROM races
         WHERE race_date > NOW() AND race_date <= NOW() + INTERVAL '3 hours'
         ORDER BY race_date`
      );

  for (const race of racesResult.rows) {
    try {
      // The grid should have arrived about 50 minutes before the start. If a start is 20 minutes away
      // and there is still none, tell the admin once (the list then simply keeps the qualifying order).
      if (!forced && !race.grid_alert_sent && new Date(race.race_date).getTime() - Date.now() <= 20 * 60_000) {
        if ((await getStoredGrid(race.id)).size === 0) {
          const sent = await sendAdminAlert(
            `No starting grid yet for ${race.race_name}${race.race_type === 'sprint' ? ' (sprint)' : ''}`,
            'The start is less than 20 minutes away and neither the live timing feed nor OpenF1 has given a starting grid, so the prediction list still follows the qualifying order. Grid penalties are not reflected for this session. Nothing else is affected.'
          );
          if (sent) await query('UPDATE races SET grid_alert_sent = TRUE WHERE id = $1', [race.id]);
        }
      }

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

      // The live feed (services/startingGridFromFeed.ts) is the main source and works before the
      // start; this OpenF1 route is the fallback and never overwrites a grid that is already stored.
      const stored = await getStoredGrid(race.id);
      if (stored.size > 0) continue;

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
