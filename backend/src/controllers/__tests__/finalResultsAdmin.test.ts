import test, { before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import jwt from 'jsonwebtoken';
import nodemailer from 'nodemailer';
import type { AddressInfo } from 'net';
import type { Server } from 'http';

// A fake mail transport, installed before anything imports the email service.
const sent: any[] = [];
(nodemailer as any).createTransport = () => ({
  sendMail: async (options: any) => {
    sent.push(options);
  },
});
/* eslint-disable @typescript-eslint/no-var-requires */
const { query } = require('../../config/database');
const { resetTestDatabase, closeTestDatabase, createTestUser, seedSeason, addPrediction } = require('../../testing/testDb');
const { authenticateAdmin } = require('../../middleware/adminAuth');
const { createFinalResultsHandlers } = require('../finalResultsController');

const decision = (order: number[], over: Record<string, unknown> = {}) => ({
  action: 'apply',
  rowsFrom: 'jolpi',
  reason: 'Confirmed by Jolpi (Ergast), OpenF1',
  warning: null,
  analysis: { verdict: 'confirmed', scored: 10, sources: [], consensus: null, chosen: 'jolpi', differences: [] },
  sources: [
    {
      source: 'jolpi',
      label: 'Jolpi (Ergast)',
      available: true,
      rows: order.map((number, i) => ({ number, position: i + 1, status: 'finished', rawStatus: 'Finished', points: 0 })),
    },
  ],
  ...over,
});
const AFTER_PENALTY = [1, 2, 3, 4, 5, 6, 8, 9, 7, 10];
const held = decision([], { action: 'hold', rowsFrom: null, reason: 'Sources disagree with the stored results and with each other, results not changed' });

let decideImpl: () => Promise<any> = async () => decision(AFTER_PENALTY);
let release: (() => void) | null = null;

let server: Server;
let base = '';
let admin: { id: number };
let player: { id: number };
let driverIds: number[];
let raceId: number;
let futureRaceId: number;
const token = (u: { id: number }) => jwt.sign({ userId: u.id, email: 'x@example.invalid' }, process.env.JWT_SECRET!);

before(async () => {
  process.env.ADMIN_EMAIL = 'owner@example.invalid';
  process.env.FRONTEND_URL = 'https://pouleposition.example.invalid';
  await resetTestDatabase();
  const season = await seedSeason();
  driverIds = season.driverIds;
  raceId = season.pastRaceId;
  futureRaceId = season.futureRaceId;
  admin = await createTestUser({ nickname: 'Boss', isAdmin: true });
  player = await createTestUser({ nickname: 'Plain' });

  const handlers = createFinalResultsHandlers({ decide: () => decideImpl() });
  const app = express();
  app.use(express.json());
  app.post('/races/:raceId/final-results', authenticateAdmin, handlers.runFinalResults);
  app.get('/final-results/status', authenticateAdmin, handlers.getFinalResultsStatus);
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

// The morning after: provisional results stored (the on-track order), the player's points worked out.
beforeEach(async () => {
  sent.length = 0;
  decideImpl = async () => decision(AFTER_PENALTY);
  release = null;
  await query('DELETE FROM predictions WHERE race_id = $1', [raceId]);
  await query('DELETE FROM race_results WHERE race_id = $1', [raceId]);
  await query(
    `UPDATE races SET status = 'provisional', final_results_processed = FALSE, race_date = NOW() - INTERVAL '2 days' WHERE id = $1`,
    [raceId]
  );
  for (let i = 0; i < 10; i++) {
    await query(`INSERT INTO race_results (race_id, driver_id, position, points, status) VALUES ($1, $2, $3, 0, 'Finished')`, [
      raceId,
      driverIds[i],
      i + 1,
    ]);
  }
  await addPrediction(player.id, raceId, driverIds, 101);
});

const call = async (method: string, p: string, who: { id: number }) => {
  const res = await fetch(`${base}${p}`, { method, headers: { Authorization: `Bearer ${token(who)}` } });
  return { status: res.status, json: (await res.json()) as any };
};
const raceRow = async () => (await query('SELECT * FROM races WHERE id = $1', [raceId])).rows[0];

// The run goes on after the answer, so the tests wait for it the way the Pitlane does.
const untilFinished = async () => {
  for (let i = 0; i < 100; i++) {
    const { json } = await call('GET', '/final-results/status', admin);
    if (!json.running) return json;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error('the final run did not finish');
};

test('a_player_who_is_not_an_admin_is_refused', async () => {
  assert.equal((await call('POST', `/races/${raceId}/final-results`, player)).status, 403);
  assert.equal((await call('GET', '/final-results/status', player)).status, 403);
});

test('a_race_that_does_not_exist_or_has_not_happened_is_not_found', async () => {
  assert.equal((await call('POST', '/races/999999/final-results', admin)).status, 404);
  assert.equal((await call('POST', `/races/${futureRaceId}/final-results`, admin)).status, 404);
  assert.equal((await call('POST', '/races/abc/final-results', admin)).status, 400);
});

test('a_race_that_already_had_its_final_run_is_refused_and_nobody_is_mailed', async () => {
  await query(`UPDATE races SET status = 'completed', final_results_processed = TRUE WHERE id = $1`, [raceId]);
  const res = await call('POST', `/races/${raceId}/final-results`, admin);
  assert.equal(res.status, 409);
  assert.match(res.json.error, /not waiting for its final results/);
  assert.equal(sent.length, 0);
});

test('the_owner_can_run_the_final_standings_on_any_day_and_the_race_is_closed_with_the_honest_points', async () => {
  const started = await call('POST', `/races/${raceId}/final-results`, admin);
  assert.equal(started.status, 202);

  const finished = await untilFinished();
  assert.equal(finished.lastStatus, 'done');
  assert.match(finished.lastMessage, /Test Grand Prix 1/);
  const race = await raceRow();
  assert.equal(race.status, 'completed');
  assert.equal(race.final_results_processed, true);
  const points = (await query('SELECT points_earned FROM predictions WHERE race_id = $1', [raceId])).rows[0].points_earned;
  assert.equal(points, 92, 'the penalty for driver 7 is in');
  assert.ok(sent.length >= 2, 'the player got the final mail and the results-are-in mail');
});

test('when_the_sources_cannot_agree_the_run_changes_nothing_and_says_why', async () => {
  decideImpl = async () => held;
  assert.equal((await call('POST', `/races/${raceId}/final-results`, admin)).status, 202);

  const finished = await untilFinished();
  assert.equal(finished.lastStatus, 'held');
  assert.match(finished.lastMessage, /Sources disagree/);
  const race = await raceRow();
  assert.equal(race.status, 'provisional', 'still waiting, so it can be run again once the sources catch up');
  assert.equal(race.final_results_processed, false);
});

test('a_second_press_while_the_run_is_still_going_is_turned_away', async () => {
  decideImpl = () => new Promise((resolve) => (release = () => resolve(decision(AFTER_PENALTY))));
  assert.equal((await call('POST', `/races/${raceId}/final-results`, admin)).status, 202);

  const again = await call('POST', `/races/${raceId}/final-results`, admin);
  assert.equal(again.status, 409);
  assert.match(again.json.error, /already/i);

  while (!release) await new Promise((resolve) => setTimeout(resolve, 10)); // the run has reached the sources
  release();
  await untilFinished();
  assert.equal((await raceRow()).status, 'completed', 'and the first run still finished normally');
});
