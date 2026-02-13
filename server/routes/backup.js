import { Router } from 'express'
import crypto from 'crypto'
import pool from '../db.js'
import { requireAdmin } from '../middleware/auth.js'
import { validate, restoreBackupSchema } from '../middleware/validate.js'

const router = Router()

// Encryption key from environment (32 bytes for AES-256)
const BACKUP_ENCRYPTION_KEY = process.env.BACKUP_ENCRYPTION_KEY

// Encrypt data with AES-256-GCM
function encryptBackup(data) {
  if (!BACKUP_ENCRYPTION_KEY) {
    return { encrypted: false, data }
  }

  const key = crypto.scryptSync(BACKUP_ENCRYPTION_KEY, 'salt', 32)
  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)

  const jsonData = JSON.stringify(data)
  let encrypted = cipher.update(jsonData, 'utf8', 'base64')
  encrypted += cipher.final('base64')

  const authTag = cipher.getAuthTag()

  return {
    encrypted: true,
    iv: iv.toString('base64'),
    authTag: authTag.toString('base64'),
    data: encrypted,
    checksum: crypto.createHash('sha256').update(jsonData).digest('hex'),
  }
}

// Decrypt data with AES-256-GCM
function decryptBackup(encryptedData) {
  if (!encryptedData.encrypted) {
    return encryptedData.data
  }

  if (!BACKUP_ENCRYPTION_KEY) {
    throw new Error('BACKUP_ENCRYPTION_KEY required to decrypt backup')
  }

  const key = crypto.scryptSync(BACKUP_ENCRYPTION_KEY, 'salt', 32)
  const iv = Buffer.from(encryptedData.iv, 'base64')
  const authTag = Buffer.from(encryptedData.authTag, 'base64')

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(authTag)

  let decrypted = decipher.update(encryptedData.data, 'base64', 'utf8')
  decrypted += decipher.final('utf8')

  const data = JSON.parse(decrypted)

  // Verify checksum
  const checksum = crypto.createHash('sha256').update(decrypted).digest('hex')
  if (checksum !== encryptedData.checksum) {
    throw new Error('Backup integrity check failed')
  }

  return data
}

// GET backup - export all data as JSON (encrypted if key is set)
router.get('/backup', requireAdmin, async (req, res, next) => {
  try {
    const players = await pool.query('SELECT * FROM players ORDER BY id')
    const games = await pool.query('SELECT * FROM games ORDER BY id')
    const gamePlayers = await pool.query('SELECT * FROM game_players ORDER BY game_id, player_id')
    const stats = await pool.query('SELECT * FROM stats ORDER BY id')

    const backupData = {
      version: '2.0',
      exported_at: new Date().toISOString(),
      data: {
        players: players.rows,
        games: games.rows,
        game_players: gamePlayers.rows,
        stats: stats.rows,
      },
    }

    const backup = encryptBackup(backupData)
    res.json(backup)
  } catch (err) {
    next(err)
  }
})

// POST restore - import JSON data (handles both encrypted and unencrypted)
router.post('/restore', requireAdmin, async (req, res, next) => {
  const client = await pool.connect()

  try {
    let backupData
    const body = req.body

    // Handle encrypted backups
    if (body.encrypted) {
      try {
        backupData = decryptBackup(body)
      } catch (err) {
        return res.status(400).json({
          error: 'Failed to decrypt backup: ' + err.message,
        })
      }
    } else if (body.data) {
      // Unencrypted backup with data wrapper
      backupData = body
    } else {
      return res.status(400).json({
        error: 'Invalid backup format',
      })
    }

    const { data } = backupData

    if (!data || !data.players || !data.games || !data.stats) {
      return res.status(400).json({
        error: 'Invalid backup format. Expected data with players, games, and stats arrays.',
      })
    }

    await client.query('BEGIN')

    // Clear existing data (in reverse order of dependencies)
    await client.query('DELETE FROM stats')
    await client.query('DELETE FROM game_players')
    await client.query('DELETE FROM games')
    await client.query('DELETE FROM players')

    // Reset sequences
    await client.query('ALTER SEQUENCE players_id_seq RESTART WITH 1')
    await client.query('ALTER SEQUENCE games_id_seq RESTART WITH 1')
    await client.query('ALTER SEQUENCE stats_id_seq RESTART WITH 1')

    // Insert players
    for (const player of data.players) {
      await client.query(
        `INSERT INTO players (id, name, position, offense_position, defense_position, school, grad_year, notes, flagged, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          player.id,
          player.name,
          player.position,
          player.offense_position,
          player.defense_position,
          player.school,
          player.grad_year,
          player.notes,
          player.flagged,
          player.created_at || new Date(),
        ]
      )
    }

    // Update player sequence to max id + 1
    if (data.players.length > 0) {
      const maxPlayerId = Math.max(...data.players.map((p) => p.id))
      await client.query(`ALTER SEQUENCE players_id_seq RESTART WITH ${maxPlayerId + 1}`)
    }

    // Insert games
    for (const game of data.games) {
      await client.query(
        `INSERT INTO games (id, opponent, date, location, competition_level, video_url, notes, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          game.id,
          game.opponent,
          game.date,
          game.location,
          game.competition_level,
          game.video_url,
          game.notes,
          game.created_at || new Date(),
        ]
      )
    }

    // Update game sequence
    if (data.games.length > 0) {
      const maxGameId = Math.max(...data.games.map((g) => g.id))
      await client.query(`ALTER SEQUENCE games_id_seq RESTART WITH ${maxGameId + 1}`)
    }

    // Insert game_players associations
    if (data.game_players) {
      for (const gp of data.game_players) {
        await client.query(
          'INSERT INTO game_players (game_id, player_id) VALUES ($1, $2)',
          [gp.game_id, gp.player_id]
        )
      }
    }

    // Insert stats
    for (const stat of data.stats) {
      await client.query(
        `INSERT INTO stats (id, game_id, player_id, stat_type, value, timestamp, period, note, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          stat.id,
          stat.game_id,
          stat.player_id,
          stat.stat_type,
          stat.value,
          stat.timestamp,
          stat.period,
          stat.note,
          stat.created_at || new Date(),
        ]
      )
    }

    // Update stats sequence
    if (data.stats.length > 0) {
      const maxStatId = Math.max(...data.stats.map((s) => s.id))
      await client.query(`ALTER SEQUENCE stats_id_seq RESTART WITH ${maxStatId + 1}`)
    }

    await client.query('COMMIT')

    res.json({
      message: 'Restore completed successfully',
      counts: {
        players: data.players.length,
        games: data.games.length,
        game_players: data.game_players?.length || 0,
        stats: data.stats.length,
      },
    })
  } catch (err) {
    await client.query('ROLLBACK')
    next(err)
  } finally {
    client.release()
  }
})

export default router
