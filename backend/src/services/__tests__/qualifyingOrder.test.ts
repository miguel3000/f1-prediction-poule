import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { query } from '../../config/database';
import { resetTestDatabase, closeTestDatabase, seedSeason } from '../../testing/testDb';
import { previousRaceOrder } from '../qualifyingService';

let season: Awaited<ReturnType<typeof seedSeason>>;

before(async () => {
  await resetTestDatabase();
  season = await seedSeason();
});
after(closeTestDatabase);

test('previous_race_order_still_offers_a_driver_who_was_not_in_that_race', async () => {
  // Last race classified nine of the ten drivers; the tenth (a stand-in who joined since) never raced.
  for (let i = 0; i < 9; i++) {
    await query('INSERT INTO race_results (race_id, driver_id, position, points) VALUES ($1, $2, $3, 0)', [
      season.pastRaceId,
      season.driverIds[i],
      i + 1,
    ]);
  }
  const rows = await previousRaceOrder(2026, 2);
  assert.ok(rows);
  assert.equal(rows!.length, 10, 'every driver must stay pickable');
  assert.deepEqual(rows!.slice(0, 9).map((r: any) => r.id), season.driverIds.slice(0, 9));
  const last = rows![9];
  assert.equal(last.id, season.driverIds[9]);
  assert.equal(last.position, null, 'a driver without a result has no position');
});

test('previous_race_order_is_null_when_there_is_no_earlier_result', async () => {
  assert.equal(await previousRaceOrder(2026, 1), null);
});
