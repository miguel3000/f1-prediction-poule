import { query } from '../config/database';

// Picks the earlier prediction to copy into a race the player forgot.
// Same-kind history first; for a sprint the newer of that and the last
// main-race prediction wins (a main pick has 10 drivers, a sprint needs the
// top 8). Only races before the one being filled count.
export async function findSourcePrediction(userId: number, isSprint: boolean, raceDate: Date | string) {
  const own = await query(
    `SELECT p.*, r.race_date AS source_race_date
     FROM ${isSprint ? 'sprint_predictions' : 'predictions'} p
     JOIN races r ON p.race_id = r.id
     WHERE p.user_id = $1 AND r.race_date < $2
     ORDER BY r.race_date DESC
     LIMIT 1`,
    [userId, raceDate]
  );
  let pred = own.rows[0];

  if (isSprint) {
    const main = await query(
      `SELECT p.*, r.race_date AS source_race_date
       FROM predictions p
       JOIN races r ON p.race_id = r.id
       WHERE p.user_id = $1 AND r.race_date < $2
       ORDER BY r.race_date DESC
       LIMIT 1`,
      [userId, raceDate]
    );
    const candidate = main.rows[0];
    if (candidate && (!pred || new Date(candidate.source_race_date) > new Date(pred.source_race_date))) {
      pred = candidate;
    }
  }

  return pred || null;
}
