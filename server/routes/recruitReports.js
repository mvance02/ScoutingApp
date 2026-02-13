import { Router } from 'express'
import pool from '../db.js'
import { logAudit, getClientIp } from '../middleware/audit.js'

const router = Router()

const COACH_MAP = {
  QB: 'Aaron Roderick',
  RB: 'Harvey Unga',
  WR: 'Fesi Sitake',
  TE: 'Kevin Gilbride',
  OL: 'TJ Woods',
  DL: "Sione Po'uha",
  DE: "Sione Po'uha",
  LB: "Kelly Poppinga / Chad Kauha'aha'a",
  C: 'Lewis Walker',
  S: 'Demario Warren',
  K: 'Justin Ena',
  P: 'Justin Ena',
}

const OFFENSE_POSITIONS = ['QB', 'RB', 'WR', 'TE', 'OL']
const DEFENSE_POSITIONS = ['DL', 'DE', 'LB', 'C', 'S']
const SPECIAL_POSITIONS = ['K', 'P']

function deriveSideOfBall(position) {
  if (OFFENSE_POSITIONS.includes(position)) return 'OFFENSE'
  if (DEFENSE_POSITIONS.includes(position)) return 'DEFENSE'
  if (SPECIAL_POSITIONS.includes(position)) return 'SPECIAL'
  return null
}

const STATUS_PRIORITY = [
  'SIGNED',
  'COMMITTED ELSEWHERE',
  'COMMITTED',
  'OFFERED',
  'EVALUATED',
  'RECRUIT',
  'PASSED',
  'WATCHING',
]

const ELIGIBLE_RECRUIT_STATUSES = new Set([
  'OFFERED',
  'COMMITTED',
  'COMMITTED ELSEWHERE',
  'SIGNED',
])

function normalizeRecruitingStatus(status) {
  if (!status) return null
  const normalized = status.toString().trim().toLowerCase()
  if (normalized === 'committed') return 'COMMITTED'
  if (normalized === 'offered' || normalized === 'offer') return 'OFFERED'
  if (normalized === 'committed elsewhere') return 'COMMITTED ELSEWHERE'
  if (normalized === 'recruit') return 'RECRUIT'
  if (normalized === 'evaluated' || normalized === 'evaluating') return 'EVALUATED'
  if (normalized === 'signed') return 'SIGNED'
  if (normalized === 'passed' || normalized === 'not interested') return 'PASSED'
  if (normalized === 'watching') return 'WATCHING'
  if (normalized === 'interested' || normalized === 'priority') return 'RECRUIT'
  return status.toString().toUpperCase()
}

function deriveRecruitStatus(statuses) {
  const list = Array.isArray(statuses) ? statuses : [statuses]
  const mapped = list.map(normalizeRecruitingStatus).filter(Boolean)
  if (mapped.length === 0) return 'WATCHING'
  for (const priority of STATUS_PRIORITY) {
    if (mapped.includes(priority)) return priority
  }
  return mapped[0]
}

function hasEligibleRecruitStatus(statuses) {
  const list = Array.isArray(statuses) ? statuses : [statuses]
  return list.map(normalizeRecruitingStatus).some((status) => ELIGIBLE_RECRUIT_STATUSES.has(status))
}

