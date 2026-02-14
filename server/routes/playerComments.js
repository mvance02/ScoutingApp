import { Router } from 'express'
import pool from '../db.js'
import { logAudit, getClientIp } from '../middleware/audit.js'
import { parseMentions, createMentionNotifications } from '../utils/mentions.js'
import { logActivity } from '../utils/activityLogger.js'

const router = Router()

// GET all comments for a player
router.get('/player/:playerId', async (req, res, next) => {
  try {
    const { playerId } = req.params
    const result = await pool.query(
      `SELECT pc.*, u.name as author_name, u.email as author_email
       FROM player_comments pc
       LEFT JOIN users u ON u.id = pc.user_id
       WHERE pc.player_id = $1
       ORDER BY pc.created_at DESC`,
      [playerId]
    )
    res.json(result.rows)
  } catch (err) {
    next(err)
  }
})

// POST create a comment
router.post('/', async (req, res, next) => {
  try {
    const { player_id, comment } = req.body
    if (!player_id || !comment?.trim()) {
      return res.status(400).json({ error: 'player_id and comment are required' })
    }

    const commentText = comment.trim()
    
    // Parse mentions
    const mentions = parseMentions(commentText)
    const mentionedUserIds = []
    
    if (mentions.length > 0) {
      const users = await pool.query(
        `SELECT id FROM users 
         WHERE email = ANY($1) OR name = ANY($1) OR LOWER(email) = ANY($2) OR LOWER(name) = ANY($2)`,
        [mentions, mentions.map(m => m.toLowerCase())]
      )
      mentionedUserIds.push(...users.rows.map(u => u.id))
    }

    const result = await pool.query(
      `INSERT INTO player_comments (player_id, user_id, comment, mentions)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [player_id, req.user.id, commentText, mentionedUserIds.length > 0 ? mentionedUserIds : null]
    )

    const newComment = result.rows[0]

    // Create mention notifications
    if (mentions.length > 0) {
      await createMentionNotifications(newComment.id, mentions, req.user.id, player_id)
    }

    // Fetch with author info
    const withAuthor = await pool.query(
      `SELECT pc.*, u.name as author_name, u.email as author_email
       FROM player_comments pc
       LEFT JOIN users u ON u.id = pc.user_id
       WHERE pc.id = $1`,
      [newComment.id]
    )

    const commentWithAuthor = withAuthor.rows[0]

    // Get player name for activity log
    const playerResult = await pool.query('SELECT name FROM players WHERE id = $1', [player_id])
    const playerName = playerResult.rows[0]?.name || `Player #${player_id}`

    const io = req.app.get('io')

    // Broadcast via WebSocket
    if (io) {
      io.to(`player:${player_id}`).emit('comment:created', {
        comment: commentWithAuthor,
        user: { id: req.user.id, name: req.user.name || req.user.email },
        timestamp: new Date().toISOString(),
      })
    }

    // Log activity
    await logActivity({
      userId: req.user.id,
      userName: req.user.name || req.user.email,
      actionType: 'comment_added',
      entityType: 'comment',
      entityId: newComment.id,
      entityName: `Comment on ${playerName}`,
      details: { player_id, mentions: mentions.length },
      io,
    })

    logAudit({
      userId: req.user.id,
      userEmail: req.user.email,
      action: 'CREATE',
      tableName: 'player_comments',
      recordId: newComment.id,
      newValues: newComment,
      ipAddress: getClientIp(req),
    })

    res.status(201).json(commentWithAuthor)
  } catch (err) {
    next(err)
  }
})

// PUT update a comment
router.put('/:id', async (req, res, next) => {
  try {
    const { id } = req.params
    const { comment } = req.body

    const oldResult = await pool.query(
      `SELECT * FROM player_comments WHERE id = $1 AND user_id = $2`,
      [id, req.user.id]
    )
    if (oldResult.rows.length === 0) {
      return res.status(404).json({ error: 'Comment not found' })
    }

    const result = await pool.query(
      `UPDATE player_comments 
       SET comment = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2 AND user_id = $3
       RETURNING *`,
      [comment.trim(), id, req.user.id]
    )

    logAudit({
      userId: req.user.id,
      userEmail: req.user.email,
      action: 'UPDATE',
      tableName: 'player_comments',
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

// DELETE a comment
router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params
    const oldResult = await pool.query(
      `SELECT * FROM player_comments WHERE id = $1 AND user_id = $2`,
      [id, req.user.id]
    )
    if (oldResult.rows.length === 0) {
      return res.status(404).json({ error: 'Comment not found' })
    }

    const result = await pool.query(
      `DELETE FROM player_comments 
       WHERE id = $1 AND user_id = $2 
       RETURNING *`,
      [id, req.user.id]
    )

    logAudit({
      userId: req.user.id,
      userEmail: req.user.email,
      action: 'DELETE',
      tableName: 'player_comments',
      recordId: id,
      oldValues: oldResult.rows[0],
      ipAddress: getClientIp(req),
    })

    res.json({ message: 'Comment deleted', comment: result.rows[0] })
  } catch (err) {
    next(err)
  }
})

export default router
