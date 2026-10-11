/**
 * Contact extraction (port of macOS `ContactExtractionService.swift`).
 *
 * After a session ends, ask the model for the OTHER party's contact details.
 * Only a single, explicit, confident (≥ 0.7) result is proposed — and it is
 * only a proposal: the dashboard shows a review sheet, nothing is written
 * silently.
 */

import * as proxyApi from '@/services/proxy/proxyApiClient'
import { createLogger } from '@/lib/logger'

const log = createLogger('ContactExtractor')

export const CONFIDENCE_THRESHOLD = 0.7
const MIN_TRANSCRIPT_LENGTH = 100
const TRANSCRIPT_TAIL = 5000

export interface ExtractedContact {
  firstName: string
  lastName?: string
  email?: string
  company?: string
  role?: string
  confidence: number
  suggestedNotes: string[]
}

const EXTRACTION_SYSTEM_PROMPT = `You are a contact extraction assistant. Your role is to analyze conversation transcripts (in any language) and extract the contact information of the other party.

RULES:
1. Extract ONLY information explicitly mentioned in the conversation
2. NEVER invent or guess information
3. If a piece of information is not mentioned, leave the field null
4. Rate your confidence (0.0 to 1.0) based on how clear the found information is
5. Suggest relevant notes based on the conversation content
6. Write the suggested notes in the SAME LANGUAGE as the conversation

RESPOND ONLY IN JSON with this exact format:
{
    "firstName": "string or null",
    "lastName": "string or null",
    "email": "string or null",
    "company": "string or null",
    "role": "string or null",
    "confidence": 0.0-1.0,
    "suggestedNotes": ["note1", "note2"]
}`

function buildExtractionPrompt(transcript: string): string {
  const trimmed = transcript.slice(-TRANSCRIPT_TAIL)
  return `Analyze this transcript and extract the other party's contact information:

---
${trimmed}
---

Extract the information as JSON.`
}

function cleanString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  if (!trimmed || trimmed.toLowerCase() === 'null' || trimmed.toLowerCase() === 'unknown') return undefined
  return trimmed
}

/**
 * Parse the model's answer. Returns null when the JSON is invalid, the
 * confidence is below the threshold or there is no first name.
 * Pure function (unit-tested).
 */
export function parseExtractionResponse(raw: string): ExtractedContact | null {
  let jsonStr = raw.trim()
  const codeBlock = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (codeBlock) jsonStr = codeBlock[1].trim()
  // The expected shape is a single object; a list means the model answered
  // the old "everyone mentioned" way and must not be turned into a proposal.
  if (jsonStr.startsWith('[')) return null
  // Tolerate prose around the object
  const first = jsonStr.indexOf('{')
  const last = jsonStr.lastIndexOf('}')
  if (first === -1 || last === -1 || last < first) return null
  jsonStr = jsonStr.slice(first, last + 1)

  let parsed: Record<string, unknown>
  try {
    parsed = JSON.parse(jsonStr)
  } catch {
    return null
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null

  const firstName = cleanString(parsed.firstName)
  const confidence = typeof parsed.confidence === 'number' ? parsed.confidence : Number(parsed.confidence)
  if (!firstName || !Number.isFinite(confidence) || confidence < CONFIDENCE_THRESHOLD) return null

  const email = cleanString(parsed.email)
  const suggestedNotes = Array.isArray(parsed.suggestedNotes)
    ? parsed.suggestedNotes.map(cleanString).filter((n): n is string => !!n).slice(0, 5)
    : []

  return {
    firstName,
    lastName: cleanString(parsed.lastName),
    email: email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : undefined,
    company: cleanString(parsed.company),
    role: cleanString(parsed.role),
    confidence: Math.min(1, Math.max(0, confidence)),
    suggestedNotes,
  }
}

/** Ask the model for the other party's contact. Never throws; null when nothing viable. */
export async function extractContactFromTranscript(transcript: string): Promise<ExtractedContact | null> {
  if (transcript.length < MIN_TRANSCRIPT_LENGTH) {
    log.info('Transcript too short for contact extraction')
    return null
  }

  try {
    const response = await proxyApi.generateAIResponse({
      model: 'auto',
      messages: [
        { role: 'system', content: EXTRACTION_SYSTEM_PROMPT },
        { role: 'user', content: buildExtractionPrompt(transcript) },
      ],
      max_tokens: 500,
      temperature: 0.1,
    })

    const extracted = parseExtractionResponse(response)
    if (!extracted) {
      log.info('No viable contact extracted')
      return null
    }
    log.info(`Viable contact found: ${extracted.firstName} ${extracted.lastName ?? ''} (confidence ${extracted.confidence.toFixed(2)})`)
    return extracted
  } catch (error) {
    log.error('Contact extraction failed:', error)
    return null
  }
}
