import { Request, Response } from 'express';
import { query } from '../config/database';

export const getLeaderboard = async (req: Request, res: Response) => {
  try {
    const result = await query(
      `WITH current_season AS (
        SELECT EXTRACT(YEAR FROM CURRENT_DATE)::int AS season
      ),
      last_completed_race AS (
        SELECT id FROM races
        WHERE status IN ('completed', 'provisional')
          AND season = (SELECT season FROM current_season)
        ORDER BY race_date DESC
        LIMIT 1
      ),
      last_race_points AS (
        SELECT user_id, points_earned
        FROM predictions WHERE race_id = (SELECT id FROM last_completed_race)
        UNION ALL
        SELECT user_id, points_earned
        FROM sprint_predictions WHERE race_id = (SELECT id FROM last_completed_race)
      ),
      last_race_ranked AS (
        SELECT user_id, points_earned,
          RANK() OVER (ORDER BY points_earned DESC) as last_race_rank
        FROM last_race_points
      ),
      best_race AS (
        SELECT DISTINCT ON (user_id)
          user_id, points_earned as best_points, race_id
        FROM (
          SELECT p.user_id, p.points_earned, p.race_id
          FROM predictions p
          JOIN races r ON p.race_id = r.id
          WHERE p.points_earned > 0 AND r.season = (SELECT season FROM current_season)
          UNION ALL
          SELECT sp.user_id, sp.points_earned, sp.race_id
          FROM sprint_predictions sp
          JOIN races r ON sp.race_id = r.id
          WHERE sp.points_earned > 0 AND r.season = (SELECT season FROM current_season)
        ) all_preds
        ORDER BY user_id, points_earned DESC
      )
      SELECT
        u.id, u.nickname, u.avatar_url, u.total_points,
        ROW_NUMBER() OVER (ORDER BY u.total_points DESC, u.nickname ASC) as rank,
        COALESCE(lr.points_earned, 0) as last_race_points,
        lr.last_race_rank,
        COALESCE(br.best_points, 0) as best_race_points,
        r.race_name as best_race_name,
        MAX(u.total_points) OVER () - u.total_points as diff_to_leader
      FROM users u
      LEFT JOIN last_race_ranked lr ON u.id = lr.user_id
      LEFT JOIN best_race br ON u.id = br.user_id
      LEFT JOIN races r ON br.race_id = r.id
      ORDER BY u.total_points DESC, u.nickname ASC`
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Get leaderboard error:', error);
    res.status(500).json({ error: 'Failed to get leaderboard' });
  }
};

export const getTopThree = async (req: Request, res: Response) => {
  try {
    const result = await query(
      `SELECT
        id, nickname, avatar_url, total_points,
        ROW_NUMBER() OVER (ORDER BY total_points DESC) as rank
       FROM users
       ORDER BY total_points DESC, nickname ASC
       LIMIT 3`
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Get top three error:', error);
    res.status(500).json({ error: 'Failed to get top three' });
  }
};

export const getUserRank = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;

    // Use window function for efficient rank calculation (handles ties properly)
    const result = await query(
      `SELECT id, nickname, avatar_url, total_points, rank FROM (
        SELECT
          id, nickname, avatar_url, total_points,
          DENSE_RANK() OVER (ORDER BY total_points DESC) as rank
        FROM users
      ) ranked
      WHERE id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get user rank error:', error);
    res.status(500).json({ error: 'Failed to get user rank' });
  }
};

export const getSeasonHistory = async (req: Request, res: Response) => {
  try {
    const result = await query(
      `WITH current_season AS (
        SELECT EXTRACT(YEAR FROM CURRENT_DATE)::int AS season
      ),
      season_races AS (
        SELECT id, race_name, country, race_date, race_type, round
        FROM races
        WHERE season = (SELECT season FROM current_season)
          AND status IN ('completed', 'provisional')
        ORDER BY race_date ASC
      ),
      all_predictions AS (
        SELECT p.user_id, p.race_id, p.points_earned
        FROM predictions p
        JOIN season_races sr ON p.race_id = sr.id
        UNION ALL
        SELECT sp.user_id, sp.race_id, sp.points_earned
        FROM sprint_predictions sp
        JOIN season_races sr ON sp.race_id = sr.id
      )
      SELECT
        u.id AS user_id,
        u.nickname,
        u.avatar_url,
        sr.id AS race_id,
        sr.race_name,
        sr.country,
        sr.race_date,
        sr.race_type,
        COALESCE(ap.points_earned, 0) AS points_earned
      FROM users u
      CROSS JOIN season_races sr
      LEFT JOIN all_predictions ap ON ap.user_id = u.id AND ap.race_id = sr.id
      ORDER BY sr.race_date ASC, u.nickname ASC`
    );

    // Pivot rows into { races[], users[] } structure
    const racesMap = new Map<number, { id: number; name: string; country: string; date: string; race_type: string }>();
    const usersMap = new Map<number, { id: number; nickname: string; avatar_url: string | null; points_per_race: number[] }>();

    for (const row of result.rows) {
      if (!racesMap.has(row.race_id)) {
        racesMap.set(row.race_id, {
          id: row.race_id,
          name: row.race_name,
          country: row.country,
          date: row.race_date,
          race_type: row.race_type
        });
      }
      if (!usersMap.has(row.user_id)) {
        usersMap.set(row.user_id, {
          id: row.user_id,
          nickname: row.nickname,
          avatar_url: row.avatar_url,
          points_per_race: []
        });
      }
      usersMap.get(row.user_id)!.points_per_race.push(parseInt(row.points_earned));
    }

    res.json({
      races: Array.from(racesMap.values()),
      users: Array.from(usersMap.values())
    });
  } catch (error) {
    console.error('Get season history error:', error);
    res.status(500).json({ error: 'Failed to get season history' });
  }
};

// F1 points systems
const mainPointsMap: { [key: number]: number } = {
  1: 25, 2: 18, 3: 15, 4: 12, 5: 10, 6: 8, 7: 6, 8: 4, 9: 2, 10: 1
};

const sprintPointsMap: { [key: number]: number } = {
  1: 8, 2: 7, 3: 6, 4: 5, 5: 4, 6: 3, 7: 2, 8: 1
};

// Calculate points for all users after a race is completed
export const calculateRacePoints = async (raceId: number) => {
  try {
    // Get race info to determine type
    const raceQuery = await query('SELECT race_type FROM races WHERE id = $1', [raceId]);
    if (raceQuery.rows.length === 0) {
      console.log('Race not found:', raceId);
      return;
    }
    const raceType = raceQuery.rows[0].race_type || 'main';
    const isSprint = raceType === 'sprint';

    // Get race results from the correct table
    const resultsTable = isSprint ? 'sprint_results' : 'race_results';
    const resultsQuery = await query(
      `SELECT * FROM ${resultsTable} WHERE race_id = $1 ORDER BY position ASC`,
      [raceId]
    );

    const results = resultsQuery.rows;

    if (results.length === 0) {
      console.log('No race results found for race:', raceId);
      return;
    }

    // Get predictions from appropriate table
    const predictionTable = isSprint ? 'sprint_predictions' : 'predictions';
    const predictionsQuery = await query(
      `SELECT * FROM ${predictionTable} WHERE race_id = $1`,
      [raceId]
    );

    const predictions = predictionsQuery.rows;

    // Use appropriate points system
    const pointsMap = isSprint ? sprintPointsMap : mainPointsMap;
    const maxPositions = isSprint ? 8 : 10;
    const scoringPositions = isSprint ? 8 : 10;

    // Calculate points for all predictions
    const predictionUpdates: { id: number; points: number; userId: number }[] = [];

    for (const prediction of predictions) {
      let pointsEarned = 0;

      // Check each position
      for (let predictedPos = 1; predictedPos <= maxPositions; predictedPos++) {
        const predictedDriverId = prediction[`position_${predictedPos}`];

        // Find the actual position of the predicted driver
        const actualResult = results.find((r: any) => r.driver_id === predictedDriverId);

        if (actualResult && actualResult.position <= scoringPositions) {
          const basePoints = pointsMap[predictedPos] || 0;
          const posDiff = Math.abs(predictedPos - actualResult.position);

          if (posDiff === 0) {
            pointsEarned += basePoints;
          } else if (posDiff === 1) {
            pointsEarned += Math.round(basePoints * 0.5);
          }
        }
      }

      predictionUpdates.push({ id: prediction.id, points: pointsEarned, userId: prediction.user_id });
    }

    // Batch update predictions (single query instead of N queries)
    if (predictionUpdates.length > 0) {
      const predictionIds = predictionUpdates.map(p => p.id);
      const pointsCases = predictionUpdates.map(p => `WHEN ${p.id} THEN ${p.points}`).join(' ');

      await query(
        `UPDATE ${predictionTable}
         SET points_earned = CASE id ${pointsCases} END,
             is_locked = TRUE
         WHERE id = ANY($1)`,
        [predictionIds]
      );

      // Batch update user points (aggregate points per user first)
      const userPointsMap = new Map<number, number>();
      for (const update of predictionUpdates) {
        userPointsMap.set(update.userId, (userPointsMap.get(update.userId) || 0) + update.points);
      }

      // Single query to update all user points
      const userIds = Array.from(userPointsMap.keys());
      const userPointsCases = Array.from(userPointsMap.entries())
        .map(([userId, points]) => `WHEN ${userId} THEN total_points + ${points}`)
        .join(' ');

      await query(
        `UPDATE users
         SET total_points = CASE id ${userPointsCases} END
         WHERE id = ANY($1)`,
        [userIds]
      );
    }

    console.log(`Points calculated for ${predictions.length} ${raceType} predictions for race ${raceId}`);
  } catch (error) {
    console.error('Calculate race points error:', error);
    throw error;
  }
};
