-- ScoutingApp PostgreSQL Schema
-- Run this in PgAdmin to create the database tables

-- Users table
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role VARCHAR(20) DEFAULT 'scout',
  reset_token VARCHAR(64),
  reset_token_expires TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Players table
CREATE TABLE players (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  position VARCHAR(50),
  offense_position VARCHAR(50),
  defense_position VARCHAR(50),
  school VARCHAR(255),
  state VARCHAR(50),
  grad_year VARCHAR(10),
  notes TEXT,
  flagged BOOLEAN DEFAULT true,
  cut_up_completed BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Games table
CREATE TABLE games (
  id SERIAL PRIMARY KEY,
  opponent VARCHAR(255),
  date DATE,
  location VARCHAR(255),
  competition_level VARCHAR(100),
  video_url TEXT,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Game-Player junction table
CREATE TABLE game_players (
  game_id INTEGER REFERENCES games(id) ON DELETE CASCADE,
  player_id INTEGER REFERENCES players(id) ON DELETE CASCADE,
  PRIMARY KEY (game_id, player_id)
);

-- Stats table
CREATE TABLE stats (
  id SERIAL PRIMARY KEY,
  game_id INTEGER REFERENCES games(id) ON DELETE CASCADE,
  player_id INTEGER REFERENCES players(id) ON DELETE CASCADE,
  stat_type VARCHAR(50) NOT NULL,
  value INTEGER DEFAULT 0,
  timestamp VARCHAR(20),
  period VARCHAR(20),
  note TEXT,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Game Player Grades table
CREATE TABLE game_player_grades (
  id SERIAL PRIMARY KEY,
  game_id INTEGER REFERENCES games(id) ON DELETE CASCADE,
  player_id INTEGER REFERENCES players(id) ON DELETE CASCADE,
  grade VARCHAR(10),
  notes TEXT,
  admin_notes TEXT,
  game_score VARCHAR(20),
  team_record VARCHAR(20),
  next_opponent VARCHAR(255),
  next_game_date VARCHAR(20),
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (game_id, player_id)
);

-- Game Notes table
CREATE TABLE game_notes (
  id SERIAL PRIMARY KEY,
  game_id INTEGER REFERENCES games(id) ON DELETE CASCADE,
  timestamp VARCHAR(20),
  period VARCHAR(20),
  note TEXT NOT NULL,
  category VARCHAR(50) DEFAULT 'general',
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Recruits table
CREATE TABLE recruits (
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
  player_id INTEGER REFERENCES players(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Recruit Weekly Reports table
CREATE TABLE recruit_weekly_reports (
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

-- Recruit Notes table
CREATE TABLE recruit_notes (
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

-- Indexes for performance
CREATE INDEX idx_stats_game_id ON stats(game_id);
CREATE INDEX idx_stats_player_id ON stats(player_id);
CREATE INDEX idx_stats_created_by ON stats(created_by);
CREATE INDEX idx_game_players_game ON game_players(game_id);
CREATE INDEX idx_game_players_player ON game_players(player_id);
CREATE INDEX idx_players_flagged ON players(flagged);
CREATE INDEX idx_game_grades_game ON game_player_grades(game_id);
CREATE INDEX idx_game_grades_player ON game_player_grades(player_id);
CREATE INDEX idx_game_notes_game ON game_notes(game_id);
CREATE INDEX idx_users_reset_token ON users(reset_token);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_recruits_position ON recruits(position);
CREATE INDEX idx_recruits_status ON recruits(status);
CREATE UNIQUE INDEX idx_recruits_player_id ON recruits(player_id) WHERE player_id IS NOT NULL;
CREATE INDEX idx_recruit_reports_week ON recruit_weekly_reports(week_start_date);
CREATE INDEX idx_recruit_notes_week ON recruit_notes(week_start_date);