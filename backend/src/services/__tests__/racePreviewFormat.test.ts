import test from 'node:test';
import assert from 'node:assert/strict';
import { timeOf, dayKeyOf, shortWhenOf, weekdayShort, dayLongOf, kmToMiles, circuitFactsText } from '../racePreviewFormat';

test('times_are_dutch_time_in_winter_and_summer', () => {
  assert.equal(timeOf(new Date('2026-11-20T00:30:00Z')), '01:30'); // CET, UTC+1
  assert.equal(timeOf(new Date('2026-07-03T13:00:00Z')), '15:00'); // CEST, UTC+2
});

test('midnight_is_00_not_24_and_a_late_session_belongs_to_the_next_dutch_day', () => {
  assert.equal(timeOf(new Date('2026-11-19T23:00:00Z')), '00:00');
  assert.equal(timeOf(new Date('2026-11-19T23:30:00Z')), '00:30');
  assert.equal(dayKeyOf(new Date('2026-11-19T23:30:00Z')), '2026-11-20');
  assert.equal(dayKeyOf(new Date('2026-11-20T00:30:00Z')), '2026-11-20');
  assert.equal(dayKeyOf(new Date('2026-11-20T22:59:00Z')), '2026-11-20');
});

test('the_race_start_reads_naturally_in_both_languages', () => {
  const race = new Date('2026-11-22T04:00:00Z');
  assert.equal(shortWhenOf(race, 'en'), 'Sun 05:00');
  assert.equal(shortWhenOf(race, 'nl'), 'zo 05:00');
  assert.equal(weekdayShort(race, 'nl'), 'zo');
  assert.equal(dayLongOf(race, 'en'), 'Sunday 22 November');
  assert.equal(dayLongOf(race, 'nl'), 'zondag 22 november');
});

test('kilometres_become_miles', () => {
  assert.equal(kmToMiles(6.201).toFixed(3), '3.853');
  assert.equal(kmToMiles(1).toFixed(6), '0.621371');
});

test('circuit_facts_are_written_with_the_readers_decimal_mark', () => {
  const vegas = { lengthKm: 6.201, laps: 50, raceDistanceKm: 309.958 };
  assert.deepEqual(circuitFactsText(vegas, 'en'), {
    lapKm: '6.201 km', lapMi: '3.853 mi', laps: '50', distanceKm: '310.0 km', distanceMi: '192.6 mi',
  });
  assert.deepEqual(circuitFactsText(vegas, 'nl'), {
    lapKm: '6,201 km', lapMi: '3,853 mi', laps: '50', distanceKm: '310,0 km', distanceMi: '192,6 mi',
  });
});
