import { v4 as uuidv4 } from 'uuid'
import { createLogger } from '@/lib/logger'
import { useSessionStore } from '@/stores/sessionStore'
import { db } from '@/db/client'
import { debounce } from '@/lib/utils'
import { getCachedDeviceId, deleteRemoteSession } from '@/services/sync/syncManager'
import type { Session, TranscriptEntry } from '@/types/models'

const log = createLogger('SessionManager')

let durationTimer: ReturnType<typeof setInterval> | null = null

// ── DB helpers (snake_case mapping) ─────────────────────────────────

interface DbSessionRow {
  id: string
  title: string
  start_time: string
  end_time: string | null
  transcript: string
  summary: string | null
  action_items: string
  mode_id: string | null
  sync_status: string
  remote_id: string | null
  device_id: string | null
}

function dbRowToSession(row: DbSessionRow): Session {
  return {
    id: row.id,
    title: row.title,
    startTime: row.start_time,
    endTime: row.end_time,
    transcript: row.transcript,
    summary: row.summary,
    actionItems: safeJsonParse(row.action_items, []),
    modeId: row.mode_id,
    entries: [],
    syncStatus: (row.sync_status as Session['syncStatus']) || 'local',
    remoteId: row.remote_id ?? undefined,
    deviceId: row.device_id ?? undefined,
  }
}

function safeJsonParse<T>(str: string | null | undefined, fallback: T): T {
  if (!str) return fallback
  try {
    return JSON.parse(str)
  } catch {
    return fallback
  }
}

// Debounced DB transcript update (avoid hammering DB on every word)
const debouncedDbTranscript = debounce((id: string, transcript: string) => {
  db.query(
    'UPDATE sessions SET transcript = ? WHERE id = ?',
    [transcript, id],
  ).catch((err) => log.error('Failed to persist transcript', err))
}, 500)

// ── Public API ──────────────────────────────────────────────────────

/**
 * Load all sessions from SQLite and populate the Zustand store.
 * Call this once at app startup.
 */
export async function loadSessions(): Promise<void> {
  try {
    const rows = await db.queryAll<DbSessionRow>(
      'SELECT * FROM sessions ORDER BY start_time DESC',
    )
    const sessions = rows.map(dbRowToSession)
    useSessionStore.getState().setSessions(sessions)
    log.info(`Loaded ${sessions.length} sessions from DB`)
  } catch (err) {
    log.error('Failed to load sessions from DB', err)
  }
}

