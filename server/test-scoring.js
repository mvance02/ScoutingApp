import pool from './db.js'

const STAT_WEIGHTS = {
  'Rush TD': 10,
  'Rec TD': 10,
  'Pass TD': 8,
  'TD': 10,
  'INT': 8,
  'Forced Fumble': 6,
  'Sack': 6,
  'TFL': 4,
  'PBU': 4,
  'Tackle Solo': 2,
  'Tackle Assist': 1,
  'Reception': 0.1,
  'Pass Comp': 0.5,
  'Rush': 0.1,
  'Return': 0.1,
  'Fumble': -5,
  'Pass Inc': -0.5,
  'Sack Taken': -3,
}

function calculateScore(stats) {
  let score = 0
  for (const [statType, value] of Object.entries(stats)) {
    const weight = STAT_WEIGHTS[statType] || 0
    score += weight * value
  }
  return Math.round(score * 10) / 10
}

async function test() {
  const result = await pool.query(`
    SELECT
      p.name,
      g.opponent,
      gpg.grade,
      json_agg(json_build_object('stat', s.stat_type, 'value', s.value)) as stats_raw
    FROM players p
    JOIN game_players gp ON p.id = gp.player_id
    JOIN games g ON gp.game_id = g.id
    LEFT JOIN game_player_grades gpg ON g.id = gpg.game_id AND p.id = gpg.player_id
    LEFT JOIN stats s ON g.id = s.game_id AND p.id = s.player_id
    WHERE g.date = '2026-02-04'
    GROUP BY p.id, p.name, g.id, g.opponent, gpg.grade
  `)

  const performances = result.rows.map(row => {
    const stats = {}
    for (const s of row.stats_raw) {
      if (s.stat) {
        stats[s.stat] = (stats[s.stat] || 0) + s.value
      }
    }
    return {
      name: row.name,
      opponent: row.opponent,
      grade: row.grade,
      stats,
      score: calculateScore(stats)
    }
  })

  performances.sort((a, b) => b.score - a.score)

  console.log('\nTop 10 Performances (Stats-Only Scoring):\n')
  performances.slice(0, 10).forEach((p, i) => {
    console.log(`${i + 1}. ${p.name} vs ${p.opponent}`)
    console.log(`   Grade: ${p.grade || 'N/A'} | Score: ${p.score}`)
    console.log(`   Stats:`, p.stats)
    console.log()
  })

  await pool.end()
}

test()
