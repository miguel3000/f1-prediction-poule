import test from 'node:test';
import assert from 'node:assert/strict';
import { renderRacePreview, RacePreviewData } from '../emailService';
import { weekendSessions } from '../weekendSchedule';
import type { JolpiRace } from '../jolpiService';

// The Las Vegas weekend as the official calendar has it (UTC), and a sprint weekend.
const vegas: JolpiRace = {
  season: '2026', round: '21', raceName: 'Las Vegas Grand Prix',
  Circuit: { circuitId: 'vegas', circuitName: 'Las Vegas Strip Street Circuit', Location: { locality: 'Las Vegas', country: 'USA' } },
  date: '2026-11-22', time: '04:00:00Z',
  FirstPractice: { date: '2026-11-20', time: '00:30:00Z' },
  SecondPractice: { date: '2026-11-20', time: '04:00:00Z' },
  ThirdPractice: { date: '2026-11-21', time: '00:30:00Z' },
  Qualifying: { date: '2026-11-21', time: '04:00:00Z' },
};
const china: JolpiRace = {
  season: '2026', round: '2', raceName: 'Chinese Grand Prix',
  Circuit: { circuitId: 'shanghai', circuitName: 'Shanghai International Circuit', Location: { locality: 'Shanghai', country: 'China' } },
  date: '2026-03-15', time: '07:00:00Z',
  FirstPractice: { date: '2026-03-13', time: '03:30:00Z' },
  SprintQualifying: { date: '2026-03-13', time: '07:30:00Z' },
  Sprint: { date: '2026-03-14', time: '03:00:00Z' },
  Qualifying: { date: '2026-03-14', time: '07:00:00Z' },
};

const data = (jr: JolpiRace, predictions: RacePreviewData['predictions'] = [{ kind: 'race', saved: false }]): RacePreviewData => ({
  raceName: jr.raceName, circuitId: jr.Circuit.circuitId, circuitName: jr.Circuit.circuitName,
  locality: jr.Circuit.Location.locality, country: jr.Circuit.Location.country,
  sessions: weekendSessions(jr).map((s) => ({ key: s.key, startsAt: new Date(s.startsAt) })),
  predictions, lockMinutes: 1,
});

const text = (html: string) => html.replace(/<style[\s\S]*?<\/style>/g, '').replace(/<[^>]+>/g, '\n').replace(/&nbsp;/g, ' ').replace(/\s*\n\s*/g, '\n');

test('english_mail_has_the_schedule_in_dutch_time_grouped_by_day', () => {
  const mail = renderRacePreview(data(vegas), 'Kimi', 'en', 'https://example.test/unsub');
  assert.equal(mail.subject, 'Race weekend: Las Vegas Grand Prix (lights out Sun 05:00)');
  const t = text(mail.html);
  assert.match(t, /Hello Kimi!/);
  assert.match(t, /Lights out is\nSunday 22 November 05:00\n\. Here is your weekend\. All times are Dutch time\./);
  // each day with its own sessions, in order
  const order = ['Fri', '20 November', 'Practice 1', '01:30', 'Practice 2', '05:00', 'Sat', '21 November', 'Practice 3', '01:30', 'Qualifying', '05:00', 'Sun', '22 November', 'Race', '05:00'];
  let at = t.indexOf('Practice 1') - 20;
  for (const piece of order) {
    const found = t.indexOf(piece, at);
    assert.ok(found >= 0, `"${piece}" is missing or out of order`);
    at = found + piece.length;
  }
});

test('the_localised_times_note_sits_right_under_the_dutch_time_remark_in_both_languages', () => {
  const en = renderRacePreview(data(vegas), 'Kimi', 'en').html;
  const nl = renderRacePreview(data(vegas), 'Kimi', 'nl').html;
  const noteEn = 'Would you like the start times in your own time zone? Reply to this email, or send me a message in the Pit Wall if you have access to it.';
  const noteNl = 'Wil je de starttijden in jouw eigen tijdzone? Stuur me een reactie op deze mail, of een bericht via de Pit Wall als je daar toegang toe hebt.';
  assert.ok(en.includes(noteEn));
  assert.ok(nl.includes(noteNl));
  // directly after the sentence that says the times are Dutch time, before anything else
  assert.ok(en.indexOf('All times are Dutch time.') < en.indexOf(noteEn));
  assert.ok(en.indexOf(noteEn) < en.indexOf('Race prediction'));
  assert.ok(nl.indexOf('Alle tijden zijn Nederlandse tijd.') < nl.indexOf(noteNl));
});

test('dutch_mail_uses_the_sites_own_session_names_and_decimal_comma', () => {
  const mail = renderRacePreview(data(vegas), 'Kimi', 'nl');
  assert.equal(mail.subject, 'Race-weekend: Las Vegas Grand Prix (lichten uit zo 05:00)');
  const t = text(mail.html);
  for (const word of ['Hallo Kimi!', 'Training 1', 'Training 3', 'Kwalificatie', '6,201 km', '3,853 mi', '310,0 km', '192,6 mi', 'Ronden', 'Racedistantie', 'Doe je voorspelling', 'Voorspellingen sluiten 1 min voor de start.']) {
    assert.ok(t.toLowerCase().includes(word.toLowerCase()), `Dutch mail lacks "${word}"`);
  }
  for (const day of ['vr', 'za', 'zo']) assert.ok(t.includes(`\n${day}\n`), `Dutch day "${day}" missing`);
  assert.ok(!t.includes('Practice'));
});

