import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import jwt from 'jsonwebtoken';
import type { AddressInfo } from 'net';
import type { Server } from 'http';

/* eslint-disable @typescript-eslint/no-var-requires */
const authRoutes = require('../../routes/auth').default;
const { query } = require('../../config/database');
const { resetTestDatabase, closeTestDatabase, createTestUser } = require('../../testing/testDb');

// The unsubscribe link in a mail is opened in a browser (GET), and mail apps with a built-in
// Unsubscribe button (Gmail, Apple Mail) send a POST to the same address (RFC 8058, one click).
let server: Server;
let base = '';

before(async () => {
  await resetTestDatabase();
  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use('/api/auth', authRoutes);
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

const tokenFor = (userId: number, purpose = 'unsubscribe') => jwt.sign({ userId, purpose }, process.env.JWT_SECRET!);
const optedOut = async (id: number) => (await query('SELECT email_opt_out FROM users WHERE id = $1', [id])).rows[0].email_opt_out as boolean;
const post = (token: string, body = 'List-Unsubscribe=One-Click') =>
  fetch(`${base}/api/auth/unsubscribe?token=${token}`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body });

test('the_link_in_the_mail_still_unsubscribes_in_the_browser', async () => {
  const user = await createTestUser();
  const res = await fetch(`${base}/api/auth/unsubscribe?token=${tokenFor(user.id)}`);
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type') ?? '', /html/);
  assert.equal(await optedOut(user.id), true);
});

test('a_one_click_post_from_a_mail_app_unsubscribes_the_player', async () => {
  const user = await createTestUser();
  assert.equal(await optedOut(user.id), false);
  const res = await post(tokenFor(user.id));
  assert.equal(res.status, 200);
  assert.equal(await optedOut(user.id), true);
});

test('a_post_with_a_bad_or_foreign_token_changes_nothing', async () => {
  const user = await createTestUser();
  assert.equal((await post('not-a-token')).status, 400);
  assert.equal((await post(tokenFor(user.id, 'login'))).status, 400); // a token made for something else
  assert.equal((await post(jwt.sign({ userId: user.id, purpose: 'unsubscribe' }, 'wrong-secret'))).status, 400);
  assert.equal((await fetch(`${base}/api/auth/unsubscribe`, { method: 'POST' })).status, 400); // no token at all
  assert.equal(await optedOut(user.id), false);
});
