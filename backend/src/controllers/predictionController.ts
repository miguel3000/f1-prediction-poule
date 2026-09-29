import { Request, Response } from 'express';
import { query } from '../config/database';
import { sendPredictionConfirmation } from '../services/emailService';

export const submitPrediction = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { raceId, positions, dnfPick } = req.body;

    if (!raceId || !positions || positions.length !== 10) {
      return res.status(400).json({ error: 'Race ID and 10 positions are required' });
    }

    // Optional bonus pick — any driver in the field, not just the predicted top 10
    const dnfPickId: number | null = dnfPick == null ? null : Number(dnfPick);
    if (dnfPickId != null && Number.isNaN(dnfPickId)) {
      return res.status(400).json({ error: 'Invalid DNF pick' });
    }

    // Check if race exists and is not completed
    const raceResult = await query('SELECT * FROM races WHERE id = $1', [raceId]);

    if (raceResult.rows.length === 0) {
      return res.status(404).json({ error: 'Race not found' });
    }

    const race = raceResult.rows[0];

    // Check if predictions are locked (1 minute before race)
    const lockTime = new Date(race.race_date.getTime() - parseInt(process.env.PREDICTION_LOCK_MINUTES || '1') * 60 * 1000);
    const now = new Date();

    if (now >= lockTime) {
      return res.status(400).json({ error: 'Predictions are locked for this race' });
    }

    // Check if user already has a prediction for this race
    const existingPrediction = await query(
      'SELECT * FROM predictions WHERE user_id = $1 AND race_id = $2',
      [userId, raceId]
    );

    if (existingPrediction.rows.length > 0) {
      // Update existing prediction
      await query(
        `UPDATE predictions SET
          position_1 = $1, position_2 = $2, position_3 = $3, position_4 = $4, position_5 = $5,
          position_6 = $6, position_7 = $7, position_8 = $8, position_9 = $9, position_10 = $10,
          dnf_pick = $11,
          submitted_at = CURRENT_TIMESTAMP
         WHERE user_id = $12 AND race_id = $13`,
        [...positions, dnfPickId, userId, raceId]
      );
    } else {
      // Create new prediction
      await query(
        `INSERT INTO predictions
          (user_id, race_id, position_1, position_2, position_3, position_4, position_5,
           position_6, position_7, position_8, position_9, position_10, dnf_pick)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
        [userId, raceId, ...positions, dnfPickId]
      );
    }

    // Get driver names/teams for confirmation email (single query instead of N queries)
    const allDriverIds = dnfPickId != null ? [...positions, dnfPickId] : positions;
    const driverResult = await query(
      'SELECT id, name, team FROM drivers WHERE id = ANY($1)',
      [allDriverIds]
    );
    const driverMap = new Map(driverResult.rows.map((d: any) => [d.id, d]));
    const driverPicks = positions
      .map((id: number) => driverMap.get(id))
      .filter(Boolean)
      .map((d: any) => ({ driverName: d.name, team: d.team }));
    const dnfPickName = dnfPickId != null ? driverMap.get(dnfPickId)?.name ?? null : null;

    // Get user info
    const userResult = await query('SELECT nickname, email FROM users WHERE id = $1', [userId]);
    const user = userResult.rows[0];

    // Send confirmation email
    await sendPredictionConfirmation(user.email, user.nickname, race.race_name, driverPicks, dnfPickName);

    res.json({ message: 'Prediction submitted successfully', raceId, positions });
  } catch (error) {
    console.error('Submit prediction error:', error);
    res.status(500).json({ error: 'Failed to submit prediction' });
  }
};

export const getPrediction = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { raceId } = req.params;

    const result = await query(
      'SELECT * FROM predictions WHERE user_id = $1 AND race_id = $2',
      [userId, raceId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Prediction not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get prediction error:', error);
    res.status(500).json({ error: 'Failed to get prediction' });
  }
};

export const getUserPredictions = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;

    const result = await query(
      `SELECT p.*, r.race_name, r.race_date, r.round, r.season, r.status
       FROM predictions p
       JOIN races r ON p.race_id = r.id
       WHERE p.user_id = $1
       ORDER BY r.race_date DESC`,
      [userId]
    );

    // Transform predictions to include driver details
    const predictions = await Promise.all(result.rows.map(async (prediction: any) => {
      // Get all driver IDs from the prediction
      const driverIds = [];
      for (let i = 1; i <= 10; i++) {
        if (prediction[`position_${i}`]) {
          driverIds.push(prediction[`position_${i}`]);
        }
      }
      if (prediction.dnf_pick) driverIds.push(prediction.dnf_pick);

      // Fetch driver details
      const driversResult = await query(
        'SELECT id, name, team, driver_number FROM drivers WHERE id = ANY($1)',
        [driverIds]
      );
      const driverMap = new Map(driversResult.rows.map((d: any) => [d.id, d]));

      // Build positions array in order
      const positions = [];
      for (let i = 1; i <= 10; i++) {
        const driverId = prediction[`position_${i}`];
        if (driverId && driverMap.has(driverId)) {
          positions.push(driverMap.get(driverId));
        }
      }

      // Compute per-driver points for completed/provisional races
      const mainPointsMap: Record<number, number> = { 1: 25, 2: 18, 3: 15, 4: 12, 5: 10, 6: 8, 7: 6, 8: 4, 9: 2, 10: 1 };
      let positionPoints: Array<{ pointsEarned: number; hasBonus: boolean; actualPosition: number | null }> | undefined;

      let firstOutDriverName: string | null = null;

      if (prediction.status === 'completed' || prediction.status === 'provisional') {
        const resultsResult = await query(
          'SELECT driver_id, position, status FROM race_results WHERE race_id = $1',
          [prediction.race_id]
        );
        const resultsMap = new Map(resultsResult.rows.map((r: any) => [r.driver_id, r.position]));

        positionPoints = [];
        for (let i = 1; i <= 10; i++) {
          const driverId = prediction[`position_${i}`];
          const actualPos: number | null = resultsMap.get(driverId) ?? null;
          if (actualPos && actualPos <= 10) {
            const basePoints = mainPointsMap[i] || 0;
            const diff = Math.abs(i - actualPos);
            const isNearMiss = diff === 1;
            const pointsEarned = diff === 0 ? basePoints : isNearMiss ? Math.round(basePoints * 0.5) : 0;
            positionPoints.push({ pointsEarned, hasBonus: isNearMiss, actualPosition: actualPos });
          } else {
            positionPoints.push({ pointsEarned: 0, hasBonus: false, actualPosition: actualPos });
          }
        }

        // Same "worst-classified DNF = retired earliest" heuristic used to award the bonus
        const dnfResults = resultsResult.rows.filter((r: any) => r.status === 'dnf');
        if (dnfResults.length > 0) {
          const firstOut = dnfResults.reduce((worst: any, r: any) => (r.position > worst.position ? r : worst), dnfResults[0]);
          const firstOutDriver = await query('SELECT name FROM drivers WHERE id = $1', [firstOut.driver_id]);
          firstOutDriverName = firstOutDriver.rows[0]?.name ?? null;
        }
      }

      const dnfPickDriver = prediction.dnf_pick ? driverMap.get(prediction.dnf_pick) : null;

      return {
        id: prediction.id,
        race_id: prediction.race_id,
        race_name: prediction.race_name,
        race_date: prediction.race_date,
        status: prediction.status,
        positions: positions,
        points: prediction.points_earned,
        positionPoints,
        dnfPick: dnfPickDriver ? { name: dnfPickDriver.name } : null,
        dnfBonusPoints: prediction.dnf_bonus_points || 0,
        firstOutDriverName
      };
    }));

    res.json(predictions);
  } catch (error) {
    console.error('Get user predictions error:', error);
    res.status(500).json({ error: 'Failed to get predictions' });
  }
};
