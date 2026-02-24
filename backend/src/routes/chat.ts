import { Router, Request, Response } from 'express'
import { chatRateLimiter } from '../middleware/rateLimiter'
import { generateCompanionResponse, updateSummaryIfNeeded } from '../services/anthropic'
import { assessCrisisRisk, getCrisisGuidance } from '../services/crisis'
import { ChatRequest, ChatResponse } from '../types'

const router = Router()

router.post('/', chatRateLimiter, async (req: Request, res: Response) => {
  try {
    const { messages, careProfile, existingSummary } = req.body as ChatRequest

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

    // Update summary if conversation has grown beyond the context window.
    // This runs in parallel preparation — the updated summary is passed to
    // the response generator and returned to the client to persist.
    const updatedSummary = await updateSummaryIfNeeded(messages, existingSummary ?? null)

    // Generate AI response — passes summary for full conversation memory
    let responseText = await generateCompanionResponse(
      messages,
      careProfile,
      updatedSummary
    )

    // Append crisis resources if flagged
    if (crisisAssessment.flagged && crisisAssessment.severity !== 'none') {
      responseText += getCrisisGuidance(crisisAssessment.severity)
    }

    const response: ChatResponse = {
      message: responseText,
      flagged: crisisAssessment.flagged,
      updatedSummary,
    }

    res.json(response)
  } catch (error) {
    console.error('Chat route error:', error)
    console.error('Error details:', JSON.stringify(error, Object.getOwnPropertyNames(error)))
    res.status(500).json({
      error: 'Something went wrong. Please try again.'
    })
  }
})

export default router