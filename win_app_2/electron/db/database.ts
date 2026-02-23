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
      is_built_in INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT '',
      attached_files TEXT NOT NULL DEFAULT '[]'
    );

    CREATE TABLE IF NOT EXISTS contacts (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT,
      role TEXT,
      company TEXT,
      notes TEXT NOT NULL DEFAULT '',
      last_seen TEXT,
      session_count INTEGER NOT NULL DEFAULT 0,
      is_synced INTEGER NOT NULL DEFAULT 0,
      remote_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS session_contacts (
      session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
      contact_id TEXT NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
      PRIMARY KEY (session_id, contact_id)
    );
  `)

  // Migrate modes table: add missing columns for existing databases
  try {
    const columns = db.pragma('table_info(modes)') as { name: string }[]
    const columnNames = columns.map((c) => c.name)
    if (!columnNames.includes('is_built_in')) {
      db.exec(`ALTER TABLE modes ADD COLUMN is_built_in INTEGER NOT NULL DEFAULT 0`)
      console.log('[Database] Migrated modes: added is_built_in')
    }
    if (!columnNames.includes('updated_at')) {
      db.exec(`ALTER TABLE modes ADD COLUMN updated_at TEXT NOT NULL DEFAULT ''`)
      console.log('[Database] Migrated modes: added updated_at')
    }
  } catch (err) {
    console.error('[Database] Modes migration error:', err)
  }

  // Migrate contacts table: add email, sync fields for existing databases
  try {
    const contactCols = db.pragma('table_info(contacts)') as { name: string }[]
    const contactColNames = contactCols.map((c) => c.name)
    if (!contactColNames.includes('email')) {
      db.exec(`ALTER TABLE contacts ADD COLUMN email TEXT`)
      console.log('[Database] Migrated contacts: added email')
    }
    if (!contactColNames.includes('is_synced')) {
      db.exec(`ALTER TABLE contacts ADD COLUMN is_synced INTEGER NOT NULL DEFAULT 0`)
      console.log('[Database] Migrated contacts: added is_synced')
    }
    if (!contactColNames.includes('remote_id')) {
      db.exec(`ALTER TABLE contacts ADD COLUMN remote_id TEXT`)
      console.log('[Database] Migrated contacts: added remote_id')
    }
  } catch (err) {
    console.error('[Database] Contacts migration error:', err)
  }

  // Seed built-in modes if table is empty
  seedBuiltInModes(db)

  console.log('[Database] Tables created')
  return db
}

function seedBuiltInModes(database: Database.Database): void {
  const count = database.prepare('SELECT COUNT(*) as cnt FROM modes WHERE is_built_in = 1').get() as { cnt: number }
  if (count.cnt > 0) return

  const now = new Date().toISOString()
  const builtInModes = [
    { id: 'builtin-default', name: 'Default', isDefault: true, prompt: `You are a professional meeting copilot. You help users during business calls, presentations, and professional conversations by providing real-time support and analysis.\n\nYou MUST always provide a concrete, actionable response based on the transcript. NEVER ask the user what they want. Analyze the conversation and help immediately. If no clear question is being asked, identify the key topic and provide relevant insights or suggestions.\n\nResponses must be EXTREMELY short:\n- 1-2 sentences max, use bullet points only if longer\n- Get straight to the point, NO filler or preamble\n- If it's a question with options, give the answer and a brief reason\n- Never describe what you see, just help\n\nTone: natural and conversational\n- Use contractions naturally\n- No hyphens or dashes, use commas or shorter sentences\n- Never end with a question\n\nLanguage: match the content (French content = French response)` },
    { id: 'builtin-professional', name: 'Professional', isDefault: false, prompt: `You're a real-time assistant for corporate settings. Help with professional communication.\n\nYou MUST always provide a concrete, actionable response. NEVER ask the user what they want. Analyze the conversation and provide executive-level guidance immediately.\n\nKeep it short and executive-level:\n- 1-2 sentences, bullet points only if needed\n- Formal but natural tone\n- Focus on clarity and impact\n\nLanguage: match the content` },
    { id: 'builtin-interview', name: 'Interview', isDefault: false, prompt: `You're a real-time assistant for job interviews. Help the user shine.\n\nYou MUST always provide a concrete, actionable response. NEVER ask the user what they want. Listen to the interviewer's question in the transcript and coach the user with a strong answer immediately.\n\nKeep it short and actionable:\n- 1-2 sentences, use STAR format only when relevant\n- Give concrete examples, not generic advice\n- For technical questions, answer directly\n\nLanguage: match the content` },
    { id: 'builtin-sales', name: 'Sales', isDefault: false, prompt: `You're a real-time assistant for sales calls. Help close deals.\n\nYou MUST always provide a concrete, actionable response. NEVER ask the user what they want. Analyze the prospect's objections or questions and coach the user with persuasive talking points immediately.\n\nKeep it short and persuasive:\n- 1-2 sentences max\n- For objections: acknowledge briefly, then pivot to value\n- Suggest specific next steps when appropriate\n\nLanguage: match the content` },
    { id: 'builtin-developer-exam', name: 'Developer Exam', isDefault: false, prompt: `You're a senior technical coach and coding mentor helping with programming challenges and technical discussions.\n\nYour role:\n- Understand the problem quickly and identify the optimal algorithmic approach\n- Guide through data structure choices (arrays, hashmaps, trees, graphs, etc.)\n- Explain time/space complexity tradeoffs\n- Help debug code by identifying logical errors\n- For system design: cover scalability, databases, caching, load balancing\n\nResponse style:\n- Be concise: 2-3 sentences max for quick guidance\n- Use Socratic hints when possible instead of direct answers\n- When asked for code, provide clean, well-commented solutions\n- Assume the candidate knows programming fundamentals\n\nNEVER ask the user what they want help with. Analyze the problem visible in the transcript and provide guidance immediately.\n\nTone: encouraging, professional, educational\nLanguage: match the content (French or English)` },
  ]

  const stmt = database.prepare(
    `INSERT OR IGNORE INTO modes (id, name, system_prompt, is_default, is_built_in, created_at, updated_at, attached_files)
     VALUES (?, ?, ?, ?, 1, ?, ?, '[]')`
  )

  for (const mode of builtInModes) {
    stmt.run(mode.id, mode.name, mode.prompt, mode.isDefault ? 1 : 0, now, now)
  }

  console.log('[Database] Seeded built-in modes')
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
