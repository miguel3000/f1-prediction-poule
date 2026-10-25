import { query, getClient } from '../config/database';
import * as openF1Service from './openF1Service';

// The real starting grid for a race or sprint, with grid penalties applied. It becomes known
// about an hour before the start (see getStartingGrid in openF1Service); until then the
// prediction list follows the qualifying order. Predicting still means predicting the finishing
// order, so the grid only changes the order of the list, never the scoring.

export interface GridRace {
  id: number;
  season: number;
  race_date: any;
  race_type: 'main' | 'sprint';
}

export const fetchStartingGrid = async (race: GridRace): Promise<openF1Service.OpenF1GridRow[]> => {
  const raceDate = new Date(race.race_date).toISOString();
  const sessionKey =
    race.race_type === 'sprint'
      ? await openF1Service.getSprintSessionKey(race.season, raceDate)
      : await openF1Service.getRaceSessionKey(race.season, raceDate);
  if (!sessionKey) return [];
  return openF1Service.getStartingGrid(sessionKey);
};

export const getStoredGrid = async (raceId: number): Promise<Map<number, number>> => {
  const result = await query(
    `SELECT d.driver_number, g.position FROM starting_grid g JOIN drivers d ON d.id = g.driver_id WHERE g.race_id = $1`,
    [raceId]
  );
  return new Map(result.rows.map((r: any) => [r.driver_number, r.position]));
};

// Replaces the stored grid in one transaction. Drivers we do not know are skipped.
export const storeStartingGrid = async (race: GridRace, rows: openF1Service.OpenF1GridRow[]) => {
  const drivers = await query('SELECT id, driver_number FROM drivers WHERE season = $1 AND driver_number = ANY($2)', [
    race.season,
    rows.map((r) => r.driver_number),
  ]);
  const idByNumber = new Map(drivers.rows.map((d: any) => [d.driver_number, d.id]));

  const client = await getClient();
  let stored = 0;
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM starting_grid WHERE race_id = $1', [race.id]);
    for (const row of rows) {
      const driverId = idByNumber.get(row.driver_number);
      if (!driverId) continue;
      await client.query('INSERT INTO starting_grid (race_id, driver_id, position) VALUES ($1, $2, $3)', [
        race.id,
        driverId,
        row.position,
      ]);
      stored++;
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
  return { stored, unknown: rows.length - stored };
};
