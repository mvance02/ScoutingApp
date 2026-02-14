import { Server } from 'socket.io'
import jwt from 'jsonwebtoken'
import pool from './db.js'

const JWT_SECRET = process.env.JWT_SECRET || 'scouting-dev-secret'

async function verifyToken(token) {
  try {
    const decoded = jwt.verify(token, JWT_SECRET)
    // Get user from database - JWT contains 'id' not 'userId'
    const userId = decoded.id || decoded.userId
    const result = await pool.query('SELECT id, name, email, role FROM users WHERE id = $1', [userId])
    if (result.rows.length === 0) {
      throw new Error('User not found')
    }
    return result.rows[0]
  } catch (err) {
    throw new Error('Invalid token')
  }
}

export function initializeWebSocket(httpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin: process.env.NODE_ENV === 'production'
        ? [process.env.FRONTEND_URL].filter(Boolean)
        : ['http://localhost:3000', 'http://localhost:5173'],
      credentials: true,
    },
  })

  // Authentication middleware
  io.use(async (socket, next) => {
    const token = socket.handshake.auth.token
    if (!token) {
      return next(new Error('Authentication failed'))
    }
    try {
      const user = await verifyToken(token)
      socket.userId = user.id
      socket.userName = user.name || user.email
      socket.userEmail = user.email
      next()
    } catch (err) {
      next(new Error('Authentication failed'))
    }
  })

  io.on('connection', (socket) => {
    console.log(`User ${socket.userName} (${socket.userId}) connected`)

    // Join game room
    socket.on('join:game', (gameId) => {
      socket.join(`game:${gameId}`)
      socket.emit('joined', { room: `game:${gameId}` })
      // Notify others in room
      socket.to(`game:${gameId}`).emit('user:joined', {
        userId: socket.userId,
        userName: socket.userName,
      })
    })

    // Leave game room
    socket.on('leave:game', (gameId) => {
      socket.leave(`game:${gameId}`)
      socket.to(`game:${gameId}`).emit('user:left', {
        userId: socket.userId,
        userName: socket.userName,
      })
    })

    // Join player room
    socket.on('join:player', (playerId) => {
      socket.join(`player:${playerId}`)
    })

    // Leave player room
    socket.on('leave:player', (playerId) => {
      socket.leave(`player:${playerId}`)
    })

    // Join chat room
    socket.on('join:chat', (roomId) => {
      socket.join(`chat:${roomId}`)
    })

    // Leave chat room
    socket.on('leave:chat', (roomId) => {
      socket.leave(`chat:${roomId}`)
    })

    // Typing indicator
    socket.on('typing', ({ room_id }) => {
      socket.to(`chat:${room_id}`).emit('user:typing', {
        userId: socket.userId,
        userName: socket.userName,
      })
    })

    socket.on('typing:stop', ({ room_id }) => {
      socket.to(`chat:${room_id}`).emit('user:typing:stop', {
        userId: socket.userId,
      })
    })

    socket.on('disconnect', () => {
      console.log(`User ${socket.userName} disconnected`)
    })
  })

  return io
}
