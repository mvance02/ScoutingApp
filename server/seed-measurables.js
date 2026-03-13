import pg from 'pg'
import dotenv from 'dotenv'

dotenv.config()

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })

function primaryPos(row) {
  const raw = (row.position || row.offense_position || row.defense_position || '').toUpperCase()
  if (!raw) return 'ATH'
  if (['OT', 'OG', 'C'].includes(raw)) return 'OL'
  if (raw === 'DL') return 'DT'
  if (raw === 'S' || raw === 'FS' || raw === 'SS') return 'DB'
  if (raw === 'EDGE') return 'DE'
  return raw
}

function randRange(min, max, decimals = 1) {
  const v = min + Math.random() * (max - min)
  return Number(v.toFixed(decimals))
}

const MEASURABLE_PRESETS = {
  QB: { h: [72, 75], w: [195, 220], arm: [31, 33.5], hand: [9, 10.25] },
  RB: { h: [69, 72], w: [190, 215], arm: [30, 32.5], hand: [8.9, 9.8] },
  WR: { h: [71, 75], w: [180, 205], arm: [31, 33.5], hand: [9, 10.1] },
  TE: { h: [75, 78], w: [230, 255], arm: [32, 34], hand: [9.25, 10.25] },
  OL: { h: [76, 79], w: [290, 325], arm: [32.5, 35], hand: [9.75, 10.75] },
  DT: { h: [74, 77], w: [280, 310], arm: [32, 34], hand: [9.4, 10.2] },
  DE: { h: [74, 77], w: [245, 270], arm: [32.5, 34.5], hand: [9.2, 10] },
  LB: { h: [72, 75], w: [215, 240], arm: [31.5, 33.5], hand: [9, 9.9] },
  DB: { h: [70, 73], w: [180, 200], arm: [30.5, 32.5], hand: [8.9, 9.7] },
  ATH: { h: [71, 75], w: [185, 215], arm: [31, 33.5], hand: [9, 10] },
}

async function seedMeasurables() {
  const client = await pool.connect()
  try {
    const { rows: allPlayers } = await client.query(
      `SELECT id, name, position, offense_position, defense_position,
              is_juco, is_transfer_wishlist,
              composite_rating, height_in, weight_lb, arm_length_in, hand_size_in
       FROM players
       ORDER BY id`
    )

    console.log(`Seeding measurables for ${allPlayers.length} players...`)

    for (const p of allPlayers) {
      const pos = primaryPos(p)
      const preset = MEASURABLE_PRESETS[pos] || MEASURABLE_PRESETS.ATH

      const isJuco = p.is_juco === true
      const isTransfer = p.is_transfer_wishlist === true

      const ratingMin = isTransfer ? 83 : isJuco ? 82 : 79
      const ratingMax = isTransfer ? 96 : isJuco ? 94 : 92

      const newComposite =
        p.composite_rating == null ? randRange(ratingMin, ratingMax, 2) : null
      const newHeight = p.height_in == null ? randRange(preset.h[0], preset.h[1], 1) : null
      const newWeight = p.weight_lb == null ? randRange(preset.w[0], preset.w[1], 0) : null
      const newArm =
        p.arm_length_in == null ? randRange(preset.arm[0], preset.arm[1], 2) : null
      const newHand =
        p.hand_size_in == null ? randRange(preset.hand[0], preset.hand[1], 2) : null

      if (
        newComposite == null &&
        newHeight == null &&
        newWeight == null &&
        newArm == null &&
        newHand == null
      ) {
        continue
      }

      await client.query(
        `UPDATE players
         SET composite_rating = COALESCE($1, composite_rating),
             height_in = COALESCE($2, height_in),
             weight_lb = COALESCE($3, weight_lb),
             arm_length_in = COALESCE($4, arm_length_in),
             hand_size_in = COALESCE($5, hand_size_in)
         WHERE id = $6`,
        [newComposite, newHeight, newWeight, newArm, newHand, p.id]
      )
    }

    console.log('Measurables seeding complete.')
  } catch (err) {
    console.error('Measurables seed failed:', err)
    throw err
  } finally {
    client.release()
    await pool.end()
  }
}

seedMeasurables()

