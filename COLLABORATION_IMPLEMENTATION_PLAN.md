# Collaboration Features Implementation Plan

## Overview
This document outlines how to implement real-time collaboration features in the BYU Scouting App.

---

## 1. Real-Time Updates (WebSockets for Live Stat Tracking)

### Architecture
- **Technology**: Socket.io (works with Express, handles reconnection, rooms)
- **Pattern**: Room-based architecture (one room per game/player)
- **Flow**: User action → API → Database → WebSocket broadcast → All connected clients

### Implementation Steps

#### Backend (Server)

**1. Install Socket.io**
```bash
cd server
npm install socket.io
```

**2. Create WebSocket Server** (`server/websocket.js`)
```javascript
import { Server } from 'socket.io'
import { verifyToken } from './middleware/auth.js'

export function initializeWebSocket(httpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin: ['http://localhost:3000', 'http://localhost:5173'],
      credentials: true,
    },
  })

  // Authentication middleware
  io.use(async (socket, next) => {
    const token = socket.handshake.auth.token
    try {
      const user = await verifyToken(token)
      socket.userId = user.id
      socket.userName = user.name
      next()
    } catch (err) {
      next(new Error('Authentication failed'))
    }
  })

  io.on('connection', (socket) => {
    console.log(`User ${socket.userName} connected`)

    // Join game room
    socket.on('join:game', (gameId) => {
      socket.join(`game:${gameId}`)
      socket.emit('joined', { room: `game:${gameId}` })
    })

    // Leave game room
    socket.on('leave:game', (gameId) => {
      socket.leave(`game:${gameId}`)
    })

    // Join player room
    socket.on('join:player', (playerId) => {
      socket.join(`player:${playerId}`)
    })

    socket.on('disconnect', () => {
      console.log(`User ${socket.userName} disconnected`)
    })
  })

  return io
}
```

**3. Update Server Entry Point** (`server/index.js`)
```javascript
import { createServer } from 'http'
import { initializeWebSocket } from './websocket.js'

const httpServer = createServer(app)
const io = initializeWebSocket(httpServer)

// Export io for use in routes
app.set('io', io)

httpServer.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`)
})
```

**4. Broadcast in Routes** (`server/routes/stats.js`)
```javascript
// After creating a stat
router.post('/', async (req, res, next) => {
  try {
    const stat = await createStat(req.body)
    
    // Broadcast to game room
    const io = req.app.get('io')
    io.to(`game:${stat.game_id}`).emit('stat:created', {
      stat,
      user: { id: req.user.id, name: req.user.name },
      timestamp: new Date().toISOString(),
    })
    
    res.status(201).json(stat)
  } catch (err) {
    next(err)
  }
})
```

#### Frontend (React)

**1. Install Socket.io Client**
```bash
npm install socket.io-client
```

**2. Create WebSocket Hook** (`src/hooks/useWebSocket.js`)
```javascript
import { useEffect, useRef } from 'react'
import { io } from 'socket.io-client'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'
const WS_URL = API_URL.replace('/api', '')

export function useWebSocket(gameId, onStatUpdate, onPlayerUpdate) {
  const socketRef = useRef(null)

  useEffect(() => {
    const token = localStorage.getItem('auth_token')
    if (!token) return

    const socket = io(WS_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
    })

    socket.on('connect', () => {
      console.log('WebSocket connected')
      if (gameId) {
        socket.emit('join:game', gameId)
      }
    })

    socket.on('stat:created', (data) => {
      onStatUpdate?.(data)
    })

    socket.on('stat:updated', (data) => {
      onStatUpdate?.(data)
    })

    socket.on('player:updated', (data) => {
      onPlayerUpdate?.(data)
    })

    socketRef.current = socket

    return () => {
      socket.disconnect()
    }
  }, [gameId])

  return socketRef.current
}
```

**3. Use in GameReview Component**
```javascript
import { useWebSocket } from '../hooks/useWebSocket'

