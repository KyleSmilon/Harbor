const HIGH_RISK_PATTERNS = [
  /\b(suicid|kill myself|end my life|don't want to (be here|live|exist))\b/i,
  /\b(can't (go on|do this anymore|take it anymore))\b/i,
  /\b(no point|no reason to (live|continue)|better off without me)\b/i,
  /\b(harm myself|hurt myself|self.harm)\b/i,
  /\b(want to die|wish I was dead|wish I were dead)\b/i,
  /\b(ending it|end it all|make it stop)\b/i,
]

const ELEVATED_RISK_PATTERNS = [
  /\b(hopeless|worthless|trapped|can't escape|no way out)\b/i,
  /\b(exhausted|breaking|broken|falling apart|can't cope)\b/i,
  /\b(nobody cares|all alone|completely alone|no one understands)\b/i,
]

export interface CrisisAssessment {
  flagged: boolean
  severity: 'none' | 'elevated' | 'high'
}

export function assessCrisisRisk(text: string): CrisisAssessment {
  const isHighRisk = HIGH_RISK_PATTERNS.some(pattern => pattern.test(text))

  if (isHighRisk) {
    return { flagged: true, severity: 'high' }
  }

  const isElevatedRisk = ELEVATED_RISK_PATTERNS.some(pattern => 
    pattern.test(text)
  )

  if (isElevatedRisk) {
    return { flagged: true, severity: 'elevated' }
  }

  return { flagged: false, severity: 'none' }
}

export function getCrisisGuidance(severity: 'elevated' | 'high'): string {
  if (severity === 'high') {
    return `\n\n---\n💙 **You don't have to carry this alone.**\n\nIf you're having thoughts of hurting yourself, please reach out right now:\n\n• **988 Suicide & Crisis Lifeline** — call or text 988 (free, 24/7)\n• **Caregiver Help Desk** — 1-855-227-3640\n• **Crisis Text Line** — text HOME to 741741\n\nYou matter. What you're going through is real and it's incredibly hard.`
  }

  return `\n\n---\n💙 **A gentle reminder** — if you're ever feeling overwhelmed beyond what you can manage alone, the 988 Crisis Lifeline (call or text 988) and the Caregiver Help Desk (1-855-227-3640) are always available. You don't have to be in crisis to reach out.`
}