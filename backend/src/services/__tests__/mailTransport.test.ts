import test from 'node:test';
import assert from 'node:assert/strict';
import { createMailTransporter, unsubscribeOptions } from '../mailTransport';
import { htmlToText } from '../htmlToText';
import { transporter, sendBroadcastEmail, sendNewsletterEmail, sendRacePreviewEmail, sendPredictionConfirmation, sendProvisionalResults, renderRacePreview } from '../emailService';
import { newsletters } from '../../newsletters';
import { weekendSessions } from '../weekendSchedule';
import type { JolpiRace } from '../jolpiService';

// A real-length unsubscribe link: the signed token is long, so the header gets folded over several lines.
const TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEyLCJwdXJwb3NlIjoidW5zdWJzY3JpYmUiLCJpYXQiOjE3OTU2NTI4MDB9.k3j2h1g0f9e8d7c6b5a4Z3Y2X1W0V9U8T7S6R5Q4P3O';
const UNSUB = `https://pouleposition.nl/api/auth/unsubscribe?token=${TOKEN}`;

const raw = async (extra: object = {}) => {
  const t = createMailTransporter({ streamTransport: true, buffer: true });
  const info = await t.sendMail({
    from: 'Kimi <kimi@example.test>', to: 'player@example.test', subject: 'Test',
    html: '<p>Hello <strong>Kimi</strong>!</p><p><a href="https://example.test/predictions">Make your prediction</a></p>',
    ...extra,
  });
  return (info as unknown as { message: Buffer }).message.toString().replace(/\r?\n(?=[ \t])/g, ''); // unfold long headers (RFC 5322: drop the line break, keep the space)
};

test('every_mail_gets_a_plain_text_part_next_to_the_html', async () => {
  const mime = await raw();
  assert.match(mime, /Content-Type: multipart\/alternative/);
  assert.match(mime, /Content-Type: text\/plain/);
  assert.match(mime, /Content-Type: text\/html/);
  assert.match(mime, /Hello Kimi!/);
  assert.match(mime, /Make your prediction \(https:\/\/example\.test\/predictions\)/);
});

