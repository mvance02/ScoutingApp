-- Update test players and grades with placeholder values.
-- Replace the values below if you want specific score/opponent/date.

-- Update player state when missing
UPDATE players
SET state = 'UT'
WHERE state IS NULL OR state = '';

-- Find the most recent game id
WITH latest_game AS (
  SELECT id
  FROM games
  ORDER BY created_at DESC
  LIMIT 1
)
UPDATE game_player_grades
SET game_score = COALESCE(NULLIF(game_score, ''), '0-0'),
    team_record = COALESCE(NULLIF(team_record, ''), '0-0'),
    next_opponent = COALESCE(NULLIF(next_opponent, ''), 'TBD'),
    next_game_date = COALESCE(NULLIF(next_game_date, ''), '2024-09-28')
WHERE game_id = (SELECT id FROM latest_game);
