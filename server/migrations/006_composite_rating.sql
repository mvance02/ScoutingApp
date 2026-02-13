-- Migration 006: Add composite_rating to players table
ALTER TABLE players
  ADD COLUMN IF NOT EXISTS composite_rating DECIMAL(4,2);

CREATE INDEX IF NOT EXISTS idx_players_composite_rating ON players(composite_rating);
