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
  async createSession(session: DbSession): Promise<void> {
    const db = getDb()
    await db.query(
      `INSERT INTO sessions (id, title, summary, startTime, endTime, duration, isActive, modeId, modeName, syncStatus, remoteId)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
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
      ],
    )
  },

  async updateSession(id: string, updates: Partial<DbSession>): Promise<void> {
    const db = getDb()
    const fields = Object.keys(updates)
      .map((k) => `${k} = ?`)
      .join(', ')
    const values = Object.values(updates)
    await db.query(`UPDATE sessions SET ${fields} WHERE id = ?`, [...values, id])
  },

  async getSession(id: string): Promise<DbSession | undefined> {
    const db = getDb()
    return db.queryGet<DbSession>('SELECT * FROM sessions WHERE id = ?', [id])
  },

  async getAllSessions(): Promise<DbSession[]> {
    const db = getDb()
    return db.queryAll<DbSession>('SELECT * FROM sessions ORDER BY startTime DESC')
  },

  async getRecentSessions(limit: number): Promise<DbSession[]> {
    const db = getDb()
    return db.queryAll<DbSession>(
      'SELECT * FROM sessions ORDER BY startTime DESC LIMIT ?',
      [limit],
    )
  },

  async searchSessions(query: string): Promise<DbSession[]> {
    const db = getDb()
    const pattern = `%${query}%`
    return db.queryAll<DbSession>(
      'SELECT * FROM sessions WHERE title LIKE ? OR summary LIKE ? ORDER BY startTime DESC',
      [pattern, pattern],
    )
  },

  async deleteSession(id: string): Promise<void> {
    const db = getDb()
    await db.query('DELETE FROM transcript_entries WHERE sessionId = ?', [id])
    await db.query('DELETE FROM ai_responses WHERE sessionId = ?', [id])
    await db.query('DELETE FROM sessions WHERE id = ?', [id])
  },

  // Transcript entries
  async addTranscriptEntry(entry: DbTranscriptEntry): Promise<void> {
    const db = getDb()
    await db.query(
      `INSERT INTO transcript_entries (id, sessionId, text, speaker, timestamp, isFinal)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [entry.id, entry.sessionId, entry.text, entry.speaker, entry.timestamp, entry.isFinal],
    )
  },

  async getTranscriptEntries(sessionId: string): Promise<DbTranscriptEntry[]> {
    const db = getDb()
    return db.queryAll<DbTranscriptEntry>(
      'SELECT * FROM transcript_entries WHERE sessionId = ? ORDER BY timestamp ASC',
      [sessionId],
    )
  },

  async updateTranscriptEntry(id: string, text: string, isFinal: number): Promise<void> {
    const db = getDb()
    await db.query(
      'UPDATE transcript_entries SET text = ?, isFinal = ? WHERE id = ?',
      [text, isFinal, id],
    )
  },

  // AI responses
  async addAiResponse(response: DbAiResponse): Promise<void> {
    const db = getDb()
    await db.query(
      `INSERT INTO ai_responses (id, sessionId, content, responseType, provider, model, timestamp)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        response.id,
        response.sessionId,
        response.content,
        response.responseType,
        response.provider,
        response.model,
        response.timestamp,
      ],
    )
  },

  async getAiResponses(sessionId: string): Promise<DbAiResponse[]> {
    const db = getDb()
    return db.queryAll<DbAiResponse>(
      'SELECT * FROM ai_responses WHERE sessionId = ? ORDER BY timestamp ASC',
      [sessionId],
    )
  },

  // Modes
  async createMode(mode: DbMode): Promise<void> {
    const db = getDb()
    await db.query(
      `INSERT INTO modes (id, name, systemPrompt, isBuiltIn, icon, sortOrder, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        mode.id,
        mode.name,
        mode.systemPrompt,
        mode.isBuiltIn,
        mode.icon,
        mode.sortOrder,
        mode.createdAt,
        mode.updatedAt,
      ],
    )
  },

  async updateMode(id: string, updates: Partial<DbMode>): Promise<void> {
    const db = getDb()
    const fields = Object.keys(updates)
      .map((k) => `${k} = ?`)
      .join(', ')
    const values = Object.values(updates)
    await db.query(`UPDATE modes SET ${fields} WHERE id = ?`, [...values, id])
  },

  async getAllModes(): Promise<DbMode[]> {
    const db = getDb()
    return db.queryAll<DbMode>('SELECT * FROM modes ORDER BY sortOrder ASC')
  },

  async deleteMode(id: string): Promise<void> {
    const db = getDb()
    await db.query('DELETE FROM modes WHERE id = ? AND isBuiltIn = 0', [id])
  },
}
