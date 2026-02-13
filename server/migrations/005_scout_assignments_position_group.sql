-- Add position_group to scout_assignments and update constraints
ALTER TABLE scout_assignments
  ADD COLUMN IF NOT EXISTS position_group VARCHAR(20);

ALTER TABLE scout_assignments
  DROP CONSTRAINT IF EXISTS assignment_target_check;

ALTER TABLE scout_assignments
  ADD CONSTRAINT assignment_target_check
    CHECK (player_id IS NOT NULL OR game_id IS NOT NULL OR position_group IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_scout_assignments_position_group
  ON scout_assignments(position_group);

CREATE UNIQUE INDEX IF NOT EXISTS idx_scout_assignment_unique_position_group
  ON scout_assignments(scout_id, position_group)
  WHERE position_group IS NOT NULL;
