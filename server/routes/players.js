import { Router } from 'express'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import pool from '../db.js'
import { logAudit, getClientIp } from '../middleware/audit.js'
import { validate, createPlayerSchema, updatePlayerSchema } from '../middleware/validate.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const uploadsDir = path.join(__dirname, '..', 'uploads')

// Ensure uploads directory exists
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true })
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname)
    cb(null, `player-${req.params.id}-${Date.now()}${ext}`)
  },
})

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /\.(jpg|jpeg|png|gif|webp)$/i
    if (allowed.test(path.extname(file.originalname))) {
      cb(null, true)
    } else {
      cb(new Error('Only image files are allowed'))
    }
  },
})

const router = Router()

// Normalize recruiting statuses: enforce business rules, deduplicate, default
function normalizeStatuses(statuses) {
  if (!statuses || !Array.isArray(statuses) || statuses.length === 0) {
    return ['Watching']
  }
  const set = new Set(statuses)
  // "Committed" implies "Offered"
  if (set.has('Committed') && !set.has('Offered')) {
    set.add('Offered')
  }
  return [...set]
}

// GET all players with optional filtering
router.get('/', async (req, res, next) => {
  try {
    const {
      search,
      state,
      position,
      grad_year,
      flagged,
      recruiting_status, // filter: show players whose statuses include this value
      side,
    } = req.query

    let query = 'SELECT * FROM players WHERE 1=1'
    const params = []
    let paramIndex = 1

    // Text search (name, school)
    if (search) {
      query += ` AND (LOWER(name) LIKE LOWER($${paramIndex}) OR LOWER(school) LIKE LOWER($${paramIndex}))`
      params.push(`%${search}%`)
      paramIndex++
    }

    // State filter
    if (state) {
      query += ` AND LOWER(state) = LOWER($${paramIndex})`
      params.push(state)
      paramIndex++
    }

    // Position filter (checks any position field)
    if (position) {
      query += ` AND (LOWER(position) = LOWER($${paramIndex}) OR LOWER(offense_position) = LOWER($${paramIndex}) OR LOWER(defense_position) = LOWER($${paramIndex}))`
      params.push(position)
      paramIndex++
    }

    // Graduation year filter
    if (grad_year) {
      query += ` AND grad_year = $${paramIndex}`
      params.push(grad_year)
      paramIndex++
    }

    // Flagged filter
    if (flagged !== undefined) {
      query += ` AND flagged = $${paramIndex}`
      params.push(flagged === 'true' || flagged === true)
      paramIndex++
    }

    // Recruiting status filter (array contains)
    if (recruiting_status) {
      query += ` AND recruiting_statuses @> ARRAY[$${paramIndex}]`
      params.push(recruiting_status)
      paramIndex++
    }

    // Side filter (offense/defense)
    if (side === 'offense') {
      query += ` AND offense_position IS NOT NULL AND offense_position != ''`
    } else if (side === 'defense') {
      query += ` AND defense_position IS NOT NULL AND defense_position != ''`
    }

    query += ' ORDER BY created_at DESC'

    const result = await pool.query(query, params)
    res.json(result.rows)
  } catch (err) {
    next(err)
  }
})

// GET single player
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params
    const result = await pool.query('SELECT * FROM players WHERE id = $1', [id])
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Player not found' })
    }
    res.json(result.rows[0])
  } catch (err) {
    next(err)
  }
})

// GET player status history
router.get('/:id/status-history', async (req, res, next) => {
  try {
    const { id } = req.params
    const result = await pool.query(
      `SELECT psh.*, u.name as changed_by_name, u.email as changed_by_email
       FROM player_status_history psh
       LEFT JOIN users u ON u.id = psh.changed_by
       WHERE psh.player_id = $1
       ORDER BY psh.changed_at DESC`,
      [id]
    )
    res.json(result.rows)
  } catch (err) {
    next(err)
  }
})

