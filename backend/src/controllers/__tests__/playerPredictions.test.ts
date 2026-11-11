import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import jwt from 'jsonwebtoken';
import type { AddressInfo } from 'net';
import type { Server } from 'http';
import { query } from '../../config/database';
import { resetTestDatabase, closeTestDatabase, createTestUser, seedSeason, addPrediction } from '../../testing/testDb';
import { createGroup, joinGroup } from '../../services/groupService';
import playerRoutes from '../../routes/players';

// The player page: one player's predictions against the real results, race by race, with every pick
// marked exact / near / miss by the same rule that scores it.

type U = { id: number; nickname: string };
let server: Server;
let base = '';
let A: U, B: U, D: U, E: U;
let groupId = 0;
let season: Awaited<ReturnType<typeof seedSeason>>;
let d: number[]; // driver ids, d[0] = Driver 1 ... d[9] = Driver 10, then d[10] retires, d[11] does not start
let startedNoResultId = 0;

const addDriver = async (n: number) =>
  (await query(
    `INSERT INTO drivers (driver_number, name, name_acronym, team, season) VALUES ($1, $2, $3, 'Team 6', 2026) RETURNING id`,
    [n, `Driver ${n}`, `D${String(n).padStart(2, '0')}`]
  )).rows[0].id as number;

const addResults = async (raceId: number, table: 'race_results' | 'sprint_results', rows: Array<[number, number, string]>) => {
  for (const [driver, position, status] of rows) {
    await query(`INSERT INTO ${table} (race_id, driver_id, position, points, status) VALUES ($1, $2, $3, 0, $4)`, [raceId, driver, position, status]);
  }
};

before(async () => {
  await resetTestDatabase();
  season = await seedSeason();
  A = await createTestUser({ nickname: 'Alice', canStartGroups: true });
  B = await createTestUser({ nickname: 'Bob' });
  D = await createTestUser({ nickname: 'Dave', playsInMain: false });
  E = await createTestUser({ nickname: 'Eve' });
  const g = await createGroup({ id: A.id, isAdmin: false }, 'Visible Group');
  groupId = g.id;
  await joinGroup(D.id, g.inviteCode, false);

  d = [...season.driverIds, await addDriver(11), await addDriver(12)];
  // Main race 1: D1..D10 finish in order, D11 retires (P11), D12 does not start (P12).
  await addResults(season.pastRaceId, 'race_results', [
    ...d.slice(0, 10).map((id, i): [number, number, string] => [id, i + 1, 'Finished']),
    [d[10], 11, 'Retired'],
    [d[11], 12, 'Did not start'],
  ]);
  // Sprint 1: D1..D8 finish in order.
  await addResults(season.pastSprintId, 'sprint_results', d.slice(0, 8).map((id, i): [number, number, string] => [id, i + 1, 'Finished']));

  // Alice: P1 D1 exact, P2 D2 exact, P3 D4 near, P4 D3 near, P5 D7 two places off (miss), P6 D6 exact,
  // P7 D5 two places off (miss), P8 D8 exact, P9 D10 near, P10 D9 near; first out D11 right.
  // 25 + 18 + 8 + 6 + 0 + 8 + 0 + 4 + 1 + 1 = 71, plus 25 for the first retirement = 96.
  const alice = [d[0], d[1], d[3], d[2], d[6], d[5], d[4], d[7], d[9], d[8]];
  await addPrediction(A.id, season.pastRaceId, alice, 96, d[10]);
  await addPrediction(A.id, season.pastSprintId, d.slice(0, 8), 36);
  await addPrediction(A.id, season.futureRaceId, d.slice(0, 10), 0, d[1]);
  // Bob picks the driver who did not start as first retirement and one who is outside the top 10.
  await addPrediction(B.id, season.pastRaceId, [d[1], d[0], d[2], d[3], d[4], d[5], d[6], d[7], d[8], d[11]], 77, d[11]);
  await addPrediction(D.id, season.pastRaceId, d.slice(0, 10), 12, d[0]);

  // A race that has started but has no result yet.
  startedNoResultId = (
    await query(
      `INSERT INTO races (season, round, race_name, circuit_name, country, race_date, race_type, status)
       VALUES (2026, 3, 'Test Grand Prix 3', 'Test Circuit', 'Testland', NOW() - INTERVAL '1 hour', 'main', 'upcoming') RETURNING id`
    )
  ).rows[0].id as number;
  await addPrediction(A.id, startedNoResultId, d.slice(0, 10), 0, d[2]);

  const app = express();
  app.use(express.json());
  app.use('/api/players', playerRoutes);
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => {
      base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
      resolve();
    });
  });
});
after(async () => {
  server.closeAllConnections();
  server.close();
  await closeTestDatabase();
});

