import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { parseListing, classifyTitle, parseDocumentText } from '../fiaDocumentsParser';

// Real text from the 2026 Mexico City Grand Prix weekend (the compiled tests live in dist/, the fixtures in src/).
const FIXTURES = path.resolve(__dirname, '../../../src/services/__tests__/fixtures/fia');
const fixture = (name: string) => fs.readFileSync(path.join(FIXTURES, name), 'utf8');

test('listing_gives_the_event_and_every_document_with_its_utc_time', () => {
  const listing = parseListing(fixture('listing.html'));
  assert.ok(listing);
  assert.equal(listing!.event, 'Mexico City Grand Prix');
  assert.equal(listing!.documents.length, 40); // 41 rows; the recalled Doc 13 has no PDF link, so it is left out

  const doc42 = listing!.documents.find((d) => d.docNumber === 42)!;
  assert.equal(doc42.title, 'Infringment - Car 77 - Pit Lane Speeding');
  assert.equal(doc42.publishedAt.toISOString(), '2026-10-31T18:09:00.000Z'); // 19:09 in Amsterdam time (CET)
  assert.equal(
    doc42.url,
    'https://www.fia.com/system/files/decision-document/2026_mexico_city_grand_prix_-_infringment_-_car_77_-_pit_lane_speeding.pdf'
  );
  assert.ok(!doc42.title.includes('Doc 42'));

  assert.equal(listing!.documents.find((d) => d.docNumber === 13), undefined, 'a recalled document has no link to read');
});

test('summer_times_use_the_summer_offset', () => {
  const html = `<div class="decision-document-list"><ul class="event-wrapper"><li>
    <div class="event-title active">Test Grand Prix</div>
    <ul><li><ul><li class="document-row key-1"><a href="/system/files/decision-document/a.pdf"><div class="title">Doc 1 - Competition Visa</div>
    <div class="published">Published on <span class="date-display-single">15.07.26 10:00</span> CET</div></a></li></ul></li></ul></li></ul></div>`;
  const listing = parseListing(html)!;
  assert.equal(listing.documents[0].publishedAt.toISOString(), '2026-07-15T08:00:00.000Z'); // CEST is UTC+2
});

test('a_page_without_an_expanded_event_block_is_null', () => {
  assert.equal(parseListing('<html><body><div class="event-title data-id-1 use-ajax">Old GP</div></body></html>'), null);
  assert.equal(parseListing(''), null);
});

test('titles_decide_what_is_read', () => {
  const read: Array<[string, string]> = [
    ['Decision - Driver Change TGR Haas F1 Team', 'driver_change'],
    ['Revised Entry List', 'entry_list'],
    ['Infringement - Car 77 - PU elements', 'infringement'],
    ['Infringment - Car 14 - Pit Lane Speeding', 'infringement'],
    ['Summons - Car 6 - Alleged misconduct', 'summons'],
    ['New PU Elements for this Competition', 'pu_report'],
  ];
  for (const [title, kind] of read) {
    assert.deepEqual(classifyTitle(title), { read: true, kind }, title);
  }
  const skipped = [
    'Free Practice 2 Classification',
    'Timetable V2',
    'Curfew',
    'Competition Visa',
    'Entry List',
    'Infringement - Free Practice 1 Deleted Lap Times',
    'Infringement - Free Practice 1 Deleted Lap Times - Double Yellow',
    'FP1 and FP2 Scrutineering',
    'Self Scrutineering after Survival Cell Change',
    'Race Director Notes - SC2 - SC1 Times',
    'Recalled - New PU Elements for this Competition',
  ];
  for (const title of skipped) {
    assert.equal(classifyTitle(title).read, false, title);
  }
});

test('unfamiliar_titles_that_sound_like_a_penalty_are_read_instead_of_skipped', () => {
  for (const title of [
    'Penalty - Car 12 - Unsafe release',
    'Offence - Car 4 - Track limits',
    'Disqualification - Car 5 - Qualifying',
    'Withdrawal of Car 22',
    'Exclusion - Car 9 - Qualifying',
    'Pit lane start - Car 77',
    'Grid penalty for Car 11',
  ]) {
    assert.deepEqual(classifyTitle(title), { read: true, kind: 'decision' }, title);
  }
  // Routine papers stay unread.
  for (const title of ['Post-Qualifying Procedure', 'Race Director Notes - SC2 - SC1 Times', 'Entry List', 'Car Display Procedure']) {
    assert.equal(classifyTitle(title).read, false, title);
  }
});

test('driver_change_names_both_drivers_and_is_a_flag', () => {
  const r = parseDocumentText('driver_change', fixture('driver_change.txt'));
  assert.equal(r.severity, 'flag');
  assert.equal(r.understood, true);
  assert.deepEqual(r.facts, {
    originalNumber: 31,
    originalName: 'Esteban Ocon',
    replacementNumber: 50,
    replacementName: 'Ryo Hirakawa',
  });
  assert.match(r.summary, /Ryo Hirakawa/);
  assert.match(r.summary, /Esteban Ocon/);
});

test('a_fifty_place_drop_is_a_flag_with_the_places', () => {
  const r = parseDocumentText('infringement', fixture('bottas_pu_elements.txt'));
  assert.equal(r.severity, 'flag');
  assert.equal(r.understood, true);
  assert.equal(r.facts.carNumber, 77);
  assert.equal(r.facts.driverName, 'Valtteri Bottas');
  assert.equal(r.facts.gridDrop, 50);
  assert.match(r.summary, /Valtteri Bottas/);
  assert.match(r.summary, /50/);
});

test('a_drop_written_in_words_is_read', () => {
  const r = parseDocumentText('infringement', fixture('verstappen_incident.txt'));
  assert.equal(r.severity, 'flag');
  assert.equal(r.facts.carNumber, 3);
  assert.equal(r.facts.gridDrop, 1);
});

test('a_formal_warning_is_seen_not_flagged', () => {
  const r = parseDocumentText('infringement', fixture('hadjar_misconduct.txt'));
  assert.equal(r.severity, 'seen');
  assert.equal(r.understood, true);
  assert.equal(r.facts.carNumber, 6);
  assert.match(String(r.facts.decision), /formal warning/i);
});

test('text_without_a_decision_is_not_understood', () => {
  assert.equal(parseDocumentText('infringement', fixture('survival_cell.txt')).understood, false);
  assert.equal(parseDocumentText('infringement', '').understood, false);
  assert.equal(parseDocumentText('decision', '   ').understood, false);
});

test('pit_lane_start_and_exclusion_wording_is_a_flag', () => {
  const wrap = (decision: string) =>
    `From The Stewards\nNo / Driver  5 - Test Driver\nCompetitor Test Team\nTime 12:00\nDecision  ${decision}\nReason  Because.\n`;
  for (const decision of ['Start from the pit lane.', 'Disqualified from the Qualifying.', 'Excluded from the results.']) {
    const r = parseDocumentText('decision', wrap(decision));
    assert.equal(r.severity, 'flag', decision);
    assert.equal(r.understood, true, decision);
  }
  assert.equal(parseDocumentText('decision', wrap('Fine of EUR 5000.')).severity, 'seen');
});

test('other_kinds_are_seen_with_a_short_summary', () => {
  for (const kind of ['entry_list', 'summons', 'pu_report', 'other'] as const) {
    const r = parseDocumentText(kind, fixture('pu_report.txt'));
    assert.equal(r.severity, 'seen', kind);
    assert.equal(r.understood, true, kind);
  }
});
