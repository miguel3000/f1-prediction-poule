import { query } from '../config/database';
import * as jolpiService from '../services/jolpiService';
import { activeSeason } from '../services/season';

async function syncDriverStandings() {
  try {
    console.log('[CRON] Starting driver standings sync...');
    const season = await activeSeason();
    const standings = await jolpiService.getDriverStandings(season);
    let updated = 0;
    let notFound = 0;

    for (const standing of standings) {
      const driverNumber = parseInt(standing.Driver.permanentNumber);
      const points = parseInt(standing.points);
      const driverName = `${standing.Driver.givenName} ${standing.Driver.familyName}`;
      const nationality = standing.Driver.nationality;

      // Try matching by driver number first
      let result = await query(
        `UPDATE drivers
         SET total_points = $1, nationality = $2, updated_at = CURRENT_TIMESTAMP
         WHERE driver_number = $3 AND season = $4`,
        [points, nationality, driverNumber, season]
      );

      // If no match by number, try matching by name (handles cases like Verstappen)
      if (!result.rowCount || result.rowCount === 0) {
        console.log(`[CRON] ⚠ Driver #${driverNumber} not found, trying name match for ${driverName}...`);

        // Match by name with case-insensitive partial match
        // This catches "Max VERSTAPPEN" vs "Max Verstappen" and similar variations
        result = await query(
          `UPDATE drivers
           SET total_points = $1, nationality = $2, updated_at = CURRENT_TIMESTAMP
           WHERE UPPER(name) = UPPER($3) AND season = $4`,
          [points, nationality, driverName, season]
        );
      }

      if (result.rowCount && result.rowCount > 0) {
        updated++;
        console.log(`[CRON] ✓ Updated ${driverName} (#${driverNumber}): ${points} points`);
      } else {
        notFound++;
        console.log(`[CRON] ✗ Driver ${driverName} (#${driverNumber}) not found in database`);
      }
    }

    console.log(`[CRON] Driver standings sync completed: ${updated} updated, ${notFound} not found`);
    process.exit(0);
  } catch (error) {
    console.error('[CRON] Error syncing driver standings:', error);
    process.exit(1);
  }
}

syncDriverStandings();
