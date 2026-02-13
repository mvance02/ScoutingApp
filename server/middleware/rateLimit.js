import rateLimit from 'express-rate-limit'

// Strict limiter for authentication routes (login/register)
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 requests per window
  message: { error: 'Too many authentication attempts. Please try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
})

// Stricter limiter for password reset to prevent abuse
export const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // 3 requests per hour per IP
  message: { error: 'Too many password reset requests. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
})

// General API limiter
export const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute
  message: { error: 'Too many requests. Please slow down.' },
  standardHeaders: true,
  legacyHeaders: false,
})

// Burst limiter for stat creation (prevents accidental rapid submissions)
export const statCreationLimiter = rateLimit({
  windowMs: 1000, // 1 second
  max: 10, // 10 stats per second
  message: { error: 'Creating stats too quickly. Please slow down.' },
  standardHeaders: true,
  legacyHeaders: false,
})
