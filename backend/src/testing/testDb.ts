import path from 'path';
import { spawnSync } from 'child_process';
import pool, { query } from '../config/database';

// Helpers for the backend tests. They run against the throwaway database in DATABASE_URL
// (docker-compose.test.yml or scripts/test-db.sh, port 5433); `npm test` sets the variable.

// Empties the database and builds the real schema with the real migration, so tests see exactly
// what production sees.
export const resetTestDatabase = async (): Promise<void> => {
  if (!/f1_test/.test(process.env.DATABASE_URL || '')) {
    throw new Error('Refusing to reset a database that is not named f1_test');
  }
  await query('DROP SCHEMA public CASCADE');
  await query('CREATE SCHEMA public');
  runMigration();
};

// Runs dist/database/migrate.js and throws if it fails.
export const runMigration = (): void => {
  const result = spawnSync('node', [path.join(__dirname, '..', 'database', 'migrate.js')], {
    env: process.env,
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    throw new Error(`migration failed (${result.status}): ${result.stdout}${result.stderr}`);
  }
};

export const closeTestDatabase = async (): Promise<void> => {
  await pool.end();
};

let counter = 0;

export const createTestUser = async (
  opts: { nickname?: string; email?: string; canStartGroups?: boolean; playsInMain?: boolean; isAdmin?: boolean } = {}
): Promise<{ id: number; nickname: string }> => {
  counter += 1;
  const nickname = opts.nickname ?? `tester${counter}`;
  const email = opts.email ?? `${nickname.toLowerCase().replace(/[^a-z0-9]/g, '')}${counter}@example.invalid`;

  // Only the columns the test names; everything else takes the column default.
  const columns: Record<string, unknown> = { nickname, email, password_hash: 'x' };
  if (opts.canStartGroups !== undefined) columns.can_start_groups = opts.canStartGroups;
  if (opts.playsInMain !== undefined) columns.plays_in_main = opts.playsInMain;
  if (opts.isAdmin !== undefined) columns.is_admin = opts.isAdmin;

  const names = Object.keys(columns);
  const result = await query(
    `INSERT INTO users (${names.join(', ')}) VALUES (${names.map((_, i) => `$${i + 1}`).join(', ')}) RETURNING id, nickname`,
    Object.values(columns)
  );
  return result.rows[0];
};

// Ten 2026 drivers (numbers 1 to 10) and three races: a main race and a sprint that are over, and
// a main race still to come. Safe to call once per reset database.
export const seedSeason = async (): Promise<{
  driverIds: number[];
  pastRaceId: number;
  futureRaceId: number;
  pastSprintId: number;
}> => {
  const driverIds: number[] = [];
  for (let n = 1; n <= 10; n++) {
    const d = await query(
      `INSERT INTO drivers (driver_number, name, name_acronym, team, season) VALUES ($1, $2, $3, $4, 2026) RETURNING id`,
      [n, `Driver ${n}`, `D${String(n).padStart(2, '0')}`, `Team ${Math.ceil(n / 2)}`]
    );
    driverIds.push(d.rows[0].id);
  }
  const race = async (round: number, type: 'main' | 'sprint', daysFromNow: number, status: string) => {
    const r = await query(
      `INSERT INTO races (season, round, race_name, circuit_name, country, race_date, race_type, status)
       VALUES (2026, $1, $2, 'Test Circuit', 'Testland', NOW() + ($3 || ' days')::interval, $4, $5) RETURNING id`,
      [round, `Test Grand Prix ${round}${type === 'sprint' ? ' Sprint' : ''}`, String(daysFromNow), type, status]
    );
    return r.rows[0].id as number;
  };
  return {
    driverIds,
    pastRaceId: await race(1, 'main', -7, 'completed'),
    pastSprintId: await race(1, 'sprint', -8, 'completed'),
    futureRaceId: await race(2, 'main', 7, 'upcoming'),
  };
};

// Writes a prediction for a main race (10 positions, optional DNF pick) or a sprint (8 positions).
export const addPrediction = async (
  userId: number,
  raceId: number,
  driverIds: number[],
  pointsEarned: number,
  dnfPickDriverId?: number
): Promise<void> => {
  const race = await query('SELECT race_type FROM races WHERE id = $1', [raceId]);
  const isSprint = race.rows[0].race_type === 'sprint';
  const slots = isSprint ? 8 : 10;
  const positions = Array.from({ length: slots }, (_, i) => `position_${i + 1}`);
  const columns = ['user_id', 'race_id', ...positions, 'points_earned'];
  const values: unknown[] = [userId, raceId, ...driverIds.slice(0, slots), pointsEarned];
  if (!isSprint) {
    columns.push('dnf_pick');
    values.push(dnfPickDriverId ?? null);
  }
  await query(
    `INSERT INTO ${isSprint ? 'sprint_predictions' : 'predictions'} (${columns.join(', ')})
     VALUES (${columns.map((_, i) => `$${i + 1}`).join(', ')})`,
    values
  );
};
