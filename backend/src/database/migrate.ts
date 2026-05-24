import fs from 'fs';
import path from 'path';
import { query } from '../config/database';

const runMigration = async () => {
  try {
    console.log('Running database migrations...');

    // Try to find schema.sql in either src or dist directory
    let schemaPath = path.join(__dirname, 'schema.sql');
    if (!fs.existsSync(schemaPath)) {
      // If running from dist, go back to src
      schemaPath = path.join(__dirname, '../../src/database/schema.sql');
    }
    const schema = fs.readFileSync(schemaPath, 'utf-8');

    await query(schema);

    // Add password_hash column if it doesn't exist
    console.log('Checking for password_hash column...');
    await query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255)
    `);
    console.log('password_hash column ensured.');

    // Add sprint_results table if it doesn't exist
    console.log('Checking for sprint_results table...');
    await query(`
      CREATE TABLE IF NOT EXISTS sprint_results (
        id SERIAL PRIMARY KEY,
        race_id INTEGER NOT NULL REFERENCES races(id) ON DELETE CASCADE,
        driver_id INTEGER NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
        position INTEGER NOT NULL,
        points INTEGER NOT NULL,
        status VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(race_id, position),
        UNIQUE(race_id, driver_id)
      )
    `);
    await query(`CREATE INDEX IF NOT EXISTS idx_sprint_results_race ON sprint_results(race_id)`);
    console.log('sprint_results table ensured.');

    // Add qualifying_date column to races table
    console.log('Checking for qualifying_date column...');
    await query(`
      ALTER TABLE races
      ADD COLUMN IF NOT EXISTS qualifying_date TIMESTAMP
    `);
    console.log('qualifying_date column ensured.');

    // Add q1, q2, q3 columns to qualifying_results table
    console.log('Checking for q1/q2/q3 columns...');
    await query(`ALTER TABLE qualifying_results ADD COLUMN IF NOT EXISTS q1 VARCHAR(20)`);
    await query(`ALTER TABLE qualifying_results ADD COLUMN IF NOT EXISTS q2 VARCHAR(20)`);
    await query(`ALTER TABLE qualifying_results ADD COLUMN IF NOT EXISTS q3 VARCHAR(20)`);
    console.log('q1/q2/q3 columns ensured.');

    // Add image_url column to drivers table for headshots
    console.log('Checking for image_url column on drivers...');
    await query(`ALTER TABLE drivers ADD COLUMN IF NOT EXISTS image_url VARCHAR(500)`);
    console.log('image_url column ensured.');

    // Drop magic_links table (no longer needed - password auth only)
    console.log('Dropping magic_links table if it exists...');
    await query(`DROP TABLE IF EXISTS magic_links`);
    console.log('magic_links table dropped.');

    console.log('Database migrations completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
};

runMigration();
