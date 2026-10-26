import test from 'node:test';
import assert from 'node:assert/strict';
import { isPredictionLocked, predictionLockTime } from '../predictionLock';

const raceDate = new Date('2026-11-01T20:00:00Z');

test('refused_one_second_before_the_lock', () => {
  delete process.env.PREDICTION_LOCK_MINUTES;
  const oneSecondBefore = new Date(predictionLockTime(raceDate).getTime() - 1000);
  assert.equal(isPredictionLocked(raceDate, oneSecondBefore), false);
});

test('shown_at_the_lock', () => {
  delete process.env.PREDICTION_LOCK_MINUTES;
  assert.equal(predictionLockTime(raceDate).toISOString(), '2026-11-01T19:59:00.000Z');
  assert.equal(isPredictionLocked(raceDate, predictionLockTime(raceDate)), true);
  assert.equal(isPredictionLocked(raceDate, raceDate), true);
});

test('lock_minutes_follow_the_environment_variable', () => {
  process.env.PREDICTION_LOCK_MINUTES = '5';
  assert.equal(predictionLockTime(raceDate).toISOString(), '2026-11-01T19:55:00.000Z');
  process.env.PREDICTION_LOCK_MINUTES = '0';
  assert.equal(predictionLockTime(raceDate).toISOString(), '2026-11-01T20:00:00.000Z');
  delete process.env.PREDICTION_LOCK_MINUTES;
});
