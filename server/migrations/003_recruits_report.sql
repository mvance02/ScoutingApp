-- Recruits weekly report tables

CREATE TABLE IF NOT EXISTS recruits (
  id SERIAL PRIMARY KEY,
  player_id INTEGER REFERENCES players(id) ON DELETE SET NULL,
  name VARCHAR(255) NOT NULL,
  school VARCHAR(255) NOT NULL,
  state VARCHAR(50),
  class_year VARCHAR(10),
  position VARCHAR(20),
  side_of_ball VARCHAR(20),
  status VARCHAR(30),
  committed_school VARCHAR(255),
  committed_date DATE,
  assigned_coach VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS recruit_weekly_reports (
  id SERIAL PRIMARY KEY,
  recruit_id INTEGER REFERENCES recruits(id) ON DELETE CASCADE,
  week_start_date DATE NOT NULL,
  week_end_date DATE NOT NULL,
  last_game_date DATE,
  last_game_opponent VARCHAR(255),
  last_game_score VARCHAR(50),
  last_game_result VARCHAR(10),
  next_game_date DATE,
  next_game_time VARCHAR(20),
  next_game_opponent VARCHAR(255),
  next_game_location VARCHAR(10),
  stats JSONB DEFAULT '{}'::jsonb,
  other_stats JSONB DEFAULT '[]'::jsonb,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (recruit_id, week_start_date)
);

CREATE TABLE IF NOT EXISTS recruit_notes (
  id SERIAL PRIMARY KEY,
  recruit_id INTEGER REFERENCES recruits(id) ON DELETE CASCADE,
  week_start_date DATE NOT NULL,
  note_date DATE,
  source VARCHAR(50),
  link TEXT,
  summary TEXT,
  quote TEXT,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_recruits_position ON recruits(position);
CREATE INDEX IF NOT EXISTS idx_recruits_status ON recruits(status);
CREATE INDEX IF NOT EXISTS idx_recruit_reports_week ON recruit_weekly_reports(week_start_date);
CREATE INDEX IF NOT EXISTS idx_recruit_notes_week ON recruit_notes(week_start_date);
