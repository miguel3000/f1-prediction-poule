import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import path from 'path';
import { spawnSync } from 'child_process';
import { query } from '../../config/database';
import { resetTestDatabase, closeTestDatabase, createTestUser, seedSeason, addPrediction } from '../../testing/testDb';

// The cron scripts used to look only at season 2026, so in 2027 they would have found nothing and
// stayed quiet: no reminders, no copied predictions. They work on whichever race is in their time
// window. Run for real against the test database, with a race of a season that has not started.

const run = (script: string) => {
  const result = spawnSync('node', [path.join(__dirname, '..', `${script}.js`)], { env: process.env, encoding: 'utf8' });
  assert.equal(result.status, 0, `${script} failed: ${result.stdout}${result.stderr}`);
};

let driverIds: number[] = [];
let pastRaceId = 0;

before(async () => {
  await resetTestDatabase();
  const season = await seedSeason();
  driverIds = season.driverIds;
  pastRaceId = season.pastRaceId;
});
after(closeTestDatabase);

const addRace2027 = async (startsInSeconds: number): Promise<number> =>
  (
    await query(
      `INSERT INTO races (season, round, race_name, circuit_name, country, race_date, race_type, status)
       VALUES (2027, 1, 'Opening Grand Prix', 'Test Circuit', 'Testland', NOW() + ($1 || ' seconds')::interval, 'main', 'upcoming') RETURNING id`,
      [String(startsInSeconds)]
    )
  ).rows[0].id as number;

test('a_player_who_forgot_gets_their_last_prediction_copied_in_a_new_season', async () => {
  const player = await createTestUser();
  await addPrediction(player.id, pastRaceId, driverIds, 40, driverIds[3]);
  const race = await addRace2027(30); // locked half a minute ago: the copy window is 1 to 10 minutes after the lock

  run('copyMissingPredictions');

  const copied = await query('SELECT position_1, position_10, dnf_pick FROM predictions WHERE user_id = $1 AND race_id = $2', [player.id, race]);
  assert.equal(copied.rows.length, 1);
  assert.equal(copied.rows[0].position_1, driverIds[0]);
  assert.equal(copied.rows[0].dnf_pick, driverIds[3]);
});

test('the_reminder_goes_out_for_a_race_of_a_new_season', async () => {
  await query('DELETE FROM races WHERE season = 2027');
  await createTestUser();
  const race = await addRace2027(60 * 60); // starts in an hour: the reminder window is 55 to 65 minutes before

  run('sendMissedPredictionReminders');

  const row = await query('SELECT reminder_sent FROM races WHERE id = $1', [race]);
  assert.equal(row.rows[0].reminder_sent, true);
});