export function startSession(title?: string, modeId?: string | null): Session {
  const session: Session = {
    id: uuidv4(),
    title: title || `Session - ${new Date().toLocaleString()}`,
    startTime: new Date().toISOString(),
    endTime: null,
    transcript: '',
    summary: null,
    actionItems: [],
    modeId: modeId || null,
    entries: [],
    syncStatus: 'local',
    deviceId: getCachedDeviceId(),
  }

  // Zustand (for UI reactivity)
  useSessionStore.getState().addSession(session)
  useSessionStore.getState().setCurrentSession(session)

  // SQLite (for persistence)
  db.query(
    `INSERT INTO sessions (id, title, start_time, end_time, transcript, summary, action_items, mode_id, sync_status, device_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      session.id,
      session.title,
      session.startTime,
      session.endTime,
      session.transcript,
      session.summary,
      JSON.stringify(session.actionItems),
      session.modeId,
      session.syncStatus || 'local',
      session.deviceId || null,
    ],
  ).catch((err) => log.error('Failed to persist new session', err))

  // Start duration timer
  durationTimer = setInterval(() => {
    // Timer ticks for UI duration display
  }, 1000)

  log.info(`Session started: ${session.id}`)
  return session
}

export function endSession(): void {
  const store = useSessionStore.getState()
  const session = store.currentSession
  if (!session) return

  if (durationTimer) {
    clearInterval(durationTimer)
    durationTimer = null
  }

  const endTime = new Date().toISOString()

  // Zustand
  store.updateSession(session.id, { endTime })
  store.setCurrentSession(null)

  // SQLite
  db.query(
    'UPDATE sessions SET end_time = ? WHERE id = ?',
    [endTime, session.id],
  ).catch((err) => log.error('Failed to persist session end', err))

  log.info(`Session ended: ${session.id}`)
}

/**
 * Finalize a session: write transcript, title, summary, and endTime to DB in one shot.
 * All writes are awaited so the DB is consistent before loadSessions().
 */
export async function finalizeSession(
  sessionId: string,
  transcript: string,
  title: string | null,
  summary: string | null,
): Promise<void> {
  const store = useSessionStore.getState()
  const endTime = new Date().toISOString()

  // Update Zustand store immediately
  const updates: Partial<Session> = { endTime, transcript }
  if (title) updates.title = title
  if (summary) updates.summary = summary
  store.updateSession(sessionId, updates)
  store.setCurrentSession(null)

  if (durationTimer) {
    clearInterval(durationTimer)
    durationTimer = null
  }

  // Single awaited DB write with all fields
  log.info(`Finalizing session ${sessionId}: title=${title ? title.slice(0, 30) : 'null'}, summary=${summary ? summary.slice(0, 50) : 'NULL'}, transcript=${transcript.length} chars`)

  try {
    const result = await db.query(
      'UPDATE sessions SET transcript = ?, title = COALESCE(?, title), summary = ?, end_time = ? WHERE id = ?',
      [transcript, title, summary, endTime, sessionId],
    )
    log.info(`Session finalized: ${sessionId}, rows affected: ${result.changes ?? 0}`)

    if (result.changes === 0) {
      log.error(`No rows updated for session ${sessionId}! Session may not exist in DB. Inserting...`)
      await db.query(
        `INSERT OR REPLACE INTO sessions (id, title, start_time, end_time, transcript, summary, action_items, mode_id, sync_status, device_id)
         VALUES (?, ?, ?, ?, ?, ?, '[]', NULL, 'local', NULL)`,
        [sessionId, title || 'Untitled Session', new Date().toISOString(), endTime, transcript, summary],
      )
      log.info(`Session inserted via fallback: ${sessionId}`)
    }
  } catch (err) {
    log.error('Failed to finalize session in DB', err)
  }
}

export function updateTranscript(transcript: string): void {
  const store = useSessionStore.getState()
  const session = store.currentSession
  if (!session) return

  // Zustand (immediate, for UI)
  store.updateSession(session.id, { transcript })

  // SQLite (debounced, for persistence)
  debouncedDbTranscript(session.id, transcript)
}

export function addTranscriptEntry(
  speaker: string,
  text: string,
  isFinal: boolean,
): TranscriptEntry {
  const sessionId = useSessionStore.getState().currentSession?.id || ''

  const entry: TranscriptEntry = {
    id: uuidv4(),
    sessionId,
    timestamp: new Date().toISOString(),
    speaker,
    text,
    isFinal,
  }

  // Zustand
  const store = useSessionStore.getState()
  const session = store.currentSession
  if (session) {
    store.updateSession(session.id, {
      entries: [...session.entries, entry],
    })
  }

  // SQLite
  if (sessionId) {
    db.query(
      `INSERT INTO transcript_entries (id, session_id, timestamp, speaker, text, is_final)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [entry.id, sessionId, entry.timestamp, speaker, text, isFinal ? 1 : 0],
    ).catch((err) => log.error('Failed to persist transcript entry', err))
  }

  return entry
}

export async function updateTranscriptEntryTranslation(
  id: string,
  translatedText: string,
  sourceLang: string | null,
  targetLang: string,
): Promise<void> {
  // Update Zustand store immediately for any consumers reading entries
  const store = useSessionStore.getState()
  const session = store.currentSession
  if (session) {
    const updatedEntries = session.entries.map((e) =>
      e.id === id
        ? {
            ...e,
            translatedText,
            translationSourceLang: sourceLang,
            translationTargetLang: targetLang,
          }
        : e,
    )
    store.updateSession(session.id, { entries: updatedEntries })
  }

  try {
    await db.query(
      `UPDATE transcript_entries
       SET translated_text = ?, translation_source_lang = ?, translation_target_lang = ?
       WHERE id = ?`,
      [translatedText, sourceLang, targetLang, id],
    )
  } catch (err) {
    log.error('Failed to persist transcript entry translation', err)
  }
}

