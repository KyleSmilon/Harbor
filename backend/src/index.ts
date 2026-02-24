import express from 'express'
import helmet from 'helmet'
import cors from 'cors'
import dotenv from 'dotenv'
import { globalRateLimiter } from './middleware/rateLimiter'
import { requireAuth } from './middleware/auth'
import chatRouter from './routes/chat'

dotenv.config()

const app = express()
const PORT = process.env.PORT || 3000

app.set('trust proxy', 1) // Trust Railway's proxy layer

// Security middleware — order matters here
app.use(helmet())
app.use(cors({
  origin: process.env.ALLOWED_ORIGIN || '*', // Lock this down in production
  methods: ['POST'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}))
app.use(express.json({ limit: '10kb' })) // Prevents large payload attacks
app.use(globalRateLimiter)

// Health check — Railway uses this to know your server is alive
app.get('/health', (_req, res) => {
  res.json({ status: 'ok' })
})

// All chat routes require authentication
app.use('/api/chat', requireAuth, chatRouter)

// Catch-all for unknown routes
app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' })
})

app.listen(PORT, () => {
  console.log(`Harbor backend running on port ${PORT}`)
})
