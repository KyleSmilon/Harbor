export interface Message {
  role: 'user' | 'assistant'
  content: string
}

export interface CareProfile {
  careRecipientName: string
  relationship: string
  durationMonths: number
  biggestChallenge: string
  supportSituation: string
}

export interface ChatRequest {
  messages: Message[]
  careProfile: CareProfile
  userId: string
}

export interface ChatResponse {
  message: string
  flagged: boolean
}