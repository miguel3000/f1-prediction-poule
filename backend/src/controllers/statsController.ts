import { Request, Response } from 'express';
import * as jolpiService from '../services/jolpiService';
import { query } from '../config/database';


// Get practice session results for a race
export const getPracticeResults = async (req: Request, res: Response) => {
  try {
    const { round, session } = req.params;
    const season = parseInt(req.query.season as string) || 2026;
    const sessionNum = parseInt(session) as 1 | 2 | 3;

    if (![1, 2, 3].includes(sessionNum)) {
      return res.status(400).json({ error: 'Session must be 1, 2, or 3' });
    }

    const results = await jolpiService.getPracticeResults(season, parseInt(round), sessionNum);

    const formattedResults = results.map((r: any, index: number) => ({
      position: parseInt(r.position) || index + 1,
      driverNumber: r.number,
      driverName: `${r.Driver.givenName} ${r.Driver.familyName}`,
      driverCode: r.Driver.code,
      team: r.Constructor?.name || 'Unknown',
      time: r.Time?.time || 'No time',
      laps: parseInt(r.laps) || 0
    }));

    res.json(formattedResults);
  } catch (error) {
    console.error('Get practice results error:', error);
    res.status(500).json({ error: 'Failed to get practice results' });
  }
};

// Get qualifying results for a race
export const getQualifyingResults = async (req: Request, res: Response) => {
  try {
    const { round } = req.params;
    const season = parseInt(req.query.season as string) || 2026;

    const results = await jolpiService.getQualifyingResults(season, parseInt(round));

    const formattedResults = results.map((r: any) => ({
      position: parseInt(r.position),
      driverNumber: r.number,
      driverName: `${r.Driver.givenName} ${r.Driver.familyName}`,
      driverCode: r.Driver.code,
      team: r.Constructor?.name || 'Unknown',
      q1: r.Q1 || null,
      q2: r.Q2 || null,
      q3: r.Q3 || null
    }));

    res.json(formattedResults);
  } catch (error) {
    console.error('Get qualifying results error:', error);
    res.status(500).json({ error: 'Failed to get qualifying results' });
  }
};

// Get race results for a race
export const getRaceResultsFromApi = async (req: Request, res: Response) => {
  try {
    const { round } = req.params;
    const season = parseInt(req.query.season as string) || 2026;

    const results = await jolpiService.getRaceResults(season, parseInt(round));

    const formattedResults = results.map((r: any) => ({
      position: parseInt(r.position),
      driverNumber: r.number,
      driverName: `${r.Driver.givenName} ${r.Driver.familyName}`,
      driverCode: r.Driver.code,
      team: r.Constructor?.name || 'Unknown',
      points: parseFloat(r.points),
      status: r.status,
      time: r.Time?.time || null,
      fastestLap: r.FastestLap?.Time?.time || null,
      fastestLapRank: r.FastestLap?.rank ? parseInt(r.FastestLap.rank) : null
    }));

    res.json(formattedResults);
  } catch (error) {
    console.error('Get race results error:', error);
    res.status(500).json({ error: 'Failed to get race results' });
  }
};

// Get sprint results for a race
export const getSprintResultsFromApi = async (req: Request, res: Response) => {
  try {
    const { round } = req.params;
    const season = parseInt(req.query.season as string) || 2026;

    const results = await jolpiService.getSprintResults(season, parseInt(round));

    const formattedResults = results.map((r: any) => ({
      position: parseInt(r.position),
      driverNumber: r.number,
      driverName: `${r.Driver.givenName} ${r.Driver.familyName}`,
      driverCode: r.Driver.code,
      team: r.Constructor?.name || 'Unknown',
      points: parseFloat(r.points),
      status: r.status,
      time: r.Time?.time || null
    }));

    res.json(formattedResults);
  } catch (error) {
    console.error('Get sprint results error:', error);
    res.status(500).json({ error: 'Failed to get sprint results' });
  }
};

