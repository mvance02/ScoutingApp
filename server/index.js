import express from 'express'
import { createServer } from 'http'
import cors from 'cors'
import helmet from 'helmet'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

import playersRouter from './routes/players.js'
import gamesRouter from './routes/games.js'
import statsRouter from './routes/stats.js'
import gradesRouter from './routes/grades.js'
import notesRouter from './routes/notes.js'
import backupRouter from './routes/backup.js'
import authRouter from './routes/auth.js'
import assignmentsRouter from './routes/assignments.js'
import auditRouter from './routes/audit.js'
import performancesRouter from './routes/performances.js'
import emailRouter from './routes/email.js'
import recruitsRouter from './routes/recruits.js'
import recruitReportsRouter from './routes/recruitReports.js'
import recruitNotesRouter from './routes/recruitNotes.js'
import notificationsRouter from './routes/notifications.js'
import playerCommentsRouter from './routes/playerComments.js'
import visitsRouter from './routes/visits.js'
import activityRouter from './routes/activity.js'
import chatRouter from './routes/chat.js'
import shortcutsRouter from './routes/shortcuts.js'
import { requireAuth } from './middleware/auth.js'
import { authLimiter, passwordResetLimiter, apiLimiter, statCreationLimiter } from './middleware/rateLimit.js'
import { initializeWebSocket } from './websocket.js'

dotenv.config()

const app = express()
const httpServer = createServer(app)
const PORT = process.env.PORT || 3001

// Initialize WebSocket server
const io = initializeWebSocket(httpServer)
app.set('io', io) // Make io available in routes

// Security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "blob:", "http://localhost:3000", "http://localhost:3001"],
    },
  },
  crossOriginEmbedderPolicy: false, // Allow embedding for API
  crossOriginResourcePolicy: { policy: 'cross-origin' }, // Allow cross-origin image loading
}))

// CORS configuration
const allowedOrigins = process.env.NODE_ENV === 'production'
  ? [process.env.FRONTEND_URL].filter(Boolean)
  : ['http://localhost:3000', 'http://localhost:5173']

app.use(cors({
  origin: allowedOrigins,
  credentials: true,
}))
app.use(express.json({ limit: '50mb' }))

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')))

// Apply general rate limiting to all API routes
app.use('/api', apiLimiter)

// Auth routes with specific rate limiters
app.post('/api/auth/login', authLimiter)
app.post('/api/auth/register', authLimiter)
app.post('/api/auth/forgot-password', passwordResetLimiter)
app.post('/api/auth/reset-password', authLimiter)

// Health check (before auth)
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// Auth routes (no requireAuth — must be before the catch-all /api route)
app.use('/api/auth', authRouter)
app.use('/api/players', requireAuth, playersRouter)
app.use('/api/games', requireAuth, gamesRouter)
app.use('/api/stats', requireAuth, statsRouter)
app.post('/api/stats', requireAuth, statCreationLimiter) // Extra burst protection for stat creation
app.use('/api/grades', requireAuth, gradesRouter)
app.use('/api/notes', requireAuth, notesRouter)
app.use('/api/assignments', requireAuth, assignmentsRouter)
app.use('/api/audit-log', requireAuth, auditRouter)
app.use('/api/performances', requireAuth, performancesRouter)
app.use('/api/recruits', requireAuth, recruitsRouter)
app.use('/api/recruit-reports', requireAuth, recruitReportsRouter)
app.use('/api/recruit-notes', requireAuth, recruitNotesRouter)
app.use('/api/email', requireAuth, emailRouter)
app.use('/api/notifications', requireAuth, notificationsRouter)
app.use('/api/player-comments', requireAuth, playerCommentsRouter)
app.use('/api/visits', requireAuth, visitsRouter)
app.use('/api/activity', requireAuth, activityRouter)
app.use('/api/chat', requireAuth, chatRouter)
app.use('/api/shortcuts', requireAuth, shortcutsRouter)
app.use('/api', backupRouter)

// Error handling
app.use((err, req, res, next) => {
  console.error('Error:', err)
  res.status(500).json({ error: err.message || 'Internal server error' })
})

httpServer.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`)
  console.log(`WebSocket server initialized`)
})
