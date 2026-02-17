import { Router } from 'express'
import pool from '../db.js'
import { validate, createStatSchema, updateStatSchema } from '../middleware/validate.js'
import { logActivity } from '../utils/activityLogger.js'

const router = Router()

// GET season averages for players in a game (excluding this game's stats)
router.get('/averages/:gameId', async (req, res, next) => {
  try {
    const { gameId } = req.params

    // Get all players in this game
    const playersResult = await pool.query(
      'SELECT player_id FROM game_players WHERE game_id = $1',
      [gameId]
    )
    const playerIds = playersResult.rows.map((r) => r.player_id)
    if (playerIds.length === 0) return res.json({})

    // Get stats for these players across all OTHER games
    const result = await pool.query(
      `SELECT player_id, stat_type,
              AVG(value)::float as avg,
              COUNT(*)::int as count,
              STDDEV_POP(value)::float as stddev
       FROM stats
       WHERE player_id = ANY($1) AND game_id != $2
       GROUP BY player_id, stat_type
       HAVING COUNT(*) >= 2`,
      [playerIds, gameId]
    )

    // Build nested object: { playerId: { statType: { avg, count, stddev } } }
    const averages = {}
    result.rows.forEach((row) => {
      if (!averages[row.player_id]) averages[row.player_id] = {}
      averages[row.player_id][row.stat_type] = {
        avg: Math.round(row.avg * 10) / 10,
        count: row.count,
        stddev: Math.round((row.stddev || 0) * 10) / 10,
      }
    })

    res.json(averages)
  } catch (err) {
    next(err)
  }
})

// GET stats for a game
router.get('/:gameId', async (req, res, next) => {
  try {
    const { gameId } = req.params
    const result = await pool.query(
      `SELECT s.*, p.name as player_name, p.position as player_position,
              u.name as created_by_name
       FROM stats s
       LEFT JOIN players p ON s.player_id = p.id
       LEFT JOIN users u ON s.created_by = u.id
       WHERE s.game_id = $1
       ORDER BY s.created_at DESC`,
      [gameId]
    )
    res.json(result.rows)
  } catch (err) {
    next(err)
  }
})

// GET all stats (for aggregation)
router.get('/', async (req, res, next) => {
  try {
    const { player_id } = req.query

    let query = `
      SELECT s.*, p.name as player_name, p.position as player_position,
             g.opponent, g.date as game_date, u.name as created_by_name
      FROM stats s
      LEFT JOIN players p ON s.player_id = p.id
      LEFT JOIN games g ON s.game_id = g.id
      LEFT JOIN users u ON s.created_by = u.id
    `
    const params = []

    if (player_id) {
      query += ' WHERE s.player_id = $1'
      params.push(player_id)
    }

    query += ' ORDER BY g.date DESC, s.created_at ASC'

    const result = await pool.query(query, params)
    res.json(result.rows)
  } catch (err) {
    next(err)
  }
})

