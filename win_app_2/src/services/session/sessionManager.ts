import { v4 as uuidv4 } from 'uuid'
import { createLogger } from '@/lib/logger'
import { useSessionStore } from '@/stores/sessionStore'
import { db } from '@/db/client'
import { currentOwnerId, ownerFilter } from './userScope'
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
  meeting_participants?: number | null
  meeting_hourly_rate?: number | null
  meeting_currency?: string | null
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
    meetingParticipants: row.meeting_participants ?? null,
    meetingHourlyRate: row.meeting_hourly_rate ?? null,
    meetingCurrency: row.meeting_currency ?? null,
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
    // Only the signed-in account's rows (legacy NULL rows while signed out)
    const owner = ownerFilter()
    const rows = await db.queryAll<DbSessionRow>(
      `SELECT * FROM sessions WHERE ${owner.sql} ORDER BY start_time DESC`,
      owner.params,
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
    `INSERT INTO sessions (id, title, start_time, end_time, transcript, summary, action_items, mode_id, sync_status, device_id, owner_user_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
      currentOwnerId(),
    ],
  ).catch((err) => log.error('Failed to persist new session', err))

  // Start duration timer
  durationTimer = setInterval(() => {
    // Timer ticks for UI duration display
  }, 1000)

  log.info(`Session started: ${session.id}`)
  return session
}

/**
 * Drop a session that never really started (audio/transcription failed before
 * any content). Clears the duration timer and the DB row so it doesn't linger
 * as a ghost "New Session".
 */
export async function discardSession(sessionId: string): Promise<void> {
  if (durationTimer) {
    clearInterval(durationTimer)
    durationTimer = null
  }
  const store = useSessionStore.getState()
  store.removeSession(sessionId)
  if (store.currentSession?.id === sessionId) store.setCurrentSession(null)
  try {
    await db.query('DELETE FROM transcript_entries WHERE session_id = ?', [sessionId])
    await db.query('DELETE FROM sessions WHERE id = ?', [sessionId])
    log.info(`Session discarded: ${sessionId}`)
  } catch (err) {
    log.error('Failed to discard session', err)
  }
}

/**
 * Close sessions left open by a crash / force-quit (mac closes them at launch).
 * Empty ones are deleted; the rest get an end time so they sync and display.
 */
export async function closeOrphanSessions(): Promise<{ closed: number; deleted: number }> {
  try {
    const orphans = await db.queryAll<{ id: string; start_time: string; transcript: string }>(
      'SELECT id, start_time, transcript FROM sessions WHERE end_time IS NULL',
    )
    let closed = 0
    let deleted = 0
    for (const row of orphans) {
      if (!row.transcript || row.transcript.trim().length === 0) {
        await db.query('DELETE FROM transcript_entries WHERE session_id = ?', [row.id])
        await db.query('DELETE FROM sessions WHERE id = ?', [row.id])
        deleted++
      } else {
        await db.query('UPDATE sessions SET end_time = ? WHERE id = ?', [row.start_time, row.id])
        closed++
      }
    }
    if (closed || deleted) log.info(`Orphan sessions: closed ${closed}, deleted ${deleted}`)
    return { closed, deleted }
  } catch (err) {
    log.error('Orphan session cleanup failed', err)
    return { closed: 0, deleted: 0 }
  }
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
export interface MeetingCostSnapshot {
  participants: number
  hourlyRate: number
  currency: string
}

export async function finalizeSession(
  sessionId: string,
  transcript: string,
  title: string | null,
  summary: string | null,
  meetingCost?: MeetingCostSnapshot | null,
  actionItems?: string[] | null,
): Promise<void> {
  const store = useSessionStore.getState()
  const endTime = new Date().toISOString()

  // Update Zustand store immediately
  const updates: Partial<Session> = { endTime, transcript }
  if (title) updates.title = title
  if (summary) updates.summary = summary
  if (actionItems) updates.actionItems = actionItems
  if (meetingCost) {
    updates.meetingParticipants = meetingCost.participants
    updates.meetingHourlyRate = meetingCost.hourlyRate
    updates.meetingCurrency = meetingCost.currency
  }
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
      'UPDATE sessions SET transcript = ?, title = COALESCE(?, title), summary = ?, end_time = ?, meeting_participants = ?, meeting_hourly_rate = ?, meeting_currency = ?, action_items = COALESCE(?, action_items) WHERE id = ?',
      [transcript, title, summary, endTime, meetingCost?.participants ?? null, meetingCost?.hourlyRate ?? null, meetingCost?.currency ?? null, actionItems ? JSON.stringify(actionItems) : null, sessionId],
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

/**
 * Persist a session imported from the server (other device / web). Writes the
 * SQLite row and the store; previously imports lived only in memory and
 * vanished on restart.
 */
export async function upsertImportedSession(session: Session): Promise<void> {
  const store = useSessionStore.getState()
  const exists = store.sessions.some((s) => s.id === session.id)
  if (exists) {
    store.updateSession(session.id, session)
  } else {
    store.addSession(session)
  }
  try {
    await db.query(
      `INSERT INTO sessions (id, title, start_time, end_time, transcript, summary, action_items, mode_id, sync_status, remote_id, device_id, version, checksum, owner_user_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         owner_user_id = COALESCE(sessions.owner_user_id, excluded.owner_user_id),
         title = excluded.title,
         end_time = excluded.end_time,
         transcript = excluded.transcript,
         summary = excluded.summary,
         action_items = excluded.action_items,
         mode_id = COALESCE(excluded.mode_id, sessions.mode_id),
         sync_status = excluded.sync_status,
         remote_id = COALESCE(excluded.remote_id, sessions.remote_id),
         version = excluded.version`,
      [
        session.id,
        session.title,
        session.startTime,
        session.endTime,
        session.transcript,
        session.summary,
        JSON.stringify(session.actionItems ?? []),
        session.modeId,
        session.syncStatus ?? 'synced',
        session.remoteId ?? null,
        session.deviceId ?? null,
        1,
        null,
        currentOwnerId(),
      ],
    )
  } catch (err) {
    log.error(`Failed to persist imported session ${session.id}`, err)
  }
}

/** Mark local sessions as synced (store + DB) after a successful upload. */
export async function markSessionsSynced(ids: string[]): Promise<void> {
  if (ids.length === 0) return
  const store = useSessionStore.getState()
  for (const id of ids) store.updateSession(id, { syncStatus: 'synced' })
  try {
    const placeholders = ids.map(() => '?').join(', ')
    await db.query(`UPDATE sessions SET sync_status = 'synced' WHERE id IN (${placeholders})`, ids)
  } catch (err) {
    log.error('Failed to mark sessions synced', err)
  }
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
      await db.query('DELETE FROM sessions WHERE id = ?', [id]).catch((e) =>
        log.warn(`Fallback delete failed for session ${id}`, e),
      )
    }
    await db.walCheckpoint().catch((e) => log.warn('WAL checkpoint failed after bulk delete', e))
  }

  // Remote deletes - parallel, fire-and-forget
  Promise.allSettled(ids.map((id) => deleteRemoteSession(id))).then((results) => {
    const failed = results.filter((r) => r.status === 'rejected').length
    if (failed > 0) log.error(`${failed}/${ids.length} remote deletes failed`)
  })
}
