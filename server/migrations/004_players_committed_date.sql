-- Add committed_date to players for multi-status tracking
ALTER TABLE players ADD COLUMN IF NOT EXISTS committed_date DATE;
