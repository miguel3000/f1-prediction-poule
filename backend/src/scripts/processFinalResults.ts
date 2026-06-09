import { query } from '../config/database';
import * as jolpiService from '../services/jolpiService';
import { calculateRacePoints } from '../controllers/leaderboardController';
import { sendFinalResults, sendResultsAreInEmail, UserPredictionResult } from '../services/emailService';

async function processFinalResults() {
  try {
    console.log('[CRON] Starting final results processing...');
    const season = 2026;

    // Find races that are 24+ hours old and haven't had final results processed
    const racesResult = await query(
      `SELECT r.id, r.season, r.round, r.race_name, r.race_date, r.race_type
       FROM races r
       WHERE r.season = $1
         AND r.race_date < NOW() - INTERVAL '24 hours'
         AND r.final_results_processed = FALSE
         AND r.status = 'provisional'
       ORDER BY r.race_date DESC`,
      [season]
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
        const isSprint = race.race_type === 'sprint';
        const predictionTable = isSprint ? 'sprint_predictions' : 'predictions';
        console.log(`[CRON] Processing final results for ${race.race_name} (${isSprint ? 'Sprint' : 'Main'})...`);

        // Store current prediction points before recalculating
        const previousPointsResult = await query(
          `SELECT p.user_id, p.points_earned, u.email, u.nickname
           FROM ${predictionTable} p
           JOIN users u ON p.user_id = u.id
           WHERE p.race_id = $1`,
          [race.id]
        );
        const previousPointsMap = new Map(
          previousPointsResult.rows.map((r: any) => [r.user_id, {
            points: r.points_earned,
            email: r.email,
            nickname: r.nickname
          }])
        );

        // Fetch fresh results from API (may include disqualifications)
        const jolpiResults = isSprint
          ? await jolpiService.getSprintResults(race.season, race.round)
          : await jolpiService.getRaceResults(race.season, race.round);

        if (jolpiResults.length === 0) {
          console.log(`[CRON] ⚠ No results available for ${race.race_name}`);
          continue;
        }

        // Build driver lookup map
        const driverNumbers = jolpiResults.map((r: any) => parseInt(r.number));
        const driversResult = await query(
          'SELECT id, driver_number FROM drivers WHERE driver_number = ANY($1) AND season = $2',
          [driverNumbers, race.season]
        );
        const driverMap = new Map(driversResult.rows.map((d: any) => [d.driver_number, d.id]));

        // Clear existing results
        const resultsTable = isSprint ? 'sprint_results' : 'race_results';
        await query(`DELETE FROM ${resultsTable} WHERE race_id = $1`, [race.id]);

        // Insert fresh results (with any DQs applied)
        for (const result of jolpiResults) {
          const driverNumber = parseInt(result.number);
          const driverId = driverMap.get(driverNumber);

          if (driverId) {
            await query(
              `INSERT INTO ${resultsTable} (race_id, driver_id, position, points, status)
               VALUES ($1, $2, $3, $4, $5)`,
              [race.id, driverId, parseInt(result.position), parseFloat(result.points), result.status]
            );
          }
        }

        // Get old prediction points for comparison
        const oldPredictions = await query(
          `SELECT user_id, points_earned FROM ${predictionTable} WHERE race_id = $1`,
          [race.id]
        );
        const oldPointsMap = new Map(oldPredictions.rows.map((p: any) => [p.user_id, p.points_earned]));

        // Reset prediction points to 0 first
        await query(
          `UPDATE ${predictionTable} SET points_earned = 0 WHERE race_id = $1`,
          [race.id]
        );

        // Recalculate all points with final results
        // Note: calculateRacePoints adds new points to user totals
        await calculateRacePoints(race.id);

        // Now adjust user totals: subtract old points that were already counted
        // This avoids double-counting since calculateRacePoints already added new points
        for (const [userId, oldPoints] of oldPointsMap) {
          if (oldPoints > 0) {
            await query(
              'UPDATE users SET total_points = total_points - $1 WHERE id = $2',
              [oldPoints, userId]
            );
          }
        }

        // Update race status to completed
        await query(
          `UPDATE races SET status = 'completed', final_results_processed = TRUE, updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
          [race.id]
        );

        // Get new points and send emails
        const maxPositions = isSprint ? 8 : 10;
        const pointsMap: Record<number, number> = isSprint
          ? { 1: 8, 2: 7, 3: 6, 4: 5, 5: 4, 6: 3, 7: 2, 8: 1 }
          : { 1: 25, 2: 18, 3: 15, 4: 12, 5: 10, 6: 8, 7: 6, 8: 4, 9: 2, 10: 1 };

        const newPredictions = await query(
          `SELECT p.*, u.email, u.nickname
           FROM ${predictionTable} p
           JOIN users u ON p.user_id = u.id
           WHERE p.race_id = $1`,
          [race.id]
        );

        // Load final results once for all users
        const finalResultsResult = await query(
          `SELECT driver_id, position FROM ${resultsTable} WHERE race_id = $1`,
          [race.id]
        );
        const finalResultsMap = new Map(finalResultsResult.rows.map((r: any) => [r.driver_id, r.position]));

        // Load driver names once
        const allDriverIds = newPredictions.rows.flatMap((pred: any) =>
          Array.from({ length: maxPositions }, (_, i) => pred[`position_${i + 1}`]).filter(Boolean)
        );
        const uniqueDriverIds = [...new Set(allDriverIds)];
        const driverNamesResult = await query(
          'SELECT id, name FROM drivers WHERE id = ANY($1)',
          [uniqueDriverIds]
        );
        const driverNameMap = new Map(driverNamesResult.rows.map((d: any) => [d.id, d.name]));

        console.log(`[CRON] Sending final results to ${newPredictions.rows.length} users...`);

        for (const pred of newPredictions.rows) {
          try {
            const previousData = previousPointsMap.get(pred.user_id);
            const previousPoints = previousData?.points || 0;
            const hasChanges = previousPoints !== pred.points_earned;

            // Build per-driver breakdown
            const userPredictionResults: UserPredictionResult[] = [];
            for (let pos = 1; pos <= maxPositions; pos++) {
              const driverId = pred[`position_${pos}`];
              if (!driverId) continue;
              const driverName = driverNameMap.get(driverId) || 'Unknown';
              const actualPos: number | null = finalResultsMap.get(driverId) ?? null;
              let pointsEarned = 0;
              let hasBonus = false;
              if (actualPos && actualPos <= maxPositions) {
                const basePoints = pointsMap[pos] || 0;
                const diff = Math.abs(pos - actualPos);
                if (diff === 0) {
                  pointsEarned = basePoints;
                } else if (diff === 1) {
                  pointsEarned = Math.round(basePoints * 0.5);
                  hasBonus = true;
                }
              }
              userPredictionResults.push({ predictedPosition: pos, driverName, actualPosition: actualPos, pointsEarned, hasBonus });
            }

            await sendFinalResults(
              pred.email,
              pred.nickname,
              race.race_name,
              pred.points_earned,
              hasChanges,
              hasChanges ? previousPoints : undefined,
              userPredictionResults
            );
          } catch (emailError) {
            console.error(`[CRON] Error sending final results email to ${pred.email}:`, emailError);
          }
        }

        // Send "The results are in!" email to all users
        const allUsers = await query('SELECT email, nickname FROM users');
        console.log(`[CRON] Sending "The results are in!" email to ${allUsers.rows.length} users...`);
        for (const user of allUsers.rows) {
          try {
            await sendResultsAreInEmail(user.email, user.nickname, race.race_name);
          } catch (emailError) {
            console.error(`[CRON] Error sending results-are-in email to ${user.email}:`, emailError);
          }
        }

        console.log(`[CRON] ✓ Final results processed for ${race.race_name}`);

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
