import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
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
const authRoutes = require('../../routes/auth').default;
const { query } = require('../../config/database');
const { resetTestDatabase, closeTestDatabase } = require('../../testing/testDb');

let server: Server;
let base = '';

before(async () => {
  await resetTestDatabase();
  const app = express();
  app.use(express.json());
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

const register = async (nickname: string, email: string) => {
  const res = await fetch(`${base}/api/auth/register-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nickname, email, password: 'secret1' }),
  });
  return { status: res.status, json: (await res.json()) as any };
};
// Sign-up mails go out in the background; let them finish before the test ends.
const waitForMailTo = async (email: string) => {
  for (let i = 0; i < 100; i++) {
    if (sent.some((m) => JSON.stringify(m.to).includes(email))) return;
    await new Promise((r) => setTimeout(r, 30));
  }
  throw new Error(`no mail sent to ${email}`);
};
const storedNicknames = async (email: string) =>
  (await query('SELECT nickname FROM users WHERE email = $1', [email])).rows.map((r: any) => r.nickname);

test('register_stores_the_nickname_without_surrounding_spaces', async () => {
  const res = await register('  Padded Pilot  ', 'padded@example.invalid');
  assert.equal(res.status, 201);
  assert.equal(res.json.user.nickname, 'Padded Pilot');
  assert.deepEqual(await storedNicknames('padded@example.invalid'), ['Padded Pilot']);
  await waitForMailTo('padded@example.invalid');
});

test('register_treats_a_padded_copy_of_a_taken_nickname_as_taken', async () => {
  const first = await register('Taken Name', 'taken1@example.invalid');
  assert.equal(first.status, 201);
  await waitForMailTo('taken1@example.invalid');

  const second = await register('Taken Name ', 'taken2@example.invalid');
  assert.equal(second.status, 400);
  assert.deepEqual(await storedNicknames('taken2@example.invalid'), [], 'no second account may be created');
});

test('register_refuses_a_nickname_that_is_only_spaces', async () => {
  const res = await register('   ', 'blank@example.invalid');
  assert.equal(res.status, 400);
  assert.deepEqual(await storedNicknames('blank@example.invalid'), []);
});
