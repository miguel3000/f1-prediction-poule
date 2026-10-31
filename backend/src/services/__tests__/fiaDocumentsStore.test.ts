import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { query } from '../../config/database';
import { resetTestDatabase, closeTestDatabase } from '../../testing/testDb';
import type { ListedDocument } from '../fiaDocumentsParser';
import {
  getWatchWindow,
  storeListed,
  getUnsentFlags,
  markFlagsEmailed,
  recordFeedFlag,
  recordCheck,
  shouldAlertWatcherFailure,
  listDocuments,
  getLastCheck,
} from '../fiaDocumentsService';

// One main race (Sunday 1 Nov 2026, 20:00 UTC, lock one minute earlier) and a sprint-only weekend later.
const RACE = new Date('2026-11-01T20:00:00Z');
let raceId = 0;

before(async () => {
  await resetTestDatabase();
  raceId = (
    await query(
      `INSERT INTO races (season, round, race_name, circuit_name, country, race_date, race_type, status)
       VALUES (2026, 19, 'Mexico City Grand Prix', 'Test', 'Mexico', $1, 'main', 'upcoming') RETURNING id`,
      [RACE]
    )
  ).rows[0].id;
  await query(
    `INSERT INTO races (season, round, race_name, circuit_name, country, race_date, race_type, status)
     VALUES (2026, 30, 'Sprint Only GP', 'Test', 'Nowhere', '2026-11-20T12:00:00Z', 'sprint', 'upcoming')`
  );
});
after(closeTestDatabase);

const doc = (n: number, iso: string, title = `Infringement - Car ${n}`): ListedDocument => ({
  url: `https://www.fia.com/system/files/decision-document/doc_${n}.pdf`,
  docNumber: n,
  title,
  publishedAt: new Date(iso),
});

test('window_runs_from_six_days_before_a_main_race_until_its_lock', async () => {
  const at = (iso: string) => getWatchWindow(new Date(iso));
  assert.equal(await at('2026-10-26T19:59:59Z'), null, 'just before six days');
  const open = await at('2026-10-26T20:00:00Z');
  assert.ok(open, 'exactly six days before');
  assert.equal(open!.raceName, 'Mexico City Grand Prix');
  assert.equal(open!.raceId, raceId);
  assert.equal(open!.start.toISOString(), '2026-10-26T20:00:00.000Z');
  assert.equal(open!.end.toISOString(), '2026-11-01T19:59:00.000Z', 'one minute before the start');
  assert.ok(await at('2026-11-01T19:58:59Z'), 'just before the lock');
  assert.equal(await at('2026-11-01T19:59:00Z'), null, 'at the lock');
  assert.equal(await at('2026-11-18T12:00:00Z'), null, 'a sprint-only weekend has no window');
});

test('documents_before_the_window_start_are_not_stored', async () => {
  const window = (await getWatchWindow(new Date('2026-10-30T12:00:00Z')))!;
  const added = await storeListed('Mexico City Grand Prix', [
    doc(1, '2026-10-25T10:00:00Z'), // the previous event's paper, before the window
    doc(2, '2026-10-28T21:00:00Z'),
    doc(3, '2026-10-31T18:09:00Z'),
  ], window);
  assert.equal(added, 2);
  const urls = (await query('SELECT url FROM fia_documents ORDER BY id')).rows.map((r: any) => r.url);
  assert.deepEqual(urls, [doc(2, '2026-10-28T21:00:00Z').url, doc(3, '2026-10-31T18:09:00Z').url]);
});

test('storing_the_same_listing_twice_adds_nothing_and_keeps_what_was_read', async () => {
  const window = (await getWatchWindow(new Date('2026-10-30T12:00:00Z')))!;
  await query("UPDATE fia_documents SET status = 'read', severity = 'seen', summary = 'kept' WHERE url LIKE '%doc_2.pdf'");
  const added = await storeListed('Mexico City Grand Prix', [doc(2, '2026-10-28T21:00:00Z'), doc(3, '2026-10-31T18:09:00Z')], window);
  assert.equal(added, 0);
  assert.equal((await query("SELECT summary FROM fia_documents WHERE url LIKE '%doc_2.pdf'")).rows[0].summary, 'kept');
});

test('flags_are_sent_once_after_marking', async () => {
  await query(
    `UPDATE fia_documents SET status = 'read', severity = 'flag', kind = 'infringement', summary = '#77 Bottas: 50-place grid drop',
       facts = '{"gridDrop":50}' WHERE url LIKE '%doc_3.pdf'`
  );
  const flags = await getUnsentFlags();
  assert.equal(flags.length, 1);
  assert.equal(flags[0].summary, '#77 Bottas: 50-place grid drop');
  assert.equal(flags[0].facts.gridDrop, 50);
  assert.equal(flags[0].source, 'fia');
  assert.ok(flags[0].url.endsWith('doc_3.pdf'));
  assert.equal(flags[0].publishedAt.toISOString(), '2026-10-31T18:09:00.000Z');

  await markFlagsEmailed(flags.map((f) => f.id));
  assert.deepEqual(await getUnsentFlags(), []);
});

test('a_feed_flag_is_recorded_once_per_key_and_is_unsent_until_marked', async () => {
  assert.equal(await recordFeedFlag('Qualifying:Mexico:50', 'Live feed: driver list differs', '#50 is not in our drivers table', { unknown: [50] }), true);
  assert.equal(await recordFeedFlag('Qualifying:Mexico:50', 'Live feed: driver list differs', 'again', { unknown: [50] }), false);
  const flags = await getUnsentFlags();
  assert.equal(flags.length, 1);
  assert.equal(flags[0].source, 'feed');
  assert.deepEqual(flags[0].facts, { unknown: [50] });
  await markFlagsEmailed([flags[0].id]);
});

test('three_failed_checks_in_a_row_alert_once_and_a_success_resets', async () => {
  const now = new Date('2026-10-31T12:00:00Z'); // inside the window
  const fail = () => recordCheck({ ok: false, found: 0, added: 0, error: 'page changed' });
  await recordCheck({ ok: true, found: 40, added: 0 });
  await fail();
  await fail();
  assert.equal(await shouldAlertWatcherFailure(now), false, 'two failures are not enough');
  await fail();
  assert.equal(await shouldAlertWatcherFailure(now), true, 'the third failure alerts');
  assert.equal(await shouldAlertWatcherFailure(now), false, 'not twice for the same streak');
  await fail();
  await fail();
  await fail();
  assert.equal(await shouldAlertWatcherFailure(now), false, 'still the same streak');
  await recordCheck({ ok: true, found: 40, added: 1 });
  await fail();
  await fail();
  await fail();
  assert.equal(await shouldAlertWatcherFailure(now), true, 'a new streak alerts again');
  await fail();
  await fail();
  await fail();
  assert.equal(await shouldAlertWatcherFailure(new Date('2026-12-15T12:00:00Z')), false, 'outside any window it never alerts');
});

test('the_list_puts_flags_first_and_the_last_check_is_the_newest', async () => {
  const docs = await listDocuments(10);
  assert.equal(docs[0].severity, 'flag');
  assert.ok(docs.length >= 3);
  const last = await getLastCheck();
  assert.equal(last!.ok, false);
  assert.equal(last!.error, 'page changed');
});
