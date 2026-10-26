import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import jwt from 'jsonwebtoken';
import type { AddressInfo } from 'net';
import type { Server } from 'http';
import { query } from '../../config/database';
import { resetTestDatabase, closeTestDatabase, createTestUser, seedSeason, addPrediction } from '../../testing/testDb';
import { createGroup, joinGroup } from '../../services/groupService';
import leaderboardRoutes from '../../routes/leaderboard';
import statsRoutes from '../../routes/stats';

type U = { id: number; nickname: string };
let server: Server;
let base = '';
let A: U, B: U, C: U, D: U;
let groupId = 0;

before(async () => {
  await resetTestDatabase();
  const season = await seedSeason();
  A = await createTestUser({ nickname: 'Alice', canStartGroups: true });
  B = await createTestUser({ nickname: 'Bob' });
  C = await createTestUser({ nickname: 'Carol' });
  D = await createTestUser({ nickname: 'Dave', playsInMain: false });
  const g = await createGroup({ id: A.id, isAdmin: false }, 'Scope Group');
  groupId = g.id;
  await joinGroup(D.id, g.inviteCode, false);

  // Whole-season points, and one race everybody predicted (Dave scored the most that race).
  for (const [u, total, race] of [[A, 100, 40], [B, 80, 30], [C, 60, 20], [D, 90, 50]] as Array<[U, number, number]>) {
    await query('UPDATE users SET total_points = $1 WHERE id = $2', [total, u.id]);
    await addPrediction(u.id, season.pastRaceId, season.driverIds, race);
  }

  const app = express();
  app.use(express.json());
  app.use('/api/leaderboard', leaderboardRoutes);
  app.use('/api/stats', statsRoutes);
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

const get = async (path: string, viewer: U) => {
  const res = await fetch(`${base}${path}`, {
    headers: { Authorization: `Bearer ${jwt.sign({ userId: viewer.id, email: 'x@example.invalid' }, process.env.JWT_SECRET!)}` },
  });
  return { status: res.status, json: (await res.json()) as any };
};
const ids = (rows: any[]) => rows.map((r) => r.id);

test('main_scope_excludes_group_only_players', async () => {
  const res = await get('/api/leaderboard', A);
  assert.equal(res.status, 200);
  assert.deepEqual(ids(res.json), [A.id, B.id, C.id]);
  assert.deepEqual(res.json.map((r: any) => Number(r.rank)), [1, 2, 3]);
});

test('group_scope_has_only_members', async () => {
  const res = await get(`/api/leaderboard?poule=${groupId}`, A);
  assert.deepEqual(ids(res.json), [A.id, D.id]);
});

test('non_member_asking_for_a_group_is_404', async () => {
  assert.equal((await get(`/api/leaderboard?poule=${groupId}`, B)).status, 404);
  assert.equal((await get(`/api/leaderboard/season-history?poule=${groupId}`, B)).status, 404);
  assert.equal((await get(`/api/leaderboard/player-stats?poule=${groupId}`, B)).status, 404);
});

test('group_only_player_asking_for_main_is_403_and_defaults_to_the_group', async () => {
  assert.equal((await get('/api/leaderboard?poule=main', D)).status, 403);
  const fallback = await get('/api/leaderboard', D);
  assert.equal(fallback.status, 200);
  assert.deepEqual(ids(fallback.json), [A.id, D.id]);
});

test('ranks_and_diff_to_leader_are_computed_inside_the_poule', async () => {
  const group = await get(`/api/leaderboard?poule=${groupId}`, A);
  assert.deepEqual(group.json.map((r: any) => [Number(r.rank), Number(r.diff_to_leader)]), [[1, 0], [2, 10]]);
  const main = await get('/api/leaderboard', A);
  assert.deepEqual(main.json.map((r: any) => Number(r.diff_to_leader)), [0, 20, 40]);
});

test('last_race_rank_is_inside_the_poule', async () => {
  const main = await get('/api/leaderboard', A);
  assert.equal(Number(main.json.find((r: any) => r.id === A.id).last_race_rank), 1); // Dave's 50 does not count here
  const group = await get(`/api/leaderboard?poule=${groupId}`, A);
  assert.equal(Number(group.json.find((r: any) => r.id === A.id).last_race_rank), 2);
  assert.equal(Number(group.json.find((r: any) => r.id === D.id).last_race_rank), 1);
});

test('season_history_users_are_only_the_poule', async () => {
  const main = await get('/api/leaderboard/season-history', A);
  assert.deepEqual(ids(main.json.users).sort(), [A.id, B.id, C.id].sort());
  const group = await get(`/api/leaderboard/season-history?poule=${groupId}`, A);
  assert.deepEqual(ids(group.json.users).sort(), [A.id, D.id].sort());
});

test('player_stats_users_are_only_the_poule', async () => {
  const main = await get('/api/leaderboard/player-stats', A);
  assert.deepEqual(ids(main.json).sort(), [A.id, B.id, C.id].sort());
  const group = await get(`/api/leaderboard/player-stats?poule=${groupId}`, A);
  assert.deepEqual(ids(group.json).sort(), [A.id, D.id].sort());
});

test('top_three_and_rank_follow_the_poule', async () => {
  const top = await get('/api/leaderboard/top-three', A);
  assert.deepEqual(ids(top.json), [A.id, B.id, C.id]);
  const rank = await get(`/api/leaderboard/rank?poule=${groupId}`, D);
  assert.equal(Number(rank.json.rank), 2);
});

test('top_scorers_on_the_stats_page_exclude_group_only_players', async () => {
  const res = await get('/api/stats/summary', A);
  assert.deepEqual(res.json.topScorers.map((t: any) => t.nickname), ['Alice', 'Bob', 'Carol']);
});

test('when_everyone_plays_in_main_the_standings_list_everyone_in_points_order', async () => {
  await query('UPDATE users SET plays_in_main = TRUE WHERE id = $1', [D.id]);
  const res = await get('/api/leaderboard', A);
  assert.deepEqual(ids(res.json), [A.id, D.id, B.id, C.id]);
  assert.deepEqual((await get('/api/stats/summary', A)).json.topScorers.map((t: any) => t.nickname), ['Alice', 'Dave', 'Bob', 'Carol']);
  await query('UPDATE users SET plays_in_main = FALSE WHERE id = $1', [D.id]);
});
