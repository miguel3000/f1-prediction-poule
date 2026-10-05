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

    // Add provisional_alert_sent column to races table (tracks whether we've already
    // emailed the admin that results were still unavailable after the retry window)
    console.log('Checking for provisional_alert_sent column...');
    await query(`ALTER TABLE races ADD COLUMN IF NOT EXISTS provisional_alert_sent BOOLEAN DEFAULT FALSE`);
    console.log('provisional_alert_sent column ensured.');

    // Add is_admin column to users table (replaces the separate Basic-Auth
    // admin username/password — admin rights are now tied to a real account)
    console.log('Checking for is_admin column on users...');
    await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT FALSE`);
    console.log('is_admin column ensured.');

    // Add email_opt_out column to users (lets a player opt out of the admin
    // broadcast/announcement emails via the unsubscribe link, without
    // affecting transactional emails like prediction confirmations)
    console.log('Checking for email_opt_out column...');
    await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS email_opt_out BOOLEAN NOT NULL DEFAULT FALSE`);
    console.log('email_opt_out column ensured.');

    // Add dnf_pick / dnf_bonus_points columns to predictions (main race only —
    // the +25pt bonus for correctly calling the first retirement of the race)
    console.log('Checking for dnf_pick/dnf_bonus_points columns...');
    await query(`ALTER TABLE predictions ADD COLUMN IF NOT EXISTS dnf_pick INTEGER REFERENCES drivers(id)`);
    await query(`ALTER TABLE predictions ADD COLUMN IF NOT EXISTS dnf_bonus_points INTEGER DEFAULT 0`);
    console.log('dnf_pick/dnf_bonus_points columns ensured.');

    // Add reminder_sent column to races (tracks whether the 1-hour-before-lights-out
    // missed-prediction reminder has already gone out, so the cron job stays idempotent)
    console.log('Checking for reminder_sent column...');
    await query(`ALTER TABLE races ADD COLUMN IF NOT EXISTS reminder_sent BOOLEAN DEFAULT FALSE`);
    console.log('reminder_sent column ensured.');

    // Practice session results (FP1/FP2/FP3). Jolpi has no practice endpoint,
    // so these are captured from the live timing feed (and OpenF1 as backup).
    // Keyed by season/round/session instead of race_id so the main/sprint rows
    // of one weekend don't duplicate them. A session's rows are always replaced
    // as one set; `final` marks a finished session that live writes must not touch.
    console.log('Checking for practice_results table...');
    await query(`
      CREATE TABLE IF NOT EXISTS practice_results (
        id SERIAL PRIMARY KEY,
        season INTEGER NOT NULL,
        round INTEGER NOT NULL,
        session SMALLINT NOT NULL,
        position INTEGER NOT NULL,
        driver_number INTEGER NOT NULL,
        driver_name VARCHAR(255) NOT NULL,
        driver_code VARCHAR(10),
        team VARCHAR(255),
        best_time VARCHAR(20),
        laps INTEGER DEFAULT 0,
        final BOOLEAN NOT NULL DEFAULT FALSE,
        source VARCHAR(20) NOT NULL DEFAULT 'live',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(season, round, session, driver_number)
      )
    `);
    await query(`CREATE INDEX IF NOT EXISTS idx_practice_results_lookup ON practice_results(season, round, session)`);
    console.log('practice_results table ensured.');

    // Results cross-check: the live feed's race classification, and the latest
    // verdict per race (so the admin is only emailed when it changes).
    console.log('Checking for race_classifications and result_checks tables...');
    await query(`
      CREATE TABLE IF NOT EXISTS race_classifications (
        id SERIAL PRIMARY KEY,
        season INTEGER NOT NULL,
        round INTEGER NOT NULL,
        kind VARCHAR(10) NOT NULL CHECK (kind IN ('main', 'sprint')),
        source VARCHAR(20) NOT NULL DEFAULT 'live',
        driver_number INTEGER NOT NULL,
        position INTEGER NOT NULL,
        status VARCHAR(10) NOT NULL,
        laps INTEGER DEFAULT 0,
        final BOOLEAN NOT NULL DEFAULT FALSE,
        captured_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(season, round, kind, driver_number)
      )
    `);
    await query(`
      CREATE TABLE IF NOT EXISTS result_checks (
        race_id INTEGER PRIMARY KEY REFERENCES races(id) ON DELETE CASCADE,
        verdict VARCHAR(20) NOT NULL,
        detail JSONB,
        notified_signature TEXT,
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    console.log('race_classifications and result_checks tables ensured.');

    // Preferred site language per player ('en' | 'nl'); NULL = not chosen yet,
    // in which case the browser's language decides.
    console.log('Checking for language column on users...');
    await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS language VARCHAR(2) CHECK (language IN ('en', 'nl'))`);
    console.log('language column ensured.');

    // Player Pit Wall: the admin grants individual players access, players
    // submit ideas/implementations, the admin approves or declines them.
    console.log('Checking for pitwall_access column and pitwall_ideas table...');
    await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS pitwall_access BOOLEAN NOT NULL DEFAULT FALSE`);
    await query(`
      CREATE TABLE IF NOT EXISTS pitwall_ideas (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        kind VARCHAR(20) NOT NULL CHECK (kind IN ('idea', 'implementation')),
        title VARCHAR(200) NOT NULL,
        description TEXT NOT NULL DEFAULT '' CHECK (char_length(description) <= 2000),
        status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'declined')),
        admin_note TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        decided_at TIMESTAMPTZ
      )
    `);
    await query(`CREATE INDEX IF NOT EXISTS idx_pitwall_ideas_user ON pitwall_ideas(user_id, created_at DESC)`);
    console.log('pitwall_access and pitwall_ideas ensured.');

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
