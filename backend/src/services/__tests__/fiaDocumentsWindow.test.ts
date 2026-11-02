import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { query } from '../../config/database';
import { resetTestDatabase, closeTestDatabase } from '../../testing/testDb';
import type { ListedDocument } from '../fiaDocumentsParser';
import { getWatchWindow, storeListed } from '../fiaDocumentsService';

// Two main races a week apart (Mexico 1 Nov, São Paulo 8 Nov) and the last one of the season later on.
// Papers keep coming after a race (time penalties, a grid drop for the next event), so the watcher does
// not stop at the prediction lock: it reads from six days before a race until seven days after it.
const MEXICO = new Date('2026-11-01T20:00:00Z');
const SAO_PAULO = new Date('2026-11-08T17:00:00Z');
let mexicoId = 0;
let saoPauloId = 0;

before(async () => {
  await resetTestDatabase();
  const add = async (round: number, name: string, date: Date) =>
    (
      await query(
        `INSERT INTO races (season, round, race_name, circuit_name, country, race_date, race_type, status)
         VALUES (2026, $1, $2, 'Test', 'Test', $3, 'main', 'upcoming') RETURNING id`,
        [round, name, date]
      )
    ).rows[0].id as number;
  mexicoId = await add(19, 'Mexico City Grand Prix', MEXICO);
  saoPauloId = await add(20, 'São Paulo Grand Prix', SAO_PAULO);
});
after(closeTestDatabase);

const at = (iso: string, anytime = false) => getWatchWindow(new Date(iso), { anytime });
const doc = (n: number, iso: string): ListedDocument => ({
  url: `https://www.fia.com/system/files/decision-document/window_${n}.pdf`,
  docNumber: n,
  title: `Infringement - Car ${n}`,
  publishedAt: new Date(iso),
});

test('the_window_stays_open_after_the_lock_and_after_the_race', async () => {
  const afterLock = await at('2026-11-01T19:59:00Z');
  assert.ok(afterLock, 'the lock no longer closes it');
  assert.equal(afterLock!.raceName, 'Mexico City Grand Prix');

  const nextDay = await at('2026-11-02T15:00:00Z');
  assert.ok(nextDay, 'the morning after the race');
  assert.equal(nextDay!.raceId, mexicoId);
  assert.equal(nextDay!.start.toISOString(), '2026-10-26T20:00:00.000Z');
  assert.equal(nextDay!.end.toISOString(), '2026-11-08T20:00:00.000Z', 'seven days after the start');
});

test('when_the_next_window_opens_the_previous_races_papers_are_still_in_range', async () => {
  const both = (await at('2026-11-02T17:00:00Z'))!;
  assert.equal(both.raceId, saoPauloId, 'the weekend ahead is the race the window is about');
  assert.equal(both.start.toISOString(), '2026-10-26T20:00:00.000Z', 'but Mexico\'s late papers are not dropped');

  const onlyOne = (await at('2026-11-08T20:00:00Z'))!;
  assert.equal(onlyOne.raceId, saoPauloId);
  assert.equal(onlyOne.start.toISOString(), '2026-11-02T17:00:00.000Z', 'Mexico\'s week is over');
});

test('seven_days_after_the_last_race_the_window_closes', async () => {
  assert.ok(await at('2026-11-15T16:59:59Z'));
  assert.equal(await at('2026-11-15T17:00:00Z'), null);
  assert.equal(await at('2026-12-15T12:00:00Z'), null);
  assert.equal(await at('2026-10-26T19:59:59Z'), null, 'and it still opens six days before the first race');
});

test('a_paper_published_after_the_race_is_stored', async () => {
  const window = (await at('2026-11-02T15:00:00Z'))!;
  const added = await storeListed('Mexico City Grand Prix', [doc(1, '2026-11-02T01:35:00Z'), doc(2, '2026-11-01T22:47:00Z')], window);
  assert.equal(added, 2);
});

test('a_paper_from_the_night_after_the_race_is_kept_when_the_next_window_opens', async () => {
  const window = (await at('2026-11-02T17:30:00Z'))!;
  const added = await storeListed('Mexico City Grand Prix', [doc(3, '2026-11-02T01:50:00Z')], window);
  assert.equal(added, 1, 'published before São Paulo\'s window opened, still Mexico\'s week');
});

test('a_paper_after_the_window_has_closed_is_not_stored', async () => {
  const window = (await at('2026-11-14T12:00:00Z'))!;
  assert.equal(await storeListed('São Paulo Grand Prix', [doc(4, '2026-11-15T18:00:00Z')], window), 0);
});

test('checking_by_hand_works_at_any_time_and_reads_from_the_latest_window_start', async () => {
  const winter = (await at('2026-12-15T12:00:00Z', true))!;
  assert.equal(winter.raceName, 'São Paulo Grand Prix', 'the latest race that has opened');
  assert.equal(winter.start.toISOString(), '2026-11-02T17:00:00.000Z');
  assert.equal(winter.end.toISOString(), '2026-12-15T12:00:00.000Z', 'up to now');
  assert.equal(await at('2026-10-01T12:00:00Z', true), null, 'before the first window there is nothing to read');
});

test('checking_by_hand_inside_the_window_is_the_ordinary_window', async () => {
  const ordinary = (await at('2026-11-02T15:00:00Z'))!;
  const byHand = (await at('2026-11-02T15:00:00Z', true))!;
  assert.deepEqual(byHand, ordinary);
});
