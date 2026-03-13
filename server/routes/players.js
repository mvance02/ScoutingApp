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
      home_state,
      grad_year,
      notes,
      flagged = true,
      cut_up_completed = false,
      recruiting_statuses: rawStatuses,
      status_notes,
      committed_school,
      committed_date,
      composite_rating,
      height_in,
      weight_lb,
      forty_time,
      arm_length_in,
      hand_size_in,
      undersized_traits,
      is_juco = false,
      is_transfer_wishlist = false,
      is_lds,
      offered_date,
      eligibility_years_left,
      recruiting_context,
      immediate_impact_tag,
      risk_notes,
      current_school_level,
      portal_status,
      transfer_reason,
      other_offers,
    } = req.body

    const recruiting_statuses = normalizeStatuses(rawStatuses)
    const effectiveCommittedSchool =
      recruiting_statuses.includes('Committed Elsewhere') ? (committed_school || null) : null
    const effectiveCommittedDate =
      recruiting_statuses.includes('Committed Elsewhere') ? (committed_date || null) : null

    const result = await pool.query(
      `INSERT INTO players (
         name,
         position,
         offense_position,
         defense_position,
         school,
         state,
         home_state,
         grad_year,
         notes,
         flagged,
         cut_up_completed,
         recruiting_statuses,
         status_notes,
         committed_school,
         committed_date,
         composite_rating,
         height_in,
         weight_lb,
         forty_time,
         arm_length_in,
         hand_size_in,
         undersized_traits,
         is_juco,
         is_transfer_wishlist,
         is_lds,
         offered_date,
         eligibility_years_left,
         recruiting_context,
         immediate_impact_tag,
         risk_notes,
         current_school_level,
         portal_status,
         transfer_reason,
         other_offers
       )
       VALUES (
         $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
         $11, $12, $13, $14, $15, $16, $17, $18, $19,
         $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33, $34
       )
       RETURNING *`,
      [
        name,
        position,
        offense_position,
        defense_position,
        school,
        state,
        home_state || null,
        grad_year,
        notes,
        flagged,
        cut_up_completed,
        recruiting_statuses,
        status_notes,
        effectiveCommittedSchool,
        effectiveCommittedDate,
        composite_rating || null,
        height_in ?? null,
        weight_lb ?? null,
        forty_time ?? null,
        arm_length_in ?? null,
        hand_size_in ?? null,
        Array.isArray(undersized_traits) ? undersized_traits : [],
        is_juco || false,
        is_transfer_wishlist || false,
        is_lds || null,
        offered_date || null,
        eligibility_years_left ?? null,
        recruiting_context || null,
        immediate_impact_tag || null,
        risk_notes || null,
        current_school_level || null,
        portal_status || null,
        transfer_reason || null,
        other_offers || null,
      ]
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
      home_state,
      grad_year,
      notes,
      flagged,
      cut_up_completed,
      recruiting_statuses: rawStatuses,
      status_notes,
      committed_school,
      committed_date,
      composite_rating,
      height_in,
      weight_lb,
      forty_time,
      arm_length_in,
      hand_size_in,
      undersized_traits,
      is_juco,
      is_transfer_wishlist,
      is_lds,
      offered_date,
      eligibility_years_left,
      recruiting_context,
      immediate_impact_tag,
      risk_notes,
      current_school_level,
      portal_status,
      transfer_reason,
      other_offers,
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
           home_state = COALESCE($7, home_state),
           grad_year = COALESCE($8, grad_year),
           notes = COALESCE($9, notes),
           flagged = COALESCE($10, flagged),
           cut_up_completed = COALESCE($11, cut_up_completed),
           recruiting_statuses = COALESCE($12, recruiting_statuses),
           status_notes = COALESCE($13, status_notes),
           committed_school = $15,
           committed_date = $16,
           composite_rating = COALESCE($17, composite_rating),
           height_in = COALESCE($18, height_in),
           weight_lb = COALESCE($19, weight_lb),
           forty_time = COALESCE($20, forty_time),
           arm_length_in = COALESCE($21, arm_length_in),
           hand_size_in = COALESCE($22, hand_size_in),
           undersized_traits = COALESCE($23, undersized_traits),
           is_juco = COALESCE($24, is_juco),
           is_transfer_wishlist = COALESCE($25, is_transfer_wishlist),
           is_lds = CASE WHEN $26 IS NOT NULL THEN $26 ELSE is_lds END,
           offered_date = CASE WHEN $27 IS NOT NULL THEN $27 ELSE offered_date END,
           eligibility_years_left = COALESCE($28, eligibility_years_left),
           recruiting_context = COALESCE($29, recruiting_context),
           immediate_impact_tag = COALESCE($30, immediate_impact_tag),
           risk_notes = COALESCE($31, risk_notes),
           current_school_level = COALESCE($32, current_school_level),
           portal_status = COALESCE($33, portal_status),
           transfer_reason = COALESCE($34, transfer_reason),
           other_offers = COALESCE($35, other_offers),
           status_updated_at = CASE WHEN $12 IS NOT NULL AND $12::text != recruiting_statuses::text THEN CURRENT_TIMESTAMP ELSE status_updated_at END
       WHERE id = $14
       RETURNING *`,
      [
        name,
        position,
        offense_position,
        defense_position,
        school,
        state,
        home_state || null,
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
        height_in !== undefined ? height_in : null,
        weight_lb !== undefined ? weight_lb : null,
        forty_time !== undefined ? forty_time : null,
        arm_length_in !== undefined ? arm_length_in : null,
        hand_size_in !== undefined ? hand_size_in : null,
        undersized_traits !== undefined ? (Array.isArray(undersized_traits) ? undersized_traits : []) : null,
        is_juco !== undefined ? is_juco : null,
        is_transfer_wishlist !== undefined ? is_transfer_wishlist : null,
        is_lds !== undefined ? is_lds : null,
        offered_date !== undefined ? offered_date : null,
        eligibility_years_left ?? null,
        recruiting_context || null,
        immediate_impact_tag || null,
        risk_notes || null,
        current_school_level || null,
        portal_status || null,
        transfer_reason || null,
        other_offers || null,
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
