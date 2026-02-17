import { z } from 'zod'

// Validation middleware factory
export function validate(schema) {
  return (req, res, next) => {
    try {
      schema.parse(req.body)
      next()
    } catch (err) {
      if (err instanceof z.ZodError) {
        const issues = err.issues || err.errors || []
        return res.status(400).json({
          error: 'Validation failed',
          details: issues.map(e => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        })
      }
      next(err)
    }
  }
}

// Auth schemas
export const registerSchema = z.object({
  name: z.string().max(255).optional(),
  email: z.string().email('Invalid email format').max(255),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password must be at most 128 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  role: z.enum(['scout', 'admin']).optional(),
})

export const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required'),
})

export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Token is required'),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password must be at most 128 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
})

// Player schemas
export const createPlayerSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
  position: z.string().max(50).optional().nullable(),
  offense_position: z.string().max(50).optional().nullable(),
  defense_position: z.string().max(50).optional().nullable(),
  school: z.string().max(255).optional().nullable(),
  state: z.string().max(50).optional().nullable(),
  grad_year: z.number().int().min(2000).max(2100).optional().nullable(),
  notes: z.string().max(10000).optional().nullable(),
  flagged: z.boolean().optional(),
  cut_up_completed: z.boolean().optional(),
  recruiting_statuses: z.array(z.enum([
    'Watching', 'Evaluating', 'Interested', 'Priority', 'Offer', 'Offered', 'Committed', 'Committed Elsewhere', 'Signed', 'Passed', 'Not Interested'
  ])).optional(),
  status_notes: z.string().max(5000).optional().nullable(),
  committed_school: z.string().max(255).optional().nullable(),
  committed_date: z.string().max(50).optional().nullable(),
  composite_rating: z.number().min(0).max(100).optional().nullable(),
})

export const updatePlayerSchema = createPlayerSchema.partial()

// Stats schemas
export const createStatSchema = z.object({
  game_id: z.number().int().positive('Game ID is required'),
  player_id: z.number().int().positive('Player ID is required'),
  stat_type: z.string().min(1).max(50, 'Stat type must be at most 50 characters'),
  value: z.number().default(0),
  timestamp: z.string().max(20).optional().nullable(),
  period: z.string().max(20).optional().nullable(),
  note: z.string().max(1000).optional().nullable(),
})

export const updateStatSchema = z.object({
  stat_type: z.string().min(1).max(50).optional(),
  value: z.number().optional(),
  timestamp: z.string().max(20).optional().nullable(),
  period: z.string().max(20).optional().nullable(),
  note: z.string().max(1000).optional().nullable(),
})

// Notes schemas
export const createNoteSchema = z.object({
  game_id: z.coerce.number().int().positive('Game ID is required'),
  timestamp: z.string().max(20).optional().nullable(),
  period: z.string().max(20).optional().nullable(),
  note: z.string().min(1, 'Note content is required').max(10000),
  category: z.string().max(50).optional().nullable(),
})

export const updateNoteSchema = z.object({
  timestamp: z.string().max(20).optional().nullable(),
  period: z.string().max(20).optional().nullable(),
  note: z.string().max(10000).optional(),
  category: z.string().max(50).optional().nullable(),
})

// Grades schemas
export const upsertGradeSchema = z.object({
  grade: z.string().max(10).optional().nullable(),
  notes: z.string().max(5000).optional().nullable(),
  admin_notes: z.string().max(5000).optional().nullable(),
  game_score: z.string().max(50).optional().nullable(),
  team_record: z.string().max(50).optional().nullable(),
  next_opponent: z.string().max(255).optional().nullable(),
  next_game_date: z.string().max(50).optional().nullable(),
})

// Games schemas
export const createGameSchema = z.object({
  opponent: z.string().min(1, 'Opponent is required').max(255),
  date: z.string().max(50).optional().nullable(),
  location: z.string().max(255).optional().nullable(),
  competition_level: z.string().max(100).optional().nullable(),
  video_url: z.string().url().max(2000).optional().nullable().or(z.literal('')),
  notes: z.string().max(10000).optional().nullable(),
  player_ids: z.array(z.number().int().positive()).optional(),
})

export const updateGameSchema = createGameSchema.partial()

// Backup schemas
export const restoreBackupSchema = z.object({
  data: z.object({
    players: z.array(z.object({
      id: z.number().int().positive(),
      name: z.string(),
    }).passthrough()),
    games: z.array(z.object({
      id: z.number().int().positive(),
      opponent: z.string(),
    }).passthrough()),
    stats: z.array(z.object({
      id: z.number().int().positive(),
    }).passthrough()),
    game_players: z.array(z.object({
      game_id: z.number().int().positive(),
      player_id: z.number().int().positive(),
    })).optional(),
  }),
})
