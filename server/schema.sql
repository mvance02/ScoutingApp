-- ScoutingApp PostgreSQL Schema
-- Run this in PgAdmin to create the database tables

-- Users table
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role VARCHAR(20) DEFAULT 'scout',
  reset_token VARCHAR(64),
  reset_token_expires TIMESTAMP,
  keyboard_shortcuts JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Players table
CREATE TABLE players (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  position VARCHAR(50),
  offense_position VARCHAR(50),
  defense_position VARCHAR(50),
  school VARCHAR(255),
  state VARCHAR(50),
  grad_year VARCHAR(10),
  notes TEXT,
  flagged BOOLEAN DEFAULT true,
  cut_up_completed BOOLEAN DEFAULT false,
  recruiting_statuses TEXT[],
  status_updated_at TIMESTAMP,
  status_notes TEXT,
  committed_school VARCHAR(255),
  committed_date DATE,
  composite_rating DECIMAL(4,2),
  profile_picture_url TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Games table
CREATE TABLE games (
  id SERIAL PRIMARY KEY,
  opponent VARCHAR(255),
  date DATE,
  location VARCHAR(255),
  competition_level VARCHAR(100),
  video_url TEXT,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Game-Player junction table
CREATE TABLE game_players (
  game_id INTEGER REFERENCES games(id) ON DELETE CASCADE,
  player_id INTEGER REFERENCES players(id) ON DELETE CASCADE,
  PRIMARY KEY (game_id, player_id)
);

-- Stats table
CREATE TABLE stats (
  id SERIAL PRIMARY KEY,
  game_id INTEGER REFERENCES games(id) ON DELETE CASCADE,
  player_id INTEGER REFERENCES players(id) ON DELETE CASCADE,
  stat_type VARCHAR(50) NOT NULL,
  value INTEGER DEFAULT 0,
  timestamp VARCHAR(20),
  period VARCHAR(20),
  note TEXT,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Game Player Grades table
CREATE TABLE game_player_grades (
  id SERIAL PRIMARY KEY,
  game_id INTEGER REFERENCES games(id) ON DELETE CASCADE,
  player_id INTEGER REFERENCES players(id) ON DELETE CASCADE,
  grade VARCHAR(10),
  notes TEXT,
  admin_notes TEXT,
  game_score VARCHAR(20),
  team_record VARCHAR(20),
  next_opponent VARCHAR(255),
  next_game_date VARCHAR(20),
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  verified BOOLEAN DEFAULT false,
  verified_by INTEGER REFERENCES users(id),
  verified_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (game_id, player_id)
);

-- Game Notes table
CREATE TABLE game_notes (
  id SERIAL PRIMARY KEY,
  game_id INTEGER REFERENCES games(id) ON DELETE CASCADE,
  timestamp VARCHAR(20),
  period VARCHAR(20),
  note TEXT NOT NULL,
  category VARCHAR(50) DEFAULT 'general',
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Recruits table
CREATE TABLE recruits (
  id SERIAL PRIMARY KEY,
  player_id INTEGER REFERENCES players(id) ON DELETE SET NULL,
  name VARCHAR(255) NOT NULL,
  school VARCHAR(255) NOT NULL,
  state VARCHAR(50),
  class_year VARCHAR(10),
  position VARCHAR(20),
  side_of_ball VARCHAR(20),
  status VARCHAR(30),
  committed_school VARCHAR(255),
  committed_date DATE,
  assigned_coach VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Recruit Weekly Reports table
CREATE TABLE recruit_weekly_reports (
  id SERIAL PRIMARY KEY,
  recruit_id INTEGER REFERENCES recruits(id) ON DELETE CASCADE,
  week_start_date DATE NOT NULL,
  week_end_date DATE NOT NULL,
  last_game_date DATE,
  last_game_opponent VARCHAR(255),
  last_game_score VARCHAR(50),
  last_game_result VARCHAR(10),
  next_game_date DATE,
  next_game_time VARCHAR(20),
  next_game_opponent VARCHAR(255),
  next_game_location VARCHAR(10),
  stats JSONB DEFAULT '{}'::jsonb,
  other_stats JSONB DEFAULT '[]'::jsonb,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (recruit_id, week_start_date)
);

-- Recruit Notes table
CREATE TABLE recruit_notes (
  id SERIAL PRIMARY KEY,
  recruit_id INTEGER REFERENCES recruits(id) ON DELETE CASCADE,
  week_start_date DATE NOT NULL,
  note_date DATE,
  source VARCHAR(50),
  link TEXT,
  summary TEXT,
  quote TEXT,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_stats_game_id ON stats(game_id);
CREATE INDEX idx_stats_player_id ON stats(player_id);
CREATE INDEX idx_stats_created_by ON stats(created_by);
CREATE INDEX idx_game_players_game ON game_players(game_id);
CREATE INDEX idx_game_players_player ON game_players(player_id);
CREATE INDEX idx_players_flagged ON players(flagged);
CREATE INDEX idx_game_grades_game ON game_player_grades(game_id);
CREATE INDEX idx_game_grades_player ON game_player_grades(player_id);
CREATE INDEX idx_game_notes_game ON game_notes(game_id);
CREATE INDEX idx_users_reset_token ON users(reset_token);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_recruits_position ON recruits(position);
CREATE INDEX idx_recruits_status ON recruits(status);
CREATE UNIQUE INDEX idx_recruits_player_id ON recruits(player_id) WHERE player_id IS NOT NULL;
CREATE INDEX idx_recruit_reports_week ON recruit_weekly_reports(week_start_date);
CREATE INDEX idx_recruit_notes_week ON recruit_notes(week_start_date);

-- Player Status History table
CREATE TABLE player_status_history (
  id SERIAL PRIMARY KEY,
  player_id INTEGER REFERENCES players(id) ON DELETE CASCADE,
  old_statuses TEXT[],
  new_statuses TEXT[],
  notes TEXT,
  changed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Scout Assignments table
CREATE TABLE scout_assignments (
  id SERIAL PRIMARY KEY,
  scout_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  player_id INTEGER REFERENCES players(id) ON DELETE CASCADE,
  position_group VARCHAR(50),
  notes TEXT,
  assigned_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Audit Log table
CREATE TABLE audit_log (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(50),
  entity_id INTEGER,
  details JSONB,
  ip_address VARCHAR(45),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Notifications table
CREATE TABLE notifications (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,
  title VARCHAR(255),
  message TEXT,
  link VARCHAR(500),
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Player Comments table
CREATE TABLE player_comments (
  id SERIAL PRIMARY KEY,
  player_id INTEGER REFERENCES players(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  comment TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Player Visits table
CREATE TABLE player_visits (
  id SERIAL PRIMARY KEY,
  player_id INTEGER REFERENCES players(id) ON DELETE CASCADE,
  visit_date DATE NOT NULL,
  visit_type VARCHAR(50),
  location VARCHAR(255),
  notes TEXT,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Composite Rating History table
CREATE TABLE composite_rating_history (
  id SERIAL PRIMARY KEY,
  player_id INTEGER REFERENCES players(id) ON DELETE CASCADE,
  old_rating DECIMAL(4,2),
  new_rating DECIMAL(4,2),
  changed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Activity Feed table
CREATE TABLE activity_feed (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(50),
  entity_id INTEGER,
  entity_name VARCHAR(255),
  details JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Comment Mentions table
CREATE TABLE comment_mentions (
  id SERIAL PRIMARY KEY,
  comment_id INTEGER REFERENCES player_comments(id) ON DELETE CASCADE,
  mentioned_user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Chat Rooms table
CREATE TABLE chat_rooms (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255),
  type VARCHAR(50) NOT NULL,
  entity_id INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Chat Messages table
CREATE TABLE chat_messages (
  id SERIAL PRIMARY KEY,
  room_id INTEGER REFERENCES chat_rooms(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Message Reads table
CREATE TABLE message_reads (
  id SERIAL PRIMARY KEY,
  room_id INTEGER REFERENCES chat_rooms(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  last_read_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (room_id, user_id)
);

-- Indexes for new tables
CREATE INDEX idx_player_status_history_player ON player_status_history(player_id);
CREATE INDEX idx_scout_assignments_scout ON scout_assignments(scout_id);
CREATE INDEX idx_scout_assignments_player ON scout_assignments(player_id);
CREATE INDEX idx_audit_log_user ON audit_log(user_id);
CREATE INDEX idx_audit_log_action ON audit_log(action);
CREATE INDEX idx_audit_log_created ON audit_log(created_at);
CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_read ON notifications(user_id, read);
CREATE INDEX idx_player_comments_player ON player_comments(player_id);
CREATE INDEX idx_player_visits_player ON player_visits(player_id);
CREATE INDEX idx_player_visits_date ON player_visits(visit_date);
CREATE INDEX idx_composite_rating_history_player ON composite_rating_history(player_id);
CREATE INDEX idx_activity_feed_user ON activity_feed(user_id);
CREATE INDEX idx_activity_feed_created ON activity_feed(created_at);
CREATE INDEX idx_comment_mentions_user ON comment_mentions(mentioned_user_id);
CREATE INDEX idx_chat_rooms_type ON chat_rooms(type);
CREATE INDEX idx_chat_messages_room ON chat_messages(room_id);
CREATE INDEX idx_chat_messages_created ON chat_messages(created_at);
CREATE INDEX idx_message_reads_room_user ON message_reads(room_id, user_id);