// Sync players with recruiting_status into recruits table
async function syncPlayersToRecruits() {
  const playersResult = await pool.query(
    `SELECT id, name, school, state, grad_year, position, offense_position, defense_position, recruiting_status, committed_school
     FROM players WHERE recruiting_status IS NOT NULL`
  )

  if (playersResult.rows.length === 0) return

  const existingResult = await pool.query(
    `SELECT player_id, id FROM recruits WHERE player_id IS NOT NULL`
  )
  const syncedMap = new Map(existingResult.rows.map((r) => [r.player_id, r.id]))

  for (const player of playersResult.rows) {
    const position = player.position || player.offense_position || player.defense_position || null
    const sideOfBall = position ? deriveSideOfBall(position) : null
    const status = deriveRecruitStatus(player.recruiting_status)
    const eligible = hasEligibleRecruitStatus(player.recruiting_status)
    const assignedCoach = position ? (COACH_MAP[position] || null) : null

    if (syncedMap.has(player.id)) {
      // Update existing recruit with latest status and committed_school
      await pool.query(
        `UPDATE recruits SET status = $1, committed_school = $2 WHERE id = $3`,
        [status, player.committed_school || null, syncedMap.get(player.id)]
      )
    } else if (eligible) {
      await pool.query(
        `INSERT INTO recruits (name, school, state, class_year, position, side_of_ball, status, assigned_coach, player_id, committed_school)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          player.name,
          player.school || '',
          player.state,
          player.grad_year,
          position,
          sideOfBall,
          status,
          assignedCoach,
          player.id,
          player.committed_school || null,
        ]
      )
    }
  }
}

// Build position-specific stats JSONB from raw stat_type counts/sums
function buildStatsForPosition(position, statCounts, statSums) {
  const stats = {}
  switch (position) {
    case 'QB': {
      const comp = statCounts['Pass Comp'] || 0
      const inc = statCounts['Pass Inc'] || 0
      stats.passComp = comp
      stats.passAtt = comp + inc
      stats.completionPct = stats.passAtt > 0 ? Math.round((comp / stats.passAtt) * 100) : 0
      stats.passYards = statSums['Pass Comp'] || 0
      stats.passTD = statCounts['Pass TD'] || 0
      stats.rushYards = (statSums['Rush'] || 0) + (statSums['Rush TD'] || 0)
      stats.rushTD = statCounts['Rush TD'] || 0
      stats.interceptions = statCounts['INT'] || 0
      stats.fumbles = statCounts['Fumble'] || 0
      break
    }
    case 'RB': {
      stats.carries = (statCounts['Rush'] || 0) + (statCounts['Rush TD'] || 0)
      stats.rushYds = (statSums['Rush'] || 0) + (statSums['Rush TD'] || 0)
      stats.rushTD = statCounts['Rush TD'] || 0
      stats.receptions = (statCounts['Reception'] || 0) + (statCounts['Rec TD'] || 0)
      stats.recYds = (statSums['Reception'] || 0) + (statSums['Rec TD'] || 0)
      stats.recTD = statCounts['Rec TD'] || 0
      stats.fumbles = statCounts['Fumble'] || 0
      break
    }
    case 'WR': {
      stats.receptions = (statCounts['Reception'] || 0) + (statCounts['Rec TD'] || 0)
      stats.recYds = (statSums['Reception'] || 0) + (statSums['Rec TD'] || 0)
      stats.recTD = statCounts['Rec TD'] || 0
      stats.carries = (statCounts['Rush'] || 0) + (statCounts['Rush TD'] || 0)
      stats.rushYds = (statSums['Rush'] || 0) + (statSums['Rush TD'] || 0)
      stats.rushTD = statCounts['Rush TD'] || 0
      stats.fumbles = statCounts['Fumble'] || 0
      break
    }
    case 'TE': {
      stats.receptions = (statCounts['Reception'] || 0) + (statCounts['Rec TD'] || 0)
      stats.recYds = (statSums['Reception'] || 0) + (statSums['Rec TD'] || 0)
      stats.tds = (statCounts['Rec TD'] || 0) + (statCounts['TD'] || 0)
      stats.fumbles = statCounts['Fumble'] || 0
      break
    }
    case 'DL':
    case 'DE': {
      stats.tackles = (statCounts['Tackle Solo'] || 0) + (statCounts['Tackle Assist'] || 0)
      stats.tfl = statCounts['TFL'] || 0
      stats.pbu = statCounts['PBU'] || 0
      stats.sack = statCounts['Sack'] || 0
      stats.ff = statCounts['Forced Fumble'] || 0
      break
    }
    case 'LB': {
      stats.tackles = (statCounts['Tackle Solo'] || 0) + (statCounts['Tackle Assist'] || 0)
      stats.pbu = statCounts['PBU'] || 0
      stats.ff = statCounts['Forced Fumble'] || 0
      stats.interceptions = statCounts['INT'] || 0
      stats.sack = statCounts['Sack'] || 0
      stats.tfl = statCounts['TFL'] || 0
      break
    }
    case 'S':
    case 'C': {
      stats.pbu = statCounts['PBU'] || 0
      stats.tackles = (statCounts['Tackle Solo'] || 0) + (statCounts['Tackle Assist'] || 0)
      stats.interceptions = statCounts['INT'] || 0
      break
    }
    case 'K': {
      stats.patAtt = statCounts['PAT Att'] || 0
      stats.patMade = statCounts['PAT Made'] || 0
      stats.fgAtt = statCounts['FG Att'] || 0
      stats.fgMade = statCounts['FG Made'] || 0
      break
    }
    case 'P': {
      stats.punts = statCounts['Punt'] || 0
      stats.netAvg = statSums['Net Avg'] || 0
      break
    }
  }
  return stats
}

// Auto-populate recruit_weekly_reports from game review data
async function autoPopulateReports(weekStartDate) {
  const weekEnd = new Date(weekStartDate)
  weekEnd.setDate(weekEnd.getDate() + 5) // Tuesday + 5 = Sunday
  const weekEndDate = weekEnd.toISOString().split('T')[0]

  // Get recruits that have a linked player
  const recruitsResult = await pool.query(
    `SELECT r.id as recruit_id, r.player_id, r.position
     FROM recruits r
     WHERE r.player_id IS NOT NULL`
  )
  if (recruitsResult.rows.length === 0) return

  // Find which already have reports for this week
  const existingResult = await pool.query(
    `SELECT recruit_id, stats FROM recruit_weekly_reports WHERE week_start_date = $1`,
    [weekStartDate]
  )
  const existingMap = new Map(
    existingResult.rows.map((r) => [r.recruit_id, r.stats])
  )

  for (const recruit of recruitsResult.rows) {
    const existingStats = existingMap.get(recruit.recruit_id)
    const hasStats =
      existingStats && Object.keys(existingStats).length > 0

    // Find game for this player within the week window
    const gameResult = await pool.query(
      `SELECT g.id, g.date, g.opponent
       FROM games g
       JOIN game_players gp ON gp.game_id = g.id
       WHERE gp.player_id = $1 AND g.date >= $2 AND g.date <= $3
       ORDER BY g.date DESC
       LIMIT 1`,
      [recruit.player_id, weekStartDate, weekEndDate]
    )

    let lastGameDate = null
    let lastGameOpponent = null
    let lastGameScore = null
    let lastGameResult = null
    let nextGameDate = null
    let nextGameOpponent = null
    let notes = ''
    let stats = {}

    if (gameResult.rows.length > 0) {
      const game = gameResult.rows[0]
      lastGameDate = game.date
      lastGameOpponent = game.opponent

      // Get grades for this player+game
      const gradesResult = await pool.query(
        `SELECT game_score, next_opponent, next_game_date, admin_notes
         FROM game_player_grades
         WHERE game_id = $1 AND player_id = $2`,
        [game.id, recruit.player_id]
      )

      if (gradesResult.rows.length > 0) {
        const grade = gradesResult.rows[0]
        if (grade.game_score) {
          // Parse W/L prefix from game_score (e.g. "W 35-14" or "L 10-24")
          const scoreStr = grade.game_score.trim()
          const match = scoreStr.match(/^([WL])\s*(.*)$/)
          if (match) {
            lastGameResult = match[1] === 'W' ? 'Win' : 'Loss'
            lastGameScore = match[2].trim()
          } else {
            lastGameScore = scoreStr
          }
        }
        nextGameOpponent = grade.next_opponent || null
        if (grade.next_game_date) {
          const parts = grade.next_game_date.split('/')
          nextGameDate = parts.length === 3 ? `${parts[2]}-${parts[0]}-${parts[1]}` : grade.next_game_date
        }
        notes = grade.admin_notes || ''
      }

      // Get stats for this player+game
      const statsResult = await pool.query(
        `SELECT stat_type, COUNT(*)::int as count, COALESCE(SUM(value), 0)::int as total
         FROM stats
         WHERE game_id = $1 AND player_id = $2
         GROUP BY stat_type`,
        [game.id, recruit.player_id]
      )

      if (statsResult.rows.length > 0) {
        const statCounts = {}
        const statSums = {}
        for (const row of statsResult.rows) {
          statCounts[row.stat_type] = row.count
          statSums[row.stat_type] = row.total
        }
        stats = buildStatsForPosition(recruit.position, statCounts, statSums)
      }
    }

    if (!existingMap.has(recruit.recruit_id)) {
      await pool.query(
        `INSERT INTO recruit_weekly_reports
          (recruit_id, week_start_date, week_end_date, last_game_date, last_game_opponent,
           last_game_score, last_game_result, next_game_date, next_game_opponent, stats, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         ON CONFLICT (recruit_id, week_start_date) DO NOTHING`,
        [
          recruit.recruit_id,
          weekStartDate,
          weekEndDate,
          lastGameDate,
          lastGameOpponent,
          lastGameScore,
          lastGameResult,
          nextGameDate,
          nextGameOpponent,
          stats,
          notes,
        ]
      )
    } else if (!hasStats && Object.keys(stats).length > 0) {
      await pool.query(
        `UPDATE recruit_weekly_reports
         SET stats = $1,
             last_game_date = COALESCE($2, last_game_date),
             last_game_opponent = COALESCE($3, last_game_opponent),
             last_game_score = COALESCE($4, last_game_score),
             last_game_result = COALESCE($5, last_game_result),
             next_game_date = COALESCE($6, next_game_date),
             next_game_opponent = COALESCE($7, next_game_opponent),
             notes = COALESCE($8, notes),
             updated_at = CURRENT_TIMESTAMP
         WHERE recruit_id = $9 AND week_start_date = $10`,
        [
          stats,
          lastGameDate,
          lastGameOpponent,
          lastGameScore,
          lastGameResult,
          nextGameDate,
          nextGameOpponent,
          notes,
          recruit.recruit_id,
          weekStartDate,
        ]
      )
    }
  }
}

// GET recruits with weekly report for a given week
router.get('/', async (req, res, next) => {
  try {
    const { week_start_date } = req.query
    if (!week_start_date) {
      return res.status(400).json({ error: 'week_start_date is required' })
    }

    // Auto-sync players with Committed/Offered status into recruits
    await syncPlayersToRecruits()

    // Auto-populate weekly reports from game review data
    await autoPopulateReports(week_start_date)

    const recruitsResult = await pool.query(
      `SELECT r.*,
              rr.id as report_id,
              rr.week_start_date,
              rr.week_end_date,
              rr.last_game_date::text,
              rr.last_game_opponent,
              rr.last_game_score,
              rr.last_game_result,
              rr.next_game_date::text,
              rr.next_game_time,
              rr.next_game_opponent,
              rr.next_game_location,
              rr.stats,
              rr.other_stats,
              rr.notes as report_notes,
              COALESCE(ARRAY[p.recruiting_status], ARRAY[r.status]) as status_list
       FROM recruits r
       LEFT JOIN players p ON p.id = r.player_id
       LEFT JOIN recruit_weekly_reports rr
         ON rr.recruit_id = r.id AND rr.week_start_date = $1
       WHERE r.status IN ('COMMITTED', 'OFFERED', 'COMMITTED ELSEWHERE', 'SIGNED')
       ORDER BY r.side_of_ball, r.position, r.name`,
      [week_start_date]
    )

    const notesResult = await pool.query(
      `SELECT * FROM recruit_notes
       WHERE week_start_date = $1
       ORDER BY note_date DESC, created_at DESC`,
      [week_start_date]
    )

    res.json({ recruits: recruitsResult.rows, notes: notesResult.rows })
  } catch (err) {
    next(err)
  }
})

// PUT upsert weekly report
router.put('/:recruitId', async (req, res, next) => {
  try {
    const { recruitId } = req.params
    const {
      week_start_date,
      week_end_date,
      last_game_date,
      last_game_opponent,
      last_game_score,
      last_game_result,
      next_game_date,
      next_game_time,
      next_game_opponent,
      next_game_location,
      stats,
      other_stats,
      notes,
    } = req.body

    if (!week_start_date || !week_end_date) {
      return res.status(400).json({ error: 'week_start_date and week_end_date are required' })
    }

    const existing = await pool.query(
      `SELECT * FROM recruit_weekly_reports WHERE recruit_id = $1 AND week_start_date = $2`,
      [recruitId, week_start_date]
    )

    const result = await pool.query(
      `INSERT INTO recruit_weekly_reports
        (recruit_id, week_start_date, week_end_date, last_game_date, last_game_opponent, last_game_score, last_game_result,
         next_game_date, next_game_time, next_game_opponent, next_game_location, stats, other_stats, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
       ON CONFLICT (recruit_id, week_start_date)
       DO UPDATE SET
         week_end_date = EXCLUDED.week_end_date,
         last_game_date = EXCLUDED.last_game_date,
         last_game_opponent = EXCLUDED.last_game_opponent,
         last_game_score = EXCLUDED.last_game_score,
         last_game_result = EXCLUDED.last_game_result,
         next_game_date = EXCLUDED.next_game_date,
         next_game_time = EXCLUDED.next_game_time,
         next_game_opponent = EXCLUDED.next_game_opponent,
         next_game_location = EXCLUDED.next_game_location,
         stats = EXCLUDED.stats,
         other_stats = EXCLUDED.other_stats,
         notes = EXCLUDED.notes,
         updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [
        recruitId,
        week_start_date,
        week_end_date,
        last_game_date,
        last_game_opponent,
        last_game_score,
        last_game_result,
        next_game_date,
        next_game_time,
        next_game_opponent,
        next_game_location,
        stats || {},
        other_stats || [],
        notes || '',
      ]
    )

    const report = result.rows[0]

    await logAudit({
      userId: req.user?.id,
      userEmail: req.user?.email,
      action: existing.rows.length ? 'UPDATE' : 'CREATE',
      tableName: 'recruit_weekly_reports',
      recordId: report.id,
      oldValues: existing.rows[0] || null,
      newValues: report,
      ipAddress: getClientIp(req),
    })

    res.json(report)
  } catch (err) {
    next(err)
  }
})

export default router
