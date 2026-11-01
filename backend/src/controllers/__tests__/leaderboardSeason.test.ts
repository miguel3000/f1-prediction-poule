import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import jwt from 'jsonwebtoken';
import type { AddressInfo } from 'net';
import type { Server } from 'http';
import { query } from '../../config/database';
import { resetTestDatabase, closeTestDatabase, createTestUser, seedSeason, addPrediction } from '../../testing/testDb';
import { calculateRacePoints } from '../leaderboardController';
import leaderboardRoutes from '../../routes/leaderboard';
import statsRoutes from '../../routes/stats';
import raceRoutes from '../../routes/races';

// Two seasons in one database: 2026 (the seeded one) and 2027. Totals must be per season, and the
// old season must stay viewable once the new one has started.
type U = { id: number; nickname: string };
let server: Server;
let base = '';
let A: U, B: U, C: U;
let driverIds: number[] = [];
let race2027 = 0;

before(async () => {
  await resetTestDatabase();
  const season = await seedSeason();
  driverIds = season.driverIds;
  A = await createTestUser({ nickname: 'Alice' });
  B = await createTestUser({ nickname: 'Bob' });
  C = await createTestUser({ nickname: 'Carol' }); // played 2026 only

  // 2026: Alice 100, Bob 60, Carol 20 (a main race and its sprint each)
  for (const [u, main, sprint] of [[A, 90, 10], [B, 50, 10], [C, 15, 5]] as Array<[U, number, number]>) {
    await addPrediction(u.id, season.pastRaceId, driverIds, main);
    await addPrediction(u.id, season.pastSprintId, driverIds, sprint);
  }

  // 2027: one finished race, Bob 30 and Alice 20
  race2027 = (
    await query(
      `INSERT INTO races (season, round, race_name, circuit_name, country, race_date, race_type, status)
       VALUES (2027, 1, 'Opening Grand Prix', 'Test Circuit', 'Testland', '2027-03-14T05:00:00Z', 'main', 'completed') RETURNING id`
    )
  ).rows[0].id;
  await addPrediction(A.id, race2027, driverIds, 20);
  await addPrediction(B.id, race2027, driverIds, 30);

  const app = express();
  app.use(express.json());
  app.use('/api/leaderboard', leaderboardRoutes);
  app.use('/api/stats', statsRoutes);
  app.use('/api/races', raceRoutes);
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

const get = async (path: string, viewer: U = A) => {
  const res = await fetch(`${base}${path}`, {
    headers: { Authorization: `Bearer ${jwt.sign({ userId: viewer.id, email: 'x@example.invalid' }, process.env.JWT_SECRET!)}` },
  });
  return { status: res.status, json: (await res.json()) as any };
};
const totals = (rows: any[]) => rows.map((r) => [r.nickname, Number(r.total_points)]);

test('the_leaderboard_of_a_season_counts_only_that_season', async () => {
  const s2026 = await get('/api/leaderboard?season=2026');
  assert.deepEqual(totals(s2026.json), [['Alice', 100], ['Bob', 60], ['Carol', 20]]);
  const s2027 = await get('/api/leaderboard?season=2027');
  // Carol did not play 2027: still on the table, on zero
  assert.deepEqual(totals(s2027.json), [['Bob', 30], ['Alice', 20], ['Carol', 0]]);
  assert.deepEqual(s2027.json.map((r: any) => Number(r.diff_to_leader)), [0, 10, 30]);
  assert.deepEqual(s2027.json.map((r: any) => Number(r.rank)), [1, 2, 3]);
});

test('last_and_best_race_follow_the_season_asked_for', async () => {
  const s2027 = await get('/api/leaderboard?season=2027');
  const bob = s2027.json.find((r: any) => r.nickname === 'Bob');
  assert.equal(Number(bob.last_race_points), 30);
  assert.equal(bob.best_race_name, 'Opening Grand Prix');
  const s2026 = await get('/api/leaderboard?season=2026');
  const bob26 = s2026.json.find((r: any) => r.nickname === 'Bob');
  assert.equal(Number(bob26.best_race_points), 50);
});

test('top_three_rank_and_player_stats_take_a_season_too', async () => {
  const top = await get('/api/leaderboard/top-three?season=2027');
  assert.deepEqual(totals(top.json), [['Bob', 30], ['Alice', 20], ['Carol', 0]]);
  const rank = await get('/api/leaderboard/rank?season=2026', B);
  assert.equal(Number(rank.json.rank), 2);
  assert.equal(Number(rank.json.total_points), 60);
  const stats = await get('/api/leaderboard/player-stats?season=2026');
  assert.deepEqual(stats.json.map((r: any) => [r.nickname, r.total_points]), [['Alice', 100], ['Bob', 60], ['Carol', 20]]);
  const stats27 = await get('/api/leaderboard/player-stats?season=2027');
  assert.deepEqual(stats27.json.map((r: any) => [r.nickname, r.total_points]), [['Bob', 30], ['Alice', 20], ['Carol', 0]]);
});

test('season_history_lists_only_the_races_of_that_season', async () => {
  const h2027 = await get('/api/leaderboard/season-history?season=2027');
  assert.deepEqual(h2027.json.races.map((r: any) => r.name), ['Opening Grand Prix']);
  const h2026 = await get('/api/leaderboard/season-history?season=2026');
  assert.equal(h2026.json.races.length, 2);
});

test('top_scorers_on_the_stats_page_follow_the_season', async () => {
  const s2026 = await get('/api/stats/summary?season=2026');
  assert.deepEqual(s2026.json.topScorers.map((t: any) => [t.nickname, Number(t.total_points)]), [['Alice', 100], ['Bob', 60], ['Carol', 20]]);
  const s2027 = await get('/api/stats/summary?season=2027');
  assert.deepEqual(s2027.json.topScorers.map((t: any) => [t.nickname, Number(t.total_points)]), [['Bob', 30], ['Alice', 20]]);
});

test('an_unknown_season_falls_back_to_the_active_one', async () => {
  const fallback = await get('/api/leaderboard?season=1999');
  const plain = await get('/api/leaderboard');
  assert.deepEqual(totals(fallback.json), totals(plain.json));
});

test('the_season_list_has_both_seasons_and_the_active_one', async () => {
  const res = await get('/api/races/seasons');
  assert.equal(res.status, 200);
  assert.deepEqual(res.json.seasons, [2027, 2026]);
  assert.equal(res.json.active, Math.min(new Date().getUTCFullYear(), 2027));
});

test('scoring_a_new_season_race_does_not_bring_the_old_season_along', async () => {
  // The reported bug: totals were rebuilt from every prediction ever made, so the first race of a new
  // season put the old season's points back. Alice predicts the exact winner (25) in the 2027 race.
  await query('DELETE FROM predictions WHERE race_id = $1', [race2027]);
  await addPrediction(A.id, race2027, driverIds, 0);
  await query('INSERT INTO race_results (race_id, driver_id, position, points, status) VALUES ($1, $2, 1, 25, $3)', [race2027, driverIds[0], 'finished']);
  await calculateRacePoints(race2027);

  const s2027 = await get('/api/leaderboard?season=2027');
  assert.equal(Number(s2027.json.find((r: any) => r.nickname === 'Alice').total_points), 25);
  const s2026 = await get('/api/leaderboard?season=2026');
  assert.equal(Number(s2026.json.find((r: any) => r.nickname === 'Alice').total_points), 100);
});
