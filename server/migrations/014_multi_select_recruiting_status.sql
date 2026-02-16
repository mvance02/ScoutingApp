-- Migration: Convert recruiting_status from single-select to multi-select (TEXT[])
-- Run via: psql -d your_database -f migrations/multi_select_recruiting_status.sql

BEGIN;

-- Players: add recruiting_statuses TEXT[] column, migrate data, drop old column
ALTER TABLE players ADD COLUMN recruiting_statuses TEXT[] DEFAULT ARRAY['Watching'];
UPDATE players SET recruiting_statuses = ARRAY[recruiting_status] WHERE recruiting_status IS NOT NULL;
CREATE INDEX idx_players_recruiting_statuses ON players USING GIN(recruiting_statuses);
DROP INDEX IF EXISTS idx_players_recruiting_status;
ALTER TABLE players DROP COLUMN IF EXISTS recruiting_status;

-- Recruits: add statuses TEXT[] column, migrate data, drop old column
ALTER TABLE recruits ADD COLUMN statuses TEXT[] DEFAULT ARRAY[]::text[];
UPDATE recruits SET statuses = ARRAY[status] WHERE status IS NOT NULL;
CREATE INDEX idx_recruits_statuses ON recruits USING GIN(statuses);
DROP INDEX IF EXISTS idx_recruits_status;
ALTER TABLE recruits DROP COLUMN IF EXISTS status;

-- Status history: convert old_status and new_status to TEXT[]
ALTER TABLE player_status_history
  ALTER COLUMN old_status TYPE TEXT[] USING CASE WHEN old_status IS NULL THEN NULL ELSE ARRAY[old_status] END,
  ALTER COLUMN new_status TYPE TEXT[] USING ARRAY[new_status];

COMMIT;
