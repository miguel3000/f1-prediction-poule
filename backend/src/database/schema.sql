-- Users table
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  nickname VARCHAR(100) NOT NULL UNIQUE,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255),
  avatar_url VARCHAR(500),
  total_points INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Drivers table
CREATE TABLE IF NOT EXISTS drivers (
  id SERIAL PRIMARY KEY,
  driver_number INTEGER NOT NULL,
  name VARCHAR(255) NOT NULL,
  name_acronym VARCHAR(3),
  team VARCHAR(255) NOT NULL,
  nationality VARCHAR(100),
  total_points INTEGER DEFAULT 0,
  image_url VARCHAR(500),
  season INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(driver_number, season)
);

-- Races table
CREATE TABLE IF NOT EXISTS races (
  id SERIAL PRIMARY KEY,
  season INTEGER NOT NULL,
  round INTEGER NOT NULL,
  race_name VARCHAR(255) NOT NULL,
  circuit_name VARCHAR(255) NOT NULL,
  country VARCHAR(100) NOT NULL,
  race_date TIMESTAMP NOT NULL,
  qualifying_date TIMESTAMP,
  race_time VARCHAR(20),
  race_type VARCHAR(20) DEFAULT 'main', -- 'sprint' or 'main'
  status VARCHAR(50) DEFAULT 'upcoming', -- upcoming, in_progress, provisional, completed
  provisional_results_sent BOOLEAN DEFAULT FALSE,
  final_results_processed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(season, round, race_type)
);

-- Qualifying results table
CREATE TABLE IF NOT EXISTS qualifying_results (
  id SERIAL PRIMARY KEY,
  race_id INTEGER NOT NULL REFERENCES races(id) ON DELETE CASCADE,
  driver_id INTEGER NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  q1 VARCHAR(20),
  q2 VARCHAR(20),
  q3 VARCHAR(20),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(race_id, position),
  UNIQUE(race_id, driver_id)
);

-- Predictions table
CREATE TABLE IF NOT EXISTS predictions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  race_id INTEGER NOT NULL REFERENCES races(id) ON DELETE CASCADE,
  position_1 INTEGER REFERENCES drivers(id),
  position_2 INTEGER REFERENCES drivers(id),
  position_3 INTEGER REFERENCES drivers(id),
  position_4 INTEGER REFERENCES drivers(id),
  position_5 INTEGER REFERENCES drivers(id),
  position_6 INTEGER REFERENCES drivers(id),
  position_7 INTEGER REFERENCES drivers(id),
  position_8 INTEGER REFERENCES drivers(id),
  position_9 INTEGER REFERENCES drivers(id),
  position_10 INTEGER REFERENCES drivers(id),
  points_earned INTEGER DEFAULT 0,
  submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  is_locked BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, race_id)
);

-- Race results table
CREATE TABLE IF NOT EXISTS race_results (
  id SERIAL PRIMARY KEY,
  race_id INTEGER NOT NULL REFERENCES races(id) ON DELETE CASCADE,
  driver_id INTEGER NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  points INTEGER NOT NULL,
  status VARCHAR(50), -- finished, dnf, dns, disqualified
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(race_id, position),
  UNIQUE(race_id, driver_id)
);

-- Sprint results table (for sprint race results)
CREATE TABLE IF NOT EXISTS sprint_results (
  id SERIAL PRIMARY KEY,
  race_id INTEGER NOT NULL REFERENCES races(id) ON DELETE CASCADE,
  driver_id INTEGER NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  points INTEGER NOT NULL,
  status VARCHAR(50), -- finished, dnf, dns, disqualified
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(race_id, position),
  UNIQUE(race_id, driver_id)
);

-- Sprint predictions table (8 positions for sprint races)
CREATE TABLE IF NOT EXISTS sprint_predictions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  race_id INTEGER NOT NULL REFERENCES races(id) ON DELETE CASCADE,
  position_1 INTEGER REFERENCES drivers(id),
  position_2 INTEGER REFERENCES drivers(id),
  position_3 INTEGER REFERENCES drivers(id),
  position_4 INTEGER REFERENCES drivers(id),
  position_5 INTEGER REFERENCES drivers(id),
  position_6 INTEGER REFERENCES drivers(id),
  position_7 INTEGER REFERENCES drivers(id),
  position_8 INTEGER REFERENCES drivers(id),
  points_earned INTEGER DEFAULT 0,
  submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  is_locked BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, race_id)
);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_drivers_season ON drivers(season);
CREATE INDEX IF NOT EXISTS idx_races_season ON races(season);
CREATE INDEX IF NOT EXISTS idx_races_date ON races(race_date);
CREATE INDEX IF NOT EXISTS idx_predictions_user ON predictions(user_id);
CREATE INDEX IF NOT EXISTS idx_predictions_race ON predictions(race_id);
CREATE INDEX IF NOT EXISTS idx_predictions_user_race ON predictions(user_id, race_id);
CREATE INDEX IF NOT EXISTS idx_race_results_race ON race_results(race_id);
CREATE INDEX IF NOT EXISTS idx_sprint_results_race ON sprint_results(race_id);
CREATE INDEX IF NOT EXISTS idx_qualifying_results_race ON qualifying_results(race_id);
CREATE INDEX IF NOT EXISTS idx_races_type ON races(race_type);
CREATE INDEX IF NOT EXISTS idx_sprint_predictions_user ON sprint_predictions(user_id);
CREATE INDEX IF NOT EXISTS idx_sprint_predictions_race ON sprint_predictions(race_id);
CREATE INDEX IF NOT EXISTS idx_sprint_predictions_user_race ON sprint_predictions(user_id, race_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at (drop first to make idempotent)
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_drivers_updated_at ON drivers;
CREATE TRIGGER update_drivers_updated_at BEFORE UPDATE ON drivers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_races_updated_at ON races;
CREATE TRIGGER update_races_updated_at BEFORE UPDATE ON races
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_predictions_updated_at ON predictions;
CREATE TRIGGER update_predictions_updated_at BEFORE UPDATE ON predictions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_sprint_predictions_updated_at ON sprint_predictions;
CREATE TRIGGER update_sprint_predictions_updated_at BEFORE UPDATE ON sprint_predictions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
