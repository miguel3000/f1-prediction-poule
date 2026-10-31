import { query } from '../config/database';
import * as jolpiService from './jolpiService';
import * as openF1Service from './openF1Service';

// One place that finds and stores a session's qualifying order, used by the
// prediction page and by the background job, so both see the same data.
// A main race's qualifying comes from Jolpi, falling back to OpenF1 (which usually
// has it sooner); sprint qualifying exists only in OpenF1 (Jolpi has no such endpoint).

export interface QualifyingRace {
  id: number;
  season: number;
  round: number;
  race_date: any;
  race_type: 'main' | 'sprint';
}

export interface QualifyingRow {
  driver_number: number;
  position: number;
  q1: string | null;
  q2: string | null;
  q3: string | null;
}

export const fetchQualifying = async (
  race: QualifyingRace
): Promise<{ source: 'jolpi' | 'openf1'; rows: QualifyingRow[] } | null> => {
  if (race.race_type === 'main') {
    try {
      const results = await jolpiService.getQualifyingResults(race.season, race.round);
      if (results.length > 0) {
        return {
          source: 'jolpi',
          rows: results.map((q, i) => ({
            driver_number: parseInt(q.number, 10),
            position: parseInt(q.position, 10) || i + 1,
            q1: q.Q1 || null,
            q2: q.Q2 || null,
            q3: q.Q3 || null,
          })),
        };
      }
    } catch (error) {
      console.log('Jolpi qualifying not available, trying OpenF1');
    }
  }

  try {
    const sessionKey =
      race.race_type === 'sprint'
        ? await openF1Service.getSprintQualifyingSessionKey(race.season, race.race_date)
        : await openF1Service.getQualifyingSessionKey(race.season, race.race_date);
    const results = sessionKey ? await openF1Service.getQualifyingResults(sessionKey) : [];
    if (results.length > 0) {
      return {
        source: 'openf1',
        rows: results.map((q) => ({
          driver_number: q.driver_number,
          position: q.position,
          q1: q.q1 || null,
          q2: q.q2 || null,
          q3: q.q3 || null,
        })),
      };
    }
  } catch (error) {
    console.log('OpenF1 qualifying not available');
  }

  return null;
};

// Upserts the order into qualifying_results and returns it with driver details,
// in qualifying order. Drivers we do not know are skipped and counted.
export const storeQualifying = async (race: QualifyingRace, rows: QualifyingRow[]) => {
  const driversResult = await query(
    `SELECT id, driver_number, name, name_acronym, team, image_url
     FROM drivers WHERE driver_number = ANY($1) AND season = $2`,
    [rows.map((r) => r.driver_number), race.season]
  );
  const driverMap = new Map(driversResult.rows.map((d: any) => [d.driver_number, d]));

  const stored: any[] = [];
  let unknown = 0;
  for (const row of [...rows].sort((a, b) => a.position - b.position)) {
    const driver = driverMap.get(row.driver_number);
    if (!driver) {
      unknown++;
      continue;
    }
    await query(
      `INSERT INTO qualifying_results (race_id, driver_id, position, q1, q2, q3)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (race_id, driver_id) DO UPDATE SET
         position = EXCLUDED.position, q1 = EXCLUDED.q1, q2 = EXCLUDED.q2, q3 = EXCLUDED.q3`,
      [race.id, driver.id, row.position, row.q1, row.q2, row.q3]
    );
    stored.push({ ...driver, position: row.position, q1: row.q1, q2: row.q2, q3: row.q3 });
  }
  return { stored, unknown };
};

// A qualifying list must never leave a driver out of the prediction picker: anyone the session
// data lacks (no time set, data gap, a stand-in who just joined) is added after the classified
// drivers, in championship order, with no grid position.
export const withAllDrivers = async (season: number, classified: any[]) => {
  const have = new Set(classified.map((d: any) => d.id));
  const all = await query(
    `SELECT id, driver_number, name, name_acronym, team, image_url
     FROM drivers WHERE season = $1 ORDER BY total_points DESC, name ASC`,
    [season]
  );
  const missing = all.rows
    .filter((d: any) => !have.has(d.id))
    .map((d: any) => ({ ...d, position: null, q1: null, q2: null, q3: null }));
  return [...classified, ...missing];
};

// Before qualifying is known the list follows the previous race's classification, with every
// other driver added after it. Null when there is no earlier race with results.
export const previousRaceOrder = async (season: number, round: number): Promise<any[] | null> => {
  const previousRace = await query(
    `SELECT id FROM races WHERE season = $1 AND race_type = 'main' AND round < $2 ORDER BY round DESC LIMIT 1`,
    [season, round]
  );
  if (previousRace.rows.length === 0) return null;
  const results = await query(
    `SELECT rr.position, d.id, d.driver_number, d.name, d.name_acronym, d.team, d.image_url
     FROM race_results rr
     JOIN drivers d ON rr.driver_id = d.id
     WHERE rr.race_id = $1
     ORDER BY rr.position ASC`,
    [previousRace.rows[0].id]
  );
  if (results.rows.length === 0) return null;
  return withAllDrivers(season, results.rows);
};
