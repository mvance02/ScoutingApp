-- Migration: Add missing tables and columns
-- Run this on existing databases to update schema
-- Safe to re-run (uses IF NOT EXISTS / IF EXISTS guards)

-- Add created_by to stats table if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'stats' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE stats ADD COLUMN created_by INTEGER REFERENCES users(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Add state column to players table if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'players' AND column_name = 'state'
  ) THEN
    ALTER TABLE players ADD COLUMN state VARCHAR(50);
  END IF;
END $$;

-- Add cut_up_completed column to players table if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'players' AND column_name = 'cut_up_completed'
  ) THEN
    ALTER TABLE players ADD COLUMN cut_up_completed BOOLEAN DEFAULT false;
  END IF;
END $$;

-- Add password reset columns to users table if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'reset_token'
  ) THEN
    ALTER TABLE users ADD COLUMN reset_token VARCHAR(64);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'reset_token_expires'
  ) THEN
    ALTER TABLE users ADD COLUMN reset_token_expires TIMESTAMP;
  END IF;
END $$;

-- Create game_player_grades table if not exists
CREATE TABLE IF NOT EXISTS game_player_grades (
  id SERIAL PRIMARY KEY,
  game_id INTEGER REFERENCES games(id) ON DELETE CASCADE,
  player_id INTEGER REFERENCES players(id) ON DELETE CASCADE,
  grade VARCHAR(10),
  notes TEXT,
  admin_notes TEXT,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (game_id, player_id)
);

-- Add admin_notes column if missing (for existing tables)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'game_player_grades' AND column_name = 'admin_notes'
  ) THEN
    ALTER TABLE game_player_grades ADD COLUMN admin_notes TEXT;
  END IF;
END $$;

-- Create game_notes table if not exists
CREATE TABLE IF NOT EXISTS game_notes (
  id SERIAL PRIMARY KEY,
  game_id INTEGER REFERENCES games(id) ON DELETE CASCADE,
  timestamp VARCHAR(20),
  period VARCHAR(20),
  note TEXT NOT NULL,
  category VARCHAR(50) DEFAULT 'general',
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add indexes (safe to run multiple times - will fail silently if exists)
CREATE INDEX IF NOT EXISTS idx_stats_created_by ON stats(created_by);
CREATE INDEX IF NOT EXISTS idx_game_grades_game ON game_player_grades(game_id);
CREATE INDEX IF NOT EXISTS idx_game_grades_player ON game_player_grades(player_id);
CREATE INDEX IF NOT EXISTS idx_game_notes_game ON game_notes(game_id);
CREATE INDEX IF NOT EXISTS idx_users_reset_token ON users(reset_token);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Verify migration
DO $$
BEGIN
  RAISE NOTICE 'Migration completed successfully!';
  RAISE NOTICE 'Tables: game_player_grades, game_notes';
  RAISE NOTICE 'Columns: stats.created_by, users.reset_token, users.reset_token_expires, game_player_grades.admin_notes';
END $$;
