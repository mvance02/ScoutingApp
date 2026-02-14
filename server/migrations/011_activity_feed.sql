-- Migration 011: Activity Feed
-- Tracks all user actions for activity feed

CREATE TABLE IF NOT EXISTS activity_feed (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  user_name VARCHAR(255),
  action_type VARCHAR(50) NOT NULL, -- 'stat_created', 'player_updated', 'comment_added', 'game_created', etc.
  entity_type VARCHAR(50) NOT NULL, -- 'stat', 'player', 'game', 'comment', 'grade', etc.
  entity_id INTEGER,
  entity_name VARCHAR(255), -- Player name, game opponent, etc.
  details JSONB DEFAULT '{}'::jsonb, -- Additional context
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_activity_feed_created ON activity_feed(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_feed_user ON activity_feed(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_feed_entity ON activity_feed(entity_type, entity_id);
