-- Migration 019: Add home state field for JUCO and Transfer players
-- Tracks the state the player is originally from (separate from current school state)

ALTER TABLE players
  ADD COLUMN IF NOT EXISTS home_state VARCHAR(50);

-- Index for filtering by home state
CREATE INDEX IF NOT EXISTS idx_players_home_state ON players(home_state);
