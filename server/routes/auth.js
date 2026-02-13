import { Router } from 'express'
import bcrypt from 'bcryptjs'
import pool from '../db.js'
import { requireAuth, requireAdmin, signToken } from '../middleware/auth.js'

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
    const { name, email, password, role } = req.body
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' })
    }

    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email])
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
    const { email, password } = req.body
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' })
    }

    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email])
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
