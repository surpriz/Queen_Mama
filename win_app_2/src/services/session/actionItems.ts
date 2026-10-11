import { createLogger } from '@/lib/logger'
import * as proxyApi from '@/services/proxy/proxyApiClient'
import type { AIMessage } from '@/types/api'

const log = createLogger('ActionItems')

const MAX_ITEMS = 8
const MIN_TRANSCRIPT_CHARS = 200

/** Prompt mirrors the macOS action-items pass: short, concrete, same language as the transcript. */
export function buildActionItemsPrompt(transcript: string): AIMessage[] {
  const trimmed = transcript.length > 12000 ? transcript.slice(-12000) : transcript
  return [
    {
      role: 'system',
      content:
        'You extract action items from meeting transcripts. ' +
        'Return ONLY a JSON array of strings (no markdown, no prose). ' +
        `Each string is one concrete, actionable follow-up (owner + task when known), max ${MAX_ITEMS} items, ` +
        'in the same language as the transcript. Return [] when there is nothing actionable.',
    },
    { role: 'user', content: `Transcript:\n\n${trimmed}` },
  ]
}

/**
 * Tolerant parser for the model output: JSON array, JSON wrapped in a code
 * fence, or a plain bullet list. Never throws.
 */
export function parseActionItems(raw: string): string[] {
  if (!raw) return []
  const text = raw.trim()
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const candidate = fenced ? fenced[1].trim() : text

  const tryJson = (s: string): string[] | null => {
    try {
      const parsed = JSON.parse(s)
      if (Array.isArray(parsed)) {
        return parsed.filter((v): v is string => typeof v === 'string').map((v) => v.trim()).filter(Boolean)
      }
    } catch {
      // not JSON
    }
    return null
  }

  const direct = tryJson(candidate)
  if (direct) return direct.slice(0, MAX_ITEMS)

  const arrayMatch = candidate.match(/\[[\s\S]*\]/)
  if (arrayMatch) {
    const inner = tryJson(arrayMatch[0])
    if (inner) return inner.slice(0, MAX_ITEMS)
  }

  // Plain bullets fallback: only lines that look like list items
  return candidate
    .split('\n')
    .filter((line) => /^\s*(?:[-*•]|\d+[.)])\s+/.test(line))
    .map((line) => line.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, '').trim())
    .filter((line) => line.length > 3)
    .slice(0, MAX_ITEMS)
}

/** Ask the backend for action items; returns [] on any failure or short transcript. */
export async function extractActionItems(transcript: string): Promise<string[]> {
  if (!transcript || transcript.length < MIN_TRANSCRIPT_CHARS) return []
  try {
    const raw = await proxyApi.generateAIResponse({
      model: 'auto',
      messages: buildActionItemsPrompt(transcript),
      max_tokens: 400,
      temperature: 0.2,
    })
    const items = parseActionItems(raw)
    log.info(`Extracted ${items.length} action items`)
    return items
  } catch (err) {
    log.warn('Action item extraction failed', err)
    return []
  }
}
