-- Add player_id FK to recruits for auto-sync from Player Management
ALTER TABLE recruits ADD COLUMN IF NOT EXISTS player_id INTEGER REFERENCES players(id) ON DELETE SET NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_recruits_player_id ON recruits(player_id) WHERE player_id IS NOT NULL;
