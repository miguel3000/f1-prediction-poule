import { getClient } from '../config/database';

export interface ResultRow {
  driverId: number;
  position: number;
  points: number;
  status: string;
}

// Swaps a race's stored results for a new set. Everything is checked before the
// old rows are touched, and the delete + insert run as one transaction, so a bad
// row (e.g. a retired driver with no position) or a failed insert leaves the
// existing results exactly as they were instead of wiping them.
export const replaceRaceResults = async (
  table: 'race_results' | 'sprint_results',
  raceId: number,
  rows: ResultRow[]
): Promise<number> => {
  if (rows.length === 0) {
    throw new Error('No usable result rows — existing results left untouched');
  }
  for (const row of rows) {
    if (!Number.isInteger(row.driverId) || !Number.isInteger(row.position) || row.position < 1 || !Number.isFinite(row.points)) {
      throw new Error(
        `Invalid result row (driver ${row.driverId}, position ${row.position}, points ${row.points}) — existing results left untouched`
      );
    }
  }

  const values: string[] = [];
  const params: any[] = [];
  rows.forEach((row, i) => {
    const p = i * 5;
    values.push(`($${p + 1}, $${p + 2}, $${p + 3}, $${p + 4}, $${p + 5})`);
    params.push(raceId, row.driverId, row.position, row.points, row.status);
  });

  const client = await getClient();
  try {
    await client.query('BEGIN');
    await client.query(`DELETE FROM ${table} WHERE race_id = $1`, [raceId]);
    await client.query(
      `INSERT INTO ${table} (race_id, driver_id, position, points, status) VALUES ${values.join(', ')}`,
      params
    );
    await client.query('COMMIT');
    return rows.length;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};
