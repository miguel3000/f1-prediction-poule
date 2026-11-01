import { query } from '../config/database';
import { decideRace, applyDecision, notifyAdminOfDecision } from '../services/resultCheckService';
import { calculateRacePoints } from '../controllers/leaderboardController';

async function syncRaceResults() {
  try {
    console.log('[CRON] Starting race results sync...');

    // Find races that have passed but don't have results yet or are marked as upcoming. Only the
    // last 60 days: a race older than that is handled by hand from the Pitlane (this used to be
    // limited to season 2026, which would have stopped it working in 2027).
    // Sprints keep their results in sprint_results, so that is the table to look in for them
    // (looking in race_results made every past sprint look empty, so each Monday re-synced
    // all of them and could email an alert about a months-old race).
    const racesResult = await query(
      `SELECT r.id, r.season, r.round, r.race_name, r.race_date, r.race_type
       FROM races r
       WHERE r.race_date < NOW()
         AND r.race_date > NOW() - INTERVAL '60 days'
         AND (
           r.status = 'upcoming'
           OR (r.race_type = 'sprint' AND NOT EXISTS (SELECT 1 FROM sprint_results WHERE race_id = r.id))
           OR (r.race_type <> 'sprint' AND NOT EXISTS (SELECT 1 FROM race_results WHERE race_id = r.id))
         )
       ORDER BY r.race_date DESC`
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

        // Cross-check the sources before storing anything; one that disagrees is reported,
        // and results are held back if the sources cannot agree.
        const decision = await decideRace(race, 'provisional');
        await notifyAdminOfDecision(race, 'provisional', decision);

        if (decision.action !== 'apply') {
          console.log(`[CRON] ⚠ Not storing results for ${race.race_name}: ${decision.reason}`);
          continue;
        }

        // Validated, then swapped in one transaction so a failure never leaves the race empty.
        const applied = await applyDecision(race, decision);
        const inserted = applied.inserted;
        const notFound = applied.unknownNumbers.length;
        console.log(`[CRON] ${race.race_name}: ${decision.reason}${decision.warning ? ` (${decision.warning})` : ''}`);

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
