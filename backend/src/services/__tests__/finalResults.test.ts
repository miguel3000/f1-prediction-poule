import test, { before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import nodemailer from 'nodemailer';

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
const { finalizeRace } = require('../finalResultsService');
const { markResultsSynced, isAwaitingFinal } = require('../raceStatus');
const { et } = require('../emailI18n');

let driverIds: number[];
let raceId: number;
let alice: { id: number; nickname: string };
let bob: { id: number; nickname: string };

// What a source says: driver numbers in finishing order, all classified.
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
const held = decision([], {
  action: 'hold',
  rowsFrom: null,
  reason: 'Sources disagree with the stored results and with each other, results not changed',
});

const raceRow = async () => (await query('SELECT * FROM races WHERE id = $1', [raceId])).rows[0];
const pointsOf = async (userId: number): Promise<number> =>
  (await query('SELECT points_earned FROM predictions WHERE race_id = $1 AND user_id = $2', [raceId, userId])).rows[0].points_earned;
const storedOrder = async (): Promise<number[]> =>
  (
    await query(
      `SELECT d.driver_number FROM race_results rr JOIN drivers d ON d.id = rr.driver_id WHERE rr.race_id = $1 ORDER BY rr.position`,
      [raceId]
    )
  ).rows.map((r: any) => r.driver_number);
const emailOf = async (userId: number): Promise<string> => (await query('SELECT email FROM users WHERE id = $1', [userId])).rows[0].email;
const addressOf = (mail: any): string => (typeof mail.to === 'string' ? mail.to : mail.to.address);
const mailsWithSubject = (subject: string) => sent.filter((m) => m.subject === subject);

const FINAL_SUBJECT = et('en', 'final.subject', { race: 'Test Grand Prix 1' });
const RESULTS_IN_SUBJECT = et('en', 'resultsIn.subject', { race: 'Test Grand Prix 1' });

const IDENTITY = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
// Penalties after the flag: driver 7 drops behind drivers 8 and 9.
const AFTER_PENALTY = [1, 2, 3, 4, 5, 6, 8, 9, 7, 10];

before(async () => {
  process.env.ADMIN_EMAIL = 'owner@example.invalid';
  process.env.FRONTEND_URL = 'https://pouleposition.example.invalid';
  await resetTestDatabase();
  const season = await seedSeason();
  driverIds = season.driverIds;
  raceId = season.pastRaceId;
  alice = await createTestUser({ nickname: 'Alice' });
  bob = await createTestUser({ nickname: 'Bob' });
  await createTestUser({ nickname: 'Carol' }); // an account that made no prediction
});
after(closeTestDatabase);

// The race the morning after: provisional results stored (the on-track order, drivers 1 to 10),
// points worked out, the final run still to come.
beforeEach(async () => {
  sent.length = 0;
  await query('DELETE FROM predictions WHERE race_id = $1', [raceId]);
  await query('DELETE FROM race_results WHERE race_id = $1', [raceId]);
  await query('DELETE FROM result_checks WHERE race_id = $1', [raceId]);
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
  await addPrediction(alice.id, raceId, driverIds, 101); // the exact on-track order: 25+18+15+12+10+8+6+4+2+1
  await addPrediction(bob.id, raceId, [...driverIds].reverse(), 9); // two neighbours right: 5 + 4
});

test('final_applies_the_new_classification_rescores_and_closes_the_race', async () => {
  const outcome = await finalizeRace(await raceRow(), { decide: async () => decision(AFTER_PENALTY) });

  assert.equal(outcome.done, true);
  assert.deepEqual(await storedOrder(), AFTER_PENALTY);
  const race = await raceRow();
  assert.equal(race.status, 'completed');
  assert.equal(race.final_results_processed, true);
  assert.equal(await pointsOf(alice.id), 92, '88 for the exact top six, 2 + 1 + 1 for drivers 8, 9 and 10, nothing for driver 7');
  assert.equal(await pointsOf(bob.id), 9, 'Bob lost nothing');
});

test('final_emails_every_predictor_and_flags_a_change_only_to_those_whose_points_moved', async () => {
  await finalizeRace(await raceRow(), { decide: async () => decision(AFTER_PENALTY) });

  const finals = mailsWithSubject(FINAL_SUBJECT);
  assert.equal(finals.length, 2, 'Alice and Bob predicted, Carol did not');
  const aliceAddress = await emailOf(alice.id);
  const bobAddress = await emailOf(bob.id);
  const toAlice = finals.find((m) => addressOf(m) === aliceAddress);
  const toBob = finals.find((m) => addressOf(m) === bobAddress);
  assert.ok(toAlice && toBob);
  assert.ok(toAlice.html.includes(et('en', 'final.updatedChange', { previous: 101, final: 92 })), 'Alice is told 101 became 92');
  assert.ok(!toBob.html.includes(et('en', 'final.updatedTitle')), 'Bob is not told anything changed');

  assert.equal(mailsWithSubject(RESULTS_IN_SUBJECT).length, 3, 'the results-are-in mail goes to every account');
});

test('final_that_the_sources_cannot_back_changes_nothing_and_sends_nothing', async () => {
  const outcome = await finalizeRace(await raceRow(), { decide: async () => held });

  assert.equal(outcome.done, false);
  assert.match(outcome.reason, /Sources disagree/);
  assert.deepEqual(await storedOrder(), IDENTITY);
  const race = await raceRow();
  assert.equal(race.status, 'provisional', 'still waiting for its final run');
  assert.equal(race.final_results_processed, false);
  assert.equal(await pointsOf(alice.id), 101);
  assert.equal(mailsWithSubject(FINAL_SUBJECT).length + mailsWithSubject(RESULTS_IN_SUBJECT).length, 0);
});

test('final_refuses_a_race_that_was_already_closed_so_nobody_is_mailed_twice', async () => {
  await query(`UPDATE races SET status = 'completed', final_results_processed = TRUE WHERE id = $1`, [raceId]);
  let asked = 0;
  const outcome = await finalizeRace(await raceRow(), {
    decide: async () => {
      asked++;
      return decision(AFTER_PENALTY);
    },
  });

  assert.equal(outcome.done, false);
  assert.match(outcome.reason, /not waiting for its final/i);
  assert.equal(asked, 0, 'the sources are not even asked');
  assert.deepEqual(await storedOrder(), IDENTITY);
  assert.equal(sent.length, 0);
});

test('a_manual_sync_keeps_a_race_that_is_waiting_for_its_final_run_waiting_for_it', async () => {
  await markResultsSynced(raceId);
  assert.equal((await raceRow()).status, 'provisional');
  assert.equal(await isAwaitingFinal(raceId), true);

  // The Mexico case: the owner synced by hand the afternoon after, and the final run must still happen.
  const outcome = await finalizeRace(await raceRow(), { decide: async () => decision(AFTER_PENALTY) });
  assert.equal(outcome.done, true);
});

test('a_manual_sync_completes_a_race_that_was_never_provisional_and_leaves_a_closed_one_closed', async () => {
  await query(`UPDATE races SET status = 'upcoming' WHERE id = $1`, [raceId]);
  await markResultsSynced(raceId);
  assert.equal((await raceRow()).status, 'completed');
  assert.equal(await isAwaitingFinal(raceId), false);

  await query(`UPDATE races SET status = 'completed', final_results_processed = TRUE WHERE id = $1`, [raceId]);
  await markResultsSynced(raceId);
  const race = await raceRow();
  assert.equal(race.status, 'completed');
  assert.equal(race.final_results_processed, true, 'a sync never reopens a closed race');
});
