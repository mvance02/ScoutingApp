import { Router } from 'express'
import pool from '../db.js'
import { logAudit, getClientIp } from '../middleware/audit.js'

const router = Router()

// GET all visits for a player
router.get('/player/:playerId', async (req, res, next) => {
  try {
    const { playerId } = req.params
    const result = await pool.query(
      `SELECT pv.*, u.name as created_by_name
       FROM player_visits pv
       LEFT JOIN users u ON u.id = pv.created_by
       WHERE pv.player_id = $1
       ORDER BY pv.visit_date DESC`,
      [playerId]
    )
    res.json(result.rows)
  } catch (err) {
    next(err)
  }
})

// GET upcoming visits
router.get('/upcoming', async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT pv.*, p.name as player_name, p.school, u.name as created_by_name
       FROM player_visits pv
       JOIN players p ON p.id = pv.player_id
       LEFT JOIN users u ON u.id = pv.created_by
       WHERE pv.visit_date >= CURRENT_DATE
       ORDER BY pv.visit_date ASC
       LIMIT 50`,
      []
    )
    res.json(result.rows)
  } catch (err) {
    next(err)
  }
})

// POST create a visit
router.post('/', async (req, res, next) => {
  try {
    const { player_id, visit_date, visit_type, location, notes } = req.body
    if (!player_id || !visit_date) {
      return res.status(400).json({ error: 'player_id and visit_date are required' })
    }

    const result = await pool.query(
      `INSERT INTO player_visits (player_id, visit_date, visit_type, location, notes, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [player_id, visit_date, visit_type || null, location || null, notes || null, req.user.id]
    )

    logAudit({
      userId: req.user.id,
      userEmail: req.user.email,
      action: 'CREATE',
      tableName: 'player_visits',
      recordId: result.rows[0].id,
      newValues: result.rows[0],
      ipAddress: getClientIp(req),
    })

    res.status(201).json(result.rows[0])
  } catch (err) {
    next(err)
  }
})

// PUT update a visit
router.put('/:id', async (req, res, next) => {
  try {
    const { id } = req.params
    const { visit_date, visit_type, location, notes } = req.body

    const oldResult = await pool.query(
      `SELECT * FROM player_visits WHERE id = $1`,
      [id]
    )
    if (oldResult.rows.length === 0) {
      return res.status(404).json({ error: 'Visit not found' })
    }

    const result = await pool.query(
      `UPDATE player_visits 
       SET visit_date = COALESCE($1, visit_date),
           visit_type = COALESCE($2, visit_type),
           location = COALESCE($3, location),
           notes = COALESCE($4, notes),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $5
       RETURNING *`,
      [visit_date, visit_type, location, notes, id]
    )

    logAudit({
      userId: req.user.id,
      userEmail: req.user.email,
      action: 'UPDATE',
      tableName: 'player_visits',
      recordId: id,
      oldValues: oldResult.rows[0],
      newValues: result.rows[0],
      ipAddress: getClientIp(req),
    })

    res.json(result.rows[0])
  } catch (err) {
    next(err)
  }
})

// DELETE a visit
router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params
    const oldResult = await pool.query(
      `SELECT * FROM player_visits WHERE id = $1`,
      [id]
    )
    if (oldResult.rows.length === 0) {
      return res.status(404).json({ error: 'Visit not found' })
    }

    const result = await pool.query(
      `DELETE FROM player_visits WHERE id = $1 RETURNING *`,
      [id]
    )

    logAudit({
      userId: req.user.id,
      userEmail: req.user.email,
      action: 'DELETE',
      tableName: 'player_visits',
      recordId: id,
      oldValues: oldResult.rows[0],
      ipAddress: getClientIp(req),
    })

    res.json({ message: 'Visit deleted', visit: result.rows[0] })
  } catch (err) {
    next(err)
  }
})

export default router
