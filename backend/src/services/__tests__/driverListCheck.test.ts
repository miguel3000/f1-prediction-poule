import test, { before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { query } from '../../config/database';
import { resetTestDatabase, closeTestDatabase } from '../../testing/testDb';
import { diffDriverList, checkFeedDriverList } from '../driverListCheck';

const NOW = new Date('2026-10-31T19:00:00Z'); // inside the window of the race below
const ours = Array.from({ length: 22 }, (_, i) => ({ driver_number: i + 1, name: `Driver ${i + 1}` }));
// The feed's list: numbers as keys, an object per driver, and a bookkeeping entry that is not a driver.
const feedOf = (numbers: number[]) =>
  Object.fromEntries([
    ['_kf', true],
    ...numbers.map((n) => [String(n), { RacingNumber: String(n), FullName: n === 50 ? 'Ryo HIRAKAWA' : `Driver ${n}`, Tla: `D${n}` }]),
  ]);
const sameAsOurs = ours.map((d) => d.driver_number);
const session = (type: string, name = type) => ({ SessionInfo: { Type: type, Name: name, Meeting: { Name: 'Mexico City Grand Prix' } } });

before(async () => {
  await resetTestDatabase();
  await query(
    `INSERT INTO races (season, round, race_name, circuit_name, country, race_date, race_type, status)
     VALUES (2026, 19, 'Mexico City Grand Prix', 'Test', 'Mexico', '2026-11-01T20:00:00Z', 'main', 'upcoming')`
  );
  for (const d of ours) {
    await query(`INSERT INTO drivers (driver_number, name, team, season) VALUES ($1, $2, 'Team', 2026)`, [d.driver_number, d.name]);
  }
});
after(closeTestDatabase);
beforeEach(async () => {
  await query('DELETE FROM fia_documents');
});

test('a_feed_driver_we_do_not_have_is_unknown', () => {
  const diff = diffDriverList(feedOf([...sameAsOurs.filter((n) => n !== 22), 50]), ours);
  assert.deepEqual(diff.unknown, [{ number: 50, name: 'Ryo HIRAKAWA' }]);
});

test('one_of_ours_missing_from_the_feed_is_absent', () => {
  const diff = diffDriverList(feedOf(sameAsOurs.filter((n) => n !== 22)), ours);
  assert.deepEqual(diff.absent, [{ number: 22, name: 'Driver 22' }]);
  assert.deepEqual(diff.unknown, []);
});

test('identical_lists_give_nothing', () => {
  assert.deepEqual(diffDriverList(feedOf(sameAsOurs), ours), { unknown: [], absent: [] });
});

test('non_driver_entries_in_the_feed_list_are_ignored', () => {
  const feed = { ...feedOf(sameAsOurs), _kf: true, Something: 'else', '99': null };
  assert.deepEqual(diffDriverList(feed, ours), { unknown: [], absent: [] });
});

test('a_partial_feed_list_gives_nothing', () => {
  assert.deepEqual(diffDriverList(feedOf([1, 2, 3, 50]), ours), { unknown: [], absent: [] });
  assert.deepEqual(diffDriverList({}, ours), { unknown: [], absent: [] });
});

test('practice_sessions_record_nothing', async () => {
  const state = { ...session('Practice', 'Practice 3'), DriverList: feedOf([...sameAsOurs.filter((n) => n !== 22), 50]) };
  await checkFeedDriverList(state, NOW);
  assert.equal((await query('SELECT 1 FROM fia_documents')).rows.length, 0);
});

test('qualifying_with_a_difference_records_one_flag_and_asking_again_adds_none', async () => {
  const state = { ...session('Qualifying'), DriverList: feedOf([...sameAsOurs.filter((n) => n !== 22), 50]) };
  await checkFeedDriverList(state, NOW);
  await checkFeedDriverList(state, NOW);
  const rows = (await query('SELECT source, kind, severity, summary, facts FROM fia_documents')).rows;
  assert.equal(rows.length, 1);
  assert.equal(rows[0].source, 'feed');
  assert.equal(rows[0].severity, 'flag');
  assert.match(rows[0].summary, /#50 Ryo HIRAKAWA/);
  assert.match(rows[0].summary, /#22 Driver 22/);
  assert.deepEqual(rows[0].facts.unknown, [{ number: 50, name: 'Ryo HIRAKAWA' }]);
});

test('a_race_session_is_checked_too_and_an_identical_list_records_nothing', async () => {
  await checkFeedDriverList({ ...session('Race'), DriverList: feedOf(sameAsOurs) }, NOW);
  assert.equal((await query('SELECT 1 FROM fia_documents')).rows.length, 0);
  await checkFeedDriverList({ ...session('Race'), DriverList: feedOf([...sameAsOurs.filter((n) => n !== 22), 50]) }, NOW);
  assert.equal((await query('SELECT 1 FROM fia_documents')).rows.length, 1);
});

test('outside_a_watch_window_nothing_is_recorded', async () => {
  const state = { ...session('Qualifying'), DriverList: feedOf([...sameAsOurs.filter((n) => n !== 22), 50]) };
  await checkFeedDriverList(state, new Date('2026-12-15T12:00:00Z'));
  assert.equal((await query('SELECT 1 FROM fia_documents')).rows.length, 0);
});

test('a_driver_already_marked_as_not_racing_is_not_reported_as_absent', async () => {
  const id = (await query('SELECT id FROM drivers WHERE driver_number = 22 AND season = 2026')).rows[0].id;
  await query('INSERT INTO driver_exclusions (season, round, driver_id) VALUES (2026, 19, $1)', [id]);
  try {
    // Only #22 is missing from the feed, and we already know he is out: nothing to tell the owner.
    await checkFeedDriverList({ ...session('Qualifying'), DriverList: feedOf(sameAsOurs.filter((n) => n !== 22)) }, NOW);
    assert.equal((await query('SELECT 1 FROM fia_documents')).rows.length, 0);
  } finally {
    await query('DELETE FROM driver_exclusions');
  }
});