function GameReview() {
  const { gameId } = useParams()
  
  useWebSocket(gameId, (data) => {
    // Update stats in real-time
    setGameStats((prev) => {
      const exists = prev.find(s => s.id === data.stat.id)
      if (exists) {
        return prev.map(s => s.id === data.stat.id ? data.stat : s)
      }
      return [...prev, data.stat]
    })
    
    // Show notification
    showNotification(`${data.user.name} added ${data.stat.statType}`)
  })
}
```

---

## 2. Activity Feed (Recent Changes)

### Database Schema
```sql
-- Activity Feed Table
CREATE TABLE activity_feed (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  user_name VARCHAR(255),
  action_type VARCHAR(50) NOT NULL, -- 'stat_created', 'player_updated', 'comment_added', etc.
  entity_type VARCHAR(50) NOT NULL, -- 'stat', 'player', 'game', 'comment'
  entity_id INTEGER,
  entity_name VARCHAR(255), -- Player name, game opponent, etc.
  details JSONB, -- Additional context
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_activity_feed_created ON activity_feed(created_at DESC);
CREATE INDEX idx_activity_feed_user ON activity_feed(user_id);
```

### Implementation

**Backend Route** (`server/routes/activity.js`)
```javascript
router.get('/', async (req, res, next) => {
  try {
    const { limit = 50, offset = 0, entity_type, user_id } = req.query
    
    let query = 'SELECT * FROM activity_feed WHERE 1=1'
    const params = []
    let paramIndex = 1
    
    if (entity_type) {
      query += ` AND entity_type = $${paramIndex}`
      params.push(entity_type)
      paramIndex++
    }
    
    if (user_id) {
      query += ` AND user_id = $${paramIndex}`
      params.push(user_id)
      paramIndex++
    }
    
    query += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`
    params.push(limit, offset)
    
    const result = await pool.query(query, params)
    res.json(result.rows)
  } catch (err) {
    next(err)
  }
})
```

**Activity Logger Helper** (`server/utils/activityLogger.js`)
```javascript
import pool from '../db.js'

export async function logActivity({
  userId,
  userName,
  actionType,
  entityType,
  entityId,
  entityName,
  details = {},
}) {
  try {
    await pool.query(
      `INSERT INTO activity_feed (user_id, user_name, action_type, entity_type, entity_id, entity_name, details)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [userId, userName, actionType, entityType, entityId, entityName, JSON.stringify(details)]
    )
    
    // Broadcast via WebSocket
    // (io would be passed in or accessed via app.get('io'))
  } catch (err) {
    console.error('Error logging activity:', err)
  }
}
```

**Use in Routes** (`server/routes/stats.js`)
```javascript
import { logActivity } from '../utils/activityLogger.js'

router.post('/', async (req, res, next) => {
  try {
    const stat = await createStat(req.body)
    
    // Log activity
    await logActivity({
      userId: req.user.id,
      userName: req.user.name,
      actionType: 'stat_created',
      entityType: 'stat',
      entityId: stat.id,
      entityName: `${stat.player_name} - ${stat.stat_type}`,
      details: { game_id: stat.game_id, player_id: stat.player_id },
    })
    
    res.status(201).json(stat)
  } catch (err) {
    next(err)
  }
})
```

**Frontend Component** (`src/components/ActivityFeed.jsx`)
```javascript
import { useState, useEffect } from 'react'
import { Activity, User, MessageSquare, BarChart3 } from 'lucide-react'
import { activityApi } from '../utils/api'

const ACTION_ICONS = {
  stat_created: BarChart3,
  player_updated: User,
  comment_added: MessageSquare,
}

function ActivityFeed({ limit = 20 }) {
  const [activities, setActivities] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadActivities()
    // Poll every 10 seconds
    const interval = setInterval(loadActivities, 10000)
    return () => clearInterval(interval)
  }, [])

  const loadActivities = async () => {
    try {
      const data = await activityApi.getRecent({ limit })
      setActivities(data)
    } catch (err) {
      console.error('Error loading activities:', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="activity-feed">
      <h3>Recent Activity</h3>
      {activities.map((activity) => {
        const Icon = ACTION_ICONS[activity.action_type] || Activity
        return (
          <div key={activity.id} className="activity-item">
            <Icon size={16} />
            <div>
              <strong>{activity.user_name}</strong> {activity.action_type.replace('_', ' ')}
              <span className="activity-entity">{activity.entity_name}</span>
            </div>
            <span className="activity-time">
              {new Date(activity.created_at).toLocaleTimeString()}
            </span>
          </div>
        )
      })}
    </div>
  )
}
```

---

## 3. @Mentions in Comments

### Database Schema
```sql
-- Extend player_comments table
ALTER TABLE player_comments ADD COLUMN IF NOT EXISTS mentions INTEGER[];

-- Mentions tracking
CREATE TABLE comment_mentions (
  id SERIAL PRIMARY KEY,
  comment_id INTEGER REFERENCES player_comments(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_mentions_comment ON comment_mentions(comment_id);
CREATE INDEX idx_mentions_user ON comment_mentions(user_id);
```

### Implementation

**Backend: Parse Mentions** (`server/utils/mentions.js`)
```javascript
export function parseMentions(text) {
  const mentionRegex = /@(\w+)/g
  const mentions = []
  let match
  
  while ((match = mentionRegex.exec(text)) !== null) {
    mentions.push(match[1]) // Username
  }
  
  return [...new Set(mentions)] // Remove duplicates
}

export async function createMentionNotifications(commentId, mentionedUsernames, commenterId) {
  const pool = require('./db.js').default
  
  // Find user IDs from usernames
  const users = await pool.query(
    'SELECT id, email, name FROM users WHERE email = ANY($1) OR name = ANY($1)',
    [mentionedUsernames]
  )
  
  // Create notifications
  for (const user of users.rows) {
    await pool.query(
      `INSERT INTO notifications (user_id, title, message, type, link)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        user.id,
        'You were mentioned',
        `You were mentioned in a comment`,
        'mention',
        `/player/${commentId}/comments`,
      ]
    )
  }
}
```

**Backend Route** (`server/routes/playerComments.js`)
```javascript
import { parseMentions, createMentionNotifications } from '../utils/mentions.js'

router.post('/', async (req, res, next) => {
  try {
    const { player_id, comment } = req.body
    
    // Create comment
    const result = await pool.query(
      `INSERT INTO player_comments (player_id, user_id, comment)
       VALUES ($1, $2, $3) RETURNING *`,
      [player_id, req.user.id, comment]
    )
    
    const newComment = result.rows[0]
    
    // Parse and handle mentions
    const mentions = parseMentions(comment)
    if (mentions.length > 0) {
      // Store mentions
      const userIds = await pool.query(
        'SELECT id FROM users WHERE email = ANY($1) OR name = ANY($1)',
        [mentions]
      )
      
      for (const user of userIds.rows) {
        await pool.query(
          'INSERT INTO comment_mentions (comment_id, user_id) VALUES ($1, $2)',
          [newComment.id, user.id]
        )
      }
      
      // Create notifications
      await createMentionNotifications(newComment.id, mentions, req.user.id)
    }
    
    res.status(201).json(newComment)
  } catch (err) {
    next(err)
  }
})
```

**Frontend: Mention Parser & UI** (`src/components/PlayerComments.jsx`)
```javascript
import { useState, useEffect } from 'react'
import { authApi } from '../utils/api'

function PlayerComments({ playerId }) {
  const [users, setUsers] = useState([]) // For autocomplete
  const [commentText, setCommentText] = useState('')
  const [mentionSuggestions, setMentionSuggestions] = useState([])
  const [mentionIndex, setMentionIndex] = useState(-1)

  useEffect(() => {
    loadUsers()
  }, [])

  const loadUsers = async () => {
    try {
      const userList = await authApi.users()
      setUsers(userList)
    } catch (err) {
      console.error('Error loading users:', err)
    }
  }

  const handleCommentChange = (e) => {
    const text = e.target.value
    setCommentText(text)
    
    // Check for @ mentions
    const cursorPos = e.target.selectionStart
    const textBeforeCursor = text.substring(0, cursorPos)
    const match = textBeforeCursor.match(/@(\w*)$/)
    
    if (match) {
      const query = match[1].toLowerCase()
      const suggestions = users
        .filter(u => 
          u.name?.toLowerCase().includes(query) || 
          u.email?.toLowerCase().includes(query)
        )
        .slice(0, 5)
      setMentionSuggestions(suggestions)
      setMentionIndex(cursorPos - match[0].length)
    } else {
      setMentionSuggestions([])
      setMentionIndex(-1)
    }
  }

  const insertMention = (user) => {
    const before = commentText.substring(0, mentionIndex)
    const after = commentText.substring(mentionIndex + (commentText.substring(mentionIndex).match(/@\w*/)?.[0]?.length || 0))
    setCommentText(`${before}@${user.name || user.email} ${after}`)
    setMentionSuggestions([])
    setMentionIndex(-1)
  }

  const renderCommentWithMentions = (comment) => {
    const parts = comment.split(/(@\w+)/g)
    return parts.map((part, i) => {
      if (part.startsWith('@')) {
        const username = part.substring(1)
        return (
          <span key={i} className="mention" style={{ 
            background: 'var(--color-primary)', 
            color: 'white', 
            padding: '2px 6px', 
            borderRadius: '4px',
            fontWeight: 600,
          }}>
            {part}
          </span>
        )
      }
      return <span key={i}>{part}</span>
    })
  }

  return (
    <div className="player-comments">
      <textarea
        value={commentText}
        onChange={handleCommentChange}
        placeholder="Type @ to mention someone..."
      />
      
      {mentionSuggestions.length > 0 && (
        <div className="mention-suggestions">
          {mentionSuggestions.map((user) => (
            <button
              key={user.id}
              onClick={() => insertMention(user)}
              className="mention-suggestion"
            >
              {user.name || user.email}
            </button>
          ))}
        </div>
      )}
      
      {/* Render comments with highlighted mentions */}
      {comments.map((comment) => (
        <div key={comment.id}>
          {renderCommentWithMentions(comment.comment)}
        </div>
      ))}
    </div>
  )
}
```

---

## 4. Shared Notes/Annotations on Game Footage

### Database Schema
```sql
-- Game Annotations Table
CREATE TABLE game_annotations (
  id SERIAL PRIMARY KEY,
  game_id INTEGER REFERENCES games(id) ON DELETE CASCADE,
  video_timestamp DECIMAL(10, 2) NOT NULL, -- Time in video (seconds)
  x_position DECIMAL(5, 2), -- X coordinate (0-100%)
  y_position DECIMAL(5, 2), -- Y coordinate (0-100%)
  note_text TEXT NOT NULL,
  annotation_type VARCHAR(50) DEFAULT 'note', -- 'note', 'highlight', 'drawing'
  color VARCHAR(20) DEFAULT '#2563eb',
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_annotations_game ON game_annotations(game_id);
CREATE INDEX idx_annotations_timestamp ON game_annotations(video_timestamp);
```

### Implementation

**Backend Route** (`server/routes/annotations.js`)
```javascript
router.get('/game/:gameId', async (req, res, next) => {
  try {
    const { gameId } = req.params
    const result = await pool.query(
      `SELECT ga.*, u.name as creator_name
       FROM game_annotations ga
       LEFT JOIN users u ON u.id = ga.created_by
       WHERE ga.game_id = $1
       ORDER BY ga.video_timestamp ASC`,
      [gameId]
    )
    res.json(result.rows)
  } catch (err) {
    next(err)
  }
})

router.post('/', async (req, res, next) => {
  try {
    const { game_id, video_timestamp, x_position, y_position, note_text, annotation_type, color } = req.body
    
    const result = await pool.query(
      `INSERT INTO game_annotations 
       (game_id, video_timestamp, x_position, y_position, note_text, annotation_type, color, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [game_id, video_timestamp, x_position, y_position, note_text, annotation_type, color, req.user.id]
    )
    
    // Broadcast via WebSocket
    const io = req.app.get('io')
    io.to(`game:${game_id}`).emit('annotation:created', {
      annotation: result.rows[0],
      user: { id: req.user.id, name: req.user.name },
    })
    
    res.status(201).json(result.rows[0])
  } catch (err) {
    next(err)
  }
})
```

**Frontend Component** (`src/components/VideoAnnotations.jsx`)
```javascript
import { useState, useEffect, useRef } from 'react'
import { MapPin, MessageSquare } from 'lucide-react'
import { annotationsApi } from '../utils/api'
import { useWebSocket } from '../hooks/useWebSocket'

function VideoAnnotations({ gameId, videoRef, currentTime }) {
  const [annotations, setAnnotations] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [clickPosition, setClickPosition] = useState(null)
  const containerRef = useRef(null)

  useEffect(() => {
    loadAnnotations()
  }, [gameId])

  // Real-time updates via WebSocket
  useWebSocket(gameId, null, null, (data) => {
    if (data.type === 'annotation:created') {
      setAnnotations((prev) => [...prev, data.annotation])
    }
  })

  const loadAnnotations = async () => {
    try {
      const data = await annotationsApi.getForGame(gameId)
      setAnnotations(data)
    } catch (err) {
      console.error('Error loading annotations:', err)
    }
  }

  const handleVideoClick = (e) => {
    if (!containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * 100
    const y = ((e.clientY - rect.top) / rect.height) * 100
    
    setClickPosition({ x, y })
    setShowForm(true)
  }

  const handleCreateAnnotation = async (noteText) => {
    try {
      await annotationsApi.create({
        game_id: gameId,
        video_timestamp: currentTime,
        x_position: clickPosition.x,
        y_position: clickPosition.y,
        note_text: noteText,
      })
      setShowForm(false)
      setClickPosition(null)
      loadAnnotations()
    } catch (err) {
      console.error('Error creating annotation:', err)
    }
  }

  // Filter annotations visible at current time
  const visibleAnnotations = annotations.filter(
    (ann) => Math.abs(ann.video_timestamp - currentTime) < 5 // Show within 5 seconds
  )

  return (
    <div 
      ref={containerRef}
      className="video-annotations-container"
      onClick={handleVideoClick}
      style={{ position: 'relative', width: '100%', height: '100%' }}
    >
      {/* Video player here */}
      
      {/* Annotation markers */}
      {visibleAnnotations.map((ann) => (
        <div
          key={ann.id}
          className="annotation-marker"
          style={{
            position: 'absolute',
            left: `${ann.x_position}%`,
            top: `${ann.y_position}%`,
            transform: 'translate(-50%, -50%)',
          }}
          title={ann.note_text}
        >
          <MapPin size={20} color={ann.color} />
        </div>
      ))}
      
      {/* Annotation form */}
      {showForm && clickPosition && (
        <div
          className="annotation-form"
          style={{
            position: 'absolute',
            left: `${clickPosition.x}%`,
            top: `${clickPosition.y}%`,
            transform: 'translate(-50%, -100%)',
          }}
        >
          <input
            type="text"
            placeholder="Add annotation..."
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleCreateAnnotation(e.target.value)
              }
            }}
            autoFocus
          />
        </div>
      )}
    </div>
  )
}
```

---

## 5. Team Chat or Messaging

### Database Schema
```sql
-- Chat Rooms
CREATE TABLE chat_rooms (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255),
  room_type VARCHAR(50) NOT NULL, -- 'global', 'game', 'player', 'position_group'
  entity_id INTEGER, -- game_id, player_id, etc.
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Chat Messages
CREATE TABLE chat_messages (
  id SERIAL PRIMARY KEY,
  room_id INTEGER REFERENCES chat_rooms(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  message TEXT NOT NULL,
  mentions INTEGER[], -- Array of mentioned user IDs
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Message Read Receipts
CREATE TABLE message_reads (
  id SERIAL PRIMARY KEY,
  message_id INTEGER REFERENCES chat_messages(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  read_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (message_id, user_id)
);

CREATE INDEX idx_messages_room ON chat_messages(room_id, created_at DESC);
CREATE INDEX idx_reads_message ON message_reads(message_id);
```

### Implementation

**Backend Routes** (`server/routes/chat.js`)
```javascript
// Get or create room
router.get('/room/:type/:entityId?', async (req, res, next) => {
  try {
    const { type, entityId } = req.params
    
    let room = await pool.query(
      'SELECT * FROM chat_rooms WHERE room_type = $1 AND entity_id = $2',
      [type, entityId || null]
    )
    
    if (room.rows.length === 0) {
      // Create room
      const result = await pool.query(
        `INSERT INTO chat_rooms (name, room_type, entity_id, created_by)
         VALUES ($1, $2, $3, $4) RETURNING *`,
        [`${type} chat`, type, entityId || null, req.user.id]
      )
      room = result
    }
    
    res.json(room.rows[0])
  } catch (err) {
    next(err)
  }
})

// Get messages
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
    params.push(limit)
    
    const result = await pool.query(query, params)
    res.json(result.rows.reverse()) // Reverse to show oldest first
  } catch (err) {
    next(err)
  }
})

// Send message
router.post('/messages', async (req, res, next) => {
  try {
    const { room_id, message } = req.body
    
    const result = await pool.query(
      `INSERT INTO chat_messages (room_id, user_id, message, mentions)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [room_id, req.user.id, message, parseMentions(message)]
    )
    
    const newMessage = result.rows[0]
    
    // Broadcast via WebSocket
    const io = req.app.get('io')
    io.to(`chat:${room_id}`).emit('message:new', {
      message: newMessage,
      user: { id: req.user.id, name: req.user.name },
    })
    
    res.status(201).json(newMessage)
  } catch (err) {
    next(err)
  }
})
```

**Frontend Component** (`src/components/Chat.jsx`)
```javascript
import { useState, useEffect, useRef } from 'react'
import { Send, MessageSquare } from 'lucide-react'
import { chatApi } from '../utils/api'
import { useWebSocket } from '../hooks/useWebSocket'

function Chat({ roomType, entityId }) {
  const [room, setRoom] = useState(null)
  const [messages, setMessages] = useState([])
  const [messageText, setMessageText] = useState('')
  const [typingUsers, setTypingUsers] = useState([])
  const messagesEndRef = useRef(null)
  const typingTimeoutRef = useRef(null)

  useEffect(() => {
    loadRoom()
  }, [roomType, entityId])

  useEffect(() => {
    if (room) {
      loadMessages()
    }
  }, [room])

  // Real-time message updates
  useWebSocket(null, null, null, null, (data) => {
    if (data.type === 'message:new' && data.message.room_id === room?.id) {
      setMessages((prev) => [...prev, data.message])
      scrollToBottom()
    }
  })

  const loadRoom = async () => {
    try {
      const roomData = await chatApi.getRoom(roomType, entityId)
      setRoom(roomData)
    } catch (err) {
      console.error('Error loading room:', err)
    }
  }

  const loadMessages = async () => {
    try {
      const data = await chatApi.getMessages(room.id)
      setMessages(data)
      scrollToBottom()
    } catch (err) {
      console.error('Error loading messages:', err)
    }
  }

  const handleSend = async () => {
    if (!messageText.trim() || !room) return
    
    try {
      await chatApi.sendMessage(room.id, messageText.trim())
      setMessageText('')
    } catch (err) {
      console.error('Error sending message:', err)
    }
  }

  const handleTyping = () => {
    // Emit typing indicator via WebSocket
    // Clear timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current)
    }
    
    // Emit typing
    socket.emit('typing', { room_id: room.id })
    
    // Stop typing after 3 seconds
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit('typing:stop', { room_id: room.id })
    }, 3000)
  }

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <div className="chat-container">
      <div className="chat-header">
        <MessageSquare size={20} />
        <h3>{room?.name || 'Chat'}</h3>
      </div>
      
      <div className="chat-messages">
        {messages.map((msg) => (
          <div key={msg.id} className="chat-message">
            <strong>{msg.user_name}</strong>
            <p>{msg.message}</p>
            <span className="message-time">
              {new Date(msg.created_at).toLocaleTimeString()}
            </span>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
      
      {typingUsers.length > 0 && (
        <div className="typing-indicator">
          {typingUsers.join(', ')} typing...
        </div>
      )}
      
      <div className="chat-input">
        <input
          type="text"
          value={messageText}
          onChange={(e) => {
            setMessageText(e.target.value)
            handleTyping()
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              handleSend()
            }
          }}
          placeholder="Type a message... (use @ to mention)"
        />
        <button onClick={handleSend}>
          <Send size={16} />
        </button>
      </div>
    </div>
  )
}
```

---

## Integration Summary

### Dependencies to Install
```bash
# Backend
cd server
npm install socket.io

# Frontend
npm install socket.io-client
```

### Migration Files Needed
1. `011_activity_feed.sql` - Activity feed table
2. `012_mentions.sql` - Mentions tracking
3. `013_annotations.sql` - Game annotations
4. `014_chat.sql` - Chat rooms and messages

### New Routes to Create
- `server/routes/activity.js` - Activity feed
- `server/routes/annotations.js` - Video annotations
- `server/routes/chat.js` - Team chat

### New Components to Create
- `src/components/ActivityFeed.jsx`
- `src/components/VideoAnnotations.jsx`
- `src/components/Chat.jsx`
- `src/hooks/useWebSocket.js`

### Key Integration Points
1. **WebSocket Server**: Initialize in `server/index.js`
2. **Broadcast Helpers**: Add to existing routes (stats, players, comments)
3. **Activity Logging**: Add to all mutation routes
4. **Mention Parsing**: Integrate into comment creation
5. **UI Integration**: Add chat/activity panels to GameReview and PlayerStats

---

## User Experience Flow

### Example: Multiple scouts reviewing the same game

1. **Scout A** opens Game Review for Game #123
   - Joins WebSocket room `game:123`
   - Sees existing stats and annotations

2. **Scout B** opens the same game
   - Joins same room
   - Sees Scout A's activity in real-time

3. **Scout A** adds a stat (Rush, 5 yards)
   - API saves to database
   - WebSocket broadcasts to `game:123`
   - Scout B sees the stat appear instantly
   - Activity feed updates for both

4. **Scout B** adds annotation at 2:34 timestamp
   - Annotation saved and broadcast
   - Scout A sees annotation marker appear

5. **Scout A** types in chat: "@ScoutB what did you think of that play?"
   - Message saved and broadcast
   - Scout B gets notification (mention)
   - Both see message in chat

This creates a seamless collaborative experience where multiple scouts can work together in real-time!
