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

// Demo data for breakout players when no real data exists
const DEMO_BREAKOUT_PLAYERS = [
  {
    player: { id: 'demo-1', name: 'Jaylen Carter', school: 'Westlake HS', position: 'RB' },
    game: { id: 'demo-g1', opponent: 'Eastside Academy', date: '2025-10-18' },
    grade: 'A',
    breakoutScore: 3.2,
    keyStats: [
      { statType: 'Rush', gameValue: 156, seasonAvg: 82, unit: 'yds' },
      { statType: 'Rush TD', gameValue: 3, seasonAvg: 0.8, unit: '' },
      { statType: 'Reception', gameValue: 45, seasonAvg: 18, unit: 'yds' },
    ],
  },
  {
    player: { id: 'demo-2', name: 'Marcus Thompson', school: 'Central Prep', position: 'WR' },
    game: { id: 'demo-g2', opponent: 'Lincoln HS', date: '2025-10-18' },
    grade: 'A-',
    breakoutScore: 2.8,
    keyStats: [
      { statType: 'Reception', gameValue: 142, seasonAvg: 58, unit: 'yds' },
      { statType: 'Rec TD', gameValue: 2, seasonAvg: 0.4, unit: '' },
    ],
  },
  {
    player: { id: 'demo-3', name: 'Aidan Brooks', school: 'Ridge Valley', position: 'DE' },
    game: { id: 'demo-g3', opponent: 'Summit Prep', date: '2025-10-17' },
    grade: null,
    breakoutScore: 2.4,
    keyStats: [
      { statType: 'Sack', gameValue: 3, seasonAvg: 0.7, unit: '' },
      { statType: 'TFL', gameValue: 5, seasonAvg: 1.8, unit: '' },
      { statType: 'Tackle Solo', gameValue: 8, seasonAvg: 4.2, unit: '' },
    ],
  },
  {
    player: { id: 'demo-4', name: 'Chris Wallace', school: 'Bay Area HS', position: 'QB' },
    game: { id: 'demo-g4', opponent: 'Harbor Prep', date: '2025-10-18' },
    grade: 'B+',
    breakoutScore: 1.9,
    keyStats: [
      { statType: 'Pass TD', gameValue: 4, seasonAvg: 1.5, unit: '' },
      { statType: 'Pass Comp', gameValue: 285, seasonAvg: 178, unit: 'yds' },
    ],
  },
]

