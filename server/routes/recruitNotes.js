import { Router } from 'express'
import pool from '../db.js'
import { logAudit, getClientIp } from '../middleware/audit.js'

const router = Router()

// POST create note
router.post('/', async (req, res, next) => {
  try {
    const { recruit_id, week_start_date, note_date, source, link, summary, quote } = req.body
    if (!recruit_id || !week_start_date) {
      return res.status(400).json({ error: 'recruit_id and week_start_date are required' })
    }

    const result = await pool.query(
      `INSERT INTO recruit_notes (recruit_id, week_start_date, note_date, source, link, summary, quote, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING *`,
      [recruit_id, week_start_date, note_date, source, link, summary, quote, req.user?.id || null]
    )

    const note = result.rows[0]
    await logAudit({
      userId: req.user?.id,
      userEmail: req.user?.email,
      action: 'CREATE',
      tableName: 'recruit_notes',
      recordId: note.id,
      newValues: note,
      ipAddress: getClientIp(req),
    })

    res.status(201).json(note)
  } catch (err) {
    next(err)
  }
})

// PUT update note
router.put('/:id', async (req, res, next) => {
  try {
    const { id } = req.params
    const { note_date, source, link, summary, quote } = req.body

    const existing = await pool.query('SELECT * FROM recruit_notes WHERE id = $1', [id])
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Note not found' })
    }

    const result = await pool.query(
      `UPDATE recruit_notes
       SET note_date = COALESCE($1, note_date),
           source = COALESCE($2, source),
           link = COALESCE($3, link),
           summary = COALESCE($4, summary),
           quote = COALESCE($5, quote)
       WHERE id = $6
       RETURNING *`,
      [note_date, source, link, summary, quote, id]
    )

    const note = result.rows[0]
    await logAudit({
      userId: req.user?.id,
      userEmail: req.user?.email,
      action: 'UPDATE',
      tableName: 'recruit_notes',
      recordId: note.id,
      oldValues: existing.rows[0],
      newValues: note,
      ipAddress: getClientIp(req),
    })

    res.json(note)
  } catch (err) {
    next(err)
  }
})

// DELETE note
router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params
    const existing = await pool.query('SELECT * FROM recruit_notes WHERE id = $1', [id])
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Note not found' })
    }

    await pool.query('DELETE FROM recruit_notes WHERE id = $1', [id])

    await logAudit({
      userId: req.user?.id,
      userEmail: req.user?.email,
      action: 'DELETE',
      tableName: 'recruit_notes',
      recordId: parseInt(id, 10),
      oldValues: existing.rows[0],
      ipAddress: getClientIp(req),
    })

    res.json({ message: 'Note deleted' })
  } catch (err) {
    next(err)
  }
})

export default router