test('circuit_block_shows_the_layout_with_lap_length_in_km_and_miles_laps_and_distance', () => {
  const mail = renderRacePreview(data(vegas), 'Kimi', 'en');
  const t = text(mail.html);
  assert.ok(t.includes('Las Vegas Strip Street Circuit, Las Vegas, USA'));
  for (const piece of ['6.201 km', '3.853 mi', '50', '310.0 km', '192.6 mi']) assert.ok(t.includes(piece), piece);
  assert.ok(mail.html.includes(`${process.env.FRONTEND_URL}/circuits/vegas.png?v=1`));
  assert.ok(mail.html.includes('alt="Layout of Las Vegas Strip Street Circuit"'));
});

test('an_unknown_circuit_still_gets_a_mail_without_a_broken_image_or_invented_numbers', () => {
  const unknown = { ...data(vegas), circuitId: 'new_street_circuit', circuitName: 'Brand New Street Circuit' };
  const mail = renderRacePreview(unknown, 'Kimi', 'en');
  assert.ok(!mail.html.includes('/circuits/'));
  assert.ok(!mail.html.includes(' km'));
  assert.ok(text(mail.html).includes('Brand New Street Circuit, Las Vegas, USA'));
  assert.ok(text(mail.html).includes('Practice 1')); // the schedule is still there
});

test('a_sprint_weekend_lists_sprint_qualifying_and_the_sprint_and_both_prediction_chips', () => {
  const mail = renderRacePreview(data(china, [{ kind: 'sprint', saved: true }, { kind: 'race', saved: false }]), 'Kimi', 'en');
  const t = text(mail.html);
  const order = ['Practice 1', 'Sprint Qualifying', 'Sprint', 'Qualifying', 'Race'];
  let at = t.indexOf('Practice 1');
  for (const piece of order) {
    const found = t.indexOf(piece, at);
    assert.ok(found >= 0, `${piece} missing or out of order`);
    at = found + piece.length;
  }
  assert.ok(t.indexOf('Sprint prediction: saved') < t.indexOf('Race prediction: not saved yet'));
  const nl = text(renderRacePreview(data(china, [{ kind: 'sprint', saved: true }, { kind: 'race', saved: false }]), 'Kimi', 'nl').html);
  assert.ok(nl.includes('Sprintkwalificatie') && nl.includes('Sprintvoorspelling: opgeslagen') && nl.includes('Racevoorspelling: nog niet opgeslagen'));
});

test('a_saved_prediction_is_shown_as_done_and_a_missing_one_as_waiting', () => {
  const saved = renderRacePreview(data(vegas, [{ kind: 'race', saved: true }]), 'Kimi', 'en').html;
  const todo = renderRacePreview(data(vegas, [{ kind: 'race', saved: false }]), 'Kimi', 'en').html;
  assert.ok(text(saved).includes('Race prediction: saved') && !text(saved).includes('not saved yet'));
  assert.ok(text(todo).includes('Race prediction: not saved yet'));
});

test('the_mail_closes_with_the_real_lock_time_the_site_button_and_the_unsubscribe_link', () => {
  const mail = renderRacePreview({ ...data(vegas), lockMinutes: 5 }, 'Kimi', 'en', 'https://example.test/unsub?token=abc');
  assert.ok(text(mail.html).includes('Predictions close 5 min before the start.'));
  assert.ok(mail.html.includes(`href="${process.env.FRONTEND_URL}"`));
  assert.ok(mail.html.includes('https://example.test/unsub?token=abc'));
  assert.ok(text(mail.html).includes('Kimi.')); // the signature
  assert.ok(!renderRacePreview(data(vegas), 'Kimi', 'en').html.includes('Unsubscribe')); // none without a link
});

test('a_nickname_cannot_inject_markup_and_nothing_uses_an_em_dash', () => {
  const nasty = renderRacePreview(data(vegas), '<img src=x onerror=alert(1)>', 'en');
  assert.ok(!nasty.html.includes('<img src=x'));
  assert.ok(nasty.html.includes('&lt;img src=x onerror=alert(1)&gt;'));
  for (const lang of ['en', 'nl']) {
    const mail = renderRacePreview(data(china, [{ kind: 'sprint', saved: false }, { kind: 'race', saved: false }]), 'Kimi', lang);
    assert.ok(!mail.html.includes('—') && !mail.subject.includes('—'), `${lang} has an em dash`);
  }
});

test('the_subject_is_one_line', () => {
  const mail = renderRacePreview({ ...data(vegas), raceName: 'Las Vegas\r\nBcc: evil@example.invalid Grand Prix' }, 'Kimi', 'en');
  assert.ok(!/[\r\n]/.test(mail.subject));
});

test('a_language_nobody_chose_is_english', () => {
  assert.equal(renderRacePreview(data(vegas), 'Kimi', null).subject, renderRacePreview(data(vegas), 'Kimi', 'en').subject);
});
