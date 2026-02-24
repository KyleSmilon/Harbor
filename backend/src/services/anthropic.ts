import Anthropic from '@anthropic-ai/sdk'
import { Message, CareProfile } from '../types'

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
})

// How many recent messages to always include in full
const CONTEXT_WINDOW = 10

function buildSystemPrompt(careProfile: CareProfile, summary?: string): string {
  // If a summary exists, inject it at the top of the system prompt so the
  // companion has memory of the full conversation without sending every message
  const summarySection = summary
    ? `## Conversation History Summary
The following is a summary of what has been discussed earlier in this conversation. Use this to maintain continuity and remember important details the caregiver has shared:

${summary}

## Recent Messages
The following are the most recent messages in the conversation:`
    : ''

  return `You are Harbor's Care Companion — a warm, deeply empathetic presence built specifically for family caregivers. You exist to support the emotional wellbeing of people who are caring for an aging or ill loved one.

## Who You're Talking To
This person is caring for ${careProfile.careRecipientName} (their ${careProfile.relationship}). They have been caregiving for approximately ${careProfile.durationMonths} months. Their biggest challenge is: "${careProfile.biggestChallenge}". Their support situation: ${careProfile.supportSituation}.

${summarySection}

## Your Core Approach
You follow a strict sequence for emotionally heavy messages:
1. ACKNOWLEDGE — reflect back what they shared so they feel truly heard
2. VALIDATE — affirm that their feelings make complete sense given what they're carrying
3. ONLY THEN — gently ask a question or offer a thought, only if it feels right

You never rush to solutions. You never minimize. You never say things like "at least..." or "have you tried...?" unless explicitly asked for advice. You never tell someone how they should feel.

## Your Tone
Warm, grounded, and unhurried. Like a knowledgeable friend who has walked alongside many caregivers and genuinely understands the weight of this role. You are not a therapist and you do not claim to be. You are not a medical advisor. You are a compassionate companion.

## What You Never Do
- Never diagnose or recommend medications or treatments
- Never claim to be human if sincerely asked
- Never be dismissive of how hard caregiving is
- Never end a response without leaving an open door — a gentle question or open invitation to continue
- Never be performatively cheerful when someone is in pain
- Never give unsolicited advice in a first response to a hard message

## Crisis Awareness
If someone expresses hopelessness, thoughts of self-harm, or language suggesting they may not want to continue, you first acknowledge what they've shared with deep care and warmth. You stay present with them. You do not abruptly shift into crisis mode — you remain their companion while gently noting that support is available.

## Your Purpose
You exist because caregivers are some of the most overlooked people in the healthcare system. They give everything and often have nowhere to turn. Harbor is that place. You are the reason someone makes it through a hard night.`
}

// Generates a concise summary of older messages that have fallen outside
// the active context window — preserving emotional continuity without token bloat
async function generateSummary(
  existingSummary: string | null,
  messagesToSummarise: Message[]
): Promise<string> {
  const messageText = messagesToSummarise
    .map(m => `${m.role === 'user' ? 'Caregiver' : 'Harbor'}: ${m.content}`)
    .join('\n\n')

  const prompt = existingSummary
    ? `You are summarising a caregiving support conversation for context continuity.

Previous summary:
${existingSummary}

New messages to incorporate:
${messageText}

Create an updated summary that combines the previous summary with the new messages. Focus on:
- Key emotional themes and struggles the caregiver has shared
- Important details about their loved one and situation  
- Any breakthroughs, decisions, or commitments made
- The overall emotional arc of the conversation

Keep the summary under 200 words. Write in third person (e.g. "The caregiver mentioned...").`
    : `You are summarising a caregiving support conversation for context continuity.

Conversation to summarise:
${messageText}

Summarise the key points from this conversation. Focus on:
- Key emotional themes and struggles the caregiver has shared
- Important details about their loved one and situation
- Any breakthroughs, decisions, or commitments made
- The overall emotional arc of the conversation

Keep the summary under 200 words. Write in third person (e.g. "The caregiver mentioned...").`

  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001', // Use Haiku for summarisation — faster and cheaper
    max_tokens: 300,
    messages: [{ role: 'user', content: prompt }],
  })

  const textBlock = response.content.find(b => b.type === 'text')
  return textBlock && textBlock.type === 'text' ? textBlock.text : ''
}

export async function generateCompanionResponse(
  messages: Message[],
  careProfile: CareProfile,
  existingSummary?: string | null
): Promise<string> {
  let summary = existingSummary || undefined

  // If we have more messages than the context window,
  // take the oldest ones and fold them into the summary
  const needsSummarising = messages.length > CONTEXT_WINDOW
  const recentMessages = needsSummarising
    ? messages.slice(messages.length - CONTEXT_WINDOW)
    : messages

  // Build the system prompt — injects summary if it exists
  const system = buildSystemPrompt(careProfile, summary)

  const response = await client.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 1024,
    system,
    messages: recentMessages,
  })

  const textBlock = response.content.find(block => block.type === 'text')
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('No text response from Claude')
  }

  return textBlock.text
}

// Called by the chat route to update the summary when the window slides
export async function updateSummaryIfNeeded(
  messages: Message[],
  existingSummary: string | null
): Promise<string | null> {
  if (messages.length <= CONTEXT_WINDOW) return existingSummary

  // Summarise everything that's fallen outside the context window
  const messagesToSummarise = messages.slice(0, messages.length - CONTEXT_WINDOW)
  return generateSummary(existingSummary, messagesToSummarise)
}