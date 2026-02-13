import { Router } from 'express'
import pool from '../db.js'
import { validate, createNoteSchema, updateNoteSchema } from '../middleware/validate.js'

const router = Router()

// GET notes for a game
router.get('/:gameId', async (req, res, next) => {
  try {
    const { gameId } = req.params
    const result = await pool.query(
      `SELECT n.*, u.name as author_name
       FROM game_notes n
       LEFT JOIN users u ON n.created_by = u.id
       WHERE n.game_id = $1
       ORDER BY n.created_at DESC`,
      [gameId]
    )
    res.json(result.rows)
  } catch (err) {
    next(err)
  }
})

// POST create note
router.post('/', validate(createNoteSchema), async (req, res, next) => {
  try {
    const { game_id, timestamp, period, note, category } = req.body
    const userId = req.user?.id

    const result = await pool.query(
      `INSERT INTO game_notes (game_id, timestamp, period, note, category, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [game_id, timestamp, period, note, category, userId]
    )

    // Get with author name
    const noteWithAuthor = await pool.query(
      `SELECT n.*, u.name as author_name
       FROM game_notes n
       LEFT JOIN users u ON n.created_by = u.id
       WHERE n.id = $1`,
      [result.rows[0].id]
    )
    res.status(201).json(noteWithAuthor.rows[0])
  } catch (err) {
    next(err)
  }
})

// PUT update note (only owner or admin can update)
router.put('/:id', validate(updateNoteSchema), async (req, res, next) => {
  try {
    const { id } = req.params
    const { timestamp, period, note, category } = req.body
    const userId = req.user?.id
    const isAdmin = req.user?.role === 'admin'

    // Check ownership first
    const existing = await pool.query('SELECT created_by FROM game_notes WHERE id = $1', [id])
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Note not found' })
    }

    if (!isAdmin && existing.rows[0].created_by !== userId) {
      return res.status(403).json({ error: 'You can only edit your own notes' })
    }

    const result = await pool.query(
      `UPDATE game_notes
       SET timestamp = COALESCE($1, timestamp),
           period = COALESCE($2, period),
           note = COALESCE($3, note),
           category = COALESCE($4, category)
       WHERE id = $5
       RETURNING *`,
      [timestamp, period, note, category, id]
    )

    res.json(result.rows[0])
  } catch (err) {
    next(err)
  }
})

// DELETE note (only owner or admin can delete)
router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params
    const userId = req.user?.id
    const isAdmin = req.user?.role === 'admin'

    // Check ownership first
    const existing = await pool.query('SELECT created_by FROM game_notes WHERE id = $1', [id])
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Note not found' })
    }

    if (!isAdmin && existing.rows[0].created_by !== userId) {
      return res.status(403).json({ error: 'You can only delete your own notes' })
    }

    await pool.query('DELETE FROM game_notes WHERE id = $1', [id])
    res.json({ message: 'Note deleted' })
  } catch (err) {
    next(err)
  }
})

export default router
