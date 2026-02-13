import { Router } from 'express'
import pool from '../db.js'

const router = Router()

// Stat weights for scoring (positive = good performance)
// Points are calibrated so a great game = ~50-70 points
const STAT_WEIGHTS = {
  // Touchdowns (highest value)
  'Rush TD': 10,
  'Rec TD': 10,
  'Pass TD': 8,
  'TD': 10,

  // Big plays (defense)
  'INT': 8,
  'Forced Fumble': 6,
  'Sack': 6,
  'TFL': 4,
  'PBU': 4,

  // Tackles
  'Tackle Solo': 2,
  'Tackle Assist': 1,

  // Receptions/Completions (value = yards, so per-yard weight)
  'Reception': 0.1,  // 10 points per 100 receiving yards
  'Pass Comp': 0.5,
  'Target': 0,

  // Kicking
  'FG': 5,
  'PAT': 1,
  'Kickoff': 0,
  'Punt': 0,

  // Yardage stats (value = yards)
  'Rush': 0.1,    // 10 points per 100 rushing yards
  'Return': 0.1,  // 10 points per 100 return yards

  // Negative stats
  'Fumble': -5,
  'Pass Inc': -0.5,
  'Sack Taken': -3,
}

// Grade to numeric conversion
const GRADE_VALUES = {
  'A+': 100, 'A': 95, 'A-': 92,
  'B+': 88, 'B': 85, 'B-': 82,
  'C+': 78, 'C': 75, 'C-': 72,
  'D+': 68, 'D': 65, 'D-': 62,
  'F': 50,
}

// Get start and end of current calendar week (Sunday to Saturday)
function getCurrentWeekRange() {
  const now = new Date()
  const dayOfWeek = now.getDay() // 0 = Sunday

  const sunday = new Date(now)
  sunday.setDate(now.getDate() - dayOfWeek)
  sunday.setHours(0, 0, 0, 0)

  const saturday = new Date(sunday)
  saturday.setDate(sunday.getDate() + 6)
  saturday.setHours(23, 59, 59, 999)

  return { start: sunday, end: saturday }
}

// Stats where each entry counts as 1 (regardless of value entered)
// These are "event" stats - the value field might contain yards of the play
const COUNT_STATS = new Set([
  'Rush TD', 'Rec TD', 'Pass TD', 'TD',
  'INT', 'Forced Fumble', 'Sack', 'TFL', 'PBU',
  'Tackle Solo', 'Tackle Assist', 'FG', 'PAT',
  'Fumble', 'Sack Taken'
])

// Calculate stat score for a player in a game
function calculateStatScore(stats) {
  let score = 0
  for (const stat of stats) {
    const weight = STAT_WEIGHTS[stat.stat_type] || 0
    // For count stats (TDs, INTs, etc), each entry = 1 regardless of value
    // For yardage stats (Rush, Reception), use the actual value
    const value = COUNT_STATS.has(stat.stat_type) ? 1 : (stat.value || 1)
    score += weight * value
  }
  return score
}

// Aggregate stats for display (count entries for event stats, sum for yardage)
function aggregateStats(stats) {
  const totals = {}
  for (const stat of stats) {
    const key = stat.stat_type
    if (COUNT_STATS.has(key)) {
      totals[key] = (totals[key] || 0) + 1
    } else {
      totals[key] = (totals[key] || 0) + (stat.value || 0)
    }
  }
  return totals
}

// Convert grade to numeric value
function gradeToNumeric(grade) {
  if (!grade) return 0
  return GRADE_VALUES[grade.toUpperCase()] || 0
}

