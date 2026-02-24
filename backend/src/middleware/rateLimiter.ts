import rateLimit from 'express-rate-limit'

export const chatRateLimiter = rateLimit({
  windowMs: 60 * 1000,       // 1 minute window
  max: 20,                    // max 20 messages per minute per IP
  message: {
    error: 'Too many messages sent. Please take a breath and try again shortly.'
  },
  standardHeaders: true,
  legacyHeaders: false,
})

export const globalRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
})