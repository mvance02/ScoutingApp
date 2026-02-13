import { Router } from 'express'
import pool from '../db.js'
import { requireAdmin } from '../middleware/auth.js'

const router = Router()

// GET audit log entries (admin only)
router.get('/', requireAdmin, async (req, res, next) => {
  try {
    const {
      user_id,
      action,
      table_name,
      start_date,
      end_date,
      page = 1,
      limit = 50,
    } = req.query

    const offset = (parseInt(page) - 1) * parseInt(limit)

    let query = `
      SELECT al.*,
        u.name as user_name
      FROM audit_log al
      LEFT JOIN users u ON u.id = al.user_id
      WHERE 1=1
    `
    let countQuery = 'SELECT COUNT(*) FROM audit_log al WHERE 1=1'
    const params = []
    const countParams = []
    let paramIndex = 1
    let countParamIndex = 1

    // Filter by user
    if (user_id) {
      query += ` AND al.user_id = $${paramIndex}`
      countQuery += ` AND al.user_id = $${countParamIndex}`
      params.push(parseInt(user_id))
      countParams.push(parseInt(user_id))
      paramIndex++
      countParamIndex++
    }

    // Filter by action type
    if (action) {
      query += ` AND al.action = $${paramIndex}`
      countQuery += ` AND al.action = $${countParamIndex}`
      params.push(action)
      countParams.push(action)
      paramIndex++
      countParamIndex++
    }

    // Filter by table name
    if (table_name) {
      query += ` AND al.table_name = $${paramIndex}`
      countQuery += ` AND al.table_name = $${countParamIndex}`
      params.push(table_name)
      countParams.push(table_name)
      paramIndex++
      countParamIndex++
    }

    // Filter by date range
    if (start_date) {
      query += ` AND al.created_at >= $${paramIndex}`
      countQuery += ` AND al.created_at >= $${countParamIndex}`
      params.push(start_date)
      countParams.push(start_date)
      paramIndex++
      countParamIndex++
    }

    if (end_date) {
      query += ` AND al.created_at <= $${paramIndex}`
      countQuery += ` AND al.created_at <= $${countParamIndex}`
      params.push(end_date)
      countParams.push(end_date)
      paramIndex++
      countParamIndex++
    }

    // Add ordering and pagination
    query += ` ORDER BY al.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`
    params.push(parseInt(limit), offset)

    // Execute queries
    const [result, countResult] = await Promise.all([
      pool.query(query, params),
      pool.query(countQuery, countParams),
    ])

    const total = parseInt(countResult.rows[0].count)
    const totalPages = Math.ceil(total / parseInt(limit))

    res.json({
      entries: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages,
      },
    })
  } catch (err) {
    next(err)
  }
})

// GET list of distinct actions (for filter dropdown)
router.get('/actions', requireAdmin, async (req, res, next) => {
  try {
    const result = await pool.query('SELECT DISTINCT action FROM audit_log ORDER BY action')
    res.json(result.rows.map(row => row.action))
  } catch (err) {
    next(err)
  }
})

// GET list of distinct table names (for filter dropdown)
router.get('/tables', requireAdmin, async (req, res, next) => {
  try {
    const result = await pool.query('SELECT DISTINCT table_name FROM audit_log ORDER BY table_name')
    res.json(result.rows.map(row => row.table_name))
  } catch (err) {
    next(err)
  }
})

export default router