// GET top performances for the current week
router.get('/top-performances', async (req, res, next) => {
  try {
    const { start, end } = getCurrentWeekRange()
    const limit = parseInt(req.query.limit) || 5

    // Get all games from this week with their players, grades, and stats
    const gamesResult = await pool.query(
      `SELECT
        g.id as game_id,
        g.opponent,
        g.date,
        g.competition_level,
        p.id as player_id,
        p.name as player_name,
        p.school as player_school,
        p.position as player_position,
        gpg.grade,
        gpg.notes as grade_notes
      FROM games g
      JOIN game_players gp ON g.id = gp.game_id
      JOIN players p ON gp.player_id = p.id
      LEFT JOIN game_player_grades gpg ON g.id = gpg.game_id AND p.id = gpg.player_id
      WHERE g.date >= $1 AND g.date <= $2
      ORDER BY g.date DESC`,
      [start.toISOString().split('T')[0], end.toISOString().split('T')[0]]
    )

    if (gamesResult.rows.length === 0) {
      return res.json({
        week: { start: start.toISOString(), end: end.toISOString() },
        performances: [],
        message: 'No games found for this week',
      })
    }

    // Get stats for each player-game combination
    const performances = []
    const playerGameCombos = new Map()

    for (const row of gamesResult.rows) {
      const key = `${row.game_id}-${row.player_id}`
      if (!playerGameCombos.has(key)) {
        playerGameCombos.set(key, row)
      }
    }

    for (const [key, data] of playerGameCombos) {
      // Get individual stat entries for this player in this game
      // (need individual entries to count TDs properly vs summing yards)
      const statsResult = await pool.query(
        `SELECT stat_type, value
         FROM stats
         WHERE game_id = $1 AND player_id = $2`,
        [data.game_id, data.player_id]
      )

      const statScore = calculateStatScore(statsResult.rows)
      const gradeScore = gradeToNumeric(data.grade)

      // Stats-only scoring (grade shown but not factored into ranking)
      const compositeScore = statScore

      // Build stat summary using proper aggregation
      const statSummary = aggregateStats(statsResult.rows)

      performances.push({
        player: {
          id: data.player_id,
          name: data.player_name,
          school: data.player_school,
          position: data.player_position,
        },
        game: {
          id: data.game_id,
          opponent: data.opponent,
          date: data.date,
          competitionLevel: data.competition_level,
        },
        grade: data.grade,
        gradeNotes: data.grade_notes,
        stats: statSummary,
        scores: {
          grade: gradeScore,
          stats: Math.round(statScore * 10) / 10,
          composite: Math.round(compositeScore * 10) / 10,
        },
      })
    }

    // Sort by composite score and take top N
    performances.sort((a, b) => b.scores.composite - a.scores.composite)
    const topPerformances = performances.slice(0, limit)

    res.json({
      week: {
        start: start.toISOString(),
        end: end.toISOString(),
        label: `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`,
      },
      performances: topPerformances,
      totalEvaluated: performances.length,
    })
  } catch (err) {
    next(err)
  }
})

// GET performance leaderboard (all time or by date range)
router.get('/leaderboard', async (req, res, next) => {
  try {
    const { start_date, end_date, limit = 10 } = req.query

    let dateFilter = ''
    const params = []

    if (start_date && end_date) {
      dateFilter = 'WHERE g.date >= $1 AND g.date <= $2'
      params.push(start_date, end_date)
    }

    const result = await pool.query(
      `SELECT
        p.id as player_id,
        p.name as player_name,
        p.school,
        p.position,
        COUNT(DISTINCT g.id) as games_played,
        AVG(CASE
          WHEN gpg.grade = 'A+' THEN 100
          WHEN gpg.grade = 'A' THEN 95
          WHEN gpg.grade = 'A-' THEN 92
          WHEN gpg.grade = 'B+' THEN 88
          WHEN gpg.grade = 'B' THEN 85
          WHEN gpg.grade = 'B-' THEN 82
          WHEN gpg.grade = 'C+' THEN 78
          WHEN gpg.grade = 'C' THEN 75
          WHEN gpg.grade = 'C-' THEN 72
          WHEN gpg.grade = 'D+' THEN 68
          WHEN gpg.grade = 'D' THEN 65
          WHEN gpg.grade = 'D-' THEN 62
          WHEN gpg.grade = 'F' THEN 50
          ELSE NULL
        END) as avg_grade
      FROM players p
      JOIN game_players gp ON p.id = gp.player_id
      JOIN games g ON gp.game_id = g.id
      LEFT JOIN game_player_grades gpg ON g.id = gpg.game_id AND p.id = gpg.player_id
      ${dateFilter}
      GROUP BY p.id, p.name, p.school, p.position
      HAVING COUNT(DISTINCT g.id) >= 1
      ORDER BY avg_grade DESC NULLS LAST
      LIMIT $${params.length + 1}`,
      [...params, limit]
    )

    res.json({
      leaderboard: result.rows.map((row, index) => ({
        rank: index + 1,
        player: {
          id: row.player_id,
          name: row.player_name,
          school: row.school,
          position: row.position,
        },
        gamesPlayed: parseInt(row.games_played),
        averageGrade: row.avg_grade ? Math.round(row.avg_grade * 10) / 10 : null,
      })),
    })
  } catch (err) {
    next(err)
  }
})

export default router
