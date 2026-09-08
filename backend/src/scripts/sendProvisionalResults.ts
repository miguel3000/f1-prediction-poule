import { query } from '../config/database';
import * as jolpiService from '../services/jolpiService';
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

        // Fetch results from Jolpi API
        const jolpiResults = isSprint
          ? await jolpiService.getSprintResults(race.season, race.round)
          : await jolpiService.getRaceResults(race.season, race.round);

        if (jolpiResults.length === 0) {
          console.log(`[CRON] ⚠ No results available yet for ${race.race_name}, will retry later`);
          continue;
        }

        // Clear existing results and insert new ones
        const resultsTable = isSprint ? 'sprint_results' : 'race_results';
        await query(`DELETE FROM ${resultsTable} WHERE race_id = $1`, [race.id]);

        // Build driver lookup map
        const driverNumbers = jolpiResults.map((r: any) => parseInt(r.number));
        const driversResult = await query(
          'SELECT id, driver_number, name FROM drivers WHERE driver_number = ANY($1) AND season = $2',
          [driverNumbers, race.season]
        );
        const driverMap = new Map(driversResult.rows.map((d: any) => [d.driver_number, d]));

        // Insert race results
        const raceResultsForEmail: RaceResultForEmail[] = [];
        for (const result of jolpiResults) {
          const driverNumber = parseInt(result.number);
          const driver = driverMap.get(driverNumber);

          if (driver) {
            await query(
              `INSERT INTO ${resultsTable} (race_id, driver_id, position, points, status)
               VALUES ($1, $2, $3, $4, $5)`,
              [race.id, driver.id, parseInt(result.position), parseFloat(result.points), result.status]
            );

            if (parseInt(result.position) <= maxPositions) {
              raceResultsForEmail.push({
                position: parseInt(result.position),
                driverName: driver.name,
                points: pointsMap[parseInt(result.position)] || 0
              });
            }
          }
        }

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
          `SELECT p.*, u.email, u.nickname
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

              // Get driver name
              const driverResult = await query('SELECT name FROM drivers WHERE id = $1', [predictedDriverId]);
              const driverName = driverResult.rows[0]?.name || 'Unknown';

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
              prediction.points_earned
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
      const sent = await sendAdminAlert(
        `No results after 6h — ${race.race_name}`,
        `Round ${race.round} (${race.race_name}) still has no results from the API 6 hours ` +
        `after the race started. Provisional results were never sent to players. ` +
        `Check Jolpi/OpenF1 manually, or use the "Sync Race Results" / "Send Last Race ` +
        `Results" buttons in Pitlane once results are available.`
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
