-- Migration 002: Feature Enhancements
-- Adds recruiting pipeline, scout assignments, status history, and audit log

-- Recruiting Pipeline: Add columns to players table
ALTER TABLE players
  ADD COLUMN IF NOT EXISTS recruiting_status VARCHAR(50) DEFAULT 'Watching',
  ADD COLUMN IF NOT EXISTS status_updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS status_notes TEXT;

CREATE INDEX IF NOT EXISTS idx_players_recruiting_status ON players(recruiting_status);

-- Status history tracking
CREATE TABLE IF NOT EXISTS player_status_history (
  id SERIAL PRIMARY KEY,
  player_id INTEGER REFERENCES players(id) ON DELETE CASCADE,
  old_status VARCHAR(50),
  new_status VARCHAR(50) NOT NULL,
  notes TEXT,
  changed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_status_history_player ON player_status_history(player_id);

-- Scout Assignments
CREATE TABLE IF NOT EXISTS scout_assignments (
  id SERIAL PRIMARY KEY,
  scout_id INTEGER REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  player_id INTEGER REFERENCES players(id) ON DELETE CASCADE,
  game_id INTEGER REFERENCES games(id) ON DELETE CASCADE,
  assigned_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  notes TEXT,
  CONSTRAINT assignment_target_check CHECK (player_id IS NOT NULL OR game_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_scout_assignments_scout ON scout_assignments(scout_id);
CREATE INDEX IF NOT EXISTS idx_scout_assignments_player ON scout_assignments(player_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_scout_assignment_unique_player
  ON scout_assignments(scout_id, player_id) WHERE player_id IS NOT NULL;

-- Audit Log
CREATE TABLE IF NOT EXISTS audit_log (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  user_email VARCHAR(255),
  action VARCHAR(50) NOT NULL,
  table_name VARCHAR(100) NOT NULL,
  record_id INTEGER,
  old_values JSONB,
  new_values JSONB,
  ip_address VARCHAR(45),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_log_user ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_log_table_record ON audit_log(table_name, record_id);
