// Throwaway: fills the local test database for manual browser checks. Deleted after use.
import { resetTestDatabase, seedSeason, closeTestDatabase } from './testDb';
(async () => {
  await resetTestDatabase();
  await seedSeason();
  await closeTestDatabase();
  console.log('seeded');
})();
