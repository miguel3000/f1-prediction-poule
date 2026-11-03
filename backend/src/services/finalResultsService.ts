import { query } from '../config/database';
import { decideRace, applyDecision, notifyAdminOfDecision, RaceRef } from './resultCheckService';
import { isAwaitingFinal } from './raceStatus';
import { calculateRacePoints } from '../controllers/leaderboardController';
import { sendFinalResults, sendResultsAreInEmail, UserPredictionResult } from './emailService';

// The final run for one race: fresh results from the sources (post-race penalties and
// disqualifications show up here), points recalculated, every predictor told how it ended up, and
// everyone told the results are in. Shared by the scheduled job (Sunday and Monday) and the
// Pitlane's "Run final results", which is how a race gets its final run on any other day.

export interface FinalOutcome {
  done: boolean;
  reason: string;
  emailed: number;
}

export interface FinalDeps {
  decide: typeof decideRace;
}

export const finalizeRace = async (race: RaceRef, deps: Partial<FinalDeps> = {}): Promise<FinalOutcome> => {
  const decide = deps.decide ?? decideRace;

  // A race that already had its final run must not be mailed a second time.
  if (!(await isAwaitingFinal(race.id))) {
    return { done: false, reason: `${race.race_name} is not waiting for its final results`, emailed: 0 };
  }

  const isSprint = race.race_type === 'sprint';
  const predictionTable = isSprint ? 'sprint_predictions' : 'predictions';
  const resultsTable = isSprint ? 'sprint_results' : 'race_results';

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

  // Fresh results a day later (may include disqualifications), cross-checked across
  // sources. Anything the sources agree on is applied; if they cannot agree the
  // stored results are left exactly as they are and the admin is told.
  const decision = await decide(race, 'final');
  await notifyAdminOfDecision(race, 'final', decision);

  if (decision.action !== 'apply') {
    console.log(`[FINAL] ${decision.action === 'hold' ? '⚠ Holding' : '…'} final results for ${race.race_name}: ${decision.reason}`);
    return { done: false, reason: decision.reason, emailed: 0 };
  }
  console.log(`[FINAL] ${race.race_name}: ${decision.reason}${decision.warning ? ` (${decision.warning})` : ''}`);

  await applyDecision(race, decision);

  // Recalculate all points with final results. calculateRacePoints() overwrites
  // points_earned from scratch, so this is safe to run even though points were already set
  // during provisional processing.
  await calculateRacePoints(race.id);

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
    `SELECT p.*, u.email, u.nickname, u.language
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
    'SELECT id, name, team FROM drivers WHERE id = ANY($1)',
    [uniqueDriverIds]
  );
  const driverNameMap = new Map(driverNamesResult.rows.map((d: any) => [d.id, d]));

  console.log(`[FINAL] Sending final results to ${newPredictions.rows.length} users...`);

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
        const driverInfo = driverNameMap.get(driverId);
        const driverName = driverInfo?.name || 'Unknown';
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
        userPredictionResults.push({ predictedPosition: pos, driverName, team: driverInfo?.team, actualPosition: actualPos, pointsEarned, hasBonus });
      }

      await sendFinalResults(
        pred.email,
        pred.nickname,
        race.race_name,
        pred.points_earned,
        hasChanges,
        hasChanges ? previousPoints : undefined,
        userPredictionResults,
        pred.language
      );
    } catch (emailError) {
      console.error(`[FINAL] Error sending final results email to ${pred.email}:`, emailError);
    }
  }

  // Send "The results are in!" email to all users
  const allUsers = await query('SELECT email, nickname, language FROM users');
  console.log(`[FINAL] Sending "The results are in!" email to ${allUsers.rows.length} users...`);
  for (const user of allUsers.rows) {
    try {
      await sendResultsAreInEmail(user.email, user.nickname, race.race_name, user.language);
    } catch (emailError) {
      console.error(`[FINAL] Error sending results-are-in email to ${user.email}:`, emailError);
    }
  }

  console.log(`[FINAL] ✓ Final results processed for ${race.race_name}`);
  return { done: true, reason: decision.reason, emailed: newPredictions.rows.length + allUsers.rows.length };
};
