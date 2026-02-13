import pool from './db.js'

const POSITIONS = ['QB', 'RB', 'WR', 'TE', 'OL', 'DL', 'LB', 'CB', 'S', 'K']
const SCHOOLS = [
  'Mater Dei HS', 'St. John Bosco', 'IMG Academy', 'Bishop Gorman',
  'Centennial HS', 'Corona Centennial', 'De La Salle', 'Servite',
  'Mission Viejo', 'JSerra Catholic', 'Oaks Christian', 'Sierra Canyon',
  'St. Frances Academy', 'Duncanville', 'North Shore', 'Southlake Carroll'
]
const STATES = ['CA', 'TX', 'FL', 'GA', 'OH', 'AZ', 'NV', 'MD', 'AL', 'LA']
const FIRST_NAMES = [
  'Marcus', 'Jayden', 'Caleb', 'Bryce', 'Jalen', 'Kyler', 'Trey', 'Devin',
  'Malik', 'Darius', 'Cam', 'Zion', 'Aiden', 'Tyler', 'Jordan', 'Isaiah',
  'Elijah', 'Xavier', 'Micah', 'Kai', 'Jaxon', 'Kaiden', 'Tyreek', 'Amari',
  'Davante', 'Jamal', 'Derrick', 'Travis', 'CeeDee', 'Garrett'
]
const LAST_NAMES = [
  'Williams', 'Johnson', 'Smith', 'Brown', 'Jones', 'Davis', 'Miller',
  'Wilson', 'Moore', 'Taylor', 'Anderson', 'Thomas', 'Jackson', 'White',
  'Harris', 'Martin', 'Thompson', 'Garcia', 'Martinez', 'Robinson',
  'Clark', 'Rodriguez', 'Lewis', 'Lee', 'Walker', 'Hall', 'Allen', 'Young'
]
const OPPONENTS = [
  'Lincoln HS', 'Washington Prep', 'Roosevelt Academy', 'Jefferson High',
  'Madison Central', 'Monroe HS', 'Adams Academy', 'Jackson Prep',
  'Van Buren HS', 'Harrison Central', 'Tyler Academy', 'Polk High',
  'Taylor Prep', 'Fillmore HS', 'Pierce Academy', 'Buchanan Central',
  'Cleveland HS', 'McKinley Prep', 'Garfield Academy', 'Arthur Central',
  'Taft HS', 'Wilson Prep', 'Harding Academy', 'Coolidge Central',
  'Hoover HS', 'Truman Prep', 'Eisenhower Academy', 'Kennedy Central',
  'Nixon HS', 'Ford Prep'
]
const STAT_TYPES = ['Rush', 'Reception', 'Tackle Solo', 'Tackle Assist', 'Pass Comp', 'Pass Inc', 'INT', 'Sack', 'PBU', 'TD', 'Rush TD', 'Rec TD']
const GRADES = ['A+', 'A', 'A-', 'B+', 'B', 'B-', 'C+', 'C']

function randomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)]
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

async function seed() {
  const client = await pool.connect()

  try {
    console.log('Starting seed...')

    // Create 40 fake players
    console.log('Creating players...')
    const players = []
    for (let i = 0; i < 40; i++) {
      const firstName = randomItem(FIRST_NAMES)
      const lastName = randomItem(LAST_NAMES)
      const position = randomItem(POSITIONS)

      const result = await client.query(
        `INSERT INTO players (name, position, offense_position, defense_position, school, state, grad_year, flagged, recruiting_status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING id`,
        [
          `${firstName} ${lastName}`,
          position,
          ['QB', 'RB', 'WR', 'TE', 'OL'].includes(position) ? position : null,
          ['DL', 'LB', 'CB', 'S'].includes(position) ? position : null,
          randomItem(SCHOOLS),
          randomItem(STATES),
          randomItem(['2025', '2026', '2027']),
          true,
          randomItem(['Watching', 'Evaluating', 'Priority', 'Offer'])
        ]
      )
      players.push(result.rows[0].id)
    }
    console.log(`Created ${players.length} players`)

    // Create 30 games on February 4th, 2025
    console.log('Creating games...')
    const games = []
    for (let i = 0; i < 30; i++) {
      const result = await client.query(
        `INSERT INTO games (opponent, date, location, competition_level, notes)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id`,
        [
          randomItem(OPPONENTS),
          '2026-02-04',
          randomItem(['Home', 'Away', 'Neutral']),
          randomItem(['Varsity', 'State Playoff', 'Regional Final', 'Championship']),
          'Scouting game for recruiting evaluation'
        ]
      )
      games.push(result.rows[0].id)
    }
    console.log(`Created ${games.length} games`)

    // Associate 3-6 players with each game
    console.log('Associating players with games...')
    for (const gameId of games) {
      const numPlayers = randomInt(3, 6)
      const shuffled = [...players].sort(() => Math.random() - 0.5)
      const gamePlayers = shuffled.slice(0, numPlayers)

      for (const playerId of gamePlayers) {
        await client.query(
          'INSERT INTO game_players (game_id, player_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [gameId, playerId]
        )

        // Add 5-15 stats for each player in the game
        const numStats = randomInt(5, 15)
        for (let s = 0; s < numStats; s++) {
          const statType = randomItem(STAT_TYPES)
          let value = 1
          if (statType === 'Rush' || statType === 'Reception') {
            value = randomInt(3, 25) // yards
          } else if (statType === 'Pass Comp' || statType === 'Pass Inc') {
            value = randomInt(1, 3)
          }

          await client.query(
            `INSERT INTO stats (game_id, player_id, stat_type, value, period)
             VALUES ($1, $2, $3, $4, $5)`,
            [gameId, playerId, statType, value, randomItem(['1st', '2nd', '3rd', '4th'])]
          )
        }

        // Add a grade for each player in the game
        await client.query(
          `INSERT INTO game_player_grades (game_id, player_id, grade, notes)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (game_id, player_id) DO UPDATE SET grade = $3, notes = $4`,
          [gameId, playerId, randomItem(GRADES), 'Good performance, shows potential']
        )
      }
    }

    console.log('Seed complete!')
    console.log(`- ${players.length} players created`)
    console.log(`- ${games.length} games created (all on 2025-02-04)`)
    console.log('- Stats and grades added for each player-game combination')

  } catch (err) {
    console.error('Seed failed:', err)
  } finally {
    client.release()
    await pool.end()
  }
}

seed()