export function setTitle(title: string): void {
  const store = useSessionStore.getState()
  const session = store.currentSession
  if (!session) return

  // Zustand
  store.updateSession(session.id, { title })

  // SQLite
  db.query(
    'UPDATE sessions SET title = ? WHERE id = ?',
    [title, session.id],
  ).catch((err) => log.error('Failed to persist title', err))
}

export function setSummary(summary: string): void {
  const store = useSessionStore.getState()
  const session = store.currentSession
  if (!session) return

  // Zustand
  store.updateSession(session.id, { summary })

  // SQLite
  db.query(
    'UPDATE sessions SET summary = ? WHERE id = ?',
    [summary, session.id],
  ).catch((err) => log.error('Failed to persist summary', err))
}

export function setActionItems(items: string[]): void {
  const store = useSessionStore.getState()
  const session = store.currentSession
  if (!session) return

  // Zustand
  store.updateSession(session.id, { actionItems: items })

  // SQLite
  db.query(
    'UPDATE sessions SET action_items = ? WHERE id = ?',
    [JSON.stringify(items), session.id],
  ).catch((err) => log.error('Failed to persist action items', err))
}

export async function deleteSession(id: string): Promise<void> {
  // Zustand (immediate UI update)
  useSessionStore.getState().removeSession(id)

  // SQLite - delete in correct order, all awaited
  try {
    const r1 = await db.query('DELETE FROM transcript_entries WHERE session_id = ?', [id])
    log.info(`Deleted ${r1.changes ?? 0} transcript_entries for session ${id}`)

    const r2 = await db.query('DELETE FROM ai_responses WHERE session_id = ?', [id])
    log.info(`Deleted ${r2.changes ?? 0} ai_responses for session ${id}`)

    const r3 = await db.query('DELETE FROM sessions WHERE id = ?', [id])
    log.info(`Deleted ${r3.changes ?? 0} session rows for session ${id}`)

    // Force WAL checkpoint to flush deletion to disk
    await db.walCheckpoint()
    log.info(`Session ${id} deleted from local DB`)
  } catch (err) {
    log.error('Failed to delete session from DB', err)
    try {
      await db.query('DELETE FROM sessions WHERE id = ?', [id])
      await db.walCheckpoint()
    } catch (err2) {
      log.error('Fallback session delete also failed', err2)
    }
  }

  // Also delete from remote server so sync doesn't re-download it
  deleteRemoteSession(id).catch((err) =>
    log.error('Failed to delete remote session (will retry on next sync)', err),
  )
}

export async function deleteSessions(ids: string[]): Promise<void> {
  if (ids.length === 0) return

  // Zustand (single batch update, single re-render)
  useSessionStore.getState().removeSessions(ids)

  // SQLite - batched cascade delete
  const placeholders = ids.map(() => '?').join(', ')
  try {
    const r1 = await db.query(
      `DELETE FROM transcript_entries WHERE session_id IN (${placeholders})`,
      ids,
    )
    log.info(`Bulk deleted ${r1.changes ?? 0} transcript_entries`)

    const r2 = await db.query(
      `DELETE FROM ai_responses WHERE session_id IN (${placeholders})`,
      ids,
    )
    log.info(`Bulk deleted ${r2.changes ?? 0} ai_responses`)

    const r3 = await db.query(
      `DELETE FROM sessions WHERE id IN (${placeholders})`,
      ids,
    )
    log.info(`Bulk deleted ${r3.changes ?? 0} sessions`)

    await db.walCheckpoint()
    log.info(`Bulk delete complete: ${ids.length} sessions`)
  } catch (err) {
    log.error('Bulk delete failed', err)
    for (const id of ids) {
      await db.query('DELETE FROM sessions WHERE id = ?', [id]).catch(() => {})
    }
    await db.walCheckpoint().catch(() => {})
  }

  // Remote deletes - parallel, fire-and-forget
  Promise.allSettled(ids.map((id) => deleteRemoteSession(id))).then((results) => {
    const failed = results.filter((r) => r.status === 'rejected').length
    if (failed > 0) log.error(`${failed}/${ids.length} remote deletes failed`)
  })
}
