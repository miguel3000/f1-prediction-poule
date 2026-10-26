import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import jwt from 'jsonwebtoken';
import type { AddressInfo } from 'net';
import type { Server } from 'http';
import { resetTestDatabase, closeTestDatabase, createTestUser, seedSeason, addPrediction } from '../../testing/testDb';
import { createGroup, joinGroup } from '../../services/groupService';
import raceRoutes from '../../routes/races';

type U = { id: number; nickname: string };
let server: Server;
let base = '';
let A: U, B: U, D: U, E: U;
let groupId = 0;
let season: Awaited<ReturnType<typeof seedSeason>>;

before(async () => {
  await resetTestDatabase();
  season = await seedSeason();
  A = await createTestUser({ nickname: 'Alice', canStartGroups: true });
  B = await createTestUser({ nickname: 'Bob' });
  D = await createTestUser({ nickname: 'Dave', playsInMain: false });
  E = await createTestUser({ nickname: 'Eve' }); // plays in main, never predicts
  const g = await createGroup({ id: A.id, isAdmin: false }, 'Visible Group');
  groupId = g.id;
  await joinGroup(D.id, g.inviteCode, false);

  const picks = season.driverIds;
  await addPrediction(A.id, season.pastRaceId, picks, 33, picks[9]);
  await addPrediction(B.id, season.pastRaceId, [...picks].reverse(), 12, picks[0]);
  await addPrediction(D.id, season.pastRaceId, picks, 21, picks[5]);
  await addPrediction(A.id, season.pastSprintId, picks, 8);
  await addPrediction(D.id, season.pastSprintId, picks, 5);
  await addPrediction(A.id, season.futureRaceId, picks, 0, picks[1]);

  const app = express();
  app.use(express.json());
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

const get = async (path: string, viewer: U) => {
  const res = await fetch(`${base}${path}`, {
    headers: { Authorization: `Bearer ${jwt.sign({ userId: viewer.id, email: 'x@example.invalid' }, process.env.JWT_SECRET!)}` },
  });
  const text = await res.text();
  return { status: res.status, text, json: JSON.parse(text) as any };
};

test('refused_before_the_race_has_started_and_shown_after', async () => {
  const early = await get(`/api/races/${season.futureRaceId}/predictions`, A);
  assert.equal(early.status, 403);
  assert.equal(early.json.error, 'Predictions are visible once the race has started');
  assert.ok(!early.text.includes('Driver'));
  const started = await get(`/api/races/${season.pastRaceId}/predictions`, A);
  assert.equal(started.status, 200);
  assert.equal(started.json.locked, true);
});

test('main_race_returns_10_picks_and_the_dnf_pick', async () => {
  const res = await get(`/api/races/${season.pastRaceId}/predictions`, A);
  const alice = res.json.predictions.find((p: any) => p.user.id === A.id);
  assert.equal(alice.picks.length, 10);
  assert.deepEqual(alice.picks[0], {
    position: 1,
    driver: { id: season.driverIds[0], name: 'Driver 1', name_acronym: 'D01', team: 'Team 1' },
  });
  assert.equal(alice.dnf_pick.id, season.driverIds[9]);
  assert.equal(alice.points_earned, 33);
});

test('sprint_returns_8_picks_without_dnf', async () => {
  const res = await get(`/api/races/${season.pastSprintId}/predictions`, A);
  assert.ok(res.json.predictions.length > 0);
  for (const p of res.json.predictions) {
    assert.equal(p.picks.length, 8);
    assert.equal(p.dnf_pick, null);
  }
});

test('lists_only_poule_members_who_predicted', async () => {
  const main = await get(`/api/races/${season.pastRaceId}/predictions`, A);
  assert.deepEqual(main.json.predictions.map((p: any) => p.user.id), [A.id, B.id]); // Eve did not predict, Dave is not in main
  const group = await get(`/api/races/${season.pastRaceId}/predictions?poule=${groupId}`, A);
  assert.deepEqual(group.json.predictions.map((p: any) => p.user.id), [A.id, D.id]);
});

test('group_only_player_is_absent_from_the_main_list_and_defaults_to_their_group', async () => {
  const asDave = await get(`/api/races/${season.pastRaceId}/predictions`, D);
  assert.equal(asDave.status, 200);
  assert.deepEqual(asDave.json.predictions.map((p: any) => p.user.id), [A.id, D.id]);
  assert.equal((await get(`/api/races/${season.pastRaceId}/predictions?poule=main`, D)).status, 403);
});

test('viewer_not_in_the_poule_gets_404', async () => {
  assert.equal((await get(`/api/races/${season.pastRaceId}/predictions?poule=${groupId}`, B)).status, 404);
  assert.equal((await get('/api/races/999999/predictions', A)).status, 404);
});

test('response_contains_no_email_anywhere', async () => {
  const res = await get(`/api/races/${season.pastRaceId}/predictions?poule=${groupId}`, A);
  assert.ok(!res.text.includes('@'));
  assert.ok(!/email/i.test(res.text));
});