// POST create player
router.post('/', validate(createPlayerSchema), async (req, res, next) => {
  try {
    const {
      name,
      position,
      offense_position,
      defense_position,
      school,
      state,
      grad_year,
      notes,
      flagged = true,
      cut_up_completed = false,
      recruiting_statuses: rawStatuses,
      status_notes,
      committed_school,
      committed_date,
      composite_rating,
    } = req.body

    const recruiting_statuses = normalizeStatuses(rawStatuses)
    const effectiveCommittedSchool =
      recruiting_statuses.includes('Committed Elsewhere') ? (committed_school || null) : null
    const effectiveCommittedDate =
      recruiting_statuses.includes('Committed Elsewhere') ? (committed_date || null) : null

    const result = await pool.query(
      `INSERT INTO players (name, position, offense_position, defense_position, school, state, grad_year, notes, flagged, cut_up_completed, recruiting_statuses, status_notes, committed_school, committed_date, composite_rating)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
       RETURNING *`,
      [name, position, offense_position, defense_position, school, state, grad_year, notes, flagged, cut_up_completed, recruiting_statuses, status_notes, effectiveCommittedSchool, effectiveCommittedDate, composite_rating || null]
    )

    const newPlayer = result.rows[0]

    // Log audit
    await logAudit({
      userId: req.user?.id,
      userEmail: req.user?.email,
      action: 'CREATE',
      tableName: 'players',
      recordId: newPlayer.id,
      newValues: newPlayer,
      ipAddress: getClientIp(req),
    })

    // Log initial status to history
    await pool.query(
      `INSERT INTO player_status_history (player_id, old_status, new_status, notes, changed_by)
       VALUES ($1, NULL, $2, $3, $4)`,
      [newPlayer.id, recruiting_statuses, 'Initial status', req.user?.id]
    )

    res.status(201).json(newPlayer)
  } catch (err) {
    next(err)
  }
})

// PUT update player
router.put('/:id', validate(updatePlayerSchema), async (req, res, next) => {
  try {
    const { id } = req.params
    const {
      name,
      position,
      offense_position,
      defense_position,
      school,
      state,
      grad_year,
      notes,
      flagged,
      cut_up_completed,
      recruiting_statuses: rawStatuses,
      status_notes,
      committed_school,
      committed_date,
      composite_rating,
    } = req.body

    // Get current player for audit and status tracking
    const currentResult = await pool.query('SELECT * FROM players WHERE id = $1', [id])
    if (currentResult.rows.length === 0) {
      return res.status(404).json({ error: 'Player not found' })
    }
    const currentPlayer = currentResult.rows[0]

    // Normalize statuses if provided
    const recruiting_statuses = rawStatuses !== undefined
      ? normalizeStatuses(rawStatuses)
      : undefined

    // Check if recruiting statuses are changing (compare sorted arrays)
    const oldSorted = (currentPlayer.recruiting_statuses || []).slice().sort().join(',')
    const newSorted = recruiting_statuses !== undefined ? recruiting_statuses.slice().sort().join(',') : oldSorted
    const statusChanging = recruiting_statuses !== undefined && newSorted !== oldSorted

    // Determine committed_school value
    const effectiveStatuses = recruiting_statuses || currentPlayer.recruiting_statuses || []
    let effectiveCommittedSchool = currentPlayer.committed_school
    let effectiveCommittedDate = currentPlayer.committed_date
    if (effectiveStatuses.includes('Committed Elsewhere')) {
      if (committed_school !== undefined) effectiveCommittedSchool = committed_school
      if (committed_date !== undefined) effectiveCommittedDate = committed_date
    } else {
      effectiveCommittedSchool = null
      effectiveCommittedDate = null
    }

    // Build update query with status_updated_at
    const result = await pool.query(
      `UPDATE players
       SET name = COALESCE($1, name),
           position = COALESCE($2, position),
           offense_position = COALESCE($3, offense_position),
           defense_position = COALESCE($4, defense_position),
           school = COALESCE($5, school),
           state = COALESCE($6, state),
           grad_year = COALESCE($7, grad_year),
           notes = COALESCE($8, notes),
           flagged = COALESCE($9, flagged),
           cut_up_completed = COALESCE($10, cut_up_completed),
           recruiting_statuses = COALESCE($11, recruiting_statuses),
           status_notes = COALESCE($12, status_notes),
           committed_school = $14,
           committed_date = $15,
           composite_rating = COALESCE($16, composite_rating),
           status_updated_at = CASE WHEN $11 IS NOT NULL AND $11::text != recruiting_statuses::text THEN CURRENT_TIMESTAMP ELSE status_updated_at END
       WHERE id = $13
       RETURNING *`,
      [
        name,
        position,
        offense_position,
        defense_position,
        school,
        state,
        grad_year,
        notes,
        flagged,
        cut_up_completed,
        recruiting_statuses || null,
        status_notes,
        id,
        effectiveCommittedSchool,
        effectiveCommittedDate,
        composite_rating !== undefined ? composite_rating : null,
      ]
    )

    const updatedPlayer = result.rows[0]

    // Log status change to history if statuses changed
    if (statusChanging) {
      await pool.query(
        `INSERT INTO player_status_history (player_id, old_status, new_status, notes, changed_by)
         VALUES ($1, $2, $3, $4, $5)`,
        [id, currentPlayer.recruiting_statuses, recruiting_statuses, status_notes || null, req.user?.id]
      )
    }

    // Log audit
    await logAudit({
      userId: req.user?.id,
      userEmail: req.user?.email,
      action: 'UPDATE',
      tableName: 'players',
      recordId: parseInt(id),
      oldValues: currentPlayer,
      newValues: updatedPlayer,
      ipAddress: getClientIp(req),
    })

    res.json(updatedPlayer)
  } catch (err) {
    next(err)
  }
})

