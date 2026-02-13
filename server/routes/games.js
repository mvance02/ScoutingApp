import { Router } from 'express'
import pool from '../db.js'

const router = Router()

// GET all games with player counts
router.get('/', async (req, res, next) => {
  try {
    const result = await pool.query(`
      SELECT g.*,
             COALESCE(
               (SELECT json_agg(p.id)
                FROM game_players gp
                JOIN players p ON p.id = gp.player_id
                WHERE gp.game_id = g.id),
               '[]'
             ) as player_ids
      FROM games g
      ORDER BY g.created_at DESC
    `)
    res.json(result.rows)
  } catch (err) {
    next(err)
  }
})

// GET single game with players
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params
    const gameResult = await pool.query('SELECT * FROM games WHERE id = $1', [id])

    if (gameResult.rows.length === 0) {
      return res.status(404).json({ error: 'Game not found' })
    }

    const playersResult = await pool.query(`
      SELECT p.* FROM players p
      JOIN game_players gp ON p.id = gp.player_id
      WHERE gp.game_id = $1
    `, [id])

    res.json({
      ...gameResult.rows[0],
      players: playersResult.rows,
    })
  } catch (err) {
    next(err)
  }
})

// POST create game
router.post('/', async (req, res, next) => {
  try {
    const {
      opponent,
      date,
      location,
      competition_level,
      video_url,
      notes,
    } = req.body

    const result = await pool.query(
      `INSERT INTO games (opponent, date, location, competition_level, video_url, notes)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [opponent, date, location, competition_level, video_url, notes]
    )
    res.status(201).json(result.rows[0])
  } catch (err) {
    next(err)
  }
})

// PUT update game
router.put('/:id', async (req, res, next) => {
  try {
    const { id } = req.params
    const {
      opponent,
      date,
      location,
      competition_level,
      video_url,
      notes,
    } = req.body

    const result = await pool.query(
      `UPDATE games
       SET opponent = COALESCE($1, opponent),
           date = COALESCE($2, date),
           location = COALESCE($3, location),
           competition_level = COALESCE($4, competition_level),
           video_url = COALESCE($5, video_url),
           notes = COALESCE($6, notes)
       WHERE id = $7
       RETURNING *`,
      [opponent, date, location, competition_level, video_url, notes, id]
    )

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Game not found' })
    }
    res.json(result.rows[0])
  } catch (err) {
    next(err)
  }
})

// DELETE game
router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params
    const result = await pool.query(
      'DELETE FROM games WHERE id = $1 RETURNING *',
      [id]
    )
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Game not found' })
    }
    res.json({ message: 'Game deleted', game: result.rows[0] })
  } catch (err) {
    next(err)
  }
})

// POST update game players (set the player list for a game)
router.post('/:id/players', async (req, res, next) => {
  const client = await pool.connect()
  try {
    const { id } = req.params
    const { player_ids } = req.body

    await client.query('BEGIN')

    // Check game exists
    const gameCheck = await client.query('SELECT id FROM games WHERE id = $1', [id])
    if (gameCheck.rows.length === 0) {
      await client.query('ROLLBACK')
      return res.status(404).json({ error: 'Game not found' })
    }

    // Remove existing associations
    await client.query('DELETE FROM game_players WHERE game_id = $1', [id])

    // Add new associations
    if (player_ids && player_ids.length > 0) {
      const values = player_ids.map((pid, i) => `($1, $${i + 2})`).join(', ')
      await client.query(
        `INSERT INTO game_players (game_id, player_id) VALUES ${values}`,
        [id, ...player_ids]
      )
    }

    await client.query('COMMIT')

    // Return updated game with players
    const result = await pool.query(`
      SELECT p.* FROM players p
      JOIN game_players gp ON p.id = gp.player_id
      WHERE gp.game_id = $1
    `, [id])

    res.json({ game_id: id, players: result.rows })
  } catch (err) {
    await client.query('ROLLBACK')
    next(err)
  } finally {
    client.release()
  }
})

export default router
