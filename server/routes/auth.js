import { Router } from 'express'
import crypto from 'crypto'
import bcrypt from 'bcryptjs'
import nodemailer from 'nodemailer'
import pool from '../db.js'
import { requireAuth, requireAdmin, signToken } from '../middleware/auth.js'

function getTransporter() {
  const host = process.env.SMTP_HOST
  const port = Number(process.env.SMTP_PORT || 587)
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASS
  const secure = String(process.env.SMTP_SECURE || 'false') === 'true'

  if (!host || !user || !pass) {
    return null
  }

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  })
}

const router = Router()

async function hasAnyUsers() {
  const result = await pool.query('SELECT COUNT(*) FROM users')
  return Number(result.rows[0].count) > 0
}

router.get('/status', async (req, res, next) => {
  try {
    const hasUsers = await hasAnyUsers()
    res.json({ hasUsers })
  } catch (err) {
    next(err)
  }
})

router.post('/register', async (req, res, next) => {
  try {
    const { name, password, role } = req.body
    const email = (req.body.email || '').trim().toLowerCase()
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' })
    }

    const existing = await pool.query('SELECT id FROM users WHERE LOWER(email) = $1', [email])
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Email already registered' })
    }

    const firstUser = !(await hasAnyUsers())
    if (!firstUser) {
      return requireAuth(req, res, () =>
        requireAdmin(req, res, () => createUser({ name, email, password, role }, res, next))
      )
    }

    return createUser({ name, email, password, role: 'admin' }, res, next)
  } catch (err) {
    next(err)
  }
})

router.post('/login', async (req, res, next) => {
  try {
    const { password } = req.body
    const email = (req.body.email || '').trim().toLowerCase()
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' })
    }

    const result = await pool.query('SELECT * FROM users WHERE LOWER(email) = $1', [email])
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' })
    }

    const user = result.rows[0]
    const valid = await bcrypt.compare(password, user.password_hash)
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials' })
    }

    const token = signToken(user)
    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    })
  } catch (err) {
    next(err)
  }
})

router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const result = await pool.query('SELECT id, name, email, role FROM users WHERE id = $1', [
      req.user.id,
    ])
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' })
    }
    res.json(result.rows[0])
  } catch (err) {
    next(err)
  }
})

router.get('/users', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const result = await pool.query(
      'SELECT id, name, email, role, created_at FROM users ORDER BY created_at DESC'
    )
    res.json(result.rows)
  } catch (err) {
    next(err)
  }
})

// POST /forgot-password
router.post('/forgot-password', async (req, res, next) => {
  try {
    const email = (req.body.email || '').trim().toLowerCase()
    if (!email) {
      return res.status(400).json({ error: 'Email is required' })
    }

    const result = await pool.query('SELECT id FROM users WHERE LOWER(email) = $1', [email])
    if (result.rows.length > 0) {
      const token = crypto.randomBytes(32).toString('hex')
      const expires = new Date(Date.now() + 60 * 60 * 1000) // 1 hour

      await pool.query(
        'UPDATE users SET reset_token = $1, reset_token_expires = $2 WHERE id = $3',
        [token, expires, result.rows[0].id]
      )

      const transporter = getTransporter()
      if (transporter) {
        const appUrl = process.env.APP_URL || req.headers.origin || req.headers.referer?.replace(/\/[^/]*$/, '') || 'http://localhost:5173'
        const resetUrl = `${appUrl}/reset-password?token=${token}`
        const from = process.env.EMAIL_FROM || 'scouting@localhost'

        await transporter.sendMail({
          from,
          to: email,
          subject: 'Password Reset - BYU Scouting',
          html: `<p>You requested a password reset.</p><p><a href="${resetUrl}">Click here to reset your password</a></p><p>This link expires in 1 hour.</p><p>If you did not request this, ignore this email.</p>`,
        })
      }
    }

    // Always return success to avoid revealing whether email exists
    res.json({ message: 'If an account with that email exists, a reset link has been sent.' })
  } catch (err) {
    next(err)
  }
})

// GET /verify-reset-token/:token
router.get('/verify-reset-token/:token', async (req, res, next) => {
  try {
    const { token } = req.params
    const result = await pool.query(
      'SELECT id FROM users WHERE reset_token = $1 AND reset_token_expires > NOW()',
      [token]
    )
    res.json({ valid: result.rows.length > 0 })
  } catch (err) {
    next(err)
  }
})

// POST /reset-password
router.post('/reset-password', async (req, res, next) => {
  try {
    const { token, password } = req.body
    if (!token || !password) {
      return res.status(400).json({ error: 'Token and password are required' })
    }

    const result = await pool.query(
      'SELECT id FROM users WHERE reset_token = $1 AND reset_token_expires > NOW()',
      [token]
    )
    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid or expired reset token' })
    }

    const passwordHash = await bcrypt.hash(password, 10)
    await pool.query(
      'UPDATE users SET password_hash = $1, reset_token = NULL, reset_token_expires = NULL WHERE id = $2',
      [passwordHash, result.rows[0].id]
    )

    res.json({ message: 'Password has been reset successfully' })
  } catch (err) {
    next(err)
  }
})

async function createUser({ name, email, password, role }, res, next) {
  try {
    const passwordHash = await bcrypt.hash(password, 10)
    const result = await pool.query(
      `INSERT INTO users (name, email, password_hash, role)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, email, role`,
      [name || '', email, passwordHash, role || 'scout']
    )

    const user = result.rows[0]
    const token = signToken(user)
    res.status(201).json({ token, user })
  } catch (err) {
    next(err)
  }
}

export default router
