-- Add verification tracking to game_player_grades for Saturday morning review workflow
ALTER TABLE game_player_grades ADD COLUMN IF NOT EXISTS verified BOOLEAN DEFAULT false;
ALTER TABLE game_player_grades ADD COLUMN IF NOT EXISTS verified_by INTEGER REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE game_player_grades ADD COLUMN IF NOT EXISTS verified_at TIMESTAMP;
