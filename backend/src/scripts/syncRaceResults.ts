import { query } from '../config/database';
import * as jolpiService from '../services/jolpiService';
import { calculateRacePoints } from '../controllers/leaderboardController';

async function syncRaceResults() {
  try {
    console.log('[CRON] Starting race results sync...');
    const season = 2026;

    // Find races that have passed but don't have results yet or are marked as upcoming
    const racesResult = await query(
      `SELECT r.id, r.season, r.round, r.race_name, r.race_date, r.race_type
       FROM races r
       WHERE r.season = $1
         AND r.race_date < NOW()
         AND (r.status = 'upcoming' OR NOT EXISTS (
           SELECT 1 FROM race_results WHERE race_id = r.id
         ))
       ORDER BY r.race_date DESC`,
      [season]
    );

    const races = racesResult.rows;

    if (races.length === 0) {
      console.log('[CRON] No races need result syncing');
      process.exit(0);
      return;
    }

    console.log(`[CRON] Found ${races.length} race(s) needing results sync`);

    for (const race of races) {
      try {
        const isSprint = race.race_type === 'sprint';
        console.log(`[CRON] Syncing results for ${race.race_name} (Round ${race.round}, ${isSprint ? 'Sprint' : 'Main'})...`);

        // Fetch results from Jolpi API - use sprint or main race endpoint
        const jolpiResults = isSprint
          ? await jolpiService.getSprintResults(race.season, race.round)
          : await jolpiService.getRaceResults(race.season, race.round);

        if (jolpiResults.length === 0) {
          console.log(`[CRON] ⚠ No results found for ${race.race_name}, skipping...`);
          continue;
        }

        // Clear existing results for this race (correct table per race type)
        const resultsTable = isSprint ? 'sprint_results' : 'race_results';
        await query(`DELETE FROM ${resultsTable} WHERE race_id = $1`, [race.id]);

        let inserted = 0;
        let notFound = 0;

        // Insert new results
        for (const result of jolpiResults) {
          // Find driver in our database by driver number
          const driverResult = await query(
            'SELECT id, name FROM drivers WHERE driver_number = $1 AND season = $2',
            [parseInt(result.number), race.season]
          );

          if (driverResult.rows.length > 0) {
            const driver = driverResult.rows[0];

            await query(
              `INSERT INTO ${resultsTable} (race_id, driver_id, position, points, status)
               VALUES ($1, $2, $3, $4, $5)`,
              [
                race.id,
                driver.id,
                parseInt(result.position),
                parseFloat(result.points),
                result.status
              ]
            );

            inserted++;
            console.log(`[CRON]   P${result.position}: ${driver.name} (${result.points} pts)`);
          } else {
            notFound++;
            console.log(`[CRON]   ⚠ Driver #${result.number} not found in database`);
          }
        }

        // Update race status to completed
        await query(
          'UPDATE races SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
          ['completed', race.id]
        );

        console.log(`[CRON] ✓ Inserted ${inserted} results for ${race.race_name} (${notFound} not found)`);

        // Calculate points for all predictions
        console.log(`[CRON] Calculating points for predictions...`);
        await calculateRacePoints(race.id);
        console.log(`[CRON] ✓ Points calculated for ${race.race_name}`);

      } catch (error) {
        console.error(`[CRON] ✗ Error syncing ${race.race_name}:`, error);
        // Continue with next race even if this one fails
      }
    }

    console.log('[CRON] Race results sync completed');
    process.exit(0);
  } catch (error) {
    console.error('[CRON] Error in race results sync:', error);
    process.exit(1);
  }
}

syncRaceResults();
