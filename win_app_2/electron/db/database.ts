import Database from 'better-sqlite3'
import { app } from 'electron'
import * as path from 'path'

let db: Database.Database | null = null

export function initializeDatabase(): Database.Database {
  if (db) return db

  const userDataPath = app.getPath('userData')
  const dbPath = path.join(userDataPath, 'queenmama.db')

  console.log('[Database] Initializing at:', dbPath)

  db = new Database(dbPath)

  // Enable WAL mode for better concurrent access
  db.pragma('journal_mode = WAL')
  // Enable foreign keys so ON DELETE CASCADE works
  db.pragma('foreign_keys = ON')

  // Create tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL DEFAULT 'New Session',
      start_time TEXT NOT NULL,
      end_time TEXT,
      transcript TEXT NOT NULL DEFAULT '',
      summary TEXT,
      action_items TEXT NOT NULL DEFAULT '[]',
      mode_id TEXT,
      sync_status TEXT NOT NULL DEFAULT 'local',
      remote_id TEXT,
      device_id TEXT,
      version INTEGER NOT NULL DEFAULT 1,
      checksum TEXT
    );

    CREATE TABLE IF NOT EXISTS transcript_entries (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
      timestamp TEXT NOT NULL,
      speaker TEXT NOT NULL DEFAULT 'Unknown',
      text TEXT NOT NULL DEFAULT '',
      is_final INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS ai_responses (
      id TEXT PRIMARY KEY,
      session_id TEXT REFERENCES sessions(id) ON DELETE SET NULL,
      type TEXT NOT NULL DEFAULT 'Assist',
      content TEXT NOT NULL DEFAULT '',
      timestamp TEXT NOT NULL,
      provider TEXT NOT NULL DEFAULT 'OpenAI',
      latency_ms INTEGER,
      is_automatic INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS modes (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      system_prompt TEXT NOT NULL,
      is_default INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      attached_files TEXT NOT NULL DEFAULT '[]'
    );

    CREATE TABLE IF NOT EXISTS contacts (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      role TEXT,
      company TEXT,
      notes TEXT NOT NULL DEFAULT '',
      last_seen TEXT,
      session_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS session_contacts (
      session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
      contact_id TEXT NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
      PRIMARY KEY (session_id, contact_id)
    );
  `)

  console.log('[Database] Tables created')
  return db
}

export function getDatabase(): Database.Database {
  if (!db) {
    throw new Error('Database not initialized. Call initializeDatabase() first.')
  }
  return db
}

export function walCheckpoint(): void {
  if (db) {
    try {
      db.pragma('wal_checkpoint(TRUNCATE)')
      console.log('[Database] WAL checkpoint completed')
    } catch (err) {
      console.error('[Database] WAL checkpoint failed:', err)
    }
  }
}

export function closeDatabase(): void {
  if (db) {
    walCheckpoint()
    db.close()
    db = null
    console.log('[Database] Closed')
  }
}

// Query execution helpers
export interface QueryResult {
  rows: unknown[]
  changes?: number
  lastInsertRowid?: number | bigint
}

export function executeQuery(sql: string, params: unknown[] = []): QueryResult {
  const database = getDatabase()
  const stmt = database.prepare(sql)

  // Determine if this is a SELECT query
  const isSelect = sql.trim().toUpperCase().startsWith('SELECT')

  if (isSelect) {
    const rows = stmt.all(...params)
    return { rows }
  } else {
    const result = stmt.run(...params)
    return {
      rows: [],
      changes: result.changes,
      lastInsertRowid: result.lastInsertRowid,
    }
  }
}

export function executeQueryGet(sql: string, params: unknown[] = []): unknown | undefined {
  const database = getDatabase()
  const stmt = database.prepare(sql)
  return stmt.get(...params)
}

export function executeQueryAll(sql: string, params: unknown[] = []): unknown[] {
  const database = getDatabase()
  const stmt = database.prepare(sql)
  return stmt.all(...params)
}
