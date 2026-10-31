import test, { before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import path from 'path';
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
const { createFlagsHandlers } = require('../flagsController');

const FIXTURES = path.resolve(__dirname, '../../../src/services/__tests__/fixtures/fia');
const fixture = (name: string) => fs.readFileSync(path.join(FIXTURES, name), 'utf8');
const textFor = (url: string): string => {
  if (url.includes('driver_change')) return fixture('driver_change.txt');
  if (url.includes('car_77_-_pu_elements')) return fixture('bottas_pu_elements.txt');
  if (url.includes('car_3_-_turn_14')) return fixture('verstappen_incident.txt');
  return 'From The Stewards\nNo / Driver  14 - Fernando Alonso\nCompetitor Aston Martin\nDecision  Fine of EUR 100.\nReason  Speeding.\n';
};

const INSIDE = new Date('2026-10-31T19:00:00Z');
const OUTSIDE = new Date('2026-10-20T12:00:00Z');
let now = INSIDE;
let release: (() => void) | null = null;
let hold = false;

let server: Server;
let base = '';
let admin: { id: number };
let player: { id: number };
const token = (u: { id: number }) => jwt.sign({ userId: u.id, email: 'x@example.invalid' }, process.env.JWT_SECRET!);

before(async () => {
  process.env.ADMIN_EMAIL = 'owner@example.invalid';
  process.env.FRONTEND_URL = 'https://pouleposition.example.invalid';
  await resetTestDatabase();
  admin = await createTestUser({ nickname: 'Boss', isAdmin: true });
  player = await createTestUser({ nickname: 'Plain' });
  await query(
    `INSERT INTO races (season, round, race_name, circuit_name, country, race_date, race_type, status)
     VALUES (2026, 19, 'Mexico City Grand Prix', 'Test', 'Mexico', '2026-11-01T20:00:00Z', 'main', 'upcoming')`
  );

  const handlers = createFlagsHandlers({
    now: () => now,
    fetchListing: async () => {
      if (hold) await new Promise<void>((resolve) => (release = resolve));
      return fixture('listing.html');
    },
    fetchPdfText: async (url: string) => textFor(url),
  });
  const app = express();
  app.use(express.json());
  app.get('/flags', authenticateAdmin, handlers.listFlags);
  app.post('/flags/check', authenticateAdmin, handlers.checkNow);
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
beforeEach(() => {
  sent.length = 0;
  now = INSIDE;
  hold = false;
});

const call = async (method: string, p: string, who: { id: number }) => {
  const res = await fetch(`${base}${p}`, { method, headers: { Authorization: `Bearer ${token(who)}` } });
  return { status: res.status, json: (await res.json()) as any };
};

test('a_player_who_is_not_an_admin_is_refused', async () => {
  assert.equal((await call('GET', '/flags', player)).status, 403);
  assert.equal((await call('POST', '/flags/check', player)).status, 403);
});

test('check_now_outside_the_window_says_it_did_not_run', async () => {
  now = OUTSIDE;
  const res = await call('POST', '/flags/check', admin);
  assert.equal(res.status, 200);
  assert.deepEqual(res.json, { ran: false, ok: true, added: 0, flagged: 0, emailed: 0 });
  assert.equal(sent.length, 0);
});

test('check_now_uses_the_injected_io_and_emails_the_new_flags', async () => {
  const res = await call('POST', '/flags/check', admin);
  assert.equal(res.status, 200);
  assert.deepEqual(res.json, { ran: true, ok: true, added: 40, flagged: 3, emailed: 3 });
  assert.equal(sent.length, 1);
  assert.equal(sent[0].to, 'owner@example.invalid');
});

test('the_list_shows_the_window_flags_first_and_the_last_check', async () => {
  const res = await call('GET', '/flags', admin);
  assert.equal(res.status, 200);
  assert.equal(res.json.window.raceName, 'Mexico City Grand Prix');
  assert.equal(res.json.lastCheck.ok, true);
  assert.equal(res.json.lastCheck.found, 40);
  assert.equal(res.json.documents.length, 40);
  const severities = res.json.documents.map((d: any) => d.severity);
  assert.deepEqual(severities.slice(0, 3), ['flag', 'flag', 'flag']);
  assert.ok(!severities.slice(3).includes('flag'));
  const haas = res.json.documents.find((d: any) => /Driver Change/.test(d.title));
  assert.match(haas.summary, /Ryo Hirakawa/);
  assert.equal(haas.emailed, true);
  assert.ok(haas.url.startsWith('https://www.fia.com/'));
});

test('outside_the_window_the_list_has_no_window', async () => {
  now = OUTSIDE;
  const res = await call('GET', '/flags', admin);
  assert.equal(res.json.window, null);
  assert.equal(res.json.documents.length, 40, 'what was seen stays listed');
});

test('a_second_check_while_one_is_running_is_refused', async () => {
  hold = true;
  const first = fetch(`${base}/flags/check`, { method: 'POST', headers: { Authorization: `Bearer ${token(admin)}` } });
  await new Promise((r) => setTimeout(r, 100));
  const second = await call('POST', '/flags/check', admin);
  assert.equal(second.status, 409);
  hold = false;
  release!();
  assert.equal((await first).status, 200);
});
