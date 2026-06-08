import { Request, Response } from 'express';
import { query } from '../config/database';
import { sendPredictionConfirmation } from '../services/emailService';

export const submitSprintPrediction = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { raceId, positions } = req.body;

    if (!raceId || !positions || positions.length !== 8) {
      return res.status(400).json({ error: 'Race ID and 8 positions are required for sprint predictions' });
    }

    // Check if race exists and is a sprint race
    const raceResult = await query('SELECT * FROM races WHERE id = $1', [raceId]);

    if (raceResult.rows.length === 0) {
      return res.status(404).json({ error: 'Race not found' });
    }

    const race = raceResult.rows[0];

    if (race.race_type !== 'sprint') {
      return res.status(400).json({ error: 'This is not a sprint race' });
    }

    // Check if predictions are locked (1 minute before race)
    const lockTime = new Date(race.race_date.getTime() - parseInt(process.env.PREDICTION_LOCK_MINUTES || '1') * 60 * 1000);
    const now = new Date();

    if (now >= lockTime) {
      return res.status(400).json({ error: 'Predictions are locked for this sprint race' });
    }

    // Check if user already has a prediction for this race
    const existingPrediction = await query(
      'SELECT * FROM sprint_predictions WHERE user_id = $1 AND race_id = $2',
      [userId, raceId]
    );

    if (existingPrediction.rows.length > 0) {
      // Update existing prediction
      await query(
        `UPDATE sprint_predictions SET
          position_1 = $1, position_2 = $2, position_3 = $3, position_4 = $4,
          position_5 = $5, position_6 = $6, position_7 = $7, position_8 = $8,
          submitted_at = CURRENT_TIMESTAMP
         WHERE user_id = $9 AND race_id = $10`,
        [...positions, userId, raceId]
      );
    } else {
      // Create new prediction
      await query(
        `INSERT INTO sprint_predictions
          (user_id, race_id, position_1, position_2, position_3, position_4,
           position_5, position_6, position_7, position_8)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [userId, raceId, ...positions]
      );
    }

    // Get driver names for confirmation email
    const driverResult = await query(
      'SELECT id, name FROM drivers WHERE id = ANY($1)',
      [positions]
    );
    const driverMap = new Map(driverResult.rows.map((d: any) => [d.id, d.name]));
    const driverNames = positions.map((id: number) => driverMap.get(id)).filter(Boolean) as string[];

    // Get user info
    const userResult = await query('SELECT nickname, email FROM users WHERE id = $1', [userId]);
    const user = userResult.rows[0];

    // Send confirmation email
    await sendPredictionConfirmation(user.email, user.nickname, `${race.race_name} (Sprint)`, driverNames);

    res.json({ message: 'Sprint prediction submitted successfully', raceId, positions });
  } catch (error) {
    console.error('Submit sprint prediction error:', error);
    res.status(500).json({ error: 'Failed to submit sprint prediction' });
  }
};

export const getSprintPrediction = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { raceId } = req.params;

    const result = await query(
      'SELECT * FROM sprint_predictions WHERE user_id = $1 AND race_id = $2',
      [userId, raceId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Sprint prediction not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get sprint prediction error:', error);
    res.status(500).json({ error: 'Failed to get sprint prediction' });
  }
};

export const getUserSprintPredictions = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;

    const result = await query(
      `SELECT p.*, r.race_name, r.race_date, r.round, r.season, r.status
       FROM sprint_predictions p
       JOIN races r ON p.race_id = r.id
       WHERE p.user_id = $1
       ORDER BY r.race_date DESC`,
      [userId]
    );

    // Transform predictions to include driver details
    const predictions = await Promise.all(result.rows.map(async (prediction: any) => {
      // Get all driver IDs from the prediction
      const driverIds = [];
      for (let i = 1; i <= 8; i++) {
        if (prediction[`position_${i}`]) {
          driverIds.push(prediction[`position_${i}`]);
        }
      }

      // Fetch driver details
      const driversResult = await query(
        'SELECT id, name, team, driver_number FROM drivers WHERE id = ANY($1)',
        [driverIds]
      );
      const driverMap = new Map(driversResult.rows.map((d: any) => [d.id, d]));

      // Build positions array in order
      const positions = [];
      for (let i = 1; i <= 8; i++) {
        const driverId = prediction[`position_${i}`];
        if (driverId && driverMap.has(driverId)) {
          positions.push(driverMap.get(driverId));
        }
      }

      // Compute per-driver points for completed/provisional sprint races
      const sprintPointsMap: Record<number, number> = { 1: 8, 2: 7, 3: 6, 4: 5, 5: 4, 6: 3, 7: 2, 8: 1 };
      let positionPoints: Array<{ pointsEarned: number; hasBonus: boolean; actualPosition: number | null }> | undefined;

      if (prediction.status === 'completed' || prediction.status === 'provisional') {
        const resultsResult = await query(
          'SELECT driver_id, position FROM sprint_results WHERE race_id = $1',
          [prediction.race_id]
        );
        const resultsMap = new Map(resultsResult.rows.map((r: any) => [r.driver_id, r.position]));

        positionPoints = [];
        for (let i = 1; i <= 8; i++) {
          const driverId = prediction[`position_${i}`];
          const actualPos: number | null = resultsMap.get(driverId) ?? null;
          if (actualPos && actualPos <= 8) {
            const basePoints = sprintPointsMap[actualPos] || 0;
            const hasBonus = Math.abs(i - actualPos) <= 1;
            positionPoints.push({ pointsEarned: hasBonus ? Math.round(basePoints * 1.5) : basePoints, hasBonus, actualPosition: actualPos });
          } else {
            positionPoints.push({ pointsEarned: 0, hasBonus: false, actualPosition: actualPos });
          }
        }
      }

      return {
        id: prediction.id,
        race_id: prediction.race_id,
        race_name: prediction.race_name,
        race_date: prediction.race_date,
        status: prediction.status,
        positions: positions,
        points: prediction.points_earned,
        positionPoints,
        race_type: 'sprint'
      };
    }));

    res.json(predictions);
  } catch (error) {
    console.error('Get user sprint predictions error:', error);
    res.status(500).json({ error: 'Failed to get sprint predictions' });
  }
};
