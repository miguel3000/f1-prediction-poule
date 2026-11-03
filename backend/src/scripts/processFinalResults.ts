import { query } from '../config/database';
import { finalizeRace } from '../services/finalResultsService';

async function processFinalResults() {
  try {
    console.log('[CRON] Starting final results processing...');

    // Find races that are 24+ hours old and haven't had final results processed
    const racesResult = await query(
      `SELECT r.id, r.season, r.round, r.race_name, r.race_date, r.race_type
       FROM races r
       WHERE r.race_date < NOW() - INTERVAL '24 hours'
         AND r.final_results_processed = FALSE
         AND r.status = 'provisional'
       ORDER BY r.race_date DESC`
    );

    const races = racesResult.rows;

    if (races.length === 0) {
      console.log('[CRON] No races need final results processing');
      process.exit(0);
      return;
    }

    console.log(`[CRON] Found ${races.length} race(s) needing final results processing`);

    for (const race of races) {
      try {
        console.log(`[CRON] Processing final results for ${race.race_name} (${race.race_type === 'sprint' ? 'Sprint' : 'Main'})...`);
        const outcome = await finalizeRace(race);
        console.log(outcome.done ? `[CRON] ✓ Final results processed for ${race.race_name}` : `[CRON] … ${race.race_name} left as it is: ${outcome.reason}`);
      } catch (error) {
        console.error(`[CRON] ✗ Error processing ${race.race_name}:`, error);
      }
    }

    console.log('[CRON] Final results processing completed');
    process.exit(0);
  } catch (error) {
    console.error('[CRON] Error in final results processing:', error);
    process.exit(1);
  }
}

processFinalResults();
