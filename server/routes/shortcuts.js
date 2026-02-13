import { Router } from 'express'
import pool from '../db.js'

const router = Router()

// GET /api/shortcuts — return current user's keyboard shortcuts
router.get('/', async (req, res, next) => {
  try {
    const result = await pool.query(
      'SELECT keyboard_shortcuts FROM users WHERE id = $1',
      [req.user.id]
    )
    const row = result.rows[0]
    res.json(row?.keyboard_shortcuts || null)
  } catch (err) {
    next(err)
  }
})

// PUT /api/shortcuts — save keyboard shortcuts
router.put('/', async (req, res, next) => {
  try {
    const { shortcuts, combo_shortcuts } = req.body
    if (!shortcuts || typeof shortcuts !== 'object') {
      return res.status(400).json({ error: 'shortcuts object is required' })
    }
    const data = { shortcuts, combo_shortcuts: combo_shortcuts || {} }
    await pool.query(
      'UPDATE users SET keyboard_shortcuts = $1 WHERE id = $2',
      [JSON.stringify(data), req.user.id]
    )
    res.json(data)
  } catch (err) {
    next(err)
  }
})

// POST /api/shortcuts/reset — reset to defaults (set column to null)
router.post('/reset', async (req, res, next) => {
  try {
    await pool.query(
      'UPDATE users SET keyboard_shortcuts = NULL WHERE id = $1',
      [req.user.id]
    )
    res.json({ message: 'Shortcuts reset to defaults' })
  } catch (err) {
    next(err)
  }
})

export default router
