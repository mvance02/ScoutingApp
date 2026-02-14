import { Router } from 'express'
import pool from '../db.js'

const router = Router()

// GET recent activity feed
router.get('/', async (req, res, next) => {
  try {
    const { limit = 50, offset = 0, entity_type, user_id, action_type } = req.query
    
    let query = `
      SELECT af.*, u.name as user_name, u.email as user_email
      FROM activity_feed af
      LEFT JOIN users u ON u.id = af.user_id
      WHERE 1=1
    `
    const params = []
    let paramIndex = 1
    
    if (entity_type) {
      query += ` AND af.entity_type = $${paramIndex}`
      params.push(entity_type)
      paramIndex++
    }
    
    if (user_id) {
      query += ` AND af.user_id = $${paramIndex}`
      params.push(user_id)
      paramIndex++
    }
    
    if (action_type) {
      query += ` AND af.action_type = $${paramIndex}`
      params.push(action_type)
      paramIndex++
    }
    
    query += ` ORDER BY af.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`
    params.push(parseInt(limit), parseInt(offset))
    
    const result = await pool.query(query, params)
    res.json(result.rows)
  } catch (err) {
    next(err)
  }
})

// GET activity count
router.get('/count', async (req, res, next) => {
  try {
    const result = await pool.query('SELECT COUNT(*) as count FROM activity_feed')
    res.json({ count: parseInt(result.rows[0].count) })
  } catch (err) {
    next(err)
  }
})

export default router
