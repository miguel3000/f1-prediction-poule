import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { CIRCUITS } from '../circuits';

// The circuit data behind the race weekend preview (tools/circuit-maps/build_circuits.py).
const CIRCUIT_DIR = path.resolve(__dirname, '../../../../frontend/public/circuits'); // from dist/data/__tests__

// Jolpi's circuit ids for every race of the 2026 calendar
const CALENDAR_2026 = [
  'albert_park', 'shanghai', 'suzuka', 'miami', 'villeneuve', 'monaco', 'catalunya', 'red_bull_ring',
  'silverstone', 'spa', 'hungaroring', 'zandvoort', 'monza', 'madring', 'baku', 'sepang', 'marina_bay',
  'americas', 'rodriguez', 'interlagos', 'vegas', 'losail', 'yas_marina',
];

test('every_circuit_of_the_2026_calendar_has_facts', () => {
  for (const id of CALENDAR_2026) assert.ok(CIRCUITS[id], `${id} has no circuit facts`);
});

test('every_circuit_has_a_layout_image_of_the_agreed_size', () => {
  for (const id of Object.keys(CIRCUITS)) {
    const file = path.join(CIRCUIT_DIR, `${id}.png`);
    assert.ok(fs.existsSync(file), `${id}.png is missing`);
    const png = fs.readFileSync(file);
    assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', `${id}.png is not a PNG`);
    assert.equal(png.readUInt32BE(16), 1200, `${id}.png width`);
    assert.equal(png.readUInt32BE(20), 600, `${id}.png height`);
    assert.ok(png.length < 60_000, `${id}.png is ${png.length} bytes: too heavy for an email`);
  }
});

test('there_is_no_layout_image_without_facts', () => {
  const files = fs.readdirSync(CIRCUIT_DIR).filter((f) => f.endsWith('.png')).map((f) => f.slice(0, -4));
  assert.deepEqual(files.sort(), Object.keys(CIRCUITS).sort());
});

test('the_numbers_are_plausible_and_agree_with_each_other', () => {
  for (const [id, c] of Object.entries(CIRCUITS)) {
    assert.ok(c.lengthKm > 3 && c.lengthKm < 8, `${id} length ${c.lengthKm}`);
    assert.ok(Number.isInteger(c.laps) && c.laps > 40 && c.laps < 80, `${id} laps ${c.laps}`);
    // F1's race distance uses the FIA's own lap length: within 0.2 % of laps x published length
    assert.ok(Math.abs(c.laps * c.lengthKm - c.raceDistanceKm) / c.raceDistanceKm < 0.002, `${id} distance ${c.raceDistanceKm}`);
    // a race is the shortest lap count that passes 305 km; Monaco is the 260 km exception
    assert.ok(id === 'monaco' ? c.raceDistanceKm === 260.286 : c.raceDistanceKm >= 305 && c.raceDistanceKm < 311, `${id} distance ${c.raceDistanceKm}`);
  }
});

test('las_vegas_matches_the_schedule_the_owner_shared', () => {
  // "Lengte: 6,2 km | Ronden: 50"
  assert.equal(CIRCUITS.vegas.lengthKm, 6.201);
  assert.equal(CIRCUITS.vegas.laps, 50);
});
