import { query } from '../config/database';
import * as jolpiService from '../services/jolpiService';

async function syncQualifyingResults() {
  try {
    console.log('[CRON] Starting qualifying results sync...');
    const season = 2026;

    // Find main races where qualifying has ended (qualifying_date + 2 hours < NOW)
    // and no qualifying_results exist yet
    const racesResult = await query(
      `SELECT r.id, r.season, r.round, r.race_name, r.race_date
       FROM races r
       WHERE r.season = $1
         AND r.race_type = 'main'
         AND r.race_date - INTERVAL '1 day' < NOW()
         AND NOT EXISTS (
           SELECT 1 FROM qualifying_results WHERE race_id = r.id
         )
       ORDER BY r.race_date DESC`,
      [season]
    );

    const races = racesResult.rows;

    if (races.length === 0) {
      console.log('[CRON] No races need qualifying results sync');
      process.exit(0);
      return;
    }

    console.log(`[CRON] Found ${races.length} race(s) needing qualifying results sync`);

    for (const race of races) {
      try {
        console.log(`[CRON] Syncing qualifying results for ${race.race_name} (Round ${race.round})...`);

        const qualifyingResults = await jolpiService.getQualifyingResults(race.season, race.round);

        if (qualifyingResults.length === 0) {
          console.log(`[CRON] No qualifying results found for ${race.race_name}, skipping...`);
          continue;
        }

        // Batch fetch all drivers by their numbers
        const driverNumbers = qualifyingResults.map(q => parseInt(q.number));
        const driversResult = await query(
          'SELECT id, driver_number, name FROM drivers WHERE driver_number = ANY($1) AND season = $2',
          [driverNumbers, race.season]
        );
        const driverMap = new Map(driversResult.rows.map((d: any) => [d.driver_number, d]));

        let inserted = 0;
        let notFound = 0;

        for (const result of qualifyingResults) {
          const driverNumber = parseInt(result.number);
          const driver = driverMap.get(driverNumber);

          if (driver) {
            await query(
              `INSERT INTO qualifying_results (race_id, driver_id, position, q1, q2, q3)
               VALUES ($1, $2, $3, $4, $5, $6)
               ON CONFLICT (race_id, driver_id) DO UPDATE SET
                 position = EXCLUDED.position,
                 q1 = EXCLUDED.q1,
                 q2 = EXCLUDED.q2,
                 q3 = EXCLUDED.q3`,
              [
                race.id,
                driver.id,
                parseInt(result.position),
                result.Q1 || null,
                result.Q2 || null,
                result.Q3 || null
              ]
            );

            inserted++;
            const bestTime = result.Q3 || result.Q2 || result.Q1 || 'no time';
            console.log(`[CRON]   P${result.position}: ${driver.name} (${bestTime})`);
          } else {
            notFound++;
            console.log(`[CRON]   Driver #${result.number} not found in database`);
          }
        }

        console.log(`[CRON] Inserted ${inserted} qualifying results for ${race.race_name} (${notFound} not found)`);

      } catch (error) {
        console.error(`[CRON] Error syncing qualifying for ${race.race_name}:`, error);
      }
    }

    console.log('[CRON] Qualifying results sync completed');
    process.exit(0);
  } catch (error) {
    console.error('[CRON] Error in qualifying results sync:', error);
    process.exit(1);
  }
}

syncQualifyingResults();
