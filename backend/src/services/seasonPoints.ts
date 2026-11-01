import { query } from '../config/database';

// Players' points are never stored as a running total: a season's total is the sum of what its
// predictions scored (main races and sprints). One rule for every table, so a new season starts on
// zero by itself and an old one can be shown at any time.
//
// SQL fragment for a CTE named season_points(user_id, points) for the season in the given
// parameter placeholder, for example seasonPointsCte('$2').
export const seasonPointsCte = (seasonParam: string): string => `season_points AS (
        SELECT user_id, SUM(points_earned)::int AS points
        FROM (
          SELECT p.user_id, p.points_earned
          FROM predictions p JOIN races r ON r.id = p.race_id
          WHERE r.season = ${seasonParam}
          UNION ALL
          SELECT sp.user_id, sp.points_earned
          FROM sprint_predictions sp JOIN races r ON r.id = sp.race_id
          WHERE r.season = ${seasonParam}
        ) scored
        GROUP BY user_id
      )`;

// Season totals for the given players; a player with no scored predictions is on 0.
export const getSeasonTotals = async (userIds: number[], season: number): Promise<Map<number, number>> => {
  const result = await query(
    `WITH ${seasonPointsCte('$2')}
     SELECT u.id, COALESCE(sp.points, 0) AS points
     FROM users u LEFT JOIN season_points sp ON sp.user_id = u.id
     WHERE u.id = ANY($1)`,
    [userIds, season]
  );
  return new Map(result.rows.map((r: any) => [Number(r.id), Number(r.points)]));
};

export const getSeasonTotal = async (userId: number, season: number): Promise<number> =>
  (await getSeasonTotals([userId], season)).get(userId) ?? 0;
