import { drizzle } from 'drizzle-orm/better-sqlite3'
import Database from 'better-sqlite3'
import * as schema from './schema'
import path from 'path'

let db: ReturnType<typeof drizzle> | null = null
let sqliteDb: Database.Database | null = null

export function getDatabase() {
  if (db) return db

  // In renderer process, we get the path from electron
  const userDataPath =
    typeof window !== 'undefined'
      ? '' // Will be initialized via IPC
      : process.env.QUEEN_MAMA_DB_PATH || './queenmama.db'

  const dbPath = path.join(userDataPath, 'queenmama.db')
  sqliteDb = new Database(dbPath)

  // Enable WAL mode for better concurrent access
  sqliteDb.pragma('journal_mode = WAL')

  db = drizzle(sqliteDb, { schema })
  return db
}

export function initializeDatabase(userDataPath: string) {
  const dbPath = path.join(userDataPath, 'queenmama.db')
  sqliteDb = new Database(dbPath)
  sqliteDb.pragma('journal_mode = WAL')
  db = drizzle(sqliteDb, { schema })

  // Run migrations / create tables
  sqliteDb.exec(`
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
  `)

  return db
}

export function closeDatabase() {
  sqliteDb?.close()
  sqliteDb = null
  db = null
}

export { schema }
