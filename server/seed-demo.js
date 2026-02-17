import pg from 'pg'
import dotenv from 'dotenv'
dotenv.config()

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })

async function seed() {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    // Get existing users
    const users = (await client.query('SELECT id, name FROM users')).rows
    const adminId = users.find(u => u.name === 'Matt Vance')?.id || users[0]?.id || 1
    const scoutId = users.find(u => u.name === 'Braden Speyer')?.id || users[1]?.id || 2
    const scout2Id = users[2]?.id || 3

    // Get existing players (first 20 for main demo data)
    const players = (await client.query('SELECT id, name, position, offense_position, defense_position, school, state FROM players ORDER BY id LIMIT 20')).rows
    if (players.length === 0) throw new Error('No players found')

    console.log(`Found ${players.length} players, ${users.length} users`)

    // ============================================
    // 1. UPDATE PLAYER RECRUITING STATUSES (make them varied)
    // ============================================
    const statusUpdates = [
      { id: players[0].id, status: 'Offered', rating: 89.25 },         // Semisi Uluave - DE
      { id: players[1].id, status: 'Evaluating', rating: 85.55 },      // Bode Sparrow - WR
      { id: players[2].id, status: 'Committed', rating: 88.85 },       // Marcus Johnson - QB
      { id: players[3].id, status: 'Interested', rating: 86.15 },      // DeShawn Williams - RB
      { id: players[4].id, status: 'Offered', rating: 84.95 },         // Tyler Richardson - RB
      { id: players[5].id, status: 'Signed', rating: 92.35 },          // Jaylen Carter - WR
      { id: players[6].id, status: 'Evaluating', rating: 88.65 },      // Chris Thompson - WR
      { id: players[7].id, status: 'Watching', rating: 87.25 },        // Antonio Davis - WR
      { id: players[8].id, status: 'Offered', rating: 88.15 },         // Brandon Mitchell - TE
      { id: players[9].id, status: 'Interested', rating: 86.65 },      // Malik Anderson - OL
      { id: players[10].id, status: 'Committed Elsewhere', rating: 86.85 }, // Darius Brown - DL
      { id: players[11].id, status: 'Evaluating', rating: 86.05 },     // Terrell Jackson - DL
      { id: players[12].id, status: 'Offered', rating: 87.95 },        // Jamal White - EDGE
      { id: players[13].id, status: 'Interested', rating: 86.55 },     // Marcus Lee - LB
      { id: players[14].id, status: 'Evaluating', rating: 87.45 },     // DeAndre Harris - LB
      { id: players[15].id, status: 'Watching', rating: 85.25 },       // Kevin Robinson - LB
      { id: players[16].id, status: 'Offered', rating: 86.25 },        // Tyrone Smith - CB
      { id: players[17].id, status: 'Interested', rating: 85.65 },     // Jordan Taylor - CB
      { id: players[18].id, status: 'Evaluating', rating: 86.95 },     // Andre Wilson - S
      { id: players[19].id, status: 'Watching', rating: 85.35 },       // Michael Green - S
    ]

    for (const upd of statusUpdates) {
      await client.query(
        `UPDATE players SET recruiting_status = $1, composite_rating = $2 WHERE id = $3`,
        [upd.status, upd.rating, upd.id]
      )
    }
    // Set committed school for Darius Brown
    await client.query(
      `UPDATE players SET committed_school = 'Oregon' WHERE id = $1`,
      [players[10].id]
    )
    // Set committed school for Marcus Johnson (committed to BYU)
    await client.query(
      `UPDATE players SET committed_school = 'BYU' WHERE id = $1`,
      [players[2].id]
    )

    console.log('Updated player statuses')

    // ============================================
    // 2. CREATE GAMES (6 regular season + 1 Feb 14 game day + 1 Feb 15 for this week)
    // ============================================
    const gameData = [
      { opponent: 'Lone Peak Knights', date: '2025-09-05', location: 'Highland, UT', level: 'Varsity' },
      { opponent: 'Timpview Thunderbirds', date: '2025-09-12', location: 'Provo, UT', level: 'Varsity' },
      { opponent: 'Corner Canyon Chargers', date: '2025-09-19', location: 'Draper, UT', level: 'Varsity' },
      { opponent: 'Kahuku Red Raiders', date: '2025-09-26', location: 'Laie, HI', level: 'Varsity' },
      { opponent: 'Chandler Wolves', date: '2025-10-03', location: 'Chandler, AZ', level: 'Varsity' },
      { opponent: 'Bingham Miners', date: '2025-10-10', location: 'South Jordan, UT', level: 'Varsity' },
      { opponent: 'Skyridge Falcons', date: '2026-02-14', location: 'Lehi, UT', level: 'Varsity' },
      { opponent: 'Davis Darts', date: '2026-02-15', location: 'Kaysville, UT', level: 'Varsity' },
    ]

    const gameIds = []
    for (const g of gameData) {
      const r = await client.query(
        `INSERT INTO games (opponent, date, location, competition_level) VALUES ($1, $2, $3, $4) RETURNING id`,
        [g.opponent, g.date, g.location, g.level]
      )
      gameIds.push(r.rows[0].id)
    }
    console.log(`Created ${gameIds.length} games`)

    // ============================================
    // 3. ASSIGN PLAYERS TO GAMES + INSERT STATS + GRADES
    // ============================================

    // Stat templates by position type
    function offenseStats(isQB, isRB, isWR, isTE, gameNum) {
      const stats = []
      const mult = 0.8 + Math.random() * 0.5 // game variability

      if (isQB) {
        const comps = Math.floor((12 + Math.random() * 10) * mult)
        const incs = Math.floor((4 + Math.random() * 6) * mult)
        const passTDs = Math.floor(Math.random() * 3 + 1)
        for (let i = 0; i < comps; i++) stats.push({ type: 'Pass Comp', value: Math.floor(8 + Math.random() * 25) })
        for (let i = 0; i < incs; i++) stats.push({ type: 'Pass Inc', value: 0 })
        for (let i = 0; i < passTDs; i++) stats.push({ type: 'Pass TD', value: Math.floor(10 + Math.random() * 40) })
        // Rushing
        const rushes = Math.floor((3 + Math.random() * 5) * mult)
        for (let i = 0; i < rushes; i++) stats.push({ type: 'Rush', value: Math.floor(2 + Math.random() * 15) })
        if (Math.random() > 0.6) stats.push({ type: 'Rush TD', value: Math.floor(1 + Math.random() * 8) })
        if (Math.random() > 0.8) stats.push({ type: 'Sack Taken', value: 0 })
      }

      if (isRB) {
        const carries = Math.floor((10 + Math.random() * 12) * mult)
        for (let i = 0; i < carries; i++) stats.push({ type: 'Rush', value: Math.floor(1 + Math.random() * 18) })
        const rushTDs = Math.floor(Math.random() * 2.5)
        for (let i = 0; i < rushTDs; i++) stats.push({ type: 'Rush TD', value: Math.floor(1 + Math.random() * 15) })
        // Receiving
        const recs = Math.floor((2 + Math.random() * 4) * mult)
        for (let i = 0; i < recs; i++) stats.push({ type: 'Reception', value: Math.floor(3 + Math.random() * 20) })
        if (Math.random() > 0.7) stats.push({ type: 'Rec TD', value: Math.floor(5 + Math.random() * 25) })
        if (Math.random() > 0.85) stats.push({ type: 'Fumble', value: 0 })
      }

      if (isWR) {
        const targets = Math.floor((5 + Math.random() * 6) * mult)
        const catches = Math.floor(targets * (0.55 + Math.random() * 0.3))
        for (let i = 0; i < targets; i++) stats.push({ type: 'Target', value: 0 })
        for (let i = 0; i < catches; i++) stats.push({ type: 'Reception', value: Math.floor(5 + Math.random() * 30) })
        const recTDs = Math.floor(Math.random() * 2)
        for (let i = 0; i < recTDs; i++) stats.push({ type: 'Rec TD', value: Math.floor(8 + Math.random() * 35) })
        if (Math.random() > 0.5) {
          const returns = Math.floor(1 + Math.random() * 2)
          for (let i = 0; i < returns; i++) stats.push({ type: 'Return', value: Math.floor(10 + Math.random() * 30) })
        }
      }

      if (isTE) {
        const targets = Math.floor((3 + Math.random() * 4) * mult)
        const catches = Math.floor(targets * (0.6 + Math.random() * 0.25))
        for (let i = 0; i < targets; i++) stats.push({ type: 'Target', value: 0 })
        for (let i = 0; i < catches; i++) stats.push({ type: 'Reception', value: Math.floor(5 + Math.random() * 20) })
        if (Math.random() > 0.6) stats.push({ type: 'Rec TD', value: Math.floor(3 + Math.random() * 15) })
        // Blocking (tracked as tackle assists sometimes)
        stats.push({ type: 'Tackle Assist', value: 0 })
      }

      return stats
    }

    function defenseStats(isDL, isLB, isDB, isEDGE, gameNum) {
      const stats = []
      const mult = 0.8 + Math.random() * 0.5

      if (isDL || isEDGE) {
        const soloTackles = Math.floor((2 + Math.random() * 4) * mult)
        const assistTackles = Math.floor((1 + Math.random() * 3) * mult)
        for (let i = 0; i < soloTackles; i++) stats.push({ type: 'Tackle Solo', value: 1 })
        for (let i = 0; i < assistTackles; i++) stats.push({ type: 'Tackle Assist', value: 1 })
        const sacks = Math.floor(Math.random() * 2.5)
        for (let i = 0; i < sacks; i++) stats.push({ type: 'Sack', value: 1 })
        const tfls = Math.floor(Math.random() * 2)
        for (let i = 0; i < tfls; i++) stats.push({ type: 'TFL', value: 1 })
        if (Math.random() > 0.75) stats.push({ type: 'Forced Fumble', value: 1 })
        if (Math.random() > 0.85) stats.push({ type: 'PBU', value: 1 })
      }

      if (isLB) {
        const soloTackles = Math.floor((4 + Math.random() * 6) * mult)
        const assistTackles = Math.floor((2 + Math.random() * 4) * mult)
        for (let i = 0; i < soloTackles; i++) stats.push({ type: 'Tackle Solo', value: 1 })
        for (let i = 0; i < assistTackles; i++) stats.push({ type: 'Tackle Assist', value: 1 })
        if (Math.random() > 0.5) stats.push({ type: 'Sack', value: 1 })
        const tfls = Math.floor(Math.random() * 3)
        for (let i = 0; i < tfls; i++) stats.push({ type: 'TFL', value: 1 })
        if (Math.random() > 0.7) stats.push({ type: 'PBU', value: 1 })
        if (Math.random() > 0.8) stats.push({ type: 'INT', value: 1 })
        if (Math.random() > 0.8) stats.push({ type: 'Forced Fumble', value: 1 })
      }

      if (isDB) {
        const soloTackles = Math.floor((3 + Math.random() * 4) * mult)
        const assistTackles = Math.floor((1 + Math.random() * 2) * mult)
        for (let i = 0; i < soloTackles; i++) stats.push({ type: 'Tackle Solo', value: 1 })
        for (let i = 0; i < assistTackles; i++) stats.push({ type: 'Tackle Assist', value: 1 })
        const pbus = Math.floor(Math.random() * 3)
        for (let i = 0; i < pbus; i++) stats.push({ type: 'PBU', value: 1 })
        if (Math.random() > 0.6) stats.push({ type: 'INT', value: 1 })
        if (Math.random() > 0.85) stats.push({ type: 'Forced Fumble', value: 1 })
        if (Math.random() > 0.7) stats.push({ type: 'Return', value: Math.floor(10 + Math.random() * 30) })
      }

      return stats
    }

    // Generate boosted stats for "standout" performances on Feb 14/15
    function boostStats(statsList, factor) {
      return statsList.map(s => ({
        ...s,
        value: ['Rush', 'Reception', 'Pass Comp', 'Return', 'Rec TD', 'Rush TD', 'Pass TD'].includes(s.type)
          ? Math.floor(s.value * factor)
          : s.value,
      }))
    }

    const grades = ['A+', 'A', 'A', 'A-', 'B+', 'B+', 'B', 'B', 'B-', 'C+', 'C']
    const gameScores = ['35-14', '28-21', '42-17', '31-24', '21-14', '38-28', '24-10', '17-14']

    for (let gi = 0; gi < gameIds.length; gi++) {
      const gameId = gameIds[gi]
      const isFeb14 = gi === 6
      const isFeb15 = gi === 7

      // Assign all 20 players to each game
      for (const p of players) {
        await client.query(
          `INSERT INTO game_players (game_id, player_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
          [gameId, p.id]
        )

        // Generate position-appropriate stats
        const pos = (p.position || '').toUpperCase()
        const oPos = (p.offense_position || '').toUpperCase()
        const dPos = (p.defense_position || '').toUpperCase()

        let statsList = []

        if (['QB'].includes(pos) || ['QB'].includes(oPos)) {
          statsList = offenseStats(true, false, false, false, gi)
        } else if (['RB'].includes(pos) || ['RB'].includes(oPos)) {
          statsList = offenseStats(false, true, false, false, gi)
        } else if (['WR'].includes(pos) || ['WR'].includes(oPos)) {
          statsList = offenseStats(false, false, true, false, gi)
        } else if (['TE'].includes(pos) || ['TE'].includes(oPos)) {
          statsList = offenseStats(false, false, false, true, gi)
        } else if (['OL', 'OT', 'OG', 'C'].includes(pos) || ['OL', 'OT', 'OG', 'C'].includes(oPos)) {
          // OL: minimal stats - pancake blocks tracked as tackle assists
          statsList = [
            { type: 'Tackle Assist', value: 1 },
            ...(Math.random() > 0.5 ? [{ type: 'Tackle Assist', value: 1 }] : []),
          ]
        } else if (['DL', 'DT', 'DE'].includes(pos) || ['DL', 'DT', 'DE'].includes(dPos)) {
          statsList = defenseStats(true, false, false, false, gi)
        } else if (['EDGE'].includes(pos) || ['EDGE'].includes(dPos)) {
          statsList = defenseStats(false, false, false, true, gi)
        } else if (['LB', 'ILB', 'OLB', 'MLB'].includes(pos) || ['LB'].includes(dPos)) {
          statsList = defenseStats(false, true, false, false, gi)
        } else if (['CB', 'S', 'DB', 'FS', 'SS'].includes(pos) || ['CB', 'S', 'DB'].includes(dPos)) {
          statsList = defenseStats(false, false, true, false, gi)
        } else {
          // Fallback: generic offensive skill stats
          statsList = offenseStats(false, false, true, false, gi)
        }

        // Boost Feb 14/15 stats for top players for better "top performances"
        if ((isFeb14 || isFeb15) && [0, 2, 3, 5, 12].includes(players.indexOf(p))) {
          statsList = boostStats(statsList, 1.6)
        }

        const periods = ['1st', '2nd', '3rd', '4th']
        for (const stat of statsList) {
          const period = periods[Math.floor(Math.random() * 4)]
          await client.query(
            `INSERT INTO stats (game_id, player_id, stat_type, value, period, created_by)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [gameId, p.id, stat.type, stat.value, period, [adminId, scoutId, scout2Id][Math.floor(Math.random() * 3)]]
          )
        }

        // Grade for this game
        const grade = (isFeb14 || isFeb15) && [0, 2, 3, 5, 12].includes(players.indexOf(p))
          ? ['A+', 'A', 'A'][Math.floor(Math.random() * 3)]
          : grades[Math.floor(Math.random() * grades.length)]
        const score = gameScores[gi] || '28-17'
        const verified = Math.random() > 0.3

        await client.query(
          `INSERT INTO game_player_grades (game_id, player_id, grade, notes, game_score, verified, verified_by, verified_at, created_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           ON CONFLICT (game_id, player_id) DO UPDATE SET grade = $3, notes = $4, game_score = $5, verified = $6`,
          [
            gameId, p.id, grade,
            `${p.name} showed ${grade.startsWith('A') ? 'excellent' : grade.startsWith('B') ? 'solid' : 'developing'} play against ${gameData[gi].opponent}.`,
            score, verified, verified ? adminId : null, verified ? new Date().toISOString() : null,
            [adminId, scoutId][Math.floor(Math.random() * 2)],
          ]
        )
      }
      console.log(`Seeded game ${gi + 1}/${gameIds.length}: ${gameData[gi].opponent}`)
    }

    // ============================================
    // 4. PLAYER COMMENTS
    // ============================================
    const commentTemplates = [
      { text: 'Incredible burst off the line. First step is elite for this level.', user: adminId },
      { text: 'Film study shows great football IQ. Reads the defense well pre-snap.', user: scoutId },
      { text: 'Needs to work on pad level in run blocking but pass protection is solid.', user: adminId },
      { text: 'Reminds me of a young Zach Wilson with his ability to extend plays.', user: scout2Id },
      { text: 'Met with family — very BYU-friendly. Dad is an alum.', user: adminId },
      { text: 'Watched him at the Under Armour camp. Stood out among 5-star talent.', user: scoutId },
      { text: 'Coachable kid. Took technique corrections immediately and applied them.', user: scout2Id },
      { text: 'Best hands in the 2026 class from what I have seen on film.', user: adminId },
      { text: 'Lateral agility needs work but straight-line speed is legit 4.4.', user: scoutId },
      { text: 'Physical specimen. 6\'4" 230 and still growing. Could play multiple positions.', user: adminId },
    ]

    for (let i = 0; i < Math.min(players.length, 10); i++) {
      const numComments = 2 + Math.floor(Math.random() * 3)
      for (let j = 0; j < numComments; j++) {
        const tmpl = commentTemplates[(i + j) % commentTemplates.length]
        await client.query(
          `INSERT INTO player_comments (player_id, user_id, comment, created_at)
           VALUES ($1, $2, $3, $4)`,
          [players[i].id, tmpl.user, tmpl.text, new Date(Date.now() - (30 - i - j) * 86400000).toISOString()]
        )
      }
    }
    console.log('Added player comments')

    // ============================================
    // 5. PLAYER VISITS
    // ============================================
    const visitTypes = ['Official', 'Unofficial', 'Gameday', 'Junior Day', 'Camp']
    const visitData = [
      { pid: 0, date: '2026-01-10', type: 'Official', loc: 'BYU Campus', notes: 'Full campus tour, met with coaching staff and academic advisors.' },
      { pid: 0, date: '2026-02-08', type: 'Gameday', loc: 'LaVell Edwards Stadium', notes: 'Attended BYU basketball game. Very engaged with atmosphere.' },
      { pid: 2, date: '2025-12-15', type: 'Official', loc: 'BYU Campus', notes: 'Committed on the spot after meeting with Coach Sitake.' },
      { pid: 3, date: '2026-01-25', type: 'Unofficial', loc: 'BYU Campus', notes: 'Showed strong interest. Parents very impressed with facilities.' },
      { pid: 4, date: '2026-02-01', type: 'Junior Day', loc: 'BYU Indoor Practice Facility', notes: 'Participated in position drills. Coaches were impressed.' },
      { pid: 5, date: '2025-11-20', type: 'Official', loc: 'BYU Campus', notes: 'Signing visit. Already committed — final formality.' },
      { pid: 6, date: '2026-01-18', type: 'Unofficial', loc: 'BYU Campus', notes: 'Drove up from Arizona. Really liked the weight room.' },
      { pid: 8, date: '2026-02-05', type: 'Official', loc: 'BYU Campus', notes: 'Very interested in BYU tight end development history.' },
      { pid: 12, date: '2026-01-30', type: 'Camp', loc: 'BYU Indoor Facility', notes: 'Dominated pass rush drills against older competition.' },
      { pid: 16, date: '2026-02-10', type: 'Unofficial', loc: 'BYU Campus', notes: 'Toured campus with family. Brother currently at BYU.' },
      { pid: 2, date: '2026-03-01', type: 'Gameday', loc: 'LaVell Edwards Stadium', notes: 'Spring game visit planned.' },
      { pid: 8, date: '2026-03-05', type: 'Official', loc: 'BYU Campus', notes: 'Follow-up official visit scheduled.' },
    ]

    for (const v of visitData) {
      await client.query(
        `INSERT INTO player_visits (player_id, visit_date, visit_type, location, notes, created_by)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [players[v.pid].id, v.date, v.type, v.loc, v.notes, adminId]
      )
    }
    console.log('Added player visits')

    // ============================================
    // 6. STATUS HISTORY
    // ============================================
    const statusHistoryData = [
      { pid: 0, old: 'Watching', new: 'Evaluating', date: '2025-10-15', notes: 'Strong fall camp reports' },
      { pid: 0, old: 'Evaluating', new: 'Offered', date: '2026-01-12', notes: 'Official offer extended after campus visit' },
      { pid: 2, old: 'Watching', new: 'Evaluating', date: '2025-09-20', notes: 'Film review showed elite accuracy' },
      { pid: 2, old: 'Evaluating', new: 'Offered', date: '2025-10-28', notes: 'Scholarship offer' },
      { pid: 2, old: 'Offered', new: 'Committed', date: '2025-12-20', notes: 'Committed to BYU!' },
      { pid: 3, old: 'Watching', new: 'Interested', date: '2025-11-01', notes: 'Breakout performance vs Corner Canyon' },
      { pid: 5, old: 'Evaluating', new: 'Offered', date: '2025-08-15', notes: 'Early offer — elite talent' },
      { pid: 5, old: 'Offered', new: 'Committed', date: '2025-09-10', notes: 'Quick commitment' },
      { pid: 5, old: 'Committed', new: 'Signed', date: '2025-12-18', notes: 'Early signing day' },
      { pid: 8, old: 'Watching', new: 'Evaluating', date: '2025-10-05', notes: 'Great hands and blocking' },
      { pid: 8, old: 'Evaluating', new: 'Offered', date: '2026-02-06', notes: 'Offer after official visit' },
      { pid: 10, old: 'Evaluating', new: 'Offered', date: '2025-11-15', notes: 'Scholarship offer' },
      { pid: 10, old: 'Offered', new: 'Committed Elsewhere', date: '2026-01-15', notes: 'Committed to Oregon' },
      { pid: 12, old: 'Watching', new: 'Evaluating', date: '2025-09-30', notes: 'Pass rush ability is special' },
      { pid: 12, old: 'Evaluating', new: 'Offered', date: '2026-02-01', notes: 'Offer extended' },
      { pid: 16, old: 'Watching', new: 'Evaluating', date: '2025-10-20', notes: 'Good ball skills on film' },
      { pid: 16, old: 'Evaluating', new: 'Offered', date: '2026-02-11', notes: 'Offer after camp performance' },
    ]

    for (const sh of statusHistoryData) {
      await client.query(
        `INSERT INTO player_status_history (player_id, old_status, new_status, notes, changed_by, changed_at)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [players[sh.pid].id, sh.old, sh.new, sh.notes, adminId, sh.date + 'T12:00:00Z']
      )
    }
    console.log('Added status history')

    // ============================================
    // 7. COMPOSITE RATING HISTORY
    // ============================================
    for (let i = 0; i < Math.min(players.length, 10); i++) {
      const baseRating = statusUpdates[i].rating
      const months = ['2025-08', '2025-09', '2025-10', '2025-11', '2025-12', '2026-01', '2026-02']
      for (let m = 0; m < months.length; m++) {
        const variation = (Math.random() - 0.3) * 2 // slight upward trend
        const rating = Math.min(100, Math.max(60, baseRating - 3 + m * 0.4 + variation))
        await client.query(
          `INSERT INTO composite_rating_history (player_id, rating, recorded_at, recorded_by, notes)
           VALUES ($1, $2, $3, $4, $5)`,
          [players[i].id, rating.toFixed(2), `${months[m]}-15T12:00:00Z`, adminId, `Monthly evaluation update`]
        )
      }
    }
    console.log('Added composite rating history')

    // ============================================
    // 8. RECRUIT WEEKLY REPORTS FOR WEEK 7 (Feb 10-15, 2026)
    // ============================================
    const weekStart = '2026-02-10'
    const weekEnd = '2026-02-15'

    // Get all recruits
    const recruits = (await client.query('SELECT id, name, position, side_of_ball, player_id FROM recruits ORDER BY id')).rows

    const opponents = [
      'Westlake Warriors', 'Mountain View Bruins', 'Pleasant Grove Vikings', 'Orem Tigers',
      'Springville Red Devils', 'Salem Hills Skyhawks', 'Maple Mountain Golden Eagles',
      'Payson Lions', 'Spanish Fork Dons', 'Provo Bulldogs', 'Timpanogos Timberwolves',
      'Lehi Pioneers', 'American Fork Cavemen', 'Alta Hawks', 'Brighton Bengals',
    ]
    const results = ['W', 'W', 'W', 'L', 'W', 'W', 'L', 'W', 'W', 'W']
    const scores = ['35-14', '28-21', '42-10', '21-24', '31-17', '38-7', '14-28', '45-21', '24-17', '33-20']

    for (let ri = 0; ri < recruits.length; ri++) {
      const rec = recruits[ri]
      const opp = opponents[ri % opponents.length]
      const result = results[ri % results.length]
      const score = scores[ri % scores.length]
      const side = (rec.side_of_ball || '').toUpperCase()
      const pos = (rec.position || '').toUpperCase()

      // Build stats JSON based on position/side
      let statsJson = {}
      if (side === 'OFFENSE' || ['QB', 'RB', 'WR', 'TE', 'OL', 'C'].includes(pos)) {
        if (pos === 'QB') {
          statsJson = {
            passComp: Math.floor(12 + Math.random() * 12),
            passAtt: Math.floor(20 + Math.random() * 15),
            passYds: Math.floor(150 + Math.random() * 200),
            passTD: Math.floor(1 + Math.random() * 3),
            passINT: Math.random() > 0.7 ? 1 : 0,
            rushYds: Math.floor(10 + Math.random() * 40),
            carries: Math.floor(3 + Math.random() * 6),
          }
        } else if (pos === 'RB') {
          statsJson = {
            carries: Math.floor(12 + Math.random() * 10),
            rushYds: Math.floor(60 + Math.random() * 120),
            rushTD: Math.floor(Math.random() * 3),
            receptions: Math.floor(1 + Math.random() * 4),
            recYds: Math.floor(10 + Math.random() * 40),
          }
        } else if (pos === 'WR') {
          statsJson = {
            receptions: Math.floor(3 + Math.random() * 6),
            recYds: Math.floor(40 + Math.random() * 100),
            recTD: Math.floor(Math.random() * 2),
            carries: Math.random() > 0.7 ? Math.floor(1 + Math.random() * 2) : 0,
            rushYds: Math.random() > 0.7 ? Math.floor(5 + Math.random() * 20) : 0,
          }
        } else if (pos === 'TE') {
          statsJson = {
            receptions: Math.floor(2 + Math.random() * 5),
            recYds: Math.floor(20 + Math.random() * 60),
            recTD: Math.random() > 0.5 ? 1 : 0,
          }
        } else {
          statsJson = {
            pancakes: Math.floor(3 + Math.random() * 5),
            sacksAllowed: Math.random() > 0.7 ? 1 : 0,
          }
        }
      } else if (side === 'DEFENSE' || ['DL', 'LB', 'CB', 'S', 'DE', 'DT', 'EDGE'].includes(pos)) {
        if (['DL', 'DE', 'DT', 'EDGE'].includes(pos)) {
          statsJson = {
            tackles: Math.floor(3 + Math.random() * 5),
            sacks: Math.floor(Math.random() * 2.5),
            tfl: Math.floor(Math.random() * 3),
            forcedFumbles: Math.random() > 0.7 ? 1 : 0,
          }
        } else if (pos === 'LB') {
          statsJson = {
            tackles: Math.floor(5 + Math.random() * 8),
            sacks: Math.random() > 0.5 ? 1 : 0,
            tfl: Math.floor(Math.random() * 3),
            interceptions: Math.random() > 0.8 ? 1 : 0,
            pbu: Math.floor(Math.random() * 2),
          }
        } else {
          statsJson = {
            tackles: Math.floor(3 + Math.random() * 5),
            interceptions: Math.random() > 0.6 ? 1 : 0,
            pbu: Math.floor(1 + Math.random() * 3),
            forcedFumbles: Math.random() > 0.85 ? 1 : 0,
          }
        }
      } else if (side === 'SPECIAL' || pos === 'K') {
        statsJson = {
          fgMade: Math.floor(1 + Math.random() * 3),
          fgAtt: Math.floor(2 + Math.random() * 3),
          patMade: Math.floor(3 + Math.random() * 5),
          patAtt: Math.floor(4 + Math.random() * 5),
        }
      } else {
        statsJson = {
          tackles: Math.floor(2 + Math.random() * 5),
          receptions: Math.floor(Math.random() * 3),
          recYds: Math.floor(Math.random() * 40),
        }
      }

      // Other stats (custom highlights)
      const otherStats = []
      if (Math.random() > 0.5) {
        otherStats.push({ label: '40-yard dash', value: (4.3 + Math.random() * 0.5).toFixed(2) + 's' })
      }
      if (Math.random() > 0.6) {
        otherStats.push({ label: 'Bench press reps', value: String(Math.floor(15 + Math.random() * 15)) })
      }

      await client.query(
        `INSERT INTO recruit_weekly_reports
           (recruit_id, week_start_date, week_end_date, last_game_date, last_game_opponent, last_game_score, last_game_result,
            next_game_date, next_game_time, next_game_opponent, next_game_location, stats, other_stats, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
         ON CONFLICT (recruit_id, week_start_date) DO UPDATE SET
           stats = $12, other_stats = $13, notes = $14,
           last_game_date = $4, last_game_opponent = $5, last_game_score = $6, last_game_result = $7,
           next_game_date = $8, next_game_time = $9, next_game_opponent = $10, next_game_location = $11`,
        [
          rec.id, weekStart, weekEnd,
          '2026-02-14', opp, score, result,
          '2026-02-21', '7:00 PM', opponents[(ri + 3) % opponents.length], 'Home',
          JSON.stringify(statsJson), JSON.stringify(otherStats),
          `Week 7 performance ${result === 'W' ? 'in a strong team win' : 'despite a tough loss'}. ${rec.name} ${result === 'W' ? 'contributed significantly to the victory' : 'showed resilience and fought hard'}.`,
        ]
      )
    }
    console.log(`Added week 7 reports for ${recruits.length} recruits`)

    // ============================================
    // 9. RECRUIT NOTES/ARTICLES FOR WEEK 7
    // ============================================
    const articleSources = ['247Sports', 'Rivals', 'ESPN', 'On3', 'MaxPreps', 'Deseret News', 'Salt Lake Tribune', 'X']
    const articleTemplates = [
      { summary: '{name} dominates in Week 7 with a career-best performance', quote: 'This kid is the real deal. One of the best in the state.' },
      { summary: '{name} earns Player of the Week honors after standout game', quote: 'Coaches across the region are taking notice of {name}\'s talent.' },
      { summary: 'Recruiting update: {name} drawing interest from multiple Power 4 programs', quote: 'His stock continues to rise with each passing week.' },
      { summary: '{name} highlights going viral on social media after Week 7', quote: 'The athleticism on display was jaw-dropping.' },
      { summary: 'Film breakdown: {name} shows elite-level technique against top competition', quote: 'Technique-wise, he is ahead of most recruits in this class.' },
      { summary: 'Scout report: {name} continues to impress in live evaluation', quote: 'Every time I watch him, he does something that surprises me.' },
      { summary: '{name} invited to prestigious all-star game following Week 7 performance', quote: 'All-American caliber talent right there.' },
      { summary: 'BYU coaches impressed with {name} during recent film session', quote: 'He fits exactly what we are looking for in our system.' },
    ]

    for (let ri = 0; ri < recruits.length; ri++) {
      const rec = recruits[ri]
      const numNotes = 2 + Math.floor(Math.random() * 3) // 2-4 notes per recruit

      for (let ni = 0; ni < numNotes; ni++) {
        const tmpl = articleTemplates[(ri + ni) % articleTemplates.length]
        const source = articleSources[(ri + ni) % articleSources.length]
        const noteDate = new Date('2026-02-10')
        noteDate.setDate(noteDate.getDate() + Math.floor(Math.random() * 5))

        await client.query(
          `INSERT INTO recruit_notes (recruit_id, week_start_date, note_date, source, link, summary, quote, created_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            rec.id, weekStart,
            noteDate.toISOString().split('T')[0],
            source,
            source === 'X' ? '' : `https://${source.toLowerCase().replace(/\s+/g, '')}.com/recruit/${rec.name.toLowerCase().replace(/\s+/g, '-')}`,
            tmpl.summary.replace(/\{name\}/g, rec.name),
            tmpl.quote.replace(/\{name\}/g, rec.name),
            [adminId, scoutId, scout2Id][Math.floor(Math.random() * 3)],
          ]
        )
      }
    }
    console.log(`Added recruit notes/articles for week 7`)

    // ============================================
    // 10. SCOUT ASSIGNMENTS for Feb 14 game
    // ============================================
    const feb14GameId = gameIds[6]
    const assignmentPlayers = [players[0], players[2], players[5], players[8], players[12]]
    for (const p of assignmentPlayers) {
      await client.query(
        `INSERT INTO scout_assignments (scout_id, player_id, game_id, assigned_by, notes, position_group)
         VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT DO NOTHING`,
        [scoutId, p.id, feb14GameId, adminId, `Grade ${p.name} closely in the Feb 14 game`, p.position || 'Skill']
      )
    }
    console.log('Added scout assignments')

    await client.query('COMMIT')
    console.log('\n=== SEED COMPLETE ===')
    console.log(`Games created: ${gameIds.length} (IDs: ${gameIds.join(', ')})`)
    console.log(`Feb 14 game ID: ${gameIds[6]}`)
    console.log(`Feb 15 game ID: ${gameIds[7]}`)
    console.log(`Recruit reports: ${recruits.length} for week ${weekStart}`)

  } catch (err) {
    await client.query('ROLLBACK')
    console.error('SEED FAILED:', err)
    throw err
  } finally {
    client.release()
    await pool.end()
  }
}

seed()
