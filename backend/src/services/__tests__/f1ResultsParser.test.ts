import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { parseRaceIndex, parseStartingGridPage } from '../f1ResultsParser';

// Real pages from formula1.com/en/results (2026 season), trimmed to the part the parser reads
// (images and flags removed). The compiled tests live in dist/, the fixtures in src/.
const FIXTURES = path.resolve(__dirname, '../../../src/services/__tests__/fixtures/f1');
const fixture = (name: string) => fs.readFileSync(path.join(FIXTURES, name), 'utf8');

const gridTable = (rows: Array<[string, string]>) =>
  `<table><thead><tr><th>Pos.</th><th>No.</th><th>Driver</th><th>Team</th><th>Time</th></tr></thead><tbody>` +
  rows.map(([pos, no]) => `<tr><td>${pos}</td><td>${no}</td><td><span>Some Driver</span></td><td>Team</td><td>1:20.000</td></tr>`).join('') +
  `</tbody></table>`;
const numbered = (n: number): Array<[string, string]> => Array.from({ length: n }, (_, i) => [String(i + 1), String(i + 10)]);

test('the_race_index_lists_each_race_once_in_calendar_order', () => {
  const races = parseRaceIndex(fixture('races_index.html'), 2026);
  assert.equal(races.length, 23); // the page links each race twice; one entry each
  assert.deepEqual(races[0], { id: 1279, slug: 'australia' });
  assert.deepEqual(races[15], { id: 1308, slug: 'bahrain' }); // ids are not in calendar order: Bahrain is 16th
  assert.deepEqual(races[18], { id: 1298, slug: 'mexico' });
  assert.deepEqual(parseRaceIndex(fixture('races_index.html'), 2025), [], 'links of another season are not ours');
  assert.deepEqual(parseRaceIndex('', 2026), []);
});

test('the_mexico_grid_is_read_with_penalties_applied', () => {
  const grid = parseStartingGridPage(fixture('mexico_starting_grid.html'));
  assert.ok(grid);
  assert.equal(grid!.length, 22);
  assert.deepEqual(grid!.map((g) => g.position), Array.from({ length: 22 }, (_, i) => i + 1));
  const at = (position: number) => grid![position - 1].driver_number;
  assert.equal(at(1), 44); // Hamilton
  assert.equal(at(5), 3); // Verstappen, after his one-place penalty
  assert.equal(at(18), 50); // Hirakawa, Ocon's stand-in
  assert.equal(at(21), 77); // Bottas, from the back after the power-unit penalty
  assert.equal(at(22), 30); // Lawson, no qualifying time
});

test('a_page_without_a_grid_table_is_null', () => {
  assert.equal(parseStartingGridPage(''), null);
  assert.equal(parseStartingGridPage('<html><body><p>No results yet</p></body></html>'), null);
  assert.equal(parseStartingGridPage('<table><thead><tr><th>Name</th><th>Age</th></tr></thead><tbody><tr><td>x</td><td>1</td></tr></tbody></table>'), null);
});

test('a_grid_still_filling_up_is_null', () => {
  assert.ok(parseStartingGridPage(gridTable(numbered(18))));
  assert.equal(parseStartingGridPage(gridTable(numbered(17))), null);
});

test('a_gap_or_a_repeat_in_the_places_is_not_a_grid', () => {
  const gap = numbered(20);
  gap[7][0] = '9'; // 1..7, 9, 9 ...
  assert.equal(parseStartingGridPage(gridTable(gap)), null);
  const skipped = numbered(20).filter(([pos]) => pos !== '5'); // 1-4, 6-20
  assert.equal(parseStartingGridPage(gridTable(skipped)), null);
});

test('a_driver_number_twice_is_not_a_grid', () => {
  const rows = numbered(20);
  rows[3][1] = rows[2][1];
  assert.equal(parseStartingGridPage(gridTable(rows)), null);
});

test('a_car_without_a_numbered_place_goes_behind_the_rest_in_page_order', () => {
  const rows = [...numbered(19), ['PL', '77'], ['', '30']] as Array<[string, string]>;
  const grid = parseStartingGridPage(gridTable(rows))!;
  assert.equal(grid.length, 21);
  assert.deepEqual(grid[19], { driver_number: 77, position: 20 });
  assert.deepEqual(grid[20], { driver_number: 30, position: 21 });
});

test('columns_are_found_by_their_heading_not_their_order', () => {
  const html =
    `<table><thead><tr><th>No.</th><th>Pos.</th><th>Driver</th></tr></thead><tbody>` +
    numbered(18).map(([pos, no]) => `<tr><td>${no}</td><td>${pos}</td><td>x</td></tr>`).join('') +
    `</tbody></table>`;
  const grid = parseStartingGridPage(html)!;
  assert.deepEqual(grid[0], { driver_number: 10, position: 1 });
});
