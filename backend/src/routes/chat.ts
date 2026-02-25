import { Router, Request, Response } from 'express'
import { createClient } from '@supabase/supabase-js'
import { chatRateLimiter } from '../middleware/rateLimiter'
import { generateCompanionResponse, updateSummaryIfNeeded } from '../services/anthropic'
import { assessCrisisRisk, getCrisisGuidance } from '../services/crisis'
import { ChatRequest, ChatResponse, Message } from '../types'


const router = Router()

// Backend Supabase client uses the service key — bypasses RLS to read
// full conversation history for summary generation
function getSupabase() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  )
}

router.post('/', chatRateLimiter, async (req: Request, res: Response) => {
  try {
    const { messages, careProfile, conversationId, existingSummary } = req.body as ChatRequest

    if (!messages || !careProfile || !Array.isArray(messages)) {
      res.status(400).json({ error: 'Invalid request body' })
      return
    }

    const latestUserMessage = [...messages]
      .reverse()
      .find(m => m.role === 'user')

    const crisisAssessment = latestUserMessage
      ? assessCrisisRisk(latestUserMessage.content)
      : { flagged: false, severity: 'none' as const }

    // If we have a conversationId, fetch full history from DB for accurate
    // summary generation — the app only sends recent messages
    let fullHistory = messages
    let currentSummary = existingSummary ?? null

    if (conversationId) {
      const supabase = getSupabase()

      const { data: allMessages } = await supabase
        .from('messages')
        .select('role, content')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true })

      if (allMessages && allMessages.length > 0) {
        fullHistory = allMessages as Message[]
      }

      // Also fetch the current stored summary if not passed from client
      if (!currentSummary) {
        const { data: convo } = await supabase
          .from('conversations')
          .select('summary')
          .eq('id', conversationId)
          .single()

        currentSummary = convo?.summary ?? null
      }
    }

    // Update summary using full history — this is where summarisation actually triggers
    const updatedSummary = await updateSummaryIfNeeded(fullHistory, currentSummary)

    // Persist updated summary back to DB if it changed
    if (conversationId && updatedSummary !== currentSummary) {
      const supabase = getSupabase()
      await supabase
        .from('conversations')
        .update({ summary: updatedSummary })
        .eq('id', conversationId)
    }

    // Generate response using recent messages + summary for context
    let responseText = await generateCompanionResponse(
      fullHistory,
      careProfile,
      updatedSummary
    )

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