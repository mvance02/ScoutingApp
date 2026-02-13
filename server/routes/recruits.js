import { Router } from 'express'
import pool from '../db.js'
import { logAudit, getClientIp } from '../middleware/audit.js'

const router = Router()

// GET all recruits
router.get('/', async (req, res, next) => {
  try {
    const result = await pool.query('SELECT * FROM recruits ORDER BY created_at DESC')
    res.json(result.rows)
  } catch (err) {
    next(err)
  }
})

// POST create recruit
router.post('/', async (req, res, next) => {
  try {
    const {
      player_id,
      name,
      school,
      state,
      class_year,
      position,
      side_of_ball,
      status,
      committed_school,
      committed_date,
      assigned_coach,
    } = req.body

    const result = await pool.query(
      `INSERT INTO recruits (player_id, name, school, state, class_year, position, side_of_ball, status, committed_school, committed_date, assigned_coach)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       RETURNING *`,
      [player_id || null, name, school, state, class_year, position, side_of_ball, status, committed_school, committed_date, assigned_coach]
    )
    const recruit = result.rows[0]

    await logAudit({
      userId: req.user?.id,
      userEmail: req.user?.email,
      action: 'CREATE',
      tableName: 'recruits',
      recordId: recruit.id,
      newValues: recruit,
      ipAddress: getClientIp(req),
    })

    res.status(201).json(recruit)
  } catch (err) {
    next(err)
  }
})

// PUT update recruit
router.put('/:id', async (req, res, next) => {
  try {
    const { id } = req.params
    const {
      player_id,
      name,
      school,
      state,
      class_year,
      position,
      side_of_ball,
      status,
      committed_school,
      committed_date,
      assigned_coach,
    } = req.body

    const existing = await pool.query('SELECT * FROM recruits WHERE id = $1', [id])
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Recruit not found' })
    }

    const result = await pool.query(
      `UPDATE recruits
       SET player_id = COALESCE($1, player_id),
           name = COALESCE($2, name),
           school = COALESCE($3, school),
           state = COALESCE($4, state),
           class_year = COALESCE($5, class_year),
           position = COALESCE($6, position),
           side_of_ball = COALESCE($7, side_of_ball),
           status = COALESCE($8, status),
           committed_school = COALESCE($9, committed_school),
           committed_date = COALESCE($10, committed_date),
           assigned_coach = COALESCE($11, assigned_coach),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $12
       RETURNING *`,
      [player_id || null, name, school, state, class_year, position, side_of_ball, status, committed_school, committed_date, assigned_coach, id]
    )
    const updated = result.rows[0]

    await logAudit({
      userId: req.user?.id,
      userEmail: req.user?.email,
      action: 'UPDATE',
      tableName: 'recruits',
      recordId: updated.id,
      oldValues: existing.rows[0],
      newValues: updated,
      ipAddress: getClientIp(req),
    })

    res.json(updated)
  } catch (err) {
    next(err)
  }
})

export default router
