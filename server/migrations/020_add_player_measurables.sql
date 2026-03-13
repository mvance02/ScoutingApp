-- Add player measurables for Big 12 benchmarking and undersize alerts

ALTER TABLE players
  ADD COLUMN IF NOT EXISTS height_in DECIMAL(6,2),
  ADD COLUMN IF NOT EXISTS weight_lb DECIMAL(6,2),
  ADD COLUMN IF NOT EXISTS forty_time DECIMAL(6,3),
  ADD COLUMN IF NOT EXISTS arm_length_in DECIMAL(6,2),
  ADD COLUMN IF NOT EXISTS hand_size_in DECIMAL(6,2),
  ADD COLUMN IF NOT EXISTS undersized_traits TEXT[] DEFAULT ARRAY[]::text[];

CREATE INDEX IF NOT EXISTS idx_players_height_in ON players(height_in);
CREATE INDEX IF NOT EXISTS idx_players_weight_lb ON players(weight_lb);
CREATE INDEX IF NOT EXISTS idx_players_forty_time ON players(forty_time);
