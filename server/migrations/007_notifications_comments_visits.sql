-- Migration 007: Add notifications, player comments, and visit tracking

-- Notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  type VARCHAR(50) NOT NULL, -- 'assignment', 'comment', 'visit', etc.
  title VARCHAR(255) NOT NULL,
  message TEXT,
  related_player_id INTEGER REFERENCES players(id) ON DELETE CASCADE,
  related_assignment_id INTEGER REFERENCES scout_assignments(id) ON DELETE CASCADE,
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, read);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at);

-- Player comments table (shared notes visible to all scouts)
CREATE TABLE IF NOT EXISTS player_comments (
  id SERIAL PRIMARY KEY,
  player_id INTEGER REFERENCES players(id) ON DELETE CASCADE NOT NULL,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  comment TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_player_comments_player ON player_comments(player_id);
CREATE INDEX IF NOT EXISTS idx_player_comments_created ON player_comments(created_at);

-- Visits table
CREATE TABLE IF NOT EXISTS player_visits (
  id SERIAL PRIMARY KEY,
  player_id INTEGER REFERENCES players(id) ON DELETE CASCADE NOT NULL,
  visit_date DATE NOT NULL,
  visit_type VARCHAR(50), -- 'Official', 'Unofficial', 'Gameday', etc.
  location VARCHAR(255), -- 'BYU', 'Other School', etc.
  notes TEXT,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_player_visits_player ON player_visits(player_id);
CREATE INDEX IF NOT EXISTS idx_player_visits_date ON player_visits(visit_date);

-- Composite rating history table (for trends)
CREATE TABLE IF NOT EXISTS composite_rating_history (
  id SERIAL PRIMARY KEY,
  player_id INTEGER REFERENCES players(id) ON DELETE CASCADE NOT NULL,
  rating DECIMAL(4,2) NOT NULL,
  recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  recorded_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_composite_rating_history_player ON composite_rating_history(player_id);
CREATE INDEX IF NOT EXISTS idx_composite_rating_history_date ON composite_rating_history(recorded_at);
