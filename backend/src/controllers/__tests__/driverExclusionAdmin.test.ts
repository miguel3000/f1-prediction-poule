import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import jwt from 'jsonwebtoken';
import nodemailer from 'nodemailer';
import type { AddressInfo } from 'net';
import type { Server } from 'http';

// A fake mail transport, installed before anything imports the email service.
const sent: any[] = [];
let failSends = false;
(nodemailer as any).createTransport = () => ({
  sendMail: async (options: any) => {
    if (failSends) throw new Error('SMTP down');
    sent.push(options);
  },
});
/* eslint-disable @typescript-eslint/no-var-requires */
const adminRoutes = require('../../routes/admin').default;
const { query } = require('../../config/database');
const { resetTestDatabase, closeTestDatabase, createTestUser, seedSeason, addPrediction } = require('../../testing/testDb');

let server: Server;
let base = '';
let admin: { id: number; nickname: string };
let alice: { id: number; nickname: string };
let bob: { id: number; nickname: string };
let carol: { id: number; nickname: string };
let all: number[] = [];
let mainId = 0;
const d = (n: number) => all[n - 1];
const tokenFor = (u: { id: number }) => jwt.sign({ userId: u.id, email: 'x@example.invalid' }, process.env.JWT_SECRET!);

before(async () => {
  await resetTestDatabase();
  const season = await seedSeason();
  admin = await createTestUser({ nickname: 'Boss', isAdmin: true });
  alice = await createTestUser({ nickname: 'Alice' });
  bob = await createTestUser({ nickname: 'Bob' });
  carol = await createTestUser({ nickname: 'Carol' });
  await query("UPDATE users SET language = 'nl' WHERE id = $1", [alice.id]);
  all = [...season.driverIds];
  for (const n of [11, 12]) {
    const extra = await query(
      `INSERT INTO drivers (driver_number, name, name_acronym, team, season) VALUES ($1, $2, $3, 'Team 6', 2026) RETURNING id`,
      [n, `Driver ${n}`, `D${n}`]
    );
    all.push(extra.rows[0].id);
  }
  // The upcoming race of the seed is round 2; a driver called with markup checks the email escapes names.
  mainId = season.futureRaceId;
  await query('UPDATE drivers SET name = $1 WHERE id = $2', ['Dri<i>ver 1', d(1)]);

  const app = express();
  app.use(express.json());
  app.use('/api/admin', adminRoutes);
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

const call = async (method: string, path: string, who: { id: number }, body?: unknown) => {
  const res = await fetch(`${base}/api/admin${path}`, {
    method,
    headers: { Authorization: `Bearer ${tokenFor(who)}`, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, json: (await res.json()) as any };
};

test('a_player_who_is_not_an_admin_is_refused', async () => {
  const res = await call('POST', '/driver-exclusions', alice, { round: 2, driverId: d(1) });
  assert.equal(res.status, 403);
});

test('marking_a_driver_resets_the_predictions_and_warns_each_player_in_their_language', async () => {
  await addPrediction(alice.id, mainId, [d(1), d(2), d(3), d(4), d(5), d(6), d(7), d(8), d(9), d(10)], 0, d(12));
  await addPrediction(bob.id, mainId, all.filter((id) => id !== d(1)).slice(0, 10), 0, d(1));
  await addPrediction(carol.id, mainId, all.filter((id) => id !== d(1)).slice(0, 10), 0, d(3));
  sent.length = 0;

  const res = await call('POST', '/driver-exclusions', admin, { round: 2, driverId: d(1), replacedByDriverId: d(11) });

  assert.equal(res.status, 200, JSON.stringify(res.json));
  assert.deepEqual(res.json, { reset: 2, emailed: 2, failed: 0 });
  assert.equal((await query('SELECT user_id FROM predictions WHERE race_id = $1', [mainId])).rows.length, 1);
  assert.equal(sent.length, 2);

  const toAlice = sent.find((m) => JSON.stringify(m.to).includes('alice'));
  const toBob = sent.find((m) => JSON.stringify(m.to).includes('bob'));
  assert.ok(toAlice && toBob);
  assert.match(toAlice.subject, /Voorspel opnieuw/); // Alice's language is Dutch
  assert.match(toBob.subject, /Please predict again/);
  assert.match(toBob.html, /Test Grand Prix 2/);
  assert.match(toBob.html, /Driver 11/, 'the stand-in is named');
  assert.ok(!toBob.html.includes('Dri<i>ver'), 'names are escaped');
  assert.match(toBob.html, /Dri&lt;i&gt;ver 1/);
  assert.ok(!sent.some((m) => JSON.stringify(m.to).includes('carol')), 'Carol did not use him');
});

test('an_email_that_cannot_be_sent_is_counted_not_hidden', async () => {
  failSends = true;
  // Carol predicts Driver 2 as first retirement; excluding Driver 2 resets her and the send fails.
  await query('DELETE FROM predictions WHERE user_id = $1 AND race_id = $2', [carol.id, mainId]);
  await addPrediction(carol.id, mainId, all.filter((id) => id !== d(2)).slice(0, 10), 0, d(2));
  const res = await call('POST', '/driver-exclusions', admin, { round: 2, driverId: d(2) });
  failSends = false;
  assert.equal(res.status, 200);
  assert.equal(res.json.reset, 1);
  assert.equal(res.json.emailed, 0);
  assert.equal(res.json.failed, 1);
});

test('the_list_shows_the_weekends_to_choose_from_the_drivers_and_what_is_marked', async () => {
  const res = await call('GET', '/driver-exclusions', admin);
  assert.equal(res.status, 200);
  assert.deepEqual(res.json.weekends, [{ round: 2, name: 'Test Grand Prix 2' }]);
  assert.equal(res.json.drivers.length, all.length);
  assert.deepEqual(
    res.json.exclusions.map((e: any) => e.driverName),
    ['Dri<i>ver 1', 'Driver 2']
  );
});

test('taking_a_driver_off_the_list_puts_him_back_without_any_email', async () => {
  sent.length = 0;
  const res = await call('DELETE', `/driver-exclusions/2/${d(2)}`, admin);
  assert.equal(res.status, 200);
  assert.equal(sent.length, 0);
  assert.deepEqual(
    (await call('GET', '/driver-exclusions', admin)).json.exclusions.map((e: any) => e.driverId),
    [d(1)]
  );
});

test('a_weekend_that_has_started_is_refused_with_a_clear_message', async () => {
  const res = await call('POST', '/driver-exclusions', admin, { round: 1, driverId: d(3) });
  assert.equal(res.status, 400);
  assert.equal(res.json.error, 'That weekend has already started');
});

test('bad_input_is_a_400_or_404_not_a_crash', async () => {
  assert.equal((await call('POST', '/driver-exclusions', admin, { round: 'x', driverId: d(3) })).status, 400);
  assert.equal((await call('POST', '/driver-exclusions', admin, { round: 2, driverId: 999999 })).status, 404);
  assert.equal((await call('POST', '/driver-exclusions', admin, { round: 2, driverId: d(3), replacedByDriverId: d(3) })).status, 400);
});
