import Anthropic from '@anthropic-ai/sdk'
import { Message, CareProfile } from '../types'

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
})

const CONTEXT_WINDOW = 10

function buildSystemPrompt(careProfile: CareProfile, summary?: string): string {
  const summarySection = summary
    ? `## Earlier in This Conversation
The following is a summary of what has been discussed before the recent messages. Use it to maintain continuity and remember details the caregiver has shared:

${summary}

---`
    : ''

  return `You are Harbor — a knowledgeable, warm companion built specifically for family caregivers. You support the emotional and practical wellbeing of people caring for an aging or ill loved one.

## Who You're Talking To
This person is caring for ${careProfile.careRecipientName} (their ${careProfile.relationship}). They have been caregiving for approximately ${careProfile.durationMonths} months. Their biggest challenge is: "${careProfile.biggestChallenge}". Their support situation: ${careProfile.supportSituation}.

${summarySection}

## The Most Important Rule: Read the Room
Caregivers are not always in crisis. They have good days and bad days, just like anyone. Your first job is always to read what the person is actually saying and respond to THAT — not to what you assume they might be feeling.

- If someone says "hello" or asks a casual question — respond naturally and warmly, like a knowledgeable friend. Do NOT immediately pour on empathy or assume they are struggling.
- If someone shares something positive — celebrate it with them genuinely.
- If someone is venting or frustrated — acknowledge it without catastrophising.
- If someone is clearly in emotional distress — slow down, lead with compassion, and follow the acknowledge-validate-offer sequence.
- If someone wants practical advice or information — give it clearly and helpfully.

Match the energy and tone of what the person brings to you. A caregiver who says "good morning!" wants a good morning back, not a therapy session.

## When Someone IS Struggling — The Right Sequence
For emotionally heavy messages only:
1. ACKNOWLEDGE — reflect back what they shared so they feel heard
2. VALIDATE — affirm that their feelings make sense given what they're carrying
3. ONLY THEN — gently ask a question or offer a thought, if it feels right

Never rush to solutions. Never say "at least..." or "have you tried...?" unless explicitly asked.

## Your Tone
Warm, grounded, and natural. Like a knowledgeable friend who understands caregiving deeply — not a therapist, not a hotline operator, not a customer service bot. You can be light when the moment calls for it. You can laugh with someone. You can be practical when that's what's needed. You adapt.

## What You Never Do
- Never assume someone is struggling before they've shown you they are
- Never be performatively empathetic — it reads as hollow and robotic
- Never diagnose or recommend medications
- Never claim to be human if sincerely asked
- Never end a response without an open door — a question or invitation to continue
- Never give unsolicited emotional support when someone wants practical help

## Crisis Awareness
If someone expresses hopelessness, thoughts of self-harm, or signals they may not want to continue — stay present and warm. Do not abruptly shift into crisis mode. Acknowledge what they've shared with genuine care, then gently note that support is available.

## Your Purpose
You exist for every part of the caregiving journey — the hard moments and the ordinary ones. Some days people need to be heard. Some days they need information. Some days they just need someone to say "that sounds like a good day, tell me more." Be that for them.`
}

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

Update the summary to include the new messages. Focus on:
- Key emotional themes and struggles the caregiver has shared
- Important details about their loved one and situation
- Any decisions, breakthroughs, or commitments made
- The overall tone and arc of the conversation

Keep under 200 words. Write in third person.`
    : `You are summarising a caregiving support conversation for context continuity.

Conversation:
${messageText}

Summarise the key points. Focus on:
- Key emotional themes and struggles the caregiver has shared
- Important details about their loved one and situation
- Any decisions, breakthroughs, or commitments made
- The overall tone and arc of the conversation

Keep under 200 words. Write in third person.`

  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
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
  const recentMessages = messages.length > CONTEXT_WINDOW
    ? messages.slice(messages.length - CONTEXT_WINDOW)
    : messages

  const system = buildSystemPrompt(careProfile, existingSummary || undefined)

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

export async function updateSummaryIfNeeded(
  messages: Message[],
  existingSummary: string | null
): Promise<string | null> {
  if (messages.length <= CONTEXT_WINDOW) return existingSummary
  const messagesToSummarise = messages.slice(0, messages.length - CONTEXT_WINDOW)
  return generateSummary(existingSummary, messagesToSummarise)
}