const token = (u: U) => jwt.sign({ userId: u.id, email: 'x@example.invalid' }, process.env.JWT_SECRET!);
const get = async (path: string, viewer?: U) => {
  const res = await fetch(`${base}${path}`, { headers: viewer ? { Authorization: `Bearer ${token(viewer)}` } : {} });
  const text = await res.text();
  let json: any = null;
  try { json = JSON.parse(text); } catch { /* not json */ }
  return { status: res.status, text, json };
};
const raceOf = (json: any, raceId: number) => json.races.find((r: any) => r.race.id === raceId);

test('every_pick_is_marked_exact_near_or_miss_by_the_scoring_rule', async () => {
  const res = await get(`/api/players/${A.id}/predictions`, B);
  assert.equal(res.status, 200);
  const main = raceOf(res.json, season.pastRaceId);
  assert.deepEqual(main.prediction.picks.map((p: any) => p.hit),
    ['exact', 'exact', 'near', 'near', 'miss', 'exact', 'miss', 'exact', 'near', 'near']);
  assert.equal(main.prediction.points, 96);
  assert.equal(main.prediction.dnf_pick.hit, true);
  assert.equal(main.slots, 10);
});

test('the_marks_add_up_to_the_stored_points', async () => {
  // Same table the scoring uses: main 25 18 15 12 10 8 6 4 2 1, sprint 8 7 6 5 4 3 2 1; near = half rounded.
  const BASE = { main: [25, 18, 15, 12, 10, 8, 6, 4, 2, 1], sprint: [8, 7, 6, 5, 4, 3, 2, 1] };
  const res = await get(`/api/players/${A.id}/predictions`, A);
  for (const race of res.json.races) {
    if (!race.result) continue;
    const base = race.race.race_type === 'sprint' ? BASE.sprint : BASE.main;
    const sum = race.prediction.picks.reduce((total: number, p: any, i: number) =>
      total + (p.hit === 'exact' ? base[i] : p.hit === 'near' ? Math.round(base[i] * 0.5) : 0), 0)
      + (race.prediction.dnf_pick?.hit ? 25 : 0);
    assert.equal(sum, race.prediction.points, `race ${race.race.id}: marks add up to the stored points`);
  }
});

test('each_pick_says_where_that_driver_really_finished_including_dnf_and_dns', async () => {
  const bob = raceOf((await get(`/api/players/${B.id}/predictions`, A)).json, season.pastRaceId);
  assert.deepEqual(bob.prediction.picks[0].finished, { position: 2, status: 'finished' });
  assert.deepEqual(bob.prediction.picks[9], { ...bob.prediction.picks[9], finished: { position: 12, status: 'dns' }, hit: 'miss' });
  assert.deepEqual(bob.prediction.dnf_pick.finished, { position: 12, status: 'dns' });
  assert.equal(bob.prediction.dnf_pick.hit, false, 'a driver who did not start is not the first retirement');
});

test('the_result_is_listed_by_position_with_the_first_retirement', async () => {
  const main = raceOf((await get(`/api/players/${A.id}/predictions`, A)).json, season.pastRaceId);
  assert.equal(main.result.top.length, 10);
  assert.deepEqual(main.result.top[0], { position: 1, driver: { id: d[0], name: 'Driver 1', name_acronym: 'D01', team: 'Team 1' } });
  assert.equal(main.result.first_out.id, d[10]);
  const sprint = raceOf((await get(`/api/players/${A.id}/predictions`, A)).json, season.pastSprintId);
  assert.equal(sprint.slots, 8);
  assert.equal(sprint.result.top.length, 8);
  assert.equal(sprint.prediction.picks.length, 8);
  assert.equal(sprint.prediction.dnf_pick, null);
  assert.equal(sprint.result.first_out, null);
});

