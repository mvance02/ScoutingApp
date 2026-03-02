import { Router } from 'express'
import pool from '../db.js'

const router = Router()

// GET /api/recruiting-goals — return current user's recruiting goals
router.get('/', async (req, res, next) => {
  try {
    const result = await pool.query(
      'SELECT recruiting_goals FROM users WHERE id = $1',
      [req.user.id]
    )
    const row = result.rows[0]
    res.json(row?.recruiting_goals || {})
  } catch (err) {
    next(err)
  }
})

// PUT /api/recruiting-goals — save recruiting goals
router.put('/', async (req, res, next) => {
  try {
    const goals = req.body
    if (!goals || typeof goals !== 'object' || Array.isArray(goals)) {
      return res.status(400).json({ error: 'Goals object is required' })
    }
    await pool.query(
      'UPDATE users SET recruiting_goals = $1 WHERE id = $2',
      [JSON.stringify(goals), req.user.id]
    )
    res.json(goals)
  } catch (err) {
    next(err)
  }
})

export default router
