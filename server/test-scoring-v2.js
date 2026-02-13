import pool from './db.js'

const STAT_WEIGHTS = {
  'Rush TD': 10, 'Rec TD': 10, 'Pass TD': 8, 'TD': 10,
  'INT': 8, 'Forced Fumble': 6, 'Sack': 6, 'TFL': 4, 'PBU': 4,
  'Tackle Solo': 2, 'Tackle Assist': 1,
  'Reception': 0.1, 'Pass Comp': 0.5,
  'Rush': 0.1, 'Return': 0.1,
  'Fumble': -5, 'Pass Inc': -0.5, 'Sack Taken': -3,
}

// Stats that should be counted (each entry = 1) rather than summed
const COUNT_STATS = new Set([
  'Rush TD', 'Rec TD', 'Pass TD', 'TD',
  'INT', 'Forced Fumble', 'Sack', 'TFL', 'PBU',
  'Tackle Solo', 'Tackle Assist', 'FG', 'PAT',
  'Fumble', 'Sack Taken'
])

function calculateScore(statEntries) {
  let score = 0
  for (const stat of statEntries) {
    const weight = STAT_WEIGHTS[stat.stat_type] || 0
    // Count stats = 1 per entry, yardage stats = use value
    const value = COUNT_STATS.has(stat.stat_type) ? 1 : (stat.value || 1)
    score += weight * value
  }
  return Math.round(score * 10) / 10
}

function aggregateForDisplay(statEntries) {
  const totals = {}
  for (const stat of statEntries) {
    const key = stat.stat_type
    if (COUNT_STATS.has(key)) {
      totals[key] = (totals[key] || 0) + 1
    } else {
      totals[key] = (totals[key] || 0) + (stat.value || 0)
    }
  }
  return totals
}

async function test() {
  const result = await pool.query(`
    SELECT
      p.id as player_id,
      p.name,
      g.id as game_id,
      g.opponent,
      gpg.grade
    FROM players p
    JOIN game_players gp ON p.id = gp.player_id
    JOIN games g ON gp.game_id = g.id
    LEFT JOIN game_player_grades gpg ON g.id = gpg.game_id AND p.id = gpg.player_id
    WHERE g.date = '2026-02-04'
  `)

  const performances = []

  for (const row of result.rows) {
    const statsResult = await pool.query(
      'SELECT stat_type, value FROM stats WHERE game_id = $1 AND player_id = $2',
      [row.game_id, row.player_id]
    )

    const score = calculateScore(statsResult.rows)
    const displayStats = aggregateForDisplay(statsResult.rows)

    performances.push({
      name: row.name,
      opponent: row.opponent,
      grade: row.grade,
      stats: displayStats,
      score
    })
  }

  performances.sort((a, b) => b.score - a.score)

  console.log('\nTop 10 Performances (Fixed Scoring - TDs count as 1 each):\n')
  performances.slice(0, 10).forEach((p, i) => {
    console.log(`${i + 1}. ${p.name} vs ${p.opponent}`)
    console.log(`   Grade: ${p.grade || 'N/A'} | Score: ${p.score}`)

    // Format stats nicely
    const statStr = Object.entries(p.stats)
      .filter(([k, v]) => v > 0)
      .map(([k, v]) => {
        if (k === 'Reception' || k === 'Rush') return `${v} ${k} Yds`
        return `${v} ${k}`
      })
      .join(', ')
    console.log(`   Stats: ${statStr}`)
    console.log()
  })

  await pool.end()
}

test()
