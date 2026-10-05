import { query } from '../config/database';
import { decideRace, applyDecision, notifyAdminOfDecision } from '../services/resultCheckService';
import { calculateRacePoints } from '../controllers/leaderboardController';
import {
  sendProvisionalResults,
  sendAdminAlert,
  RaceResultForEmail,
  UserPredictionResult
} from '../services/emailService';

// F1 points systems
const mainPointsMap: { [key: number]: number } = {
  1: 25, 2: 18, 3: 15, 4: 12, 5: 10, 6: 8, 7: 6, 8: 4, 9: 2, 10: 1
};

const sprintPointsMap: { [key: number]: number } = {
  1: 8, 2: 7, 3: 6, 4: 5, 5: 4, 6: 3, 7: 2, 8: 1
};

async function processProvisionalResults() {
  try {
    console.log('[CRON] Starting provisional results processing...');
    const season = 2026;

    // Find races that finished at least 5 minutes ago and haven't had provisional
    // results sent yet. Widened to a 6-hour retry window (two effective 3h passes)
    // since the results API isn't always ready within the first 3 hours.
    const racesResult = await query(
      `SELECT r.id, r.season, r.round, r.race_name, r.race_date, r.race_type
       FROM races r
       WHERE r.season = $1
         AND r.race_date < NOW() - INTERVAL '5 minutes'
         AND r.race_date > NOW() - INTERVAL '6 hours'
         AND r.provisional_results_sent = FALSE
         AND r.status = 'upcoming'
       ORDER BY r.race_date DESC`,
      [season]
    );

    const races = racesResult.rows;

    if (races.length === 0) {
      console.log('[CRON] No races need provisional results processing');
      process.exit(0);
      return;
    }

    console.log(`[CRON] Found ${races.length} race(s) needing provisional results`);

    for (const race of races) {
      try {
        const isSprint = race.race_type === 'sprint';
        const predictionTable = isSprint ? 'sprint_predictions' : 'predictions';
        const pointsMap = isSprint ? sprintPointsMap : mainPointsMap;
        const maxPositions = isSprint ? 8 : 10;
        console.log(`[CRON] Processing provisional results for ${race.race_name} (${isSprint ? 'Sprint' : 'Main'})...`);

        // Compare the sources and only go ahead when the results can be trusted
        // (or when waiting any longer would hold players up for no reason).
        const decision = await decideRace(race, 'provisional');
        await notifyAdminOfDecision(race, 'provisional', decision);

        if (decision.action !== 'apply') {
          console.log(`[CRON] ${decision.action === 'hold' ? '⚠ Holding' : '…'} ${race.race_name}: ${decision.reason}`);
          continue;
        }
        console.log(`[CRON] ${race.race_name}: ${decision.reason}${decision.warning ? ` (${decision.warning})` : ''}`);

        // Validated, then swapped in one transaction — a failure never wipes stored results.
        const applied = await applyDecision(race, decision);
        const raceResultsForEmail: RaceResultForEmail[] = applied.podium;
        const resultsTable = isSprint ? 'sprint_results' : 'race_results';

        // Update race status to provisional
        await query(
          `UPDATE races SET status = 'provisional', provisional_results_sent = TRUE, updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
          [race.id]
        );

        // Persist points now so the Season Progression graph reflects this race
        // immediately instead of waiting for the next-day final results processing.
        await calculateRacePoints(race.id);

        // Get all predictions for this race with user info (now including points_earned)
        const predictionsResult = await query(
          `SELECT p.*, u.email, u.nickname, u.language
           FROM ${predictionTable} p
           JOIN users u ON p.user_id = u.id
           WHERE p.race_id = $1`,
          [race.id]
        );

        console.log(`[CRON] Sending provisional results to ${predictionsResult.rows.length} users...`);

        // Send email to each user who made a prediction
        for (const prediction of predictionsResult.rows) {
          try {
            // Build per-driver breakdown for the email (points_earned itself is already
            // persisted by calculateRacePoints above, so use that as the authoritative total)
            const userPredictionResults: UserPredictionResult[] = [];

            for (let predictedPos = 1; predictedPos <= maxPositions; predictedPos++) {
              const predictedDriverId = prediction[`position_${predictedPos}`];
              if (!predictedDriverId) continue;

              // Get driver name/team
              const driverResult = await query('SELECT name, team FROM drivers WHERE id = $1', [predictedDriverId]);
              const driverName = driverResult.rows[0]?.name || 'Unknown';
              const driverTeam = driverResult.rows[0]?.team;

              // Find actual position
              const actualResult = await query(
                `SELECT position FROM ${resultsTable} WHERE race_id = $1 AND driver_id = $2`,
                [race.id, predictedDriverId]
              );

              let actualPosition: number | null = null;
              let pointsEarned = 0;
              let hasBonus = false;

              if (actualResult.rows.length > 0 && actualResult.rows[0].position <= maxPositions) {
                const pos: number = actualResult.rows[0].position;
                actualPosition = pos;
                const basePoints = pointsMap[predictedPos] || 0;
                const posDiff = Math.abs(predictedPos - pos);

                if (posDiff === 0) {
                  pointsEarned = basePoints;
                } else if (posDiff === 1) {
                  pointsEarned = Math.round(basePoints * 0.5);
                  hasBonus = true;
                }
              }

              userPredictionResults.push({
                predictedPosition: predictedPos,
                driverName,
                team: driverTeam,
                actualPosition,
                pointsEarned,
                hasBonus
              });
            }

            // Send provisional results email
            await sendProvisionalResults(
              prediction.email,
              prediction.nickname,
              race.race_name,
              raceResultsForEmail,
              userPredictionResults,
              prediction.points_earned,
              prediction.language
            );

          } catch (emailError) {
            console.error(`[CRON] Error sending email to ${prediction.email}:`, emailError);
          }
        }

        console.log(`[CRON] ✓ Provisional results processed for ${race.race_name}`);

      } catch (error) {
        console.error(`[CRON] ✗ Error processing ${race.race_name}:`, error);
      }
    }

    // Races that aged out of the 6-hour retry window above without ever getting
    // provisional results sent — the API never had data in time. Alert once per race
    // so it doesn't get silently picked up later by the weekly catch-all sync with
    // nobody ever having been notified (this is how the Italian GP slipped through).
    const staleResult = await query(
      `SELECT id, race_name, round
       FROM races
       WHERE season = $1
         AND race_date <= NOW() - INTERVAL '6 hours'
         AND status = 'upcoming'
         AND provisional_results_sent = FALSE
         AND provisional_alert_sent = FALSE`,
      [season]
    );

    for (const race of staleResult.rows) {
      const check = await query('SELECT verdict FROM result_checks WHERE race_id = $1', [race.id]);
      const verdict = check.rows[0]?.verdict;
      const why =
        verdict === 'conflict'
          ? `The sources disagreed about the result, so it was held back (see the earlier results check email). `
          : verdict === 'single'
            ? `Only one source ever had results, so they were never confirmed. `
            : `The APIs never had data in time. `;
      const sent = await sendAdminAlert(
        `No results after 6h — ${race.race_name}`,
        `Round ${race.round} (${race.race_name}) still has no applied results 6 hours ` +
        `after the race started. Provisional results were never sent to players. ${why}` +
        `Compare the sources in Pitlane and use "Force Re-sync" for this race once you know ` +
        `which result is right.`
      );
      if (sent) {
        await query('UPDATE races SET provisional_alert_sent = TRUE WHERE id = $1', [race.id]);
        console.log(`[CRON] ⚠ Alerted admin — no results yet for ${race.race_name}`);
      }
    }

    console.log('[CRON] Provisional results processing completed');
    process.exit(0);
  } catch (error) {
    console.error('[CRON] Error in provisional results processing:', error);
    process.exit(1);
  }
}

processProvisionalResults();
