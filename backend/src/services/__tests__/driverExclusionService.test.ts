import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { query } from '../../config/database';
import { resetTestDatabase, closeTestDatabase, createTestUser, seedSeason, addPrediction } from '../../testing/testDb';
import {
  excludeDriver,
  includeDriver,
  getExcludedDriverIds,
  listExclusions,
  usesExcludedDriver,
  DriverExclusionError,
} from '../driverExclusionService';

let season: Awaited<ReturnType<typeof seedSeason>>;
let A: { id: number; nickname: string };
let B: { id: number; nickname: string };
let C: { id: number; nickname: string };
let sprintRaceId = 0;
let mainRaceId = 0;
let all: number[] = []; // the ten seeded drivers plus two more, so ten picks can avoid any one driver

// A sprint weekend still to come (round 5): a sprint and a main race, so both can be tested.
before(async () => {
  await resetTestDatabase();
  season = await seedSeason();
  A = await createTestUser({ nickname: 'Alice' });
  B = await createTestUser({ nickname: 'Bob' });
  C = await createTestUser({ nickname: 'Carol' });
  const race = async (type: 'main' | 'sprint', days: number) =>
    (
      await query(
        `INSERT INTO races (season, round, race_name, circuit_name, country, race_date, race_type, status)
         VALUES (2026, 5, 'Weekend GP', 'Test Circuit', 'Testland', NOW() + ($1 || ' days')::interval, $2, 'upcoming') RETURNING id`,
        [String(days), type]
      )
    ).rows[0].id as number;
  sprintRaceId = await race('sprint', 8);
  mainRaceId = await race('main', 9);
  all = [...season.driverIds];
  for (const n of [11, 12]) {
    const extra = await query(
      `INSERT INTO drivers (driver_number, name, name_acronym, team, season) VALUES ($1, $2, $3, 'Team 6', 2026) RETURNING id`,
      [n, `Driver ${n}`, `D${n}`]
    );
    all.push(extra.rows[0].id);
  }
});
after(closeTestDatabase);

const d = (n: number) => all[n - 1];
const without = (driver: number, count: number) => all.filter((id) => id !== driver).slice(0, count);
const predictionsOf = async (userId: number, table: 'predictions' | 'sprint_predictions') =>
  (await query(`SELECT race_id FROM ${table} WHERE user_id = $1`, [userId])).rows.map((r: any) => r.race_id);

test('excluding_a_driver_resets_main_and_sprint_predictions_that_use_him_anywhere', async () => {
  // Alice has him in a position, Bob only as first-retirement pick, Carol does not use him.
  await addPrediction(A.id, mainRaceId, [d(1), ...without(d(1), 9)], 0, d(5));
  await addPrediction(B.id, mainRaceId, without(d(1), 10), 0, d(1));
  await addPrediction(C.id, mainRaceId, without(d(1), 10), 0, d(3));
  await addPrediction(A.id, sprintRaceId, [d(4), d(1), d(2), d(3), d(5), d(6), d(7), d(8)], 0);
  await addPrediction(C.id, sprintRaceId, [d(4), d(2), d(3), d(5), d(6), d(7), d(8), d(9)], 0);

  const reset = await excludeDriver(2026, 5, d(1), d(10));

  assert.deepEqual(
    reset.map((r) => `${r.nickname}:${r.isSprint ? 'sprint' : 'main'}`).sort(),
    ['Alice:main', 'Alice:sprint', 'Bob:main']
  );
  assert.deepEqual(await predictionsOf(A.id, 'predictions'), []);
  assert.deepEqual(await predictionsOf(B.id, 'predictions'), []);
  assert.deepEqual(await predictionsOf(C.id, 'predictions'), [mainRaceId], 'untouched');
  assert.deepEqual(await predictionsOf(A.id, 'sprint_predictions'), []);
  assert.deepEqual(await predictionsOf(C.id, 'sprint_predictions'), [sprintRaceId], 'untouched');
  assert.deepEqual(await getExcludedDriverIds(2026, 5), [d(1)]);
});

test('the_stand_in_is_stored_and_the_reset_list_carries_what_the_warning_email_needs', async () => {
  // Carol's sprint and main predictions both use Driver 2, so she is reset for both (sprint first: it is earlier).
  const reset = await excludeDriver(2026, 5, d(2), d(10));
  assert.deepEqual(
    reset.map((r) => ({ nickname: r.nickname, race: r.raceName, sprint: r.isSprint, driver: r.driverName, standIn: r.standInName })),
    [
      { nickname: 'Carol', race: 'Weekend GP', sprint: true, driver: 'Driver 2', standIn: 'Driver 10' },
      { nickname: 'Carol', race: 'Weekend GP', sprint: false, driver: 'Driver 2', standIn: 'Driver 10' },
    ]
  );
  assert.ok(reset[0].email.endsWith('@example.invalid'));
  assert.equal(reset[0].language === null || typeof reset[0].language === 'string', true);
});

test('excluding_twice_is_harmless_and_resets_nobody_the_second_time', async () => {
  assert.deepEqual(await excludeDriver(2026, 5, d(1)), []);
  assert.deepEqual(await getExcludedDriverIds(2026, 5), [d(1), d(2)].sort((a, b) => a - b));
});

test('including_a_driver_again_removes_the_exclusion_and_resets_nothing', async () => {
  await includeDriver(2026, 5, d(2));
  assert.deepEqual(await getExcludedDriverIds(2026, 5), [d(1)]);
});

test('listing_shows_the_driver_and_the_stand_in_by_name', async () => {
  const rows = await listExclusions(2026);
  assert.deepEqual(rows, [
    { round: 5, driverId: d(1), driverName: 'Driver 1', replacedByName: 'Driver 10' },
  ]);
});

test('a_weekend_that_has_started_cannot_be_changed', async () => {
  // Round 1 is over: its race date is in the past.
  await assert.rejects(
    () => excludeDriver(2026, 1, d(3)),
    (err: any) => err instanceof DriverExclusionError && err.code === 'too_late'
  );
  assert.equal((await getExcludedDriverIds(2026, 1)).length, 0);
});

test('an_unknown_weekend_or_driver_is_refused', async () => {
  await assert.rejects(
    () => excludeDriver(2026, 99, d(3)),
    (err: any) => err instanceof DriverExclusionError && err.code === 'not_found'
  );
  await assert.rejects(
    () => excludeDriver(2026, 5, 999999),
    (err: any) => err instanceof DriverExclusionError && err.code === 'not_found'
  );
});

test('a_driver_cannot_replace_himself', async () => {
  await assert.rejects(
    () => excludeDriver(2026, 5, d(3), d(3)),
    (err: any) => err instanceof DriverExclusionError && err.code === 'same_driver'
  );
});

test('usesExcludedDriver_checks_every_slot_and_the_first_retirement_pick', () => {
  const pred = { position_1: 1, position_2: 2, position_3: 3, dnf_pick: 9 };
  assert.equal(usesExcludedDriver(pred, 3, [2]), true);
  assert.equal(usesExcludedDriver(pred, 3, [9]), true);
  assert.equal(usesExcludedDriver(pred, 2, [3]), false, 'beyond the slots of a sprint');
  assert.equal(usesExcludedDriver(pred, 3, []), false);
  assert.equal(usesExcludedDriver({ position_1: 1, dnf_pick: null }, 1, [5]), false);
});