test('a_text_part_written_by_hand_is_kept', async () => {
  const mime = await raw({ text: 'Handwritten text part' });
  assert.match(mime, /Handwritten text part/);
  assert.doesNotMatch(mime, /Make your prediction \(/);
});

test('a_mail_without_html_is_left_alone', async () => {
  const t = createMailTransporter({ streamTransport: true, buffer: true });
  const info = await t.sendMail({ from: 'a@example.test', to: 'b@example.test', subject: 's', text: 'only text' });
  const mime = (info as unknown as { message: Buffer }).message.toString();
  assert.match(mime, /only text/);
  assert.doesNotMatch(mime, /multipart\/alternative/);
});

test('unsubscribe_options_give_the_one_click_headers_and_nothing_without_a_link', async () => {
  const mime = await raw(unsubscribeOptions(UNSUB));
  assert.ok(mime.includes(`List-Unsubscribe: <${UNSUB}>`), 'List-Unsubscribe header');
  assert.match(mime, /List-Unsubscribe-Post: List-Unsubscribe=One-Click/);
  assert.deepEqual(unsubscribeOptions(undefined), {});
  assert.doesNotMatch(await raw(unsubscribeOptions(undefined)), /List-Unsubscribe/);
});

// ---- every kind of mail goes through the same transport ----
const capture = async (send: () => Promise<unknown>) => {
  const sent: Array<Record<string, any>> = [];
  const original = transporter.sendMail.bind(transporter);
  (transporter as any).sendMail = async (mail: Record<string, any>) => { sent.push(mail); return {}; };
  try { await send(); } finally { (transporter as any).sendMail = original; }
  assert.equal(sent.length, 1, 'exactly one mail');
  return sent[0];
};
const vegas: JolpiRace = {
  season: '2026', round: '21', raceName: 'Las Vegas Grand Prix',
  Circuit: { circuitId: 'vegas', circuitName: 'Las Vegas Strip Street Circuit', Location: { locality: 'Las Vegas', country: 'USA' } },
  date: '2026-11-22', time: '04:00:00Z',
  FirstPractice: { date: '2026-11-20', time: '00:30:00Z' }, SecondPractice: { date: '2026-11-20', time: '04:00:00Z' },
  ThirdPractice: { date: '2026-11-21', time: '00:30:00Z' }, Qualifying: { date: '2026-11-21', time: '04:00:00Z' },
};
const preview = {
  raceName: vegas.raceName, circuitId: 'vegas', circuitName: vegas.Circuit.circuitName, locality: 'Las Vegas', country: 'USA',
  sessions: weekendSessions(vegas).map((s) => ({ key: s.key, startsAt: new Date(s.startsAt) })),
  predictions: [{ kind: 'race' as const, saved: false }], lockMinutes: 1,
};

test('the_race_weekend_preview_carries_the_one_click_unsubscribe_headers', async () => {
  const mail = await capture(() => sendRacePreviewEmail('player@example.test', 'Kimi', 'en', preview, UNSUB));
  assert.equal(mail.list?.unsubscribe, UNSUB);
  assert.equal(mail.headers?.['List-Unsubscribe-Post'], 'List-Unsubscribe=One-Click');
});

test('the_broadcast_carries_the_one_click_unsubscribe_headers', async () => {
  const mail = await capture(() => sendBroadcastEmail('player@example.test', 'Kimi', 'Subject', 'Message', UNSUB, 'en'));
  assert.equal(mail.list?.unsubscribe, UNSUB);
  assert.equal(mail.headers?.['List-Unsubscribe-Post'], 'List-Unsubscribe=One-Click');
});

test('the_newsletter_carries_the_one_click_unsubscribe_headers', async () => {
  const [name] = Object.keys(newsletters);
  const mail = await capture(() => sendNewsletterEmail('player@example.test', 'Kimi', 'nl', newsletters[name], UNSUB));
  assert.equal(mail.list?.unsubscribe, UNSUB);
  assert.equal(mail.headers?.['List-Unsubscribe-Post'], 'List-Unsubscribe=One-Click');
});

test('a_mail_you_cannot_opt_out_of_has_no_unsubscribe_header', async () => {
  const mail = await capture(() => sendPredictionConfirmation('player@example.test', 'Kimi', 'Las Vegas Grand Prix', [{ driverName: 'Max VERSTAPPEN' }], 'Lance STROLL', 'en'));
  assert.equal(mail.list, undefined);
  assert.equal(mail.headers, undefined);
});

test('the_preview_mail_as_a_whole_turns_into_readable_plain_text', () => {
  const plain = htmlToText(renderRacePreview(preview, 'Kimi', 'en', UNSUB).html);
  for (const piece of ['Race weekend', 'Lights out', '05:00', 'Hello Kimi!', 'Make your prediction (', 'Also this weekend', 'Qualifying', 'Unsubscribe']) {
    assert.ok(plain.includes(piece), `plain text lacks "${piece}"`);
  }
  assert.ok(plain.includes(UNSUB), 'the unsubscribe link keeps its address');
  assert.doesNotMatch(plain, /<[a-z/]/i, 'no tags left');
  assert.doesNotMatch(plain, /\n{3,}/, 'no runs of blank lines');
  assert.doesNotMatch(plain, /\u00a0|&nbsp;|&amp;/, 'no leftover entities or non-breaking spaces');
});

test('the_plain_text_of_a_result_mail_does_not_give_the_spoiler_away', async () => {
  const mail = await capture(() =>
    sendProvisionalResults(
      'player@example.test', 'Kimi', 'Las Vegas Grand Prix',
      [{ position: 1, driverName: 'Zzyzx WINNER', points: 25 }, { position: 2, driverName: 'Qqq RUNNERUP', points: 18 }],
      [{ predictedPosition: 1, driverName: 'Zzyzx WINNER', actualPosition: 1, pointsEarned: 25, hasBonus: false }],
      4242, 'en'
    )
  );
  // the app shows the real results only on request; the text part must behave like the app that hides them
  assert.ok(mail.html.includes('Zzyzx WINNER'), 'the HTML does carry the results, hidden');
  const plain = htmlToText(mail.html);
  assert.ok(!plain.includes('Zzyzx'), 'a winner leaked into the plain text');
  assert.ok(!plain.includes('Qqq'), 'a driver leaked into the plain text');
  assert.ok(!plain.includes('4242'), 'the score leaked into the plain text');
  assert.ok(plain.includes('/predictions'), 'the plain text still points to the site');
});
