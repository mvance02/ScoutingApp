-- Migration 012: Mentions in Comments
-- Track @mentions in comments and create notifications

-- Add mentions column to player_comments if it doesn't exist
ALTER TABLE player_comments ADD COLUMN IF NOT EXISTS mentions INTEGER[];

-- Mentions tracking table
CREATE TABLE IF NOT EXISTS comment_mentions (
  id SERIAL PRIMARY KEY,
  comment_id INTEGER REFERENCES player_comments(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (comment_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_mentions_comment ON comment_mentions(comment_id);
CREATE INDEX IF NOT EXISTS idx_mentions_user ON comment_mentions(user_id);
