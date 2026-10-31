import { query, getClient } from '../config/database';
import { isPredictionLocked } from '../utils/predictionLock';

// Drivers who are not racing a weekend (illness, a stand-in drives). They are left out of the
// prediction picker, refused by the prediction endpoints, and any prediction that already uses one
// is deleted so the player can fill it in again (see the warning email). The weekend is a season and
// a round, so it covers the sprint and the main race.

// What a player sees when they submit a prediction (from a page loaded before the driver was taken
// out) that still uses a driver who is not racing.
export const DRIVER_NOT_RACING_ERROR =
  'A driver in your prediction is not racing this weekend. Reload the page and pick again.';

export class DriverExclusionError extends Error {
  constructor(public code: 'too_late' | 'not_found' | 'same_driver') {
    super(code);
  }
}

export interface ResetPrediction {
  userId: number;
  nickname: string;
  email: string;
  language: string | null;
  raceId: number;
  raceName: string;
  isSprint: boolean;
  driverName: string;
  standInName: string | null;
}

export const getExcludedDriverIds = async (season: number, round: number): Promise<number[]> => {
  const result = await query(
    'SELECT driver_id FROM driver_exclusions WHERE season = $1 AND round = $2 ORDER BY driver_id',
    [season, round]
  );
  return result.rows.map((r: any) => r.driver_id);
};

export const listExclusions = async (season: number) => {
  const result = await query(
    `SELECT e.round, e.driver_id, d.name AS driver_name, s.name AS stand_in_name
     FROM driver_exclusions e
     JOIN drivers d ON d.id = e.driver_id
     LEFT JOIN drivers s ON s.id = e.replaced_by_driver_id
     WHERE e.season = $1
     ORDER BY e.round, d.name`,
    [season]
  );
  return result.rows.map((r: any) => ({
    round: r.round as number,
    driverId: r.driver_id as number,
    driverName: r.driver_name as string,
    replacedByName: (r.stand_in_name ?? null) as string | null,
  }));
};

// True when a stored prediction (position_1..position_N, plus the first-retirement pick unless it is
// a sprint) uses one of the excluded drivers.
export const usesExcludedDriver = (
  pred: Record<string, any>,
  slots: number,
  excludedIds: number[],
  includeFirstRetirement = true
): boolean => {
  if (excludedIds.length === 0) return false;
  const excluded = new Set(excludedIds);
  for (let i = 1; i <= slots; i++) {
    if (excluded.has(pred[`position_${i}`])) return true;
  }
  return includeFirstRetirement && pred.dnf_pick != null && excluded.has(pred.dnf_pick);
};

// Marks a driver as not racing a weekend and deletes every not-yet-locked prediction that uses him
// (a position or the first-retirement pick). Returns who was reset, so they can be told.
// Doing it twice is harmless: the second time nothing is left to reset.
export const excludeDriver = async (
  season: number,
  round: number,
  driverId: number,
  replacedByDriverId?: number | null
): Promise<ResetPrediction[]> => {
  if (replacedByDriverId != null && replacedByDriverId === driverId) throw new DriverExclusionError('same_driver');

  const races = (
    await query(
      'SELECT id, race_name, race_type, race_date FROM races WHERE season = $1 AND round = $2 ORDER BY race_date',
      [season, round]
    )
  ).rows;
  if (races.length === 0) throw new DriverExclusionError('not_found');

  const ids = [driverId, ...(replacedByDriverId != null ? [replacedByDriverId] : [])];
  const found = await query('SELECT id, name FROM drivers WHERE season = $1 AND id = ANY($2)', [season, ids]);
  const names = new Map<number, string>(found.rows.map((r: any) => [r.id, r.name]));
  if (names.size !== new Set(ids).size) throw new DriverExclusionError('not_found');

  // A race that has started keeps its predictions; a weekend with nothing left to change is refused.
  const open = races.filter((r: any) => !isPredictionLocked(r.race_date));
  if (open.length === 0) throw new DriverExclusionError('too_late');

  const client = await getClient();
  const reset: ResetPrediction[] = [];
  try {
    await client.query('BEGIN');
    await client.query(
      `INSERT INTO driver_exclusions (season, round, driver_id, replaced_by_driver_id)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (season, round, driver_id) DO UPDATE
         SET replaced_by_driver_id = COALESCE(EXCLUDED.replaced_by_driver_id, driver_exclusions.replaced_by_driver_id)`,
      [season, round, driverId, replacedByDriverId ?? null]
    );

    for (const race of open) {
      const isSprint = race.race_type === 'sprint';
      const slots = Array.from({ length: isSprint ? 8 : 10 }, (_, i) => `p.position_${i + 1}`).join(', ');
      const uses = isSprint ? `$2 = ANY(ARRAY[${slots}])` : `($2 = ANY(ARRAY[${slots}]) OR p.dnf_pick = $2)`;
      const gone = await client.query(
        `WITH gone AS (
           DELETE FROM ${isSprint ? 'sprint_predictions' : 'predictions'} p
           WHERE p.race_id = $1 AND ${uses}
           RETURNING p.user_id
         )
         SELECT u.id, u.nickname, u.email, u.language FROM gone JOIN users u ON u.id = gone.user_id
         ORDER BY lower(u.nickname)`,
        [race.id, driverId]
      );
      for (const u of gone.rows) {
        reset.push({
          userId: u.id,
          nickname: u.nickname,
          email: u.email,
          language: u.language ?? null,
          raceId: race.id,
          raceName: race.race_name,
          isSprint,
          driverName: names.get(driverId)!,
          standInName: replacedByDriverId != null ? names.get(replacedByDriverId) ?? null : null,
        });
      }
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
  return reset;
};

// Puts a driver back in the picker. Predictions that were reset stay reset.
export const includeDriver = async (season: number, round: number, driverId: number): Promise<void> => {
  await query('DELETE FROM driver_exclusions WHERE season = $1 AND round = $2 AND driver_id = $3', [
    season,
    round,
    driverId,
  ]);
};
