import { Router } from 'express'
import pool from '../db.js'
import { parseMentions, getMentionedUsers } from '../utils/mentions.js'
import { logActivity } from '../utils/activityLogger.js'

const router = Router()

// GET or create chat room
router.get('/room/:type/:entityId?', async (req, res, next) => {
  try {
    const { type, entityId } = req.params
    
    // Check if room exists
    let room = await pool.query(
      'SELECT * FROM chat_rooms WHERE room_type = $1 AND (entity_id = $2 OR ($2 IS NULL AND entity_id IS NULL))',
      [type, entityId || null]
    )
    
    if (room.rows.length === 0) {
      // Create room
      const name = entityId 
        ? `${type} chat (${entityId})`
        : `${type} chat`
      
      const result = await pool.query(
        `INSERT INTO chat_rooms (name, room_type, entity_id, created_by)
         VALUES ($1, $2, $3, $4) RETURNING *`,
        [name, type, entityId || null, req.user.id]
      )
      room = result
    }
    
    res.json(room.rows[0])
  } catch (err) {
    next(err)
  }
})

// GET all rooms for a user (or all rooms)
router.get('/rooms', async (req, res, next) => {
  try {
    const { type } = req.query
    let query = 'SELECT * FROM chat_rooms'
    const params = []
    
    if (type) {
      query += ' WHERE room_type = $1'
      params.push(type)
    }
    
    query += ' ORDER BY created_at DESC'
    
    const result = await pool.query(query, params)
    res.json(result.rows)
  } catch (err) {
    next(err)
  }
})

// GET messages for a room
router.get('/messages/:roomId', async (req, res, next) => {
  try {
    const { roomId } = req.params
    const { limit = 50, before } = req.query
    
    let query = `
      SELECT m.*, u.name as user_name, u.email as user_email
      FROM chat_messages m
      LEFT JOIN users u ON u.id = m.user_id
      WHERE m.room_id = $1
    `
    const params = [roomId]
    
    if (before) {
      query += ' AND m.created_at < $2'
      params.push(before)
    }
    
    query += ' ORDER BY m.created_at DESC LIMIT $' + (params.length + 1)
    params.push(parseInt(limit))
    
    const result = await pool.query(query, params)
    // Reverse to show oldest first
    res.json(result.rows.reverse())
  } catch (err) {
    next(err)
  }
})

// POST send message
router.post('/messages', async (req, res, next) => {
  try {
    const { room_id, message } = req.body
    
    if (!room_id || !message?.trim()) {
      return res.status(400).json({ error: 'room_id and message are required' })
    }
    
    // Parse mentions
    const mentions = parseMentions(message)
    const mentionedUsers = await getMentionedUsers(mentions)
    const mentionedUserIds = mentionedUsers.map(u => u.id)
    
    const result = await pool.query(
      `INSERT INTO chat_messages (room_id, user_id, message, mentions)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [room_id, req.user.id, message.trim(), mentionedUserIds.length > 0 ? mentionedUserIds : null]
    )
    
    const newMessage = result.rows[0]
    
    // Fetch with user info
    const withUser = await pool.query(
      `SELECT m.*, u.name as user_name, u.email as user_email
       FROM chat_messages m
       LEFT JOIN users u ON u.id = m.user_id
       WHERE m.id = $1`,
      [newMessage.id]
    )
    
    const messageWithUser = withUser.rows[0]
    
    // Create notifications for mentioned users
    for (const user of mentionedUsers) {
      if (user.id === req.user.id) continue // Don't notify self
      
      await pool.query(
        `INSERT INTO notifications (user_id, title, message, type, read)
         VALUES ($1, $2, $3, $4, false)`,
        [
          user.id,
          'You were mentioned in chat',
          `${req.user.name || req.user.email} mentioned you in a chat message`,
          'mention',
        ]
      )
    }
    
    const io = req.app.get('io')
    
    // Broadcast via WebSocket
    if (io) {
      io.to(`chat:${room_id}`).emit('message:new', {
        message: messageWithUser,
        user: { id: req.user.id, name: req.user.name || req.user.email },
        timestamp: new Date().toISOString(),
      })
    }
    
    // Log activity
    await logActivity({
      userId: req.user.id,
      userName: req.user.name || req.user.email,
      actionType: 'chat_message',
      entityType: 'chat',
      entityId: room_id,
      entityName: `Chat message`,
      details: { room_id, mentions: mentions.length },
      io,
    })
    
    res.status(201).json(messageWithUser)
  } catch (err) {
    next(err)
  }
})

// PUT mark messages as read
router.put('/messages/:roomId/read', async (req, res, next) => {
  try {
    const { roomId } = req.params
    
    // Get all unread messages in this room
    const messages = await pool.query(
      `SELECT id FROM chat_messages 
       WHERE room_id = $1 
       AND id NOT IN (SELECT message_id FROM message_reads WHERE user_id = $2)`,
      [roomId, req.user.id]
    )
    
    // Mark as read
    for (const msg of messages.rows) {
      await pool.query(
        `INSERT INTO message_reads (message_id, user_id) 
         VALUES ($1, $2) 
         ON CONFLICT DO NOTHING`,
        [msg.id, req.user.id]
      )
    }
    
    res.json({ read: messages.rows.length })
  } catch (err) {
    next(err)
  }
})

export default router