// Get all completed races with basic info
export const getCompletedRaces = async (req: Request, res: Response) => {
  try {
    const season = parseInt(req.query.season as string) || 2026;

    const result = await query(
      `SELECT id, round, race_name, circuit_name, country, race_date, race_type, status
       FROM races
       WHERE season = $1 AND status IN ('completed', 'provisional')
       ORDER BY round ASC, race_type DESC`,
      [season]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Get completed races error:', error);
    res.status(500).json({ error: 'Failed to get completed races' });
  }
};

// Get season statistics summary
export const getSeasonStats = async (req: Request, res: Response) => {
  try {
    const season = parseInt(req.query.season as string) || 2026;

    // Get race counts
    const racesResult = await query(
      `SELECT
         COUNT(*) FILTER (WHERE status IN ('completed', 'provisional') AND race_type = 'main') as completed_races,
         COUNT(*) FILTER (WHERE status = 'upcoming' AND race_type = 'main') as upcoming_races,
         COUNT(*) FILTER (WHERE status IN ('completed', 'provisional') AND race_type = 'sprint') as completed_sprints,
         COUNT(*) FILTER (WHERE status = 'upcoming' AND race_type = 'sprint') as upcoming_sprints
       FROM races WHERE season = $1`,
      [season]
    );

    // Get top prediction scorers
    const topScorersResult = await query(
      `SELECT u.nickname, u.total_points
       FROM users u
       WHERE u.total_points > 0
       ORDER BY u.total_points DESC
       LIMIT 5`
    );

    // Get total predictions made
    const predictionsResult = await query(
      `SELECT
         (SELECT COUNT(*) FROM predictions) as main_predictions,
         (SELECT COUNT(*) FROM sprint_predictions) as sprint_predictions`
    );

    res.json({
      races: racesResult.rows[0],
      topScorers: topScorersResult.rows,
      predictions: predictionsResult.rows[0]
    });
  } catch (error) {
    console.error('Get season stats error:', error);
    res.status(500).json({ error: 'Failed to get season stats' });
  }
};

// Get sprint qualifying results (SQ) for a round — DB first, Jolpi fallback
export const getSprintQualifyingResultsFromApi = async (req: Request, res: Response) => {
  try {
    const { round } = req.params;
    const season = parseInt(req.query.season as string) || 2026;
    const roundNum = parseInt(round);

    // SQ results are stored in qualifying_results with race_type='sprint'
    const dbResult = await query(
      `SELECT qr.position, qr.q1, qr.q2, qr.q3,
              d.driver_number, d.name, d.name_acronym, d.team
       FROM qualifying_results qr
       JOIN drivers d ON qr.driver_id = d.id
       JOIN races r ON qr.race_id = r.id
       WHERE r.season = $1 AND r.round = $2 AND r.race_type = 'sprint'
       ORDER BY qr.position ASC`,
      [season, roundNum]
    );

    if (dbResult.rows.length > 0) {
      return res.json(dbResult.rows.map((r: any) => ({
        position: r.position,
        driverNumber: String(r.driver_number),
        driverName: r.name,
        driverCode: r.name_acronym || '',
        team: r.team,
        q1: r.q1 || null,
        q2: r.q2 || null,
        q3: r.q3 || null,
      })));
    }

    // Fallback: fetch from Jolpi sprintQualifying endpoint
    const results = await jolpiService.getSprintQualifyingResults(season, roundNum);
    if (!results || results.length === 0) return res.json([]);

    res.json(results.map((r: any) => ({
      position: parseInt(r.position),
      driverNumber: r.number,
      driverName: `${r.Driver.givenName} ${r.Driver.familyName}`,
      driverCode: r.Driver.code,
      team: r.Constructor?.name || 'Unknown',
      q1: r.SQ1 || null,
      q2: r.SQ2 || null,
      q3: r.SQ3 || null,
    })));
  } catch (error) {
    console.error('Get sprint qualifying results error:', error);
    res.status(500).json({ error: 'Failed to get sprint qualifying results' });
  }
};

// Fun and interesting season stats computed from the DB
export const getFunStats = async (req: Request, res: Response) => {
  try {
    const season = parseInt(req.query.season as string) || 2026;

    const [poles, wins, predictedWinners, crystalBall, biggestUpset, bestLap, consistency] =
      await Promise.all([
        // Most poles (qualifying P1, main races only)
        query(
          `SELECT d.name, d.name_acronym, d.team, COUNT(*) as count
           FROM qualifying_results qr
           JOIN drivers d ON qr.driver_id = d.id
           JOIN races r ON qr.race_id = r.id
           WHERE r.season = $1 AND r.race_type = 'main' AND qr.position = 1
           GROUP BY d.id, d.name, d.name_acronym, d.team
           ORDER BY count DESC LIMIT 5`,
          [season]
        ),

        // Most race wins
        query(
          `SELECT d.name, d.name_acronym, d.team, COUNT(*) as count
           FROM race_results rr
           JOIN drivers d ON rr.driver_id = d.id
           JOIN races r ON rr.race_id = r.id
           WHERE r.season = $1 AND rr.position = 1
           GROUP BY d.id, d.name, d.name_acronym, d.team
           ORDER BY count DESC LIMIT 5`,
          [season]
        ),

        // Driver most commonly picked as race winner (P1) by poule players
        query(
          `SELECT d.name, d.name_acronym, d.team, COUNT(*) as count
           FROM predictions p
           JOIN drivers d ON p.position_1 = d.id
           JOIN races r ON p.race_id = r.id
           WHERE r.season = $1
           GROUP BY d.id, d.name, d.name_acronym, d.team
           ORDER BY count DESC LIMIT 5`,
          [season]
        ),

        // Crystal ball: users who correctly predicted the race winner most often
        query(
          `SELECT u.nickname, COUNT(*) as count
           FROM predictions p
           JOIN users u ON p.user_id = u.id
           JOIN races r ON p.race_id = r.id
           JOIN race_results rr ON p.race_id = rr.race_id AND rr.position = 1
           WHERE p.position_1 = rr.driver_id AND r.season = $1
           GROUP BY u.id, u.nickname
           ORDER BY count DESC LIMIT 5`,
          [season]
        ),

        // Biggest upset: race where fewest poule players predicted the actual winner
        query(
          `WITH race_accuracy AS (
             SELECT p.race_id,
                    COUNT(*) as total,
                    SUM(CASE WHEN p.position_1 = rr.driver_id THEN 1 ELSE 0 END) as correct
             FROM predictions p
             JOIN races r ON p.race_id = r.id
             JOIN race_results rr ON p.race_id = rr.race_id AND rr.position = 1
             WHERE r.season = $1
             GROUP BY p.race_id
             HAVING COUNT(*) >= 2
           )
           SELECT r.race_name, r.round,
                  ra.total, ra.correct,
                  ROUND(100.0 * ra.correct / ra.total, 1) as accuracy_pct,
                  d.name as winner_name, d.name_acronym as winner_acronym, d.team as winner_team
           FROM race_accuracy ra
           JOIN races r ON ra.race_id = r.id
           JOIN race_results rr ON ra.race_id = rr.race_id AND rr.position = 1
           JOIN drivers d ON rr.driver_id = d.id
           ORDER BY accuracy_pct ASC LIMIT 1`,
          [season]
        ),

        // Season's fastest qualifying lap (best Q3 across all main race qualifying sessions)
        query(
          `SELECT d.name, d.name_acronym, d.team, r.race_name, r.round, qr.q3 as lap_time
           FROM qualifying_results qr
           JOIN drivers d ON qr.driver_id = d.id
           JOIN races r ON qr.race_id = r.id
           WHERE r.season = $1 AND r.race_type = 'main' AND qr.q3 IS NOT NULL
           ORDER BY qr.q3 ASC LIMIT 1`,
          [season]
        ),

        // Most consistent poule predictor (avg points/race, min 2 completed races)
        query(
          `SELECT u.nickname,
                  COUNT(*) as races,
                  ROUND(AVG(p.points_earned), 1) as avg_points,
                  MAX(p.points_earned) as best_race
           FROM predictions p
           JOIN users u ON p.user_id = u.id
           JOIN races r ON p.race_id = r.id
           WHERE r.season = $1 AND r.status IN ('completed', 'provisional')
           GROUP BY u.id, u.nickname
           HAVING COUNT(*) >= 2
           ORDER BY avg_points DESC LIMIT 5`,
          [season]
        ),
      ]);

    res.json({
      poles: poles.rows,
      wins: wins.rows,
      predictedWinners: predictedWinners.rows,
      crystalBall: crystalBall.rows,
      biggestUpset: biggestUpset.rows[0] || null,
      bestLap: bestLap.rows[0] || null,
      consistency: consistency.rows,
    });
  } catch (error) {
    console.error('Get fun stats error:', error);
    res.status(500).json({ error: 'Failed to get fun stats' });
  }
};