// POST create stat entry
router.post('/', validate(createStatSchema), async (req, res, next) => {
  try {
    const {
      game_id,
      player_id,
      stat_type,
      value = 0,
      timestamp,
      period,
      note,
    } = req.body
    const userId = req.user?.id

    const result = await pool.query(
      `INSERT INTO stats (game_id, player_id, stat_type, value, timestamp, period, note, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [game_id, player_id, stat_type, value, timestamp, period, note, userId]
    )

    // Get player info for the response
    const statWithPlayer = await pool.query(
      `SELECT s.*, p.name as player_name, p.position as player_position,
              u.name as created_by_name
       FROM stats s
       LEFT JOIN players p ON s.player_id = p.id
       LEFT JOIN users u ON s.created_by = u.id
       WHERE s.id = $1`,
      [result.rows[0].id]
    )

    const stat = statWithPlayer.rows[0]
    const io = req.app.get('io')

    // Broadcast via WebSocket
    if (io) {
      io.to(`game:${game_id}`).emit('stat:created', {
        stat,
        user: { id: req.user.id, name: req.user.name || req.user.email },
        timestamp: new Date().toISOString(),
      })
    }

    // Log activity
    await logActivity({
      userId: req.user.id,
      userName: req.user.name || req.user.email,
      actionType: 'stat_created',
      entityType: 'stat',
      entityId: stat.id,
      entityName: `${stat.player_name} - ${stat.stat_type} (${stat.value})`,
      details: { game_id, player_id, stat_type, value },
      io,
    })

    res.status(201).json(stat)
  } catch (err) {
    next(err)
  }
})

// PUT update stat entry (only owner or admin can update)
router.put('/:id', validate(updateStatSchema), async (req, res, next) => {
  try {
    const { id } = req.params
    const {
      stat_type,
      value,
      timestamp,
      period,
      note,
    } = req.body
    const userId = req.user?.id
    const isAdmin = req.user?.role === 'admin'

    // Check ownership first
    const existing = await pool.query('SELECT created_by FROM stats WHERE id = $1', [id])
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Stat not found' })
    }

    if (!isAdmin && existing.rows[0].created_by !== userId) {
      return res.status(403).json({ error: 'You can only edit your own stats' })
    }

    const result = await pool.query(
      `UPDATE stats
       SET stat_type = COALESCE($1, stat_type),
           value = COALESCE($2, value),
           timestamp = COALESCE($3, timestamp),
           period = COALESCE($4, period),
           note = COALESCE($5, note)
       WHERE id = $6
       RETURNING *`,
      [stat_type, value, timestamp, period, note, id]
    )

    // Get player info for the response
    const statWithPlayer = await pool.query(
      `SELECT s.*, p.name as player_name, p.position as player_position,
              u.name as created_by_name
       FROM stats s
       LEFT JOIN players p ON s.player_id = p.id
       LEFT JOIN users u ON s.created_by = u.id
       WHERE s.id = $1`,
      [id]
    )

    const stat = statWithPlayer.rows[0]
    const io = req.app.get('io')

    // Broadcast via WebSocket
    if (io) {
      io.to(`game:${stat.game_id}`).emit('stat:updated', {
        stat,
        user: { id: req.user.id, name: req.user.name || req.user.email },
        timestamp: new Date().toISOString(),
      })
    }

    // Log activity
    await logActivity({
      userId: req.user.id,
      userName: req.user.name || req.user.email,
      actionType: 'stat_updated',
      entityType: 'stat',
      entityId: stat.id,
      entityName: `${stat.player_name} - ${stat.stat_type}`,
      details: { game_id: stat.game_id, player_id: stat.player_id },
      io,
    })

    res.json(stat)
  } catch (err) {
    next(err)
  }
})

// DELETE stat entry (only owner or admin can delete)
router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params
    const userId = req.user?.id
    const isAdmin = req.user?.role === 'admin'

    // Check ownership first
    const existing = await pool.query('SELECT created_by FROM stats WHERE id = $1', [id])
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Stat not found' })
    }

    if (!isAdmin && existing.rows[0].created_by !== userId) {
      return res.status(403).json({ error: 'You can only delete your own stats' })
    }

    const result = await pool.query('DELETE FROM stats WHERE id = $1 RETURNING *', [id])
    const deletedStat = result.rows[0]
    const io = req.app.get('io')

    // Broadcast via WebSocket
    if (io && deletedStat) {
      io.to(`game:${deletedStat.game_id}`).emit('stat:deleted', {
        statId: id,
        game_id: deletedStat.game_id,
        user: { id: req.user.id, name: req.user.name || req.user.email },
        timestamp: new Date().toISOString(),
      })
    }

    // Log activity
    if (deletedStat) {
      await logActivity({
        userId: req.user.id,
        userName: req.user.name || req.user.email,
        actionType: 'stat_deleted',
        entityType: 'stat',
        entityId: id,
        entityName: `Stat #${id}`,
        details: { game_id: deletedStat.game_id },
        io,
      })
    }

    res.json({ message: 'Stat deleted', stat: deletedStat })
  } catch (err) {
    next(err)
  }
})

export default router
