-- Migration 017: JUCO-specific fields
-- Adds JUCO-only evaluation fields that are ignored for HS players

ALTER TABLE players
  ADD COLUMN IF NOT EXISTS eligibility_years_left INTEGER,
  ADD COLUMN IF NOT EXISTS recruiting_context TEXT,
  ADD COLUMN IF NOT EXISTS immediate_impact_tag VARCHAR(100),
  ADD COLUMN IF NOT EXISTS risk_notes TEXT,
  ADD COLUMN IF NOT EXISTS current_school_level VARCHAR(100),
  ADD COLUMN IF NOT EXISTS portal_status VARCHAR(100),
  ADD COLUMN IF NOT EXISTS transfer_reason TEXT,
  ADD COLUMN IF NOT EXISTS other_offers JSONB;

-- Basic index to help filter JUCO board by eligibility years left and school level
CREATE INDEX IF NOT EXISTS idx_players_eligibility_years_left ON players(eligibility_years_left);
CREATE INDEX IF NOT EXISTS idx_players_current_school_level ON players(current_school_level);

