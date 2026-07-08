import { query } from '../config/database';

/**
 * One-time repair for users.total_points drift caused by the additive update
 * that calculateRacePoints() used before it was made idempotent. Recomputes
 * every user's total_points from the source of truth (predictions +
 * sprint_predictions points_earned).
 */
async function repairTotalPoints() {
  try {
    console.log('[REPAIR] Recomputing users.total_points from predictions...');

    const result = await query(
      `UPDATE users u
       SET total_points =
         COALESCE((SELECT SUM(points_earned) FROM predictions WHERE user_id = u.id), 0) +
         COALESCE((SELECT SUM(points_earned) FROM sprint_predictions WHERE user_id = u.id), 0)`
    );

    console.log(`[REPAIR] ✓ Recomputed total_points for ${result.rowCount} users`);

    process.exit(0);
  } catch (error) {
    console.error('[REPAIR] Error repairing total_points:', error);
    process.exit(1);
  }
}

repairTotalPoints();
