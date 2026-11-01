import test, { before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { query } from '../../config/database';
import { resetTestDatabase, closeTestDatabase, createTestUser, addPrediction } from '../../testing/testDb';
import { activeSeason, listSeasons, seasonFromQuery } from '../season';
import { getSeasonTotals } from '../seasonPoints';

let driverIds: number[] = [];

const addRace = async (season: number, round: number, type: 'main' | 'sprint', iso: string): Promise<number> =>
  (
    await query(
      `INSERT INTO races (season, round, race_name, circuit_name, country, race_date, race_type, status)
       VALUES ($1, $2, $3, 'C', 'X', $4, $5, 'completed') RETURNING id`,
      [season, round, `GP ${season}-${round}${type === 'sprint' ? 'S' : ''}`, iso, type]
    )
  ).rows[0].id as number;

before(async () => {
  await resetTestDatabase();
  for (let n = 1; n <= 10; n++) {
    const d = await query(`INSERT INTO drivers (driver_number, name, name_acronym, team, season) VALUES ($1, $2, $3, 'T', 2026) RETURNING id`, [n, `Driver ${n}`, `D${n}`]);
    driverIds.push(d.rows[0].id);
  }
});
after(closeTestDatabase);
beforeEach(async () => {
  await query('DELETE FROM predictions');
  await query('DELETE FROM sprint_predictions');
  await query('DELETE FROM races');
});

test('the_season_is_the_calendar_year_but_never_one_we_have_no_races_for', async () => {
  await addRace(2026, 1, 'main', '2026-03-08T05:00:00Z');
  // The 2027 calendar is not loaded yet: January 2027 still shows the season we have.
  assert.equal(await activeSeason(new Date('2027-01-15T12:00:00Z')), 2026);
  assert.equal(await activeSeason(new Date('2026-11-01T12:00:00Z')), 2026);

  await addRace(2027, 1, 'main', '2027-03-14T05:00:00Z');
  // Loaded in December: the points table does not start over before the year does.
  assert.equal(await activeSeason(new Date('2026-12-31T23:59:59Z')), 2026);
  assert.equal(await activeSeason(new Date('2027-01-01T00:00:00Z')), 2027);
});

test('an_empty_calendar_gives_the_calendar_year', async () => {
  assert.equal(await activeSeason(new Date('2026-06-01T00:00:00Z')), 2026);
});

test('seasons_are_listed_newest_first', async () => {
  await addRace(2026, 1, 'main', '2026-03-08T05:00:00Z');
  await addRace(2026, 1, 'sprint', '2026-03-07T05:00:00Z');
  await addRace(2027, 1, 'main', '2027-03-14T05:00:00Z');
  assert.deepEqual(await listSeasons(), [2027, 2026]);
});

test('a_requested_season_is_used_only_when_we_have_it', async () => {
  await addRace(2026, 1, 'main', '2026-03-08T05:00:00Z');
  const active = await activeSeason();
  assert.equal(await seasonFromQuery('2026'), 2026);
  assert.equal(await seasonFromQuery('1999'), active);
  assert.equal(await seasonFromQuery('abc'), active);
  assert.equal(await seasonFromQuery(undefined), active);
  assert.equal(await seasonFromQuery(['2026', '2027']), active);
});

test('points_are_added_up_per_season_from_main_and_sprint_predictions', async () => {
  const a = await createTestUser();
  const b = await createTestUser();
  const c = await createTestUser();
  const main26 = await addRace(2026, 1, 'main', '2026-03-08T05:00:00Z');
  const sprint26 = await addRace(2026, 1, 'sprint', '2026-03-07T05:00:00Z');
  const main27 = await addRace(2027, 1, 'main', '2027-03-14T05:00:00Z');
  await addPrediction(a.id, main26, driverIds, 40);
  await addPrediction(a.id, sprint26, driverIds, 6);
  await addPrediction(a.id, main27, driverIds, 25);
  await addPrediction(b.id, main26, driverIds, 18);

  const in2026 = await getSeasonTotals([a.id, b.id, c.id], 2026);
  assert.deepEqual([in2026.get(a.id), in2026.get(b.id), in2026.get(c.id)], [46, 18, 0]);
  const in2027 = await getSeasonTotals([a.id, b.id, c.id], 2027);
  assert.deepEqual([in2027.get(a.id), in2027.get(b.id), in2027.get(c.id)], [25, 0, 0]);
});
