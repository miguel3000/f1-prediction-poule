import test, { before, after, afterEach } from 'node:test';
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
const pitwallRoutes = require('../../routes/pitwall').default;
const adminRoutes = require('../../routes/admin').default;
const { query } = require('../../config/database');
const { resetTestDatabase, closeTestDatabase, createTestUser } = require('../../testing/testDb');

let server: Server;
let base = '';
let admin: { id: number; nickname: string };
let alice: { id: number; nickname: string };
let outsider: { id: number; nickname: string };
const tokenFor = (u: { id: number }) => jwt.sign({ userId: u.id, email: 'x@example.invalid' }, process.env.JWT_SECRET!);

before(async () => {
  await resetTestDatabase();
  admin = await createTestUser({ nickname: 'Boss', isAdmin: true });
  alice = await createTestUser({ nickname: 'Alice' });
  outsider = await createTestUser({ nickname: 'Outsider' });
  await query('UPDATE users SET pitwall_access = TRUE WHERE id = $1', [alice.id]);

  const app = express();
  app.use(express.json());
  app.use('/api/pitwall', pitwallRoutes);
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
  const res = await fetch(`${base}/api${path}`, {
    method,
    headers: { Authorization: `Bearer ${tokenFor(who)}`, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, json: (await res.json()) as any };
};
const sendMessage = (who: { id: number }, text: string) =>
  call('POST', '/pitwall/ideas', who, { kind: 'message', title: '', description: text });
const sendIdea = (who: { id: number }, title: string) =>
  call('POST', '/pitwall/ideas', who, { kind: 'idea', title, description: '' });
// The notice to the admin goes out in the background after the answer; wait for it.
const waitForMail = async (subjectPart: string) => {
  for (let i = 0; i < 100; i++) {
    const found = sent.find((m) => String(m.subject).includes(subjectPart));
    if (found) return found;
    await new Promise((r) => setTimeout(r, 30));
  }
  throw new Error(`no mail with a subject containing "${subjectPart}"`);
};
// Notices are sent after the answer. Once a test is over, wait until no more arrive, so a late one
// can never be mistaken for a mail of the next test.
afterEach(async () => {
  for (let previous = -1; previous !== sent.length; ) {
    previous = sent.length;
    await new Promise((r) => setTimeout(r, 80));
  }
});
const clear = async () => {
  await query('DELETE FROM pitwall_ideas');
  sent.length = 0;
};

test('a_short_message_is_saved_as_its_own_title_with_no_repeated_details', async () => {
  await clear();
  const res = await sendMessage(alice, '  The leaderboard shows the wrong points for Mexico  ');
  assert.equal(res.status, 201);
  assert.equal(res.json.kind, 'message');
  assert.equal(res.json.title, 'The leaderboard shows the wrong points for Mexico');
  assert.equal(res.json.description, '');
  assert.equal(res.json.status, 'pending');
  await waitForMail('new message from Alice');
});

test('a_long_message_keeps_its_full_text_and_gets_a_short_title_from_its_first_line', async () => {
  await clear();
  const first = 'My prediction for Brazil vanished after I saved it';
  const text = `${first}\nI saved it at 15:00 and it was gone at 16:00.\nUsing the phone.`;
  const res = await sendMessage(alice, text);
  assert.equal(res.status, 201);
  assert.equal(res.json.title, first);
  assert.equal(res.json.description, text);

  const long = 'x'.repeat(150);
  const res2 = await sendMessage(alice, long);
  assert.equal(res2.status, 201);
  assert.ok(res2.json.title.length <= 80, 'the title stays short');
  assert.ok(res2.json.title.endsWith('…'), 'a cut title says it was cut');
  assert.equal(res2.json.description, long, 'nothing of the message is lost');
  await waitForMail('new message from Alice');
});

test('a_message_that_is_empty_too_short_or_too_long_is_refused', async () => {
  await clear();
  for (const text of ['', '   ', 'hi', '\n\n  \n']) {
    const res = await sendMessage(alice, text);
    assert.equal(res.status, 400, `"${text}" must be refused`);
    assert.match(res.json.error, /Message must be between 3 and 2000 characters/);
  }
  const tooLong = await sendMessage(alice, 'y'.repeat(2001));
  assert.equal(tooLong.status, 400);
  const justRight = await sendMessage(alice, 'y'.repeat(2000));
  assert.equal(justRight.status, 201);
  const rows = (await query('SELECT COUNT(*)::int AS n FROM pitwall_ideas')).rows[0].n;
  assert.equal(rows, 1, 'refused messages are not stored');
  await waitForMail('new message from Alice');
});

test('an_unknown_kind_is_still_refused_and_the_error_names_messages_too', async () => {
  await clear();
  const res = await call('POST', '/pitwall/ideas', alice, { kind: 'complaint', title: 'Hello there', description: '' });
  assert.equal(res.status, 400);
  assert.match(res.json.error, /idea, an implementation or a message/);
});

test('a_player_without_pit_wall_access_cannot_send_a_message', async () => {
  await clear();
  const res = await sendMessage(outsider, 'Something is wrong with my account');
  assert.equal(res.status, 403);
  assert.equal((await query('SELECT COUNT(*)::int AS n FROM pitwall_ideas')).rows[0].n, 0);
});

test('the_admin_is_mailed_about_a_message_with_the_text_escaped', async () => {
  await clear();
  const res = await sendMessage(alice, 'Broken <b>layout</b> on the results page\nSecond line & more');
  assert.equal(res.status, 201);
  const mail = await waitForMail('new message from Alice');
  assert.equal(mail.to, process.env.ADMIN_EMAIL);
  assert.match(String(mail.html), /sent a <strong>message<\/strong>/, 'reads "a message", not "an message"');
  assert.match(String(mail.html), /Broken &lt;b&gt;layout&lt;\/b&gt; on the results page/);
  assert.match(String(mail.html), /Second line &amp; more/);
  assert.doesNotMatch(String(mail.html), /<b>layout<\/b>/, 'player text is never raw html');
  assert.doesNotMatch(String(mail.html), /waiting for your decision/, 'a message is read, not decided');
  assert.doesNotMatch(String(mail.subject), /[\r\n]/);
});

test('ideas_still_read_an_idea_in_the_admin_mail', async () => {
  await clear();
  const res = await sendIdea(alice, 'Add a rain forecast');
  assert.equal(res.status, 201);
  const mail = await waitForMail('new idea from Alice');
  assert.match(String(mail.html), /submitted an <strong>idea<\/strong>/);
  assert.match(String(mail.html), /waiting for your decision/);
});

test('messages_and_ideas_have_separate_waiting_limits', async () => {
  await clear();
  for (let i = 0; i < 10; i++) {
    const idea = await sendIdea(alice, `Idea number ${i + 1}`);
    assert.equal(idea.status, 201);
  }
  const eleventhIdea = await sendIdea(alice, 'Idea number 11');
  assert.equal(eleventhIdea.status, 429);
  const message = await sendMessage(alice, 'Ten ideas waiting must not block a report');
  assert.equal(message.status, 201, 'a full idea list does not block a message');

  await clear();
  for (let i = 0; i < 10; i++) {
    const m = await sendMessage(alice, `Message number ${i + 1}`);
    assert.equal(m.status, 201);
  }
  const eleventhMessage = await sendMessage(alice, 'Message number 11');
  assert.equal(eleventhMessage.status, 429);
  const idea = await sendIdea(alice, 'Ten messages waiting must not block an idea');
  assert.equal(idea.status, 201, 'a full message list does not block an idea');
  await waitForMail('new idea from Alice');
});

test('the_admin_can_mark_a_message_handled_with_a_note_the_player_sees_and_no_mail_goes_out', async () => {
  await clear();
  const created = await sendMessage(alice, 'My avatar will not upload');
  await waitForMail('new message from Alice');
  sent.length = 0;

  const listed = await call('GET', '/admin/pitwall-ideas', admin);
  assert.equal(listed.status, 200);
  assert.equal(listed.json[0].kind, 'message');
  assert.equal(listed.json[0].nickname, 'Alice');

  const handled = await call('PUT', `/admin/pitwall-ideas/${created.json.id}`, admin, {
    status: 'handled',
    adminNote: 'Fixed, try again now',
  });
  assert.equal(handled.status, 200);
  assert.equal(handled.json.status, 'handled');

  const mine = await call('GET', '/pitwall/ideas', alice);
  assert.equal(mine.json[0].status, 'handled');
  assert.equal(mine.json[0].admin_note, 'Fixed, try again now');

  await new Promise((r) => setTimeout(r, 150));
  assert.deepEqual(sent, [], 'marking a message handled mails nobody');

  const again = await call('PUT', `/admin/pitwall-ideas/${created.json.id}`, admin, { status: 'handled' });
  assert.equal(again.status, 409, 'handled only once');
});

test('a_message_cannot_be_approved_or_declined_and_an_idea_cannot_be_marked_handled', async () => {
  await clear();
  const message = await sendMessage(alice, 'Is the points table right?');
  const idea = await sendIdea(alice, 'Dark mode please');
  await waitForMail('new idea from Alice');

  for (const status of ['approved', 'declined']) {
    const res = await call('PUT', `/admin/pitwall-ideas/${message.json.id}`, admin, { status });
    assert.equal(res.status, 400, `a message cannot be ${status}`);
  }
  const wrong = await call('PUT', `/admin/pitwall-ideas/${idea.json.id}`, admin, { status: 'handled' });
  assert.equal(wrong.status, 400, 'an idea cannot be handled');

  const rows = (await query('SELECT id, status FROM pitwall_ideas ORDER BY id')).rows;
  assert.deepEqual(
    rows.map((r: any) => r.status),
    ['pending', 'pending'],
    'nothing changed after the refused decisions'
  );

  const unknown = await call('PUT', '/admin/pitwall-ideas/999999', admin, { status: 'handled' });
  assert.equal(unknown.status, 409, 'a missing id answers as before: already reviewed or gone');
  const bogus = await call('PUT', `/admin/pitwall-ideas/${idea.json.id}`, admin, { status: 'approved' });
  assert.equal(bogus.status, 200, 'ideas are still approved as before');
  await waitForMail('approved idea from Alice');
});

test('a_player_can_take_back_a_waiting_message_but_not_a_handled_one', async () => {
  await clear();
  const waiting = await sendMessage(alice, 'Oops, wrong poule, ignore this');
  const removed = await call('DELETE', `/pitwall/ideas/${waiting.json.id}`, alice);
  assert.equal(removed.status, 200);

  const kept = await sendMessage(alice, 'Please look at my points');
  await call('PUT', `/admin/pitwall-ideas/${kept.json.id}`, admin, { status: 'handled' });
  const refused = await call('DELETE', `/pitwall/ideas/${kept.json.id}`, alice);
  assert.equal(refused.status, 404);
  await waitForMail('new message from Alice');
});
