import test, { before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { query } from '../../config/database';
import { resetTestDatabase, closeTestDatabase } from '../../testing/testDb';
import { syncGridFromF1Site } from '../f1SiteGridService';

// A 3-round season: round 1 main (over), round 2 sprint (Sat 13 Jun 11:00 UTC) + main (Sun 14 Jun
// 13:00 UTC), round 3 main (Sun 28 Jun 13:00 UTC). Drivers 1 to 22 race.
const INDEX_URL = 'https://www.formula1.com/en/results/2026/races';
const page = (id: number, slug: string, kind: 'starting-grid' | 'sprint-grid') =>
  `https://www.formula1.com/en/results/2026/races/${id}/${slug}/${kind}`;
const indexHtml = (ids: Array<[number, string]>) =>
  ids.map(([id, slug]) => `<a href="/en/results/2026/races/${id}/${slug}/race-result">${slug}</a>`).join('\n');
const IDS: Array<[number, string]> = [[101, 'alpha'], [102, 'beta'], [103, 'gamma']];
const gridPage = (numbers: number[]) =>
  `<table><thead><tr><th>Pos.</th><th>No.</th><th>Driver</th></tr></thead><tbody>` +
  numbers.map((n, i) => `<tr><td>${i + 1}</td><td>${n}</td><td>x</td></tr>`).join('') +
  `</tbody></table>`;
const ORDER = Array.from({ length: 22 }, (_, i) => i + 1);

let mainId = 0;
let sprintId = 0;

before(async () => {
  await resetTestDatabase();
  for (let n = 1; n <= 22; n++) {
    await query(`INSERT INTO drivers (driver_number, name, name_acronym, team, season) VALUES ($1, $2, $3, 'T', 2026)`, [n, `Driver ${n}`, `D${n}`]);
  }
  const race = async (round: number, type: 'main' | 'sprint', iso: string) =>
    (
      await query(
        `INSERT INTO races (season, round, race_name, circuit_name, country, race_date, race_type, status)
         VALUES (2026, $1, $2, 'C', 'X', $3, $4, 'upcoming') RETURNING id`,
        [round, `GP ${round}`, iso, type]
      )
    ).rows[0].id as number;
  await race(1, 'main', '2026-05-31T13:00:00Z');
  sprintId = await race(2, 'sprint', '2026-06-13T11:00:00Z');
  mainId = await race(2, 'main', '2026-06-14T13:00:00Z');
  await race(3, 'main', '2026-06-28T13:00:00Z');
});
after(closeTestDatabase);
beforeEach(async () => {
  await query('DELETE FROM starting_grid');
});

// Fake formula1.com: urls map to a page (or null for "not found"); every request is recorded.
const site = (pages: Record<string, string | null>) => {
  const requested: string[] = [];
  const fetchPage = async (url: string) => {
    requested.push(url);
    if (!(url in pages)) throw new Error(`unexpected request ${url}`);
    return pages[url];
  };
  return { requested, fetchPage };
};
const syncGridFromF1Text = (iso: string, fake: { fetchPage: (u: string) => Promise<string | null> }) =>
  syncGridFromF1Site(new Date(iso), { fetchPage: fake.fetchPage });
const storedOrder = async (raceId: number) =>
  (
    await query(
      `SELECT d.driver_number FROM starting_grid g JOIN drivers d ON d.id = g.driver_id WHERE g.race_id = $1 ORDER BY g.position`,
      [raceId]
    )
  ).rows.map((r: any) => r.driver_number as number);

test('the_grid_is_stored_for_a_race_starting_within_30_hours', async () => {
  const order = [1, ...ORDER.slice(2), 2]; // car 2 at the back: a shuffled but complete grid
  const fake = site({ [INDEX_URL]: indexHtml(IDS), [page(102, 'beta', 'starting-grid')]: gridPage(order) });
  const outcomes = await syncGridFromF1Site(new Date('2026-06-13T17:00:00Z'), { fetchPage: fake.fetchPage });
  assert.deepEqual(outcomes.map((o) => [o.raceId, o.result, o.stored]), [[mainId, 'stored', 22]]);
  assert.deepEqual(await storedOrder(mainId), order);
  assert.deepEqual(fake.requested, [INDEX_URL, page(102, 'beta', 'starting-grid')]);
});

test('an_unchanged_grid_is_left_alone_and_a_changed_one_replaced', async () => {
  const now = new Date('2026-06-13T17:00:00Z');
  const first = site({ [INDEX_URL]: indexHtml(IDS), [page(102, 'beta', 'starting-grid')]: gridPage(ORDER) });
  await syncGridFromF1Site(now, { fetchPage: first.fetchPage });
  const captured = (await query('SELECT MAX(captured_at) AS at FROM starting_grid WHERE race_id = $1', [mainId])).rows[0].at;

  const again = await syncGridFromF1Site(now, { fetchPage: first.fetchPage });
  assert.equal(again[0].result, 'unchanged');
  assert.deepEqual((await query('SELECT MAX(captured_at) AS at FROM starting_grid WHERE race_id = $1', [mainId])).rows[0].at, captured);

  // A penalty is announced: car 1 drops to the back.
  const penalised = [...ORDER.slice(1), 1];
  const changed = site({ [INDEX_URL]: indexHtml(IDS), [page(102, 'beta', 'starting-grid')]: gridPage(penalised) });
  const outcome = await syncGridFromF1Site(now, { fetchPage: changed.fetchPage });
  assert.equal(outcome[0].result, 'stored');
  assert.deepEqual(await storedOrder(mainId), penalised);
});

test('nothing_is_asked_for_a_race_more_than_30_hours_away_or_closer_than_75_minutes', async () => {
  const none = site({});
  for (const iso of ['2026-06-27T06:00:00Z' /* 31 h before round 3 */, '2026-06-14T11:46:00Z' /* 74 min before round 2 */]) {
    assert.deepEqual(await syncGridFromF1Site(new Date(iso), { fetchPage: none.fetchPage }), [], iso);
  }
  assert.deepEqual(none.requested, []);

  const near = site({ [INDEX_URL]: indexHtml(IDS), [page(103, 'gamma', 'starting-grid')]: null });
  assert.equal((await syncGridFromF1Site(new Date('2026-06-27T07:00:00Z'), { fetchPage: near.fetchPage })).length, 1); // 30 h
  const wide = site({ [INDEX_URL]: indexHtml(IDS), [page(102, 'beta', 'starting-grid')]: null });
  assert.equal((await syncGridFromF1Text('2026-06-14T11:44:00Z', wide)).length, 1); // 76 min
});

test('a_sprint_reads_the_sprint_grid_page', async () => {
  const fake = site({ [INDEX_URL]: indexHtml(IDS), [page(102, 'beta', 'sprint-grid')]: gridPage(ORDER) });
  const outcomes = await syncGridFromF1Text('2026-06-13T05:00:00Z', fake);
  assert.deepEqual(outcomes.map((o) => [o.raceId, o.kind, o.result]), [[sprintId, 'sprint', 'stored']]);
  assert.deepEqual(await storedOrder(sprintId), ORDER);
});

test('a_missing_or_unfinished_page_stores_nothing_and_keeps_what_was_there', async () => {
  await query('INSERT INTO starting_grid (race_id, driver_id, position) SELECT $1, id, driver_number FROM drivers WHERE season = 2026', [mainId]);
  for (const body of [null, '<html>Not found</html>', gridPage(ORDER.slice(0, 10))]) {
    const fake = site({ [INDEX_URL]: indexHtml(IDS), [page(102, 'beta', 'starting-grid')]: body });
    const outcomes = await syncGridFromF1Text('2026-06-13T17:00:00Z', fake);
    assert.equal(outcomes[0].result, 'no-grid');
  }
  assert.equal((await storedOrder(mainId)).length, 22);
});

test('an_index_that_does_not_match_our_calendar_is_not_trusted', async () => {
  // Four races listed for a three-round season (a round was added or cancelled): the position in the list no longer means the round.
  const fake = site({ [INDEX_URL]: indexHtml([...IDS, [104, 'delta']]) });
  const outcomes = await syncGridFromF1Text('2026-06-13T17:00:00Z', fake);
  assert.equal(outcomes[0].result, 'unmapped');
  assert.deepEqual(fake.requested, [INDEX_URL]);
  assert.deepEqual(await storedOrder(mainId), []);
});

test('a_grid_of_cars_we_do_not_know_is_refused', async () => {
  const strangers = Array.from({ length: 22 }, (_, i) => 101 + i);
  const fake = site({ [INDEX_URL]: indexHtml(IDS), [page(102, 'beta', 'starting-grid')]: gridPage(strangers) });
  const outcomes = await syncGridFromF1Text('2026-06-13T17:00:00Z', fake);
  assert.equal(outcomes[0].result, 'no-grid');
  assert.deepEqual(await storedOrder(mainId), []);
});

test('a_driver_we_do_not_have_is_skipped_and_does_not_cause_a_rewrite_every_run', async () => {
  const withStranger = [...ORDER.slice(0, 21), 99]; // 21 known cars and one unknown at the back
  const fake = site({ [INDEX_URL]: indexHtml(IDS), [page(102, 'beta', 'starting-grid')]: gridPage(withStranger) });
  const first = await syncGridFromF1Text('2026-06-13T17:00:00Z', fake);
  assert.deepEqual([first[0].result, first[0].stored, first[0].unknown], ['stored', 21, 1]);
  const second = await syncGridFromF1Text('2026-06-13T17:00:00Z', fake);
  assert.equal(second[0].result, 'unchanged');
});

test('a_failing_site_is_an_error_for_the_caller_to_report', async () => {
  const fetchPage = async () => {
    throw new Error('connect ETIMEDOUT');
  };
  await assert.rejects(() => syncGridFromF1Site(new Date('2026-06-13T17:00:00Z'), { fetchPage }), /ETIMEDOUT/);
});
