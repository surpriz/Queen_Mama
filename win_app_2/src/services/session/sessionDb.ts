import { getDb } from '@/db/client'

export interface DbSession {
  id: string
  title: string
  summary: string | null
  startTime: string
  endTime: string | null
  duration: number
  isActive: number
  modeId: string | null
  modeName: string | null
  syncStatus: string
  remoteId: string | null
}

export interface DbTranscriptEntry {
  id: string
  sessionId: string
  text: string
  speaker: string
  timestamp: string
  isFinal: number
}

export interface DbAiResponse {
  id: string
  sessionId: string
  content: string
  responseType: string
  provider: string | null
  model: string | null
  timestamp: string
}

export interface DbMode {
  id: string
  name: string
  systemPrompt: string
  isBuiltIn: number
  icon: string
  sortOrder: number
  createdAt: string
  updatedAt: string
}

export const sessionDb = {
  // Sessions
  createSession(session: DbSession): void {
    const db = getDb()
    db.prepare(
      `INSERT INTO sessions (id, title, summary, startTime, endTime, duration, isActive, modeId, modeName, syncStatus, remoteId)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      session.id,
      session.title,
      session.summary,
      session.startTime,
      session.endTime,
      session.duration,
      session.isActive,
      session.modeId,
      session.modeName,
      session.syncStatus,
      session.remoteId,
    )
  },

  updateSession(id: string, updates: Partial<DbSession>): void {
    const db = getDb()
    const fields = Object.keys(updates)
      .map((k) => `${k} = ?`)
      .join(', ')
    const values = Object.values(updates)
    db.prepare(`UPDATE sessions SET ${fields} WHERE id = ?`).run(...values, id)
  },

  getSession(id: string): DbSession | undefined {
    const db = getDb()
    return db.prepare('SELECT * FROM sessions WHERE id = ?').get(id) as DbSession | undefined
  },

  getAllSessions(): DbSession[] {
    const db = getDb()
    return db.prepare('SELECT * FROM sessions ORDER BY startTime DESC').all() as DbSession[]
  },

  getRecentSessions(limit: number): DbSession[] {
    const db = getDb()
    return db
      .prepare('SELECT * FROM sessions ORDER BY startTime DESC LIMIT ?')
      .all(limit) as DbSession[]
  },

  searchSessions(query: string): DbSession[] {
    const db = getDb()
    const pattern = `%${query}%`
    return db
      .prepare(
        'SELECT * FROM sessions WHERE title LIKE ? OR summary LIKE ? ORDER BY startTime DESC',
      )
      .all(pattern, pattern) as DbSession[]
  },

  deleteSession(id: string): void {
    const db = getDb()
    db.prepare('DELETE FROM transcript_entries WHERE sessionId = ?').run(id)
    db.prepare('DELETE FROM ai_responses WHERE sessionId = ?').run(id)
    db.prepare('DELETE FROM sessions WHERE id = ?').run(id)
  },

  // Transcript entries
  addTranscriptEntry(entry: DbTranscriptEntry): void {
    const db = getDb()
    db.prepare(
      `INSERT INTO transcript_entries (id, sessionId, text, speaker, timestamp, isFinal)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(entry.id, entry.sessionId, entry.text, entry.speaker, entry.timestamp, entry.isFinal)
  },

  getTranscriptEntries(sessionId: string): DbTranscriptEntry[] {
    const db = getDb()
    return db
      .prepare('SELECT * FROM transcript_entries WHERE sessionId = ? ORDER BY timestamp ASC')
      .all(sessionId) as DbTranscriptEntry[]
  },

  updateTranscriptEntry(id: string, text: string, isFinal: number): void {
    const db = getDb()
    db.prepare('UPDATE transcript_entries SET text = ?, isFinal = ? WHERE id = ?').run(
      text,
      isFinal,
      id,
    )
  },

  // AI responses
  addAiResponse(response: DbAiResponse): void {
    const db = getDb()
    db.prepare(
      `INSERT INTO ai_responses (id, sessionId, content, responseType, provider, model, timestamp)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      response.id,
      response.sessionId,
      response.content,
      response.responseType,
      response.provider,
      response.model,
      response.timestamp,
    )
  },

  getAiResponses(sessionId: string): DbAiResponse[] {
    const db = getDb()
    return db
      .prepare('SELECT * FROM ai_responses WHERE sessionId = ? ORDER BY timestamp ASC')
      .all(sessionId) as DbAiResponse[]
  },

  // Modes
  createMode(mode: DbMode): void {
    const db = getDb()
    db.prepare(
      `INSERT INTO modes (id, name, systemPrompt, isBuiltIn, icon, sortOrder, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      mode.id,
      mode.name,
      mode.systemPrompt,
      mode.isBuiltIn,
      mode.icon,
      mode.sortOrder,
      mode.createdAt,
      mode.updatedAt,
    )
  },

  updateMode(id: string, updates: Partial<DbMode>): void {
    const db = getDb()
    const fields = Object.keys(updates)
      .map((k) => `${k} = ?`)
      .join(', ')
    const values = Object.values(updates)
    db.prepare(`UPDATE modes SET ${fields} WHERE id = ?`).run(...values, id)
  },

  getAllModes(): DbMode[] {
    const db = getDb()
    return db.prepare('SELECT * FROM modes ORDER BY sortOrder ASC').all() as DbMode[]
  },

  deleteMode(id: string): void {
    const db = getDb()
    db.prepare('DELETE FROM modes WHERE id = ? AND isBuiltIn = 0').run(id)
  },
}
