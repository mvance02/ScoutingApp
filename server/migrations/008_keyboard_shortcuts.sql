-- Add customizable keyboard shortcuts per user
ALTER TABLE users ADD COLUMN IF NOT EXISTS keyboard_shortcuts JSONB;