test('a_race_that_has_started_without_a_result_shows_the_picks_and_no_marks', async () => {
  const waiting = raceOf((await get(`/api/players/${A.id}/predictions`, A)).json, startedNoResultId);
  assert.equal(waiting.result, null);
  assert.equal(waiting.prediction.points, null);
  assert.ok(waiting.prediction.picks.every((p: any) => p.hit === null && p.driver));
  assert.equal(waiting.prediction.dnf_pick.hit, null);
});

test('only_races_that_have_started_are_listed_newest_first', async () => {
  const res = await get(`/api/players/${A.id}/predictions`, A);
  const ids = res.json.races.map((r: any) => r.race.id);
  assert.ok(!ids.includes(season.futureRaceId), 'a race still to come is never shown');
  assert.deepEqual(ids, [startedNoResultId, season.pastRaceId, season.pastSprintId]);
});

test('only_races_the_player_predicted_are_listed', async () => {
  const bob = await get(`/api/players/${B.id}/predictions`, A);
  assert.deepEqual(bob.json.races.map((r: any) => r.race.id), [season.pastRaceId]);
});

test('the_header_has_rank_season_points_and_the_totals_of_the_marks', async () => {
  const res = await get(`/api/players/${A.id}/predictions`, B);
  assert.equal(res.json.player.id, A.id);
  assert.equal(res.json.player.nickname, 'Alice');
  assert.equal(res.json.player.total_points, 96 + 36 + 0 + 0);
  assert.equal(res.json.player.rank, 1);
  assert.equal(res.json.poule_size, 3, 'Alice, Bob and Eve play in the main poule');
  const bob = await get(`/api/players/${B.id}/predictions`, A);
  assert.equal(bob.json.player.rank, 2);
  // Alice: main race 4 exact + 4 near, sprint 8 exact; first out right in 1 of the 1 scored main races.
  assert.deepEqual(res.json.stats, { exact: 12, near: 4, first_retirement_right: 1, first_retirement_races: 1 });
});

test('the_poule_decides_who_can_be_looked_at', async () => {
  assert.equal((await get(`/api/players/${D.id}/predictions`, B)).status, 404); // Dave plays only in a group Bob is not in
  assert.equal((await get(`/api/players/${D.id}/predictions?poule=${groupId}`, A)).status, 200);
  assert.equal((await get(`/api/players/${B.id}/predictions?poule=${groupId}`, A)).status, 404); // Bob is not in that group
  assert.equal((await get(`/api/players/${A.id}/predictions?poule=${groupId}`, B)).status, 404); // Bob is not in it either
  assert.equal((await get(`/api/players/${E.id}/predictions`, A)).status, 200); // in main, never predicted
  assert.deepEqual((await get(`/api/players/${E.id}/predictions`, A)).json.races, []);
});

test('a_player_who_is_not_there_or_not_a_number_is_a_404_and_login_is_required', async () => {
  assert.equal((await get('/api/players/999999/predictions', A)).status, 404);
  assert.equal((await get('/api/players/abc/predictions', A)).status, 404);
  assert.equal((await get(`/api/players/${A.id}/predictions`)).status, 401);
});

test('a_group_only_player_has_a_page_inside_their_own_group', async () => {
  const own = await get(`/api/players/${D.id}/predictions`, D);
  assert.equal(own.status, 200);
  assert.equal(own.json.player.rank, 2); // Alice 132, Dave 12 inside the group
  assert.equal((await get(`/api/players/${D.id}/predictions?poule=main`, D)).status, 403);
});

test('nothing_but_nickname_avatar_and_picks_is_shown_never_an_email', async () => {
  const res = await get(`/api/players/${A.id}/predictions?poule=${groupId}`, D);
  assert.ok(!res.text.includes('@'));
  assert.ok(!/email/i.test(res.text));
  assert.deepEqual(Object.keys(res.json.player).sort(), ['avatar_url', 'id', 'nickname', 'rank', 'total_points']);
});
