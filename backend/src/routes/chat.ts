import { Router, Request, Response } from 'express'
import { chatRateLimiter } from '../middleware/rateLimiter'
import { generateCompanionResponse } from '../services/anthropic'
import { assessCrisisRisk, getCrisisGuidance } from '../services/crisis'
import { ChatRequest, ChatResponse } from '../types'

const router = Router()

router.post('/', chatRateLimiter, async (req: Request, res: Response) => {
  try {
    const { messages, careProfile } = req.body as ChatRequest

    if (!messages || !careProfile || !Array.isArray(messages)) {
      res.status(400).json({ error: 'Invalid request body' })
      return
    }

    // Assess the latest user message for crisis signals
    const latestUserMessage = [...messages]
      .reverse()
      .find(m => m.role === 'user')

    const crisisAssessment = latestUserMessage
      ? assessCrisisRisk(latestUserMessage.content)
      : { flagged: false, severity: 'none' as const }

    // Generate AI response
    let responseText = await generateCompanionResponse(messages, careProfile)

    // Append crisis resources if flagged
    if (crisisAssessment.flagged && crisisAssessment.severity !== 'none') {
      responseText += getCrisisGuidance(crisisAssessment.severity)
    }

    const response: ChatResponse = {
      message: responseText,
      flagged: crisisAssessment.flagged,
    }

    res.json(response)
  } catch (error) {
    console.error('Chat route error:', error)
    res.status(500).json({ 
      error: 'Something went wrong. Please try again.' 
    })
  }
})

export default router