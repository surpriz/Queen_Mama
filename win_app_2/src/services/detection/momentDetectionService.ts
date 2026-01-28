import { createLogger } from '@/lib/logger'

const log = createLogger('MomentDetection')

export type MomentType = 'objection' | 'expertiseQuestion' | 'hesitation' | 'closingOpportunity'

export interface DetectedMoment {
  type: MomentType
  confidence: number
  triggerPhrase: string
  context: string
  timestamp: number
}

interface MomentPattern {
  type: MomentType
  patterns: RegExp[]
}

const MOMENT_PATTERNS: MomentPattern[] = [
  {
    type: 'objection',
    patterns: [
      // French
      /c'est trop cher/i,
      /trop co[uû]teux/i,
      /pas dans (notre|le|mon) budget/i,
      /on n'a pas (le|les) moyens/i,
      /je ne suis pas (convaincu|s[uû]r)/i,
      /ça ne (m'int[eé]resse|nous int[eé]resse) pas/i,
      /on utilise d[eé]j[aà]/i,
      /on a d[eé]j[aà] un/i,
      /pas le bon moment/i,
      /il faut que j'en parle/i,
      // English
      /too expensive/i,
      /not in (our|the|my) budget/i,
      /can't afford/i,
      /i'm not (convinced|sure)/i,
      /not interested/i,
      /we already (use|have)/i,
      /not the right time/i,
      /need to (talk|speak|discuss) (with|to)/i,
      /let me think about/i,
      /i'll get back to you/i,
    ],
  },
  {
    type: 'expertiseQuestion',
    patterns: [
      // French
      /comment (ça marche|fonctionne)/i,
      /pouvez-vous (m')?expliquer/i,
      /quelle est la diff[eé]rence/i,
      /comment vous g[eé]rez/i,
      /est-ce que (vous|ça) (peut|supporte)/i,
      /quelle technologie/i,
      // English
      /how does (it|that|this) work/i,
      /can you explain/i,
      /what('s| is) the difference/i,
      /how do you handle/i,
      /does (it|this) support/i,
      /what technology/i,
    ],
  },
  {
    type: 'hesitation',
    patterns: [
      // French
      /je ne sais pas (si|trop)/i,
      /je suis pas s[uû]r/i,
      /euh.*euh/i,
      /comment dire/i,
      /c'est [aà] dire/i,
      /bonne question/i,
      // English
      /i('m| am) not sure/i,
      /um+.*um+/i,
      /how (do|should|can) i (put|say)/i,
      /that's a good question/i,
      /let me think/i,
      /i don't (know|think)/i,
    ],
  },
  {
    type: 'closingOpportunity',
    patterns: [
      // French
      /ça (m'|nous) (int[eé]resse|pla[iî]t)/i,
      /comment on (proc[eè]de|fait|commence)/i,
      /quelles sont les (prochaines|[eé]tapes)/i,
      /on peut commencer quand/i,
      /envoyez-moi (un|le|la)/i,
      /c'est (exactement|pr[eé]cis[eé]ment) ce/i,
      // English
      /i('m| am) interested/i,
      /how do we (proceed|start|get started)/i,
      /what are the next steps/i,
      /when can we (start|begin)/i,
      /send me (a|the)/i,
      /that's exactly what/i,
      /sounds? (good|great|perfect)/i,
    ],
  },
]

const MOMENT_LABELS: Record<MomentType, string> = {
  objection: 'Objection detected',
  expertiseQuestion: 'Technical question',
  hesitation: 'Hesitation detected',
  closingOpportunity: 'Closing opportunity',
}

export function detectMoments(transcript: string): DetectedMoment[] {
  const moments: DetectedMoment[] = []
  const lastChars = transcript.slice(-300) // Analyze recent content

  for (const { type, patterns } of MOMENT_PATTERNS) {
    let matchCount = 0
    let lastMatch = ''

    for (const pattern of patterns) {
      const match = lastChars.match(pattern)
      if (match) {
        matchCount++
        lastMatch = match[0]
      }
    }

    if (matchCount > 0) {
      // Confidence scoring
      let confidence = matchCount === 1 ? 0.6 : matchCount === 2 ? 0.75 : 0.85 + matchCount * 0.02

      // Recency boost: if match is in last 100 chars
      const recentChars = transcript.slice(-100)
      for (const pattern of patterns) {
        if (pattern.test(recentChars)) {
          confidence = Math.min(1, confidence + 0.1)
          break
        }
      }

      moments.push({
        type,
        confidence,
        triggerPhrase: lastMatch,
        context: extractContext(transcript, lastMatch),
        timestamp: Date.now(),
      })
    }
  }

  return moments
}

function extractContext(transcript: string, trigger: string): string {
  const idx = transcript.lastIndexOf(trigger)
  if (idx === -1) return trigger

  const start = Math.max(0, idx - 40)
  const end = Math.min(transcript.length, idx + trigger.length + 40)
  let context = transcript.slice(start, end)

  if (start > 0) context = '...' + context
  if (end < transcript.length) context += '...'

  return context
}

export function getMomentLabel(type: MomentType): string {
  return MOMENT_LABELS[type]
}
