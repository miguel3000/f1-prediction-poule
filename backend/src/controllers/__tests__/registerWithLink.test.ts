import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
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
const authRoutes = require('../../routes/auth').default;
const { query } = require('../../config/database');
const { resetTestDatabase, closeTestDatabase, createTestUser } = require('../../testing/testDb');
const { createGroup } = require('../../services/groupService');
const { retryFailedEmails } = require('../../services/emailLog');

let server: Server;
let base = '';
let owner: { id: number; nickname: string };

before(async () => {
  await resetTestDatabase();
  owner = await createTestUser({ canStartGroups: true });
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

let n = 0;
const group = (name?: string) => createGroup({ id: owner.id, isAdmin: false }, name ?? `Link Group ${++n} ${Math.random().toString(36).slice(2, 6)}`);
const register = async (body: Record<string, unknown>) => {
  const nickname = `friend${++n}${Math.random().toString(36).slice(2, 5)}`;
  const res = await fetch(`${base}/api/auth/register-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nickname, email: `${nickname}@example.invalid`, password: 'secret1', ...body }),
  });
  return { nickname, status: res.status, json: (await res.json()) as any };
};
const waitFor = async (check: () => boolean | Promise<boolean>) => {
  for (let i = 0; i < 100; i++) {
    if (await check()) return;
    await new Promise((r) => setTimeout(r, 30));
  }
  throw new Error('timed out waiting');
};
const welcomeTo = (nickname: string) => sent.find((m) => JSON.stringify(m.to).includes(nickname) && /welcome|Welkom/i.test(String(m.subject)));

test('register_with_a_valid_code_creates_user_membership_and_returns_joinedGroup', async () => {
  const g = await group();
  const res = await register({ joinCode: g.inviteCode, playsInMain: true, language: 'en' });
  assert.equal(res.status, 201);
  assert.deepEqual(res.json.joinedGroup, { id: g.id, name: g.name });
  const user = (await query('SELECT id, plays_in_main FROM users WHERE nickname = $1', [res.nickname])).rows[0];
  assert.equal(user.plays_in_main, true);
  assert.equal((await query('SELECT 1 FROM group_members WHERE group_id = $1 AND user_id = $2', [g.id, user.id])).rows.length, 1);
});

test('register_with_an_invalid_code_is_400_and_creates_no_user', async () => {
  for (const bad of ['z'.repeat(32), 'short']) {
    const res = await register({ joinCode: bad });
    assert.equal(res.status, 400);
    assert.equal(res.json.error, 'Invite link is not valid');
    assert.equal((await query('SELECT 1 FROM users WHERE nickname = $1', [res.nickname])).rows.length, 0);
  }
});

test('plays_in_main_false_is_stored', async () => {
  const g = await group();
  const res = await register({ joinCode: g.inviteCode, playsInMain: false });
  assert.equal(res.status, 201);
  assert.equal((await query('SELECT plays_in_main FROM users WHERE nickname = $1', [res.nickname])).rows[0].plays_in_main, false);
});

test('welcome_mail_names_the_group_and_escapes_it', async () => {
  const g = await group('<b>x</b> Crew');
  const res = await register({ joinCode: g.inviteCode, language: 'nl' });
  await waitFor(() => !!welcomeTo(res.nickname));
  const html = welcomeTo(res.nickname).html as string;
  assert.ok(html.includes('Je bent lid geworden van de groep &lt;b&gt;x&lt;/b&gt; Crew'));
  assert.ok(!html.includes('<b>x</b> Crew'));
});

test('welcome_mail_without_a_group_is_unchanged', async () => {
  const res = await register({ language: 'en' });
  await waitFor(() => !!welcomeTo(res.nickname));
  assert.ok(!(welcomeTo(res.nickname).html as string).includes('You joined the group'));
});

test('failed_welcome_retry_still_names_the_group', async () => {
  const g = await group('Retry Crew');
  failSends = true;
  const res = await register({ joinCode: g.inviteCode, language: 'en' });
  await waitFor(async () => (await query("SELECT 1 FROM email_log WHERE kind = 'welcome' AND status = 'failed' AND payload->>'nickname' = $1", [res.nickname])).rows.length > 0);
  const row = (await query("SELECT payload FROM email_log WHERE kind = 'welcome' AND payload->>'nickname' = $1", [res.nickname])).rows[0];
  assert.equal(row.payload.groupName, 'Retry Crew');

  failSends = false;
  await query("UPDATE email_log SET updated_at = NOW() - INTERVAL '2 hours' WHERE payload->>'nickname' = $1", [res.nickname]);
  await retryFailedEmails();
  assert.ok((welcomeTo(res.nickname).html as string).includes('You joined the group Retry Crew'));
});
