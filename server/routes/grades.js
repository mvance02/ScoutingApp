import { Router } from 'express'
import pool from '../db.js'
import { validate, upsertGradeSchema } from '../middleware/validate.js'

const router = Router()

// GET grades for a game
router.get('/:gameId', async (req, res, next) => {
  try {
    const { gameId } = req.params
    const result = await pool.query(
      `SELECT g.*, p.name as player_name, u.name as graded_by_name
       FROM game_player_grades g
       LEFT JOIN players p ON g.player_id = p.id
       LEFT JOIN users u ON g.created_by = u.id
       WHERE g.game_id = $1
       ORDER BY p.name`,
      [gameId]
    )
    res.json(result.rows)
  } catch (err) {
    next(err)
  }
})

// GET verification progress for a game
router.get('/:gameId/progress', async (req, res, next) => {
  try {
    const { gameId } = req.params
    const result = await pool.query(
      `SELECT
         COUNT(*)::int as total,
         COUNT(*) FILTER (WHERE g.verified = true)::int as verified
       FROM game_players gp
       LEFT JOIN game_player_grades g ON g.game_id = gp.game_id AND g.player_id = gp.player_id
       WHERE gp.game_id = $1`,
      [gameId]
    )
    const row = result.rows[0] || { total: 0, verified: 0 }
    res.json({ total: row.total, verified: row.verified, unverified: row.total - row.verified })
  } catch (err) {
    next(err)
  }
})

// PUT upsert grade for a player in a game
router.put('/:gameId/:playerId', validate(upsertGradeSchema), async (req, res, next) => {
  try {
    const { gameId, playerId } = req.params
    const { grade, notes, admin_notes, game_score, team_record, next_opponent, next_game_date, verified, verified_by, verified_at } = req.body
    const userId = req.user?.id
    const isAdmin = req.user?.role === 'admin'

    // Only admins can update admin_notes
    if (admin_notes !== undefined && !isAdmin) {
      return res.status(403).json({ error: 'Only admins can update admin notes' })
    }

    // Build dynamic query based on what's being updated
    let query, params

    if (admin_notes !== undefined && isAdmin) {
      query = `INSERT INTO game_player_grades (game_id, player_id, grade, notes, admin_notes, game_score, team_record, next_opponent, next_game_date, verified, verified_by, verified_at, created_by, updated_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, COALESCE($10, false), $11, $12, $13, NOW())
               ON CONFLICT (game_id, player_id)
               DO UPDATE SET grade = COALESCE($3, game_player_grades.grade),
                             notes = COALESCE($4, game_player_grades.notes),
                             admin_notes = $5,
                             game_score = COALESCE($6, game_player_grades.game_score),
                             team_record = COALESCE($7, game_player_grades.team_record),
                             next_opponent = COALESCE($8, game_player_grades.next_opponent),
                             next_game_date = COALESCE($9, game_player_grades.next_game_date),
                             verified = COALESCE($10, game_player_grades.verified),
                             verified_by = CASE WHEN $10 IS NOT NULL THEN $11 ELSE game_player_grades.verified_by END,
                             verified_at = CASE WHEN $10 IS NOT NULL THEN $12 ELSE game_player_grades.verified_at END,
                             created_by = $13,
                             updated_at = NOW()
               RETURNING *`
      params = [gameId, playerId, grade, notes, admin_notes, game_score, team_record, next_opponent, next_game_date, verified ?? null, verified_by ?? null, verified_at ?? null, userId]
    } else {
      query = `INSERT INTO game_player_grades (game_id, player_id, grade, notes, game_score, team_record, next_opponent, next_game_date, verified, verified_by, verified_at, created_by, updated_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, COALESCE($9, false), $10, $11, $12, NOW())
               ON CONFLICT (game_id, player_id)
               DO UPDATE SET grade = COALESCE($3, game_player_grades.grade),
                             notes = COALESCE($4, game_player_grades.notes),
                             game_score = COALESCE($5, game_player_grades.game_score),
                             team_record = COALESCE($6, game_player_grades.team_record),
                             next_opponent = COALESCE($7, game_player_grades.next_opponent),
                             next_game_date = COALESCE($8, game_player_grades.next_game_date),
                             verified = COALESCE($9, game_player_grades.verified),
                             verified_by = CASE WHEN $9 IS NOT NULL THEN $10 ELSE game_player_grades.verified_by END,
                             verified_at = CASE WHEN $9 IS NOT NULL THEN $11 ELSE game_player_grades.verified_at END,
                             created_by = $12,
                             updated_at = NOW()
               RETURNING *`
      params = [gameId, playerId, grade, notes, game_score, team_record, next_opponent, next_game_date, verified ?? null, verified_by ?? null, verified_at ?? null, userId]
    }

    const result = await pool.query(query, params)
    res.json(result.rows[0])
  } catch (err) {
    next(err)
  }
})

// DELETE grade (only owner or admin can delete)
router.delete('/:gameId/:playerId', async (req, res, next) => {
  try {
    const { gameId, playerId } = req.params
    const userId = req.user?.id
    const isAdmin = req.user?.role === 'admin'

    // Check ownership first
    const existing = await pool.query(
      'SELECT created_by FROM game_player_grades WHERE game_id = $1 AND player_id = $2',
      [gameId, playerId]
    )

    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Grade not found' })
    }

    if (!isAdmin && existing.rows[0].created_by !== userId) {
      return res.status(403).json({ error: 'You can only delete your own grades' })
    }

    await pool.query(
      'DELETE FROM game_player_grades WHERE game_id = $1 AND player_id = $2',
      [gameId, playerId]
    )
    res.json({ message: 'Grade deleted' })
  } catch (err) {
    next(err)
  }
})

export default router
