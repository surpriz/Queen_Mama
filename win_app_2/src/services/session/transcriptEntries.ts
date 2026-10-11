import { db } from '@/db/client'
import { createLogger } from '@/lib/logger'
import type { TranscriptEntry } from '@/types/models'

const log = createLogger('TranscriptEntries')

/** A displayable transcript line, with the speaker normalized to me / them / unknown. */
export interface TranscriptLine {
  speaker: 'me' | 'them' | null
  text: string
  timestamp?: string
  translatedText?: string | null
}

const ME_LABELS = ['moi', 'me', 'you', 'user']
const THEM_LABELS = ['interlocuteur', 'them', 'other', 'assistant', 'speaker']

export function speakerKind(label: string): 'me' | 'them' | null {
  const lower = label.trim().toLowerCase()
  if (ME_LABELS.includes(lower)) return 'me'
  if (THEM_LABELS.includes(lower)) return 'them'
  return null
}

/**
 * Fallback for sessions recorded before entries were persisted (or pulled from
 * another device): parse the "Moi: …" / "Interlocuteur: …" transcript text.
 */
export function parseTranscriptLines(transcript: string): TranscriptLine[] {
  if (!transcript) return []
  return transcript
    .split('\n')
    .map((line) => {
      const match = line.match(/^([A-Za-zÀ-ÿ]+):\s(.*)$/)
      if (match) {
        const kind = speakerKind(match[1])
        if (kind) return { speaker: kind, text: match[2] }
      }
      return { speaker: null, text: line }
    })
    .filter((line) => line.speaker !== null || line.text.trim().length > 0)
}

export function entriesToLines(entries: TranscriptEntry[]): TranscriptLine[] {
  return entries
    .filter((e) => e.isFinal && e.text.trim().length > 0)
    .map((e) => ({
      speaker: speakerKind(e.speaker),
      text: e.text,
      timestamp: e.timestamp,
      translatedText: e.translatedText ?? null,
    }))
}

interface DbEntryRow {
  id: string
  session_id: string
  timestamp: string
  speaker: string
  text: string
  is_final: number
  translated_text: string | null
  translation_source_lang: string | null
  translation_target_lang: string | null
}

/** Read a session's transcript entries (with translations) back from SQLite. */
export async function loadEntriesForSession(sessionId: string): Promise<TranscriptEntry[]> {
  try {
    const rows = await db.queryAll<DbEntryRow>(
      'SELECT * FROM transcript_entries WHERE session_id = ? ORDER BY timestamp ASC',
      [sessionId],
    )
    return rows.map((r) => ({
      id: r.id,
      sessionId: r.session_id,
      timestamp: r.timestamp,
      speaker: r.speaker,
      text: r.text,
      isFinal: r.is_final === 1,
      translatedText: r.translated_text,
      translationSourceLang: r.translation_source_lang,
      translationTargetLang: r.translation_target_lang,
    }))
  } catch (err) {
    log.error(`Failed to load entries for session ${sessionId}`, err)
    return []
  }
}

/** Lines for display/export: persisted entries when available, otherwise the text fallback. */
export function sessionLines(transcript: string, entries: TranscriptEntry[] | undefined): TranscriptLine[] {
  const fromEntries = entries ? entriesToLines(entries) : []
  return fromEntries.length > 0 ? fromEntries : parseTranscriptLines(transcript)
}
