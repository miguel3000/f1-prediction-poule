import test, { before, after } from 'node:test';
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
const raceRoutes = require('../../routes/races').default;
const predictionRoutes = require('../../routes/predictions').default;
const sprintRoutes = require('../../routes/sprintPredictions').default;
const { query } = require('../../config/database');
const { resetTestDatabase, closeTestDatabase, createTestUser, seedSeason } = require('../../testing/testDb');
const { excludeDriver } = require('../../services/driverExclusionService');

const NOT_RACING = 'A driver in your prediction is not racing this weekend. Reload the page and pick again.';

let server: Server;
let base = '';
let user: { id: number; nickname: string };
let all: number[] = [];
let sprintId = 0;
let mainId = 0;
const d = (n: number) => all[n - 1];
const token = () => jwt.sign({ userId: user.id, email: 'x@example.invalid' }, process.env.JWT_SECRET!);

before(async () => {
  await resetTestDatabase();
  const season = await seedSeason();
  user = await createTestUser();
  all = [...season.driverIds];
  for (const n of [11, 12]) {
    const extra = await query(
      `INSERT INTO drivers (driver_number, name, name_acronym, team, season) VALUES ($1, $2, $3, 'Team 6', 2026) RETURNING id`,
      [n, `Driver ${n}`, `D${n}`]
    );
    all.push(extra.rows[0].id);
  }
  const race = async (type: 'main' | 'sprint', days: number) =>
    (
      await query(
        `INSERT INTO races (season, round, race_name, circuit_name, country, race_date, race_type, status)
         VALUES (2026, 6, 'Weekend GP', 'Test Circuit', 'Testland', NOW() + ($1 || ' days')::interval, $2, 'upcoming') RETURNING id`,
        [String(days), type]
      )
    ).rows[0].id as number;
  sprintId = await race('sprint', 8);
  mainId = await race('main', 9);
  // Qualifying is already stored, so the picker needs no outside data source.
  for (let i = 0; i < all.length; i++) {
    await query('INSERT INTO qualifying_results (race_id, driver_id, position) VALUES ($1, $2, $3)', [mainId, all[i], i + 1]);
  }
  await excludeDriver(2026, 6, d(3), d(12));

  const app = express();
  app.use(express.json());
  app.use('/api/races', raceRoutes);
  app.use('/api/predictions', predictionRoutes);
  app.use('/api/sprint-predictions', sprintRoutes);
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

const call = async (method: string, path: string, body?: unknown) => {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, json: (await res.json()) as any };
};

test('the_picker_leaves_out_a_driver_who_is_not_racing_and_does_not_add_him_back', async () => {
  const res = await call('GET', `/api/races/${mainId}/qualifying`);
  assert.equal(res.status, 200);
  assert.equal(res.json.source, 'qualifying');
  const ids = res.json.drivers.map((x: any) => x.id);
  assert.ok(!ids.includes(d(3)), 'Driver 3 is not racing');
  assert.equal(ids.length, all.length - 1);
});

test('the_picker_follows_the_real_starting_grid_without_him_too', async () => {
  for (let i = 0; i < all.length; i++) {
    if (all[i] === d(3)) continue;
    await query('INSERT INTO starting_grid (race_id, driver_id, position) VALUES ($1, $2, $3)', [mainId, all[i], i + 1]);
  }
  const res = await call('GET', `/api/races/${mainId}/qualifying`);
  assert.equal(res.json.source, 'grid');
  assert.ok(!res.json.drivers.map((x: any) => x.id).includes(d(3)));
  await query('DELETE FROM starting_grid WHERE race_id = $1', [mainId]);
});

test('a_main_prediction_with_a_driver_who_is_not_racing_is_refused', async () => {
  const withHim = [d(3), ...all.filter((id) => id !== d(3)).slice(0, 9)];
  const res = await call('POST', '/api/predictions', { raceId: mainId, positions: withHim, dnfPick: d(1) });
  assert.equal(res.status, 400);
  assert.equal(res.json.error, NOT_RACING);
  assert.equal((await query('SELECT 1 FROM predictions WHERE user_id = $1', [user.id])).rows.length, 0);
});

test('the_first_retirement_pick_cannot_be_a_driver_who_is_not_racing_either', async () => {
  const fine = all.filter((id) => id !== d(3)).slice(0, 10);
  const res = await call('POST', '/api/predictions', { raceId: mainId, positions: fine, dnfPick: d(3) });
  assert.equal(res.status, 400);
  assert.equal(res.json.error, NOT_RACING);
});

test('a_prediction_without_him_is_saved', async () => {
  const fine = all.filter((id) => id !== d(3)).slice(0, 10);
  const res = await call('POST', '/api/predictions', { raceId: mainId, positions: fine, dnfPick: d(12) });
  assert.equal(res.status, 200, JSON.stringify(res.json));
  assert.equal((await query('SELECT 1 FROM predictions WHERE user_id = $1', [user.id])).rows.length, 1);
});

test('a_sprint_prediction_with_a_driver_who_is_not_racing_is_refused', async () => {
  const res = await call('POST', '/api/sprint-predictions', {
    raceId: sprintId,
    positions: [d(1), d(2), d(3), d(4), d(5), d(6), d(7), d(8)],
  });
  assert.equal(res.status, 400);
  assert.equal(res.json.error, NOT_RACING);
});
