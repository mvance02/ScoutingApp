import { Router } from 'express'
import pool from '../db.js'
import { requireAdmin } from '../middleware/auth.js'
import { logAudit, getClientIp } from '../middleware/audit.js'

const router = Router()

// GET all assignments with optional filters
router.get('/', async (req, res, next) => {
  try {
    const { scout_id, player_id, game_id, position_group, my_assignments } = req.query

    let query = `
      SELECT sa.*,
        u.name as scout_name,
        u.email as scout_email,
        p.name as player_name,
        g.opponent as game_opponent,
        g.date as game_date,
        ab.name as assigned_by_name
      FROM scout_assignments sa
      LEFT JOIN users u ON u.id = sa.scout_id
      LEFT JOIN players p ON p.id = sa.player_id
      LEFT JOIN games g ON g.id = sa.game_id
      LEFT JOIN users ab ON ab.id = sa.assigned_by
      WHERE 1=1
    `
    const params = []
    let paramIndex = 1

    // Filter by specific scout
    if (scout_id) {
      query += ` AND sa.scout_id = $${paramIndex}`
      params.push(parseInt(scout_id))
      paramIndex++
    }

    // Filter to current user's assignments
    if (my_assignments === 'true') {
      query += ` AND sa.scout_id = $${paramIndex}`
      params.push(req.user.id)
      paramIndex++
    }

    // Filter by player
    if (player_id) {
      query += ` AND sa.player_id = $${paramIndex}`
      params.push(parseInt(player_id))
      paramIndex++
    }

    // Filter by game
    if (game_id) {
      query += ` AND sa.game_id = $${paramIndex}`
      params.push(parseInt(game_id))
      paramIndex++
    }

    // Filter by position group
    if (position_group) {
      query += ` AND sa.position_group = $${paramIndex}`
      params.push(position_group)
      paramIndex++
    }

    query += ' ORDER BY sa.assigned_at DESC'

    const result = await pool.query(query, params)
    res.json(result.rows)
  } catch (err) {
    next(err)
  }
})

// POST create assignment (admin only)
router.post('/', requireAdmin, async (req, res, next) => {
  try {
    const { scout_id, player_id, game_id, position_group, notes } = req.body

    // Validate that at least one target is provided
    if (!player_id && !game_id && !position_group) {
      return res.status(400).json({ error: 'Assignment must have a player_id, game_id, or position_group' })
    }
    
    // Only allow one type of assignment at a time
    const assignmentCount = [player_id, game_id, position_group].filter(Boolean).length
    if (assignmentCount > 1) {
      return res.status(400).json({ error: 'Assignment can only have one target type (player, game, or position group)' })
    }

    // Validate scout exists
    const scoutCheck = await pool.query('SELECT id, name, email FROM users WHERE id = $1', [scout_id])
    if (scoutCheck.rows.length === 0) {
      return res.status(400).json({ error: 'Scout not found' })
    }

    // Check for duplicate player assignment
    if (player_id) {
      const duplicateCheck = await pool.query(
        'SELECT id FROM scout_assignments WHERE scout_id = $1 AND player_id = $2',
        [scout_id, player_id]
      )
      if (duplicateCheck.rows.length > 0) {
        return res.status(400).json({ error: 'Scout is already assigned to this player' })
      }
    }

    // Check for duplicate game assignment
    if (game_id) {
      const duplicateCheck = await pool.query(
        'SELECT id FROM scout_assignments WHERE scout_id = $1 AND game_id = $2',
        [scout_id, game_id]
      )
      if (duplicateCheck.rows.length > 0) {
        return res.status(400).json({ error: 'Scout is already assigned to this game' })
      }
    }

    // Check for duplicate position group assignment
    if (position_group) {
      const duplicateCheck = await pool.query(
        'SELECT id FROM scout_assignments WHERE scout_id = $1 AND position_group = $2',
        [scout_id, position_group]
      )
      if (duplicateCheck.rows.length > 0) {
        return res.status(400).json({ error: 'Scout is already assigned to this position group' })
      }
    }

    const result = await pool.query(
      `INSERT INTO scout_assignments (scout_id, player_id, game_id, position_group, assigned_by, notes)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [scout_id, player_id || null, game_id || null, position_group || null, req.user.id, notes || null]
    )

    const newAssignment = result.rows[0]

    // Log audit
    await logAudit({
      userId: req.user?.id,
      userEmail: req.user?.email,
      action: 'CREATE',
      tableName: 'scout_assignments',
      recordId: newAssignment.id,
      newValues: newAssignment,
      ipAddress: getClientIp(req),
    })

    // Create notification for the assigned scout
    let notificationTitle = 'New Assignment'
    let notificationMessage = 'You have been assigned a new task.'
    
    if (player_id) {
      const playerResult = await pool.query('SELECT name FROM players WHERE id = $1', [player_id])
      if (playerResult.rows.length > 0) {
        notificationTitle = 'New Player Assignment'
        notificationMessage = `You have been assigned to scout ${playerResult.rows[0].name}.`
      }
    } else if (game_id) {
      const gameResult = await pool.query('SELECT opponent FROM games WHERE id = $1', [game_id])
      if (gameResult.rows.length > 0) {
        notificationTitle = 'New Game Assignment'
        notificationMessage = `You have been assigned to scout the game vs ${gameResult.rows[0].opponent}.`
      }
    } else if (position_group) {
      notificationTitle = 'New Position Group Assignment'
      notificationMessage = `You have been assigned to scout the ${position_group} position group.`
    }

    await pool.query(
      `INSERT INTO notifications (user_id, type, title, message, related_player_id, related_assignment_id)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [scout_id, 'assignment', notificationTitle, notificationMessage, player_id || null, newAssignment.id]
    )

    // Fetch full assignment data for response
    const fullResult = await pool.query(
      `SELECT sa.*,
        u.name as scout_name,
        u.email as scout_email,
        p.name as player_name,
        g.opponent as game_opponent,
        g.date as game_date,
        ab.name as assigned_by_name
      FROM scout_assignments sa
      LEFT JOIN users u ON u.id = sa.scout_id
      LEFT JOIN players p ON p.id = sa.player_id
      LEFT JOIN games g ON g.id = sa.game_id
      LEFT JOIN users ab ON ab.id = sa.assigned_by
      WHERE sa.id = $1`,
      [newAssignment.id]
    )

    res.status(201).json(fullResult.rows[0])
  } catch (err) {
    next(err)
  }
})

// DELETE assignment (admin only)
router.delete('/:id', requireAdmin, async (req, res, next) => {
  try {
    const { id } = req.params

    // Get current assignment for audit
    const currentResult = await pool.query('SELECT * FROM scout_assignments WHERE id = $1', [id])
    if (currentResult.rows.length === 0) {
      return res.status(404).json({ error: 'Assignment not found' })
    }
    const currentAssignment = currentResult.rows[0]

    await pool.query('DELETE FROM scout_assignments WHERE id = $1', [id])

    // Log audit
    await logAudit({
      userId: req.user?.id,
      userEmail: req.user?.email,
      action: 'DELETE',
      tableName: 'scout_assignments',
      recordId: parseInt(id),
      oldValues: currentAssignment,
      ipAddress: getClientIp(req),
    })

    res.json({ message: 'Assignment removed', assignment: currentAssignment })
  } catch (err) {
    next(err)
  }
})

export default router
