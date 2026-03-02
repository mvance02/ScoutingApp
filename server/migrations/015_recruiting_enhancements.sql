-- Migration 015: Recruiting Features Enhancement
-- Adds JUCO/Transfer tracking, LDS field, and offered date

-- Add player type tracking fields
ALTER TABLE players
  ADD COLUMN IF NOT EXISTS is_juco BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_transfer_wishlist BOOLEAN DEFAULT false;

-- Add LDS field
ALTER TABLE players
  ADD COLUMN IF NOT EXISTS is_lds BOOLEAN;

-- Add offered date field
ALTER TABLE players
  ADD COLUMN IF NOT EXISTS offered_date DATE;

-- Create indexes for filtering performance
CREATE INDEX IF NOT EXISTS idx_players_is_juco ON players(is_juco);
CREATE INDEX IF NOT EXISTS idx_players_is_transfer_wishlist ON players(is_transfer_wishlist);

-- Set existing players to HS (not JUCO or Transfer)
UPDATE players
SET is_juco = false, is_transfer_wishlist = false
WHERE is_juco IS NULL OR is_transfer_wishlist IS NULL;

-- Convert old grade format to new simplified format (A/B/C/F)
-- This will be handled in application code, but we ensure the grade field can handle it
-- Grade field is already VARCHAR(10), so no schema change needed