// DELETE player
router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params

    // Get current player for audit
    const currentResult = await pool.query('SELECT * FROM players WHERE id = $1', [id])
    if (currentResult.rows.length === 0) {
      return res.status(404).json({ error: 'Player not found' })
    }
    const currentPlayer = currentResult.rows[0]

    const result = await pool.query(
      'DELETE FROM players WHERE id = $1 RETURNING *',
      [id]
    )

    // Log audit
    await logAudit({
      userId: req.user?.id,
      userEmail: req.user?.email,
      action: 'DELETE',
      tableName: 'players',
      recordId: parseInt(id),
      oldValues: currentPlayer,
      ipAddress: getClientIp(req),
    })

    res.json({ message: 'Player deleted', player: result.rows[0] })
  } catch (err) {
    next(err)
  }
})

// POST upload player photo
router.post('/:id/photo', upload.single('image'), async (req, res, next) => {
  try {
    const { id } = req.params
    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided' })
    }

    // Delete old photo file if it exists
    const currentResult = await pool.query('SELECT profile_picture_url FROM players WHERE id = $1', [id])
    if (currentResult.rows.length === 0) {
      // Clean up uploaded file
      fs.unlinkSync(req.file.path)
      return res.status(404).json({ error: 'Player not found' })
    }
    const oldUrl = currentResult.rows[0].profile_picture_url
    if (oldUrl) {
      const oldPath = path.join(__dirname, '..', oldUrl)
      if (fs.existsSync(oldPath)) {
        fs.unlinkSync(oldPath)
      }
    }

    const profileUrl = `/uploads/${req.file.filename}`
    const result = await pool.query(
      'UPDATE players SET profile_picture_url = $1 WHERE id = $2 RETURNING *',
      [profileUrl, id]
    )

    res.json(result.rows[0])
  } catch (err) {
    next(err)
  }
})

// DELETE player photo
router.delete('/:id/photo', async (req, res, next) => {
  try {
    const { id } = req.params
    const currentResult = await pool.query('SELECT profile_picture_url FROM players WHERE id = $1', [id])
    if (currentResult.rows.length === 0) {
      return res.status(404).json({ error: 'Player not found' })
    }

    const oldUrl = currentResult.rows[0].profile_picture_url
    if (oldUrl) {
      const oldPath = path.join(__dirname, '..', oldUrl)
      if (fs.existsSync(oldPath)) {
        fs.unlinkSync(oldPath)
      }
    }

    await pool.query('UPDATE players SET profile_picture_url = NULL WHERE id = $1', [id])
    res.json({ message: 'Photo deleted' })
  } catch (err) {
    next(err)
  }
})

export default router
