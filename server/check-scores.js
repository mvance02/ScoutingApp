import pool from './db.js'

async function checkScores() {
  // Get top 5 performances with details
  const result = await pool.query(`
    SELECT
      p.name,
      g.opponent,
      gpg.grade,
      json_agg(json_build_object('stat', s.stat_type, 'value', s.value)) as stats
    FROM players p
    JOIN game_players gp ON p.id = gp.player_id
    JOIN games g ON gp.game_id = g.id
    LEFT JOIN game_player_grades gpg ON g.id = gpg.game_id AND p.id = gpg.player_id
    LEFT JOIN stats s ON g.id = s.game_id AND p.id = s.player_id
    WHERE g.date = '2026-02-04'
    GROUP BY p.id, p.name, g.id, g.opponent, gpg.grade
    LIMIT 10
  `)

  for (const row of result.rows) {
    console.log(`\n${row.name} vs ${row.opponent} - Grade: ${row.grade}`)

    // Aggregate stats
    const statTotals = {}
    for (const s of row.stats) {
      if (s.stat) {
        statTotals[s.stat] = (statTotals[s.stat] || 0) + s.value
      }
    }
    console.log('Stats:', statTotals)
  }

  await pool.end()
}

checkScores()
