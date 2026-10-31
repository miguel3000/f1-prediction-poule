import test, { before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import nodemailer from 'nodemailer';

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
const { query } = require('../../config/database');
const { resetTestDatabase, closeTestDatabase, createTestUser } = require('../../testing/testDb');
const { emailPendingFlags, recordCheck, recordFeedFlag } = require('../fiaDocumentsService');

const NOW = new Date('2026-10-31T19:00:00Z'); // inside the window of the race below

before(async () => {
  process.env.ADMIN_EMAIL = 'owner@example.invalid';
  process.env.FRONTEND_URL = 'https://pouleposition.example.invalid';
  await resetTestDatabase();
  await query(
    `INSERT INTO races (season, round, race_name, circuit_name, country, race_date, race_type, status)
     VALUES (2026, 19, 'Mexico City Grand Prix', 'Test', 'Mexico', '2026-11-01T20:00:00Z', 'main', 'upcoming')`
  );
});
after(closeTestDatabase);
beforeEach(async () => {
  sent.length = 0;
  failSends = false;
  await query('DELETE FROM fia_documents');
  await query('DELETE FROM fia_checks');
});

const addFlag = async (n: number, summary: string, facts: object = {}, kind = 'infringement', published = '2026-10-31T18:09:00Z') =>
  (
    await query(
      `INSERT INTO fia_documents (url, source, event, doc_number, title, published_at, status, kind, severity, summary, facts)
       VALUES ($1, 'fia', 'Mexico City Grand Prix', $2, $3, $4, 'read', $5, 'flag', $6, $7) RETURNING id`,
      [`https://www.fia.com/system/files/decision-document/doc_${n}.pdf`, n, `Doc ${n}`, published, kind, summary, JSON.stringify(facts)]
    )
  ).rows[0].id as number;

test('one_email_lists_every_new_flag_with_places_link_and_dutch_time', async () => {
  await addFlag(17, '#77 Valtteri Bottas: 50-place grid drop', { gridDrop: 50 });
  await addFlag(36, 'Driver change: Ryo Hirakawa (#50) replaces Esteban Ocon (#31)', {}, 'driver_change', '2026-10-31T13:35:00Z');

  const result = await emailPendingFlags(NOW);

  assert.equal(result.sent, 2);
  assert.equal(sent.length, 1, 'one email per run');
  const mail = sent[0];
  assert.equal(mail.to, 'owner@example.invalid');
  assert.match(mail.subject, /^Flags: Mexico City Grand Prix - 2 items/);
  assert.match(mail.html, /50-place grid drop/);
  assert.match(mail.html, /Ryo Hirakawa/);
  assert.match(mail.html, /https:\/\/www\.fia\.com\/system\/files\/decision-document\/doc_17\.pdf/);
  assert.match(mail.html, /19:09/, '18:09 UTC is 19:09 in Amsterdam on 31 Oct 2026');
  assert.match(mail.html, /14:35/);
  assert.equal((await query('SELECT 1 FROM fia_documents WHERE flag_emailed_at IS NULL')).rows.length, 0);
});

test('a_single_flag_puts_its_summary_in_the_subject', async () => {
  await addFlag(17, '#77 Valtteri Bottas: 50-place grid drop');
  await emailPendingFlags(NOW);
  assert.equal(sent[0].subject, 'Flag: #77 Valtteri Bottas: 50-place grid drop');
});

test('names_and_titles_are_escaped_and_the_subject_has_no_line_breaks', async () => {
  await addFlag(18, '#1 <script>alert(1)</script>\nSecond line');
  await emailPendingFlags(NOW);
  assert.ok(!sent[0].html.includes('<script>alert(1)'));
  assert.match(sent[0].html, /&lt;script&gt;/);
  assert.ok(!/[\r\n]/.test(sent[0].subject));
});

test('a_driver_change_flag_shows_the_suggested_action', async () => {
  await addFlag(
    36,
    'Driver change: Ryo Hirakawa (#50) replaces Esteban Ocon (#31)',
    { originalName: 'Esteban Ocon', replacementName: 'Ryo Hirakawa', replacementNumber: 50, standInInTable: false, originalInTable: true },
    'driver_change'
  );
  await emailPendingFlags(NOW);
  assert.match(sent[0].html, /Drivers not racing/);
  assert.match(sent[0].html, /not in our driver table/i);
  assert.match(sent[0].html, /Esteban Ocon/);
});

test('a_feed_flag_has_no_document_link', async () => {
  await recordFeedFlag('Qualifying:Mexico:50', 'Live feed: driver list differs from ours', '#50 Ryo Hirakawa is in the live feed but not in our drivers table', { unknown: [50] });
  await emailPendingFlags(NOW);
  assert.equal(sent.length, 1);
  assert.match(sent[0].html, /#50 Ryo Hirakawa is in the live feed/);
  assert.ok(!sent[0].html.includes('feed:Qualifying'));
});

test('a_failed_send_leaves_the_flags_unsent_and_the_next_run_sends_them', async () => {
  await addFlag(17, '#77 Valtteri Bottas: 50-place grid drop');
  failSends = true;
  assert.equal((await emailPendingFlags(NOW)).sent, 0);
  assert.equal((await query('SELECT 1 FROM fia_documents WHERE flag_emailed_at IS NULL')).rows.length, 1);
  failSends = false;
  assert.equal((await emailPendingFlags(NOW)).sent, 1);
  assert.equal(sent.length, 1);
  assert.equal((await emailPendingFlags(NOW)).sent, 0, 'sent once only');
  assert.equal(sent.length, 1);
});

test('nothing_is_sent_when_there_is_nothing_new', async () => {
  assert.equal((await emailPendingFlags(NOW)).sent, 0);
  assert.equal(sent.length, 0);
});

test('three_failed_checks_send_one_watcher_notice_and_a_failed_notice_is_retried', async () => {
  for (let i = 0; i < 3; i++) await recordCheck({ ok: false, found: 0, added: 0, error: 'page changed' });
  failSends = true;
  await emailPendingFlags(NOW);
  failSends = false;
  assert.equal(sent.length, 0);
  await emailPendingFlags(NOW);
  assert.equal(sent.length, 1);
  assert.match(sent[0].subject, /watcher is failing/i);
  assert.match(sent[0].html, /page changed/);
  await emailPendingFlags(NOW);
  assert.equal(sent.length, 1, 'one notice per streak');
});

test('the_recipient_is_ADMIN_EMAIL_and_no_player_address_appears', async () => {
  const player = await createTestUser({ nickname: 'Playerone', email: 'player.one@example.invalid' });
  await addFlag(17, '#77 Valtteri Bottas: 50-place grid drop');
  await emailPendingFlags(NOW);
  assert.equal(sent[0].to, 'owner@example.invalid');
  assert.ok(!JSON.stringify(sent[0]).includes('player.one@example.invalid'));
  assert.ok(player.id > 0);
});

test('without_an_admin_address_nothing_is_marked_sent', async () => {
  await addFlag(17, '#77 Valtteri Bottas: 50-place grid drop');
  const saved = process.env.ADMIN_EMAIL;
  delete process.env.ADMIN_EMAIL;
  try {
    assert.equal((await emailPendingFlags(NOW)).sent, 0);
  } finally {
    process.env.ADMIN_EMAIL = saved;
  }
  assert.equal((await query('SELECT 1 FROM fia_documents WHERE flag_emailed_at IS NULL')).rows.length, 1);
});
