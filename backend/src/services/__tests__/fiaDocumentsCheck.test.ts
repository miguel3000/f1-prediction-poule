import test, { before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { query } from '../../config/database';
import { resetTestDatabase, closeTestDatabase } from '../../testing/testDb';
import { parseListing, classifyTitle } from '../fiaDocumentsParser';
import { runCheck } from '../fiaDocumentsService';

const FIXTURES = path.resolve(__dirname, '../../../src/services/__tests__/fixtures/fia');
const fixture = (name: string) => fs.readFileSync(path.join(FIXTURES, name), 'utf8');
const LISTING = fixture('listing.html');
const NOW = new Date('2026-10-31T19:00:00Z'); // inside the window of the race below

// The documents the real listing links to, answered with the real text where we have it and a small
// fine for everything else.
const FINE = 'From The Stewards\nNo / Driver  14 - Fernando Alonso\nCompetitor Aston Martin\nDecision  Fine of EUR 100.\nReason  Speeding.\n';
const textFor = (url: string): string => {
  if (url.includes('driver_change')) return fixture('driver_change.txt');
  if (url.includes('car_77_-_pu_elements')) return fixture('bottas_pu_elements.txt');
  if (url.includes('car_3_-_turn_14')) return fixture('verstappen_incident.txt');
  if (url.includes('car_6_-_misconduct')) return fixture('hadjar_misconduct.txt');
  return FINE;
};

before(async () => {
  await resetTestDatabase();
  await query(
    `INSERT INTO races (season, round, race_name, circuit_name, country, race_date, race_type, status)
     VALUES (2026, 19, 'Mexico City Grand Prix', 'Test', 'Mexico', '2026-11-01T20:00:00Z', 'main', 'upcoming')`
  );
});
after(closeTestDatabase);
beforeEach(async () => {
  await query('DELETE FROM fia_documents');
  await query('DELETE FROM fia_checks');
  await query('DELETE FROM drivers');
});

const deps = (over: Partial<Parameters<typeof runCheck>[0]> = {}, reads: string[] = []) => ({
  fetchListing: async () => LISTING,
  fetchPdfText: async (url: string) => {
    reads.push(url);
    return textFor(url);
  },
  now: () => NOW,
  ...over,
});
const row = async (docNumber: number) =>
  (await query('SELECT * FROM fia_documents WHERE doc_number = $1', [docNumber])).rows[0];

test('outside_the_window_nothing_is_fetched', async () => {
  let fetched = 0;
  const result = await runCheck(
    deps({ fetchListing: async () => { fetched++; return LISTING; }, now: () => new Date('2026-10-20T12:00:00Z') })
  );
  assert.equal(result.ran, false);
  assert.equal(fetched, 0);
  assert.equal((await query('SELECT 1 FROM fia_checks')).rows.length, 0, 'a skipped run is not recorded');
});

test('a_new_weekend_listing_is_read_and_classified', async () => {
  const reads: string[] = [];
  const result = await runCheck(deps({}, reads));

  assert.equal(result.ok, true);
  assert.equal(result.found, 40);
  assert.equal(result.added, 40);
  assert.equal(result.flagged, 3, 'the driver change, the 50-place drop and the one-place drop');

  const haas = await row(36);
  assert.equal(haas.severity, 'flag');
  assert.equal(haas.status, 'read');
  assert.equal(haas.kind, 'driver_change');
  assert.equal(haas.facts.replacementNumber, 50);
  assert.equal((await row(17)).facts.gridDrop, 50);
  assert.equal((await row(33)).facts.gridDrop, 1);
  assert.equal((await row(41)).severity, 'seen');
  assert.equal((await row(19)).status, 'skipped', 'a classification is not opened');

  const readable = parseListing(LISTING)!.documents.filter((d) => classifyTitle(d.title).read);
  assert.equal(reads.length, readable.length, 'only titles that look relevant are opened');
  assert.ok(!reads.some((u) => /classification|timetable|curfew/.test(u)));
  assert.equal((await query('SELECT ok FROM fia_checks')).rows[0].ok, true);
});

test('a_second_run_adds_nothing_and_reads_nothing_again', async () => {
  await runCheck(deps());
  const reads: string[] = [];
  const result = await runCheck(deps({}, reads));
  assert.equal(result.added, 0);
  assert.equal(result.flagged, 0);
  assert.equal(reads.length, 0);
});

test('a_driver_change_is_flagged_from_its_title_when_the_pdf_cannot_be_read', async () => {
  await runCheck(deps({ fetchPdfText: async () => { throw new Error('download failed'); } }));
  const haas = await row(36);
  assert.equal(haas.severity, 'flag');
  assert.equal(haas.status, 'read');
  assert.match(haas.summary, /could not be read/i);
});

test('an_unreadable_infringement_is_retried_then_flagged_after_three_attempts', async () => {
  const garbage = async () => 'this is not a decision';
  await runCheck(deps({ fetchPdfText: garbage }));
  let bottas = await row(17);
  assert.equal(bottas.status, 'failed');
  assert.equal(bottas.attempts, 1);
  assert.equal(bottas.severity, null);

  await runCheck(deps({ fetchPdfText: garbage }));
  bottas = await row(17);
  assert.equal(bottas.attempts, 2);
  assert.equal(bottas.severity, null);

  await runCheck(deps({ fetchPdfText: garbage }));
  bottas = await row(17);
  assert.equal(bottas.attempts, 3);
  assert.equal(bottas.severity, 'flag');
  assert.match(bottas.summary, /could not read/i);
  assert.equal(bottas.facts.unreadable, true);

  const reads: string[] = [];
  await runCheck(deps({ fetchPdfText: async (u: string) => { reads.push(u); return 'x'; } }));
  assert.ok(!reads.some((u) => u.includes('car_77_-_pu_elements')), 'after three attempts it is not fetched again');
});

test('a_driver_change_says_when_the_stand_in_is_missing_from_our_drivers_table', async () => {
  await query("INSERT INTO drivers (driver_number, name, team, season) VALUES (31, 'Esteban OCON', 'Haas F1 Team', 2026)");
  await runCheck(deps());
  let facts = (await row(36)).facts;
  assert.equal(facts.originalInTable, true);
  assert.equal(facts.standInInTable, false);

  await query('DELETE FROM fia_documents');
  await query("INSERT INTO drivers (driver_number, name, team, season) VALUES (50, 'Ryo HIRAKAWA', 'Haas F1 Team', 2026)");
  await runCheck(deps());
  facts = (await row(36)).facts;
  assert.equal(facts.standInInTable, true);
});

test('a_page_without_an_event_block_is_a_failed_run', async () => {
  const result = await runCheck(deps({ fetchListing: async () => '<html><body>nothing here</body></html>' }));
  assert.equal(result.ran, true);
  assert.equal(result.ok, false);
  assert.match(result.error!, /event block/);
  const checks = (await query('SELECT ok, error FROM fia_checks')).rows;
  assert.equal(checks.length, 1);
  assert.equal(checks[0].ok, false);
  assert.equal((await query('SELECT 1 FROM fia_documents')).rows.length, 0);
});

test('a_failing_fetch_is_a_failed_run_not_a_crash', async () => {
  const result = await runCheck(deps({ fetchListing: async () => { throw new Error('connect ETIMEDOUT'); } }));
  assert.equal(result.ok, false);
  assert.match(result.error!, /ETIMEDOUT/);
});

test('a_recalled_document_is_skipped', async () => {
  const html = `<div class="decision-document-list"><ul class="event-wrapper"><li>
    <div class="event-title active">Mexico City Grand Prix</div>
    <ul><li><ul><li class="document-row key-1"><a href="/system/files/decision-document/recalled.pdf"><div class="title">Recalled - Doc 13 - New PU Elements for this Competition</div>
    <div class="published">Published on <span class="date-display-single">30.10.26 19:56</span> CET</div></a></li></ul></li></ul></li></ul></div>`;
  const reads: string[] = [];
  await runCheck(deps({ fetchListing: async () => html }, reads));
  assert.equal((await row(13)).status, 'skipped');
  assert.equal(reads.length, 0);
});
