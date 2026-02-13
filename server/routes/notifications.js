import { Router } from 'express'
import pool from '../db.js'
import { logAudit, getClientIp } from '../middleware/audit.js'

const router = Router()

// GET all notifications for current user
router.get('/', async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT * FROM notifications 
       WHERE user_id = $1 
       ORDER BY created_at DESC 
       LIMIT 100`,
      [req.user.id]
    )
    res.json(result.rows)
  } catch (err) {
    next(err)
  }
})

// GET unread count
router.get('/unread-count', async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT COUNT(*)::int as count FROM notifications 
       WHERE user_id = $1 AND read = false`,
      [req.user.id]
    )
    res.json({ count: result.rows[0].count })
  } catch (err) {
    next(err)
  }
})

// PUT mark notification as read
router.put('/:id/read', async (req, res, next) => {
  try {
    const { id } = req.params
    const result = await pool.query(
      `UPDATE notifications SET read = true 
       WHERE id = $1 AND user_id = $2 
       RETURNING *`,
      [id, req.user.id]
    )
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Notification not found' })
    }
    res.json(result.rows[0])
  } catch (err) {
    next(err)
  }
})

// PUT mark all as read
router.put('/mark-all-read', async (req, res, next) => {
  try {
    await pool.query(
      `UPDATE notifications SET read = true 
       WHERE user_id = $1 AND read = false`,
      [req.user.id]
    )
    res.json({ message: 'All notifications marked as read' })
  } catch (err) {
    next(err)
  }
})

// DELETE notification
router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params
    const result = await pool.query(
      `DELETE FROM notifications 
       WHERE id = $1 AND user_id = $2 
       RETURNING *`,
      [id, req.user.id]
    )
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Notification not found' })
    }
    res.json({ message: 'Notification deleted', notification: result.rows[0] })
  } catch (err) {
    next(err)
  }
})

export default router
