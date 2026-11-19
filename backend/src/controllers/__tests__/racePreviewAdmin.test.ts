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
const { resetTestDatabase, closeTestDatabase, createTestUser } = require('../../testing/testDb');
const { authenticateAdmin } = require('../../middleware/adminAuth');
const { createRacePreviewHandlers } = require('../racePreviewController');

const entry = (round: number) => ({
  season: '2026', round: String(round), raceName: 'Due Grand Prix',
  Circuit: { circuitId: 'vegas', circuitName: 'Test Strip Circuit', Location: { locality: 'Testville', country: 'Testland' } },
  date: '2026-11-22', time: '04:00:00Z',
  FirstPractice: { date: '2026-11-20', time: '00:30:00Z' },
  Qualifying: { date: '2026-11-21', time: '04:00:00Z' },
});
let calendar: any[] = [entry(5)];

let server: Server;
let base = '';
let admin: { id: number };
let player: { id: number };
const token = (u: { id: number }) => jwt.sign({ userId: u.id, email: 'x@example.invalid' }, process.env.JWT_SECRET!);
const call = (method: string, path: string, who?: { id: number }, body?: unknown) =>
  fetch(base + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(who ? { Authorization: `Bearer ${token(who)}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

before(async () => {
  process.env.FRONTEND_URL = 'https://pouleposition.example.invalid';
  await resetTestDatabase();
  admin = await createTestUser({ nickname: 'Boss', isAdmin: true, email: 'boss@example.invalid' } as any);
  player = await createTestUser({ nickname: 'Plain' });
  await query(`UPDATE users SET email_opt_out = TRUE WHERE id = $1`, [admin.id]); // the owner may have unsubscribed: the test still reaches them
  await query(
    `INSERT INTO races (season, round, race_name, circuit_name, country, race_date, race_type, status)
     VALUES (2026, 5, 'Due Grand Prix', 'Test', 'Testland', (NOW() AT TIME ZONE 'UTC') + interval '72 hours', 'main', 'upcoming')`
  );

  const handlers = createRacePreviewHandlers({ getCalendar: async () => calendar });
  const app = express();
  app.use(express.json());
  app.get('/race-preview', authenticateAdmin, handlers.getRacePreview);
  app.put('/race-preview', authenticateAdmin, handlers.setRacePreviewSwitch);
  app.post('/race-preview/test', authenticateAdmin, handlers.testRacePreview);
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => {
      base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
      resolve();
    });
  });
});
after(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await closeTestDatabase();
});
beforeEach(async () => {
  sent.length = 0;
  calendar = [entry(5)];
  await query('DELETE FROM app_settings');
  await query('DELETE FROM race_preview_log');
});

test('only_the_admin_can_see_or_change_the_race_preview', async () => {
  for (const [method, path] of [['GET', '/race-preview'], ['PUT', '/race-preview'], ['POST', '/race-preview/test']]) {
    assert.equal((await call(method, path)).status, 401, `${method} ${path} without login`);
    assert.equal((await call(method, path, player, method === 'GET' ? undefined : { enabled: true })).status, 403, `${method} ${path} as a player`);
  }
  assert.equal((await query('SELECT COUNT(*)::int AS n FROM app_settings')).rows[0].n, 0);
  assert.equal(sent.length, 0);
});

test('the_status_says_what_is_due_and_that_the_switch_starts_off', async () => {
  const res = await call('GET', '/race-preview', admin);
  assert.equal(res.status, 200);
  const body = (await res.json()) as any;
  assert.equal(body.autoOn, false);
  assert.equal(body.weekend.raceName, 'Due Grand Prix');
  assert.equal(body.weekend.sprint, false);
  assert.equal(body.waiting, 1); // Plain; the owner unsubscribed
  assert.equal(body.alreadySent, 0);
});

test('the_switch_is_saved_and_only_true_or_false_is_accepted', async () => {
  const on = await call('PUT', '/race-preview', admin, { enabled: true });
  assert.equal(on.status, 200);
  assert.equal(((await on.json()) as any).autoOn, true);
  assert.equal((((await (await call('GET', '/race-preview', admin)).json()) as any)).autoOn, true);

  for (const bad of [undefined, 'true', 1, null]) {
    assert.equal((await call('PUT', '/race-preview', admin, { enabled: bad })).status, 400, `enabled=${String(bad)}`);
  }
  assert.equal((((await (await call('GET', '/race-preview', admin)).json()) as any)).autoOn, true); // unchanged by the bad ones

  assert.equal(((await (await call('PUT', '/race-preview', admin, { enabled: false })).json()) as any).autoOn, false);
});

test('a_calendar_problem_is_reported_but_the_switch_still_shows', async () => {
  calendar = []; // the official calendar has no round 5
  const body = (await (await call('GET', '/race-preview', admin)).json()) as any;
  assert.equal(body.autoOn, false);
  assert.equal(body.weekend, null);
  assert.match(body.problem, /no round 5/);
});

test('the_test_mail_goes_to_the_owner_only_and_is_not_recorded', async () => {
  const res = await call('POST', '/race-preview/test', admin);
  assert.equal(res.status, 200);
  const body = (await res.json()) as any;
  assert.deepEqual(body, { raceName: 'Due Grand Prix', to: 'Boss' }); // a nickname, never an address
  assert.equal(sent.length, 1);
  assert.equal(sent[0].to.address, 'boss@example.invalid');
  assert.match(sent[0].subject, /^Race weekend: Due Grand Prix \(lights out /);
  assert.equal((await query('SELECT COUNT(*)::int AS n FROM race_preview_log')).rows[0].n, 0);
});

test('a_test_with_no_race_in_sight_says_so', async () => {
  await query(`UPDATE races SET race_date = (NOW() AT TIME ZONE 'UTC') + interval '20 days' WHERE round = 5`);
  try {
    const res = await call('POST', '/race-preview/test', admin);
    assert.equal(res.status, 404);
    assert.equal(sent.length, 0);
  } finally {
    await query(`UPDATE races SET race_date = (NOW() AT TIME ZONE 'UTC') + interval '72 hours' WHERE round = 5`);
  }
});
