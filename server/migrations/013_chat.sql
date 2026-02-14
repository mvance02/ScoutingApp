-- Migration 013: Team Chat
-- Chat rooms and messaging system

-- Chat Rooms
CREATE TABLE IF NOT EXISTS chat_rooms (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255),
  room_type VARCHAR(50) NOT NULL, -- 'global', 'game', 'player', 'position_group'
  entity_id INTEGER, -- game_id, player_id, etc.
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (room_type, entity_id)
);

-- Chat Messages
CREATE TABLE IF NOT EXISTS chat_messages (
  id SERIAL PRIMARY KEY,
  room_id INTEGER REFERENCES chat_rooms(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  message TEXT NOT NULL,
  mentions INTEGER[], -- Array of mentioned user IDs
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Message Read Receipts
CREATE TABLE IF NOT EXISTS message_reads (
  id SERIAL PRIMARY KEY,
  message_id INTEGER REFERENCES chat_messages(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  read_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (message_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_messages_room ON chat_messages(room_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reads_message ON message_reads(message_id);
CREATE INDEX IF NOT EXISTS idx_reads_user ON message_reads(user_id);
