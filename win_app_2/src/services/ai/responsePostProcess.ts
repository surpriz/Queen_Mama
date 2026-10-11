/**
 * Response post-processing shared with macOS (`AIService.swift`):
 *  - strip "prediction" bullets models keep adding despite the prompt;
 *  - detect safety-filter refusals so the caller can retry without the screenshot.
 */

const PREDICTION_PATTERNS = [
  // Sonnet 4.6 patterns
  'il va probablement', 'ils vont probablement', 'il va sûrement', 'ils vont sûrement',
  'elle va probablement', 'elles vont probablement',
  'il va certainement', 'ils vont certainement',
  'la prochaine question', 'la prochaine objection', 'la suite logique',
  'prépare un', 'prépare une', 'prépare-toi', 'prépare le', 'prépare la',
  'anticipe la', 'anticipe le', 'anticipe un',
  // GPT-5.4-mini patterns
  'le prochain risque', 'prochain angle probable', 'la vraie question sera',
  'on vous demandera', 'ils vont tester', 'il va tester',
  'anticipez la suite', 'enchaînez avec le prochain', 'enchaîne avec le prochain',
  "c'est ce qu'ils vont", "c'est ce qu'il va",
  // English patterns
  'he will probably', 'she will probably', 'they will probably',
  'the next question', 'prepare a', 'prepare for',
  'they will likely', 'expect them to', 'the follow-up will',
]

const REFUSAL_PATTERNS = [
  "i'm sorry, i can't help",
  'i cannot help with that',
  "i can't assist with",
  "i'm not able to help",
  'i cannot assist',
  "i'm unable to help",
  "i can't provide help",
  "sorry, but i can't",
  'i apologize, but i cannot',
  "i'm afraid i can't",
]

/** Remove bullet lines that predict what the other party will say next. */
export function stripPredictionBullets(text: string): string {
  const lines = text.split('\n')
  if (lines.length < 2) return text

  let stripped = 0
  const kept = lines.filter((line) => {
    const trimmed = line.trim()
    const isBullet = trimmed.startsWith('- ') || trimmed.startsWith('• ') || trimmed.startsWith('* ')
    if (!isBullet) return true
    const lower = trimmed.toLowerCase()
    const isPrediction = PREDICTION_PATTERNS.some((p) => lower.includes(p))
    if (isPrediction) stripped++
    return !isPrediction
  })

  return stripped > 0 ? kept.join('\n').trim() : text
}

/** Short responses that read like a safety-filter block. */
export function isRefusalResponse(response: string): boolean {
  const lower = response.toLowerCase().trim()
  if (lower.length >= 100) return false
  return REFUSAL_PATTERNS.some((p) => lower.includes(p))
}
