import test, { before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { query } from '../../config/database';
import { resetTestDatabase, closeTestDatabase, createTestUser, seedSeason, addPrediction } from '../../testing/testDb';
import {
  findPreviewWeekend,
  sendRacePreviews,
  runAutomaticPreview,
  sendRacePreviewTest,
  previewStatus,
  setAuto,
  isAutoOn,
  PreviewDeps,
} from '../racePreviewService';
import type { JolpiRace } from '../jolpiService';
import type { RacePreviewData } from '../emailService';

let alice: { id: number; nickname: string };
let bob: { id: number; nickname: string };
let carol: { id: number; nickname: string }; // has unsubscribed
let admin: { id: number; nickname: string }; // unsubscribed from announcements, still receives a test
let driverIds: number[];
let dueRaceId = 0; // main race in 3 days (round 5), with a sprint the day before
let dueSprintId = 0;
let laterRaceId = 0; // main race in 20 days (round 6)

const calendarEntry = (round: number, name: string): JolpiRace => ({
  season: '2026', round: String(round), raceName: name,
  Circuit: { circuitId: 'vegas', circuitName: 'Test Strip Circuit', Location: { locality: 'Testville', country: 'Testland' } },
  date: '2026-11-22', time: '04:00:00Z',
  FirstPractice: { date: '2026-11-20', time: '00:30:00Z' },
  Qualifying: { date: '2026-11-21', time: '04:00:00Z' },
});
const calendar = [calendarEntry(5, 'Due Grand Prix'), calendarEntry(6, 'Later Grand Prix')];

type Sent = { nickname: string; language: string | null; data: RacePreviewData; unsubscribeUrl: string };
let sent: Sent[] = [];
let failFor = new Set<string>();

const deps = (extra: Partial<PreviewDeps> = {}): PreviewDeps => ({
  getCalendar: async () => calendar,
  send: async (to, data, unsubscribeUrl) => {
    if (failFor.has(to.nickname)) return false;
    sent.push({ nickname: to.nickname, language: to.language, data, unsubscribeUrl });
    return true;
  },
  ...extra,
});

before(async () => {
  await resetTestDatabase();
  ({ driverIds } = await seedSeason());
  await query(`DELETE FROM races WHERE season = 2026 AND round = 2`); // the helper's own future race would sit inside the shifted windows below
  alice = await createTestUser({ nickname: 'Alice' });
  bob = await createTestUser({ nickname: 'Bob' });
  carol = await createTestUser({ nickname: 'Carol' });
  admin = await createTestUser({ nickname: 'Owner', isAdmin: true });
  await query(`UPDATE users SET email_opt_out = TRUE WHERE id = ANY($1)`, [[carol.id, admin.id]]);
  await query(`UPDATE users SET language = 'nl' WHERE id = $1`, [bob.id]);

  const race = async (round: number, type: 'main' | 'sprint', hours: number, status = 'upcoming') =>
    (
      await query(
        `INSERT INTO races (season, round, race_name, circuit_name, country, race_date, race_type, status)
         VALUES (2026, $1, $2, 'Test Strip Circuit', 'Testland', (NOW() AT TIME ZONE 'UTC') + ($3 || ' hours')::interval, $4, $5) RETURNING id`,
        [round, `Round ${round} ${type}`, String(hours), type, status]
      )
    ).rows[0].id as number;
  dueSprintId = await race(5, 'sprint', 72 - 24);
  dueRaceId = await race(5, 'main', 72);
  laterRaceId = await race(6, 'main', 20 * 24);
  await race(4, 'main', -7 * 24, 'completed');
});
after(closeTestDatabase);

beforeEach(async () => {
  sent = [];
  failFor = new Set();
  await query('DELETE FROM race_preview_log');
  await query('DELETE FROM app_settings');
  await query('DELETE FROM predictions');
  await query('DELETE FROM sprint_predictions');
});

const nicknames = () => sent.map((s) => s.nickname).sort();

test('the_weekend_is_the_next_main_race_that_starts_within_four_days', async () => {
  const weekend = await findPreviewWeekend(deps());
  assert.ok(weekend);
  assert.equal(weekend.raceId, dueRaceId);
  assert.equal(weekend.sprintRaceId, dueSprintId);
  assert.equal(weekend.raceName, 'Due Grand Prix'); // the official calendar's name
});

test('nothing_is_due_when_the_next_race_is_further_away_or_the_last_one_has_started', async () => {
  const early = Date.now() - 25 * 60 * 60 * 1000; // 25 hours earlier: the race is now more than 4 days away
  assert.equal(await findPreviewWeekend(deps({ now: () => new Date(early) })), null);
  const late = Date.now() + 73 * 60 * 60 * 1000; // after the race started, the next one is 20 days off
  assert.equal(await findPreviewWeekend(deps({ now: () => new Date(late) })), null);
});

test('a_weekend_without_a_sprint_has_no_sprint_row_and_only_a_race_chip', async () => {
  await query('DELETE FROM races WHERE id = $1', [dueSprintId]);
  try {
    const weekend = await findPreviewWeekend(deps());
    assert.equal(weekend?.sprintRaceId, null);
    await sendRacePreviews(deps(), { nicknames: ['Alice'] });
    assert.deepEqual(sent[0].data.predictions, [{ kind: 'race', saved: false }]);
  } finally {
    dueSprintId = (
      await query(
        `INSERT INTO races (season, round, race_name, circuit_name, country, race_date, race_type, status)
         VALUES (2026, 5, 'Round 5 sprint', 'Test Strip Circuit', 'Testland', (NOW() AT TIME ZONE 'UTC') + interval '48 hours', 'sprint', 'upcoming') RETURNING id`
      )
    ).rows[0].id;
  }
});

test('everyone_who_has_not_unsubscribed_gets_it_in_their_own_language_with_their_own_unsubscribe_link', async () => {
  const result = await sendRacePreviews(deps());
  assert.deepEqual(result, { raceName: 'Due Grand Prix', sent: 2, failed: [] });
  assert.deepEqual(nicknames(), ['Alice', 'Bob']); // Carol and the owner unsubscribed
  assert.equal(sent.find((s) => s.nickname === 'Bob')?.language, 'nl');
  const links = sent.map((s) => s.unsubscribeUrl);
  assert.equal(new Set(links).size, 2);
  assert.ok(links.every((l) => l.includes('/api/auth/unsubscribe?token=')));
});

test('a_second_run_mails_nobody_again', async () => {
  await sendRacePreviews(deps());
  sent = [];
  const again = await sendRacePreviews(deps());
  assert.equal(again.sent, 0);
  assert.deepEqual(sent, []);
  assert.equal((await query('SELECT COUNT(*)::int AS n FROM race_preview_log')).rows[0].n, 2);
});

test('a_failed_send_is_not_recorded_and_the_next_run_mails_only_that_player', async () => {
  failFor.add('Bob');
  const first = await sendRacePreviews(deps());
  assert.deepEqual(first.failed, ['Bob']);
  assert.equal(first.sent, 1);
  assert.deepEqual(nicknames(), ['Alice']);

  failFor.clear();
  sent = [];
  const second = await sendRacePreviews(deps());
  assert.equal(second.sent, 1);
  assert.deepEqual(nicknames(), ['Bob']);
});

test('a_send_that_throws_counts_as_failed_and_does_not_stop_the_others', async () => {
  const result = await sendRacePreviews(
    deps({
      send: async (to) => {
        if (to.nickname === 'Alice') throw new Error('smtp down');
        sent.push({ nickname: to.nickname } as Sent);
        return true;
      },
    })
  );
  assert.deepEqual(result.failed, ['Alice']);
  assert.deepEqual(nicknames(), ['Bob']);
});

test('each_player_sees_which_of_their_own_predictions_are_saved', async () => {
  await addPrediction(alice.id, dueRaceId, driverIds, 0, driverIds[0]); // Alice: race saved, sprint missing
  await addPrediction(bob.id, dueSprintId, driverIds, 0); // Bob: sprint saved, race missing
  await sendRacePreviews(deps());
  const of = (n: string) => sent.find((s) => s.nickname === n)!.data.predictions;
  assert.deepEqual(of('Alice'), [{ kind: 'sprint', saved: false }, { kind: 'race', saved: true }]);
  assert.deepEqual(of('Bob'), [{ kind: 'sprint', saved: true }, { kind: 'race', saved: false }]);
});

test('the_mail_carries_the_official_sessions_and_circuit', async () => {
  await sendRacePreviews(deps(), { nicknames: ['alice'] }); // nicknames match case-insensitively
  assert.equal(sent.length, 1);
  const d = sent[0].data;
  assert.equal(d.circuitId, 'vegas');
  assert.deepEqual(d.sessions.map((s) => s.key), ['fp1', 'qualifying', 'race']);
  assert.equal(d.lockMinutes, 1);
});

test('the_closing_line_follows_the_configured_lock_time', async () => {
  const saved = process.env.PREDICTION_LOCK_MINUTES;
  process.env.PREDICTION_LOCK_MINUTES = '7';
  try {
    await sendRacePreviews(deps(), { nicknames: ['Alice'] });
    assert.equal(sent[0].data.lockMinutes, 7);
  } finally {
    if (saved === undefined) delete process.env.PREDICTION_LOCK_MINUTES;
    else process.env.PREDICTION_LOCK_MINUTES = saved;
  }
});

test('the_hourly_job_does_nothing_while_the_switch_is_off_and_sends_once_it_is_on', async () => {
  assert.equal(await isAutoOn(), false);
  const off = await runAutomaticPreview(deps());
  assert.equal(off.switchedOff, true);
  assert.deepEqual(sent, []);

  await setAuto(true);
  assert.equal(await isAutoOn(), true);
  const on = await runAutomaticPreview(deps());
  assert.equal(on.switchedOff, false);
  assert.equal(on.sent, 2);

  await setAuto(false);
  assert.equal(await isAutoOn(), false);
});

test('a_test_goes_to_one_player_even_if_they_unsubscribed_or_already_had_it_and_is_recorded_nowhere', async () => {
  await sendRacePreviews(deps()); // Alice and Bob have had it
  sent = [];
  const t = await sendRacePreviewTest({ userId: admin.id }, deps());
  assert.deepEqual(t, { raceName: 'Due Grand Prix', to: 'Owner' });
  assert.deepEqual(nicknames(), ['Owner']);
  const again = await sendRacePreviewTest({ nickname: 'alice' }, deps());
  assert.equal(again?.to, 'Alice');
  assert.equal((await query('SELECT COUNT(*)::int AS n FROM race_preview_log')).rows[0].n, 2); // nothing new recorded
});

test('a_test_for_an_unknown_nickname_or_without_a_weekend_returns_null', async () => {
  assert.equal(await sendRacePreviewTest({ nickname: 'Nobody' }, deps()), null);
  assert.equal(await sendRacePreviewTest({ userId: alice.id }, deps({ now: () => new Date(Date.now() + 73 * 3600 * 1000) })), null);
  assert.deepEqual(sent, []);
});

test('the_status_counts_who_is_waiting_and_who_has_had_it', async () => {
  const before = await previewStatus(deps());
  assert.equal(before.autoOn, false);
  assert.equal(before.weekend?.raceName, 'Due Grand Prix');
  assert.equal(before.weekend?.sprint, true);
  assert.equal(before.waiting, 2);
  assert.equal(before.alreadySent, 0);

  failFor.add('Bob');
  await sendRacePreviews(deps());
  const after = await previewStatus(deps());
  assert.equal(after.waiting, 1);
  assert.equal(after.alreadySent, 1);
});

test('a_missing_calendar_entry_stops_the_run_before_anything_is_sent', async () => {
  await assert.rejects(sendRacePreviews(deps({ getCalendar: async () => [] })), /no round 5/);
  assert.deepEqual(sent, []);
  assert.equal((await query('SELECT COUNT(*)::int AS n FROM race_preview_log')).rows[0].n, 0);
});

test('the_later_race_is_untouched_by_the_log', async () => {
  await sendRacePreviews(deps());
  const rows = await query('SELECT DISTINCT race_id FROM race_preview_log');
  assert.deepEqual(rows.rows.map((r: any) => r.race_id), [dueRaceId]);
  assert.notEqual(laterRaceId, dueRaceId);
});