// GET breakout players - recruits whose latest game significantly exceeded their season average
router.get('/breakout-players', async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit) || 10
    const threshold = parseFloat(req.query.threshold) || 1.5

    // Find players with stats in 2+ games, get their most recent game
    const playersResult = await pool.query(
      `SELECT DISTINCT s.player_id,
              p.name as player_name,
              p.school as player_school,
              p.position as player_position,
              (SELECT g2.id FROM games g2
               JOIN stats s2 ON s2.game_id = g2.id AND s2.player_id = s.player_id
               ORDER BY g2.date DESC LIMIT 1) as latest_game_id,
              (SELECT g2.date FROM games g2
               JOIN stats s2 ON s2.game_id = g2.id AND s2.player_id = s.player_id
               ORDER BY g2.date DESC LIMIT 1) as latest_game_date,
              (SELECT g2.opponent FROM games g2
               JOIN stats s2 ON s2.game_id = g2.id AND s2.player_id = s.player_id
               ORDER BY g2.date DESC LIMIT 1) as latest_game_opponent
       FROM stats s
       JOIN players p ON s.player_id = p.id
       GROUP BY s.player_id, p.name, p.school, p.position
       HAVING COUNT(DISTINCT s.game_id) >= 2`
    )

    if (playersResult.rows.length === 0) {
      return res.json({
        breakoutPlayers: DEMO_BREAKOUT_PLAYERS.slice(0, limit),
        isDemo: true,
      })
    }

    const breakoutPlayers = []

    for (const player of playersResult.rows) {
      // Get season averages excluding the latest game
      const avgResult = await pool.query(
        `SELECT stat_type,
                AVG(value)::float as avg,
                STDDEV_POP(value)::float as stddev,
                COUNT(*)::int as count
         FROM stats
         WHERE player_id = $1 AND game_id != $2
         GROUP BY stat_type
         HAVING COUNT(*) >= 2`,
        [player.player_id, player.latest_game_id]
      )

      if (avgResult.rows.length === 0) continue

      // Build averages lookup
      const averages = {}
      avgResult.rows.forEach(row => {
        averages[row.stat_type] = {
          avg: row.avg,
          stddev: row.stddev || 0,
          count: row.count,
        }
      })

      // Get latest game stats
      const latestStatsResult = await pool.query(
        `SELECT stat_type, value FROM stats
         WHERE player_id = $1 AND game_id = $2`,
        [player.player_id, player.latest_game_id]
      )

      // Aggregate latest game stats
      const gameStats = {}
      for (const stat of latestStatsResult.rows) {
        const key = stat.stat_type
        if (COUNT_STATS.has(key)) {
          gameStats[key] = (gameStats[key] || 0) + 1
        } else {
          gameStats[key] = (gameStats[key] || 0) + (stat.value || 0)
        }
      }

      // Calculate breakout score: sum of z-scores across stat types
      let breakoutScore = 0
      let scoredStats = 0
      const keyStats = []

      for (const [statType, gameValue] of Object.entries(gameStats)) {
        const avg = averages[statType]
        if (!avg || avg.stddev <= 0) continue

        // For count stats, compute the average count per game
        let avgValue = avg.avg
        if (COUNT_STATS.has(statType)) {
          // avg.avg is the average value per stat entry, but we need count per game
          // Re-query for count-based average per game
          continue // Skip count stats from z-score if stddev-based approach won't work well
        }

        const zScore = (gameValue - avgValue) / avg.stddev
        if (zScore > 0) {
          breakoutScore += zScore
          scoredStats++
          const isYardage = !COUNT_STATS.has(statType)
          keyStats.push({
            statType,
            gameValue: Math.round(gameValue * 10) / 10,
            seasonAvg: Math.round(avgValue * 10) / 10,
            unit: isYardage ? 'yds' : '',
          })
        }
      }

      // Also handle count stats with a per-game approach
      const countStatAvgResult = await pool.query(
        `SELECT stat_type,
                COUNT(*)::float / COUNT(DISTINCT game_id)::float as avg_per_game,
                COUNT(DISTINCT game_id)::int as games
         FROM stats
         WHERE player_id = $1 AND game_id != $2 AND stat_type = ANY($3)
         GROUP BY stat_type
         HAVING COUNT(DISTINCT game_id) >= 2`,
        [player.player_id, player.latest_game_id, Array.from(COUNT_STATS)]
      )

      for (const row of countStatAvgResult.rows) {
        const gameValue = gameStats[row.stat_type]
        if (gameValue == null) continue
        const avgPerGame = row.avg_per_game
        if (avgPerGame <= 0) continue

        // Simple ratio-based z-score for count stats
        const ratio = gameValue / avgPerGame
        if (ratio > 1.5) {
          const pseudoZ = ratio - 1 // e.g., 3x average = z-score of 2
          breakoutScore += pseudoZ
          scoredStats++
          keyStats.push({
            statType: row.stat_type,
            gameValue,
            seasonAvg: Math.round(avgPerGame * 10) / 10,
            unit: '',
          })
        }
      }

      if (scoredStats === 0 || breakoutScore < threshold) continue

      // Normalize breakout score
      breakoutScore = Math.round((breakoutScore / Math.max(scoredStats, 1)) * 10) / 10

      if (breakoutScore < threshold) continue

      // Get grade if available
      const gradeResult = await pool.query(
        `SELECT grade FROM game_player_grades
         WHERE game_id = $1 AND player_id = $2`,
        [player.latest_game_id, player.player_id]
      )

      // Sort key stats by impact (highest z-score first) and take top 3
      keyStats.sort((a, b) => {
        const aRatio = a.seasonAvg > 0 ? a.gameValue / a.seasonAvg : a.gameValue
        const bRatio = b.seasonAvg > 0 ? b.gameValue / b.seasonAvg : b.gameValue
        return bRatio - aRatio
      })

      breakoutPlayers.push({
        player: {
          id: player.player_id,
          name: player.player_name,
          school: player.player_school,
          position: player.player_position,
        },
        game: {
          id: player.latest_game_id,
          opponent: player.latest_game_opponent,
          date: player.latest_game_date,
        },
        grade: gradeResult.rows[0]?.grade || null,
        breakoutScore,
        keyStats: keyStats.slice(0, 3),
      })
    }

    // Sort by breakout score descending
    breakoutPlayers.sort((a, b) => b.breakoutScore - a.breakoutScore)

    const result = breakoutPlayers.slice(0, limit)

    res.json({
      breakoutPlayers: result.length > 0 ? result : DEMO_BREAKOUT_PLAYERS.slice(0, limit),
      isDemo: result.length === 0,
    })
  } catch (err) {
    next(err)
  }
})

export default router
