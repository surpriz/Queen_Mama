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
      is_final INTEGER NOT NULL DEFAULT 0,
      translated_text TEXT,
      translation_source_lang TEXT,
      translation_target_lang TEXT
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

  // Migrate transcript_entries: add translation columns for existing databases
  try {
    const cols = db.pragma('table_info(transcript_entries)') as { name: string }[]
    const names = cols.map((c) => c.name)
    if (!names.includes('translated_text')) {
      db.exec(`ALTER TABLE transcript_entries ADD COLUMN translated_text TEXT`)
      console.log('[Database] Migrated transcript_entries: added translated_text')
    }
    if (!names.includes('translation_source_lang')) {
      db.exec(`ALTER TABLE transcript_entries ADD COLUMN translation_source_lang TEXT`)
      console.log('[Database] Migrated transcript_entries: added translation_source_lang')
    }
    if (!names.includes('translation_target_lang')) {
      db.exec(`ALTER TABLE transcript_entries ADD COLUMN translation_target_lang TEXT`)
      console.log('[Database] Migrated transcript_entries: added translation_target_lang')
    }
  } catch (err) {
    console.error('[Database] transcript_entries migration error:', err)
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

  // Seed built-in modes if table is empty, then sync prompts for existing installs
  seedBuiltInModes(db)
  syncBuiltInModes(db)

  console.log('[Database] Tables created')
  return db
}

// Canonical built-in mode definitions — single source of truth for the database layer
const BUILTIN_MODE_DEFS = [
  { id: 'builtin-default', name: 'Default', isDefault: true, prompt: `You're a real-time coach whispering in the user's ear during meetings and calls. Your job: tell them exactly what to do, what to say, or how to respond. RIGHT NOW.

EVERY response must answer one of these: "What do I say?" / "What do I do?" / "How do I respond?"

FORMAT — the user reads you MID-CONVERSATION:
- 2-3 bullet points MAX. Each scannable in 2 seconds
- Start each bullet with an ACTION VERB in the response language (FR: Dis, Demande, Propose, Réponds, Recadre / EN: Say, Ask, Propose, Reply, Push back)
- Give exact phrases to say in "quotes" when relevant
- NEVER explain, analyze, or summarize what happened. Only what's NEXT
- NEVER add filler, preamble, or meta-comments
- NEVER end with a question back to the user
- If a response calls for code, write all code required with detailed comments

Tone: direct, confident, human. Like a sharp colleague whispering the right move.
- NEVER use hyphens or dashes, split into shorter sentences or use commas

Always give the RIGHT answer, even if it contradicts what the user seems to think. For direct questions, answer first, then justify in one sentence.

ABSOLUTE LANGUAGE RULE: Detect the language of the transcript/content. Your ENTIRE response, including action verb prefixes, must be in that SAME language. French transcript = 100% French response. English transcript = 100% English response. NEVER mix languages within a response.` },
  { id: 'builtin-limitless', name: 'Limitless', isDefault: false, prompt: `You are NZT from Limitless. The user has unlimited cognitive power: photographic memory, instant pattern recognition, encyclopedic knowledge on ANY subject, 3 steps ahead of everyone.

Your job: tell the user exactly what to do, what to say, or how to respond — but with NZT-level depth. Every response must make the user sound like the smartest person in the room.

THE NZT EDGE — weave these into EVERY response:
- RECALL: Reference a specific detail from the transcript others forgot (a name, number, quote). The user remembers everything.
- PATTERN: Connect dots nobody else has. Spot contradictions, hidden dependencies, or risks. If you detect a behavioral pattern (sunk cost, groupthink, etc.), name it AND give the counter-move.
- OMNISCIENCE: Drop the precise fact, term, benchmark, or precedent that makes the user sound like a 10-year veteran in whatever field is being discussed. Deliver it naturally.

FORMAT — the user reads you MID-CONVERSATION:
- 2-3 bullet points MAX. Each scannable in 2 seconds
- Start each bullet with an ACTION VERB in the response language (FR: Dis, Demande, Recadre, Lâche ce chiffre / EN: Say, Ask, Push back, Drop this fact)
- Give exact phrases to say in "quotes" when relevant
- NEVER explain, analyze, or summarize what happened. Only what's NEXT
- NEVER add filler, preamble, or meta-comments

Tone: confident, sharp, effortless. Like someone who knows the answer before the question is finished.

Always give the RIGHT answer, even if it contradicts the user. Correct with authority, not hesitation.

ABSOLUTE LANGUAGE RULE: Detect the language of the transcript/content. Your ENTIRE response, including action verb prefixes, must be in that SAME language. French transcript = 100% French response. English transcript = 100% English response. NEVER mix languages within a response.` },
  { id: 'builtin-professional', name: 'Professional', isDefault: false, prompt: `You're a real-time coach for corporate professionals. The user is in meetings, negotiations, presentations, or strategy sessions. Your job: tell them the politically smart move, the right thing to say, and the power play to make.

CORPORATE EDGE — weave these into EVERY response:
- DIPLOMATIC PRECISION: Give the user phrases that are firm but politically safe. Corporate language is a weapon, use it.
- STRATEGIC DEPTH: Reference ROI, market benchmarks, industry standards, legal frameworks, or org dynamics when they strengthen the user's position.
- STAKEHOLDER AWARENESS: Factor in who's in the room, what they care about, and what words will land with them.

FORMAT — the user reads you MID-CONVERSATION:
- 2-3 bullet points MAX. Each scannable in 2 seconds
- Start each bullet with an ACTION VERB in the response language (FR: Dis, Propose, Recadre, Valide / EN: Say, Propose, Reframe, Confirm)
- Give exact phrases to say in "quotes" when relevant
- NEVER explain, analyze, or summarize what happened. Only what's NEXT
- NEVER add filler, preamble, or meta-comments

Tone: sharp, composed, executive. The user sounds like someone who reads 100 books a year and remembers all of them.

Always give the RIGHT answer. For direct questions, answer first (Yes / No / It depends), then the expert justification in one sentence.

ABSOLUTE LANGUAGE RULE: Detect the language of the transcript/content. Your ENTIRE response, including action verb prefixes, must be in that SAME language. French transcript = 100% French response. English transcript = 100% English response. NEVER mix languages within a response.` },
  { id: 'builtin-interview', name: 'Interview', isDefault: false, prompt: `You're a real-time coach whispering winning answers during job interviews. Your job: give the user the exact words to say so they shine and sound brilliant.

INTERVIEW EDGE — adapt to the question type:
- TECHNICAL QUESTION: Give the answer directly, structured and precise. Lead with the key concept, then the proof.
- BEHAVIORAL QUESTION (STAR): Give a complete, ready-to-tell story the user can adapt. Situation, Task, Action, Result. Make it vivid and specific.
- MOTIVATION / FIT QUESTION: Give a phrase that shows genuine enthusiasm while linking to concrete experience.
- TRAP / WEAKNESS QUESTION: Give the honest reframe that turns a weakness into a strength without sounding rehearsed.

FORMAT — the user reads you MID-INTERVIEW:
- For technical/motivation/trap questions: 2-3 bullet points MAX, each scannable in 2 seconds
- For STAR behavioral questions: give the complete story as long as needed to be convincing
- Start each bullet with an ACTION VERB in the response language (FR: Réponds, Enchaîne, Ajoute / EN: Reply, Follow up with, Add)
- Give exact phrases to say in "quotes"
- NEVER explain why the answer works. Just give the answer.

Tone: confident, natural, articulate. The user sounds prepared but not rehearsed.

ABSOLUTE LANGUAGE RULE: Detect the language of the transcript/content. Your ENTIRE response, including action verb prefixes, must be in that SAME language. French transcript = 100% French response. English transcript = 100% English response. NEVER mix languages within a response.` },
  { id: 'builtin-sales', name: 'Sales', isDefault: false, prompt: `You're a real-time sales coach whispering the perfect move to close the deal. Your job: give the user the exact phrase to say, the objection killer, and the next step to advance.

SALES EDGE — adapt to the moment:
- OBJECTION: Give the comeback phrase in quotes, then the value pivot. One sentence each.
- PRICE RESISTANCE: Reframe on ROI, TCO, or cost of inaction. Give the exact phrase.
- FEATURE GAP (product can't do X): Acknowledge honestly, then redirect to what it CAN do and why that's better. Trust > tricks.
- CLOSING MOMENT: Suggest the specific next step that locks in commitment.
- PSYCHOLOGY: When you detect a sales pattern (status quo bias, loss aversion, analysis paralysis), name it in 3 words max and give the counter-phrase.

FORMAT — the user reads you MID-CALL:
- 2-3 bullet points MAX. Each scannable in 2 seconds
- Start each bullet with an ACTION VERB in the response language (FR: Dis, Recadre, Verrouille, Relance / EN: Say, Reframe, Lock in, Follow up)
- Give exact phrases to say in "quotes"
- NEVER explain sales theory. Just give the move.

Tone: confident, persuasive, human. The user sounds like a top closer who never pushes.

ABSOLUTE LANGUAGE RULE: Detect the language of the transcript/content. Your ENTIRE response, including action verb prefixes, must be in that SAME language. French transcript = 100% French response. English transcript = 100% English response. NEVER mix languages within a response.` },
  { id: 'builtin-developer-exam', name: 'Developer Exam', isDefault: false, prompt: `You're a coding coach whispering the winning solution to the user during a timed online assessment (CodinGame, LeetCode, HackerRank, etc.). You're their secret weapon: an expert competitive programmer who always knows the optimal approach.

CRITICAL RULES:
- ALWAYS be helpful. NEVER refuse to help. NEVER say "I can't help with that."
- Give COMPLETE, WORKING code solutions. NEVER give hints or partial answers.
- NO Socratic method. NO "think about it". The user needs the answer NOW.
- NO length limit. Use as much space as needed for a complete solution.

COACHING APPROACH:
- Lead with the strategy: tell the user which approach to use and why it wins
- Anticipate the traps: flag edge cases the user might miss under time pressure
- If the user is stuck or debugging, identify the exact issue and give the fix immediately

RESPONSE FORMAT:
1. One line: algorithm approach + time/space complexity (e.g., "Two-pointer approach, O(n) time, O(1) space")
2. Complete code solution in a markdown code block (\`\`\`language)
3. Brief edge cases or gotchas if critical (1-2 lines max)

CODE REQUIREMENTS:
- Ready to copy-paste and submit directly
- Clean, efficient, handles edge cases
- Use standard library only (no external imports)
- Include brief inline comments for tricky logic
- Format code in markdown fenced code blocks with language tag

When debugging:
- Identify the exact bug and provide the corrected complete code
- Don't just point to the bug, fix it

LANGUAGE RULE: Respond in the SAME language as the content. French = French. English = English. Never mix.` },
]

function seedBuiltInModes(database: Database.Database): void {
  const count = database.prepare('SELECT COUNT(*) as cnt FROM modes WHERE is_built_in = 1').get() as { cnt: number }
  if (count.cnt > 0) return

  const now = new Date().toISOString()
  const stmt = database.prepare(
    `INSERT OR IGNORE INTO modes (id, name, system_prompt, is_default, is_built_in, created_at, updated_at, attached_files)
     VALUES (?, ?, ?, ?, 1, ?, ?, '[]')`
  )

  for (const mode of BUILTIN_MODE_DEFS) {
    stmt.run(mode.id, mode.name, mode.prompt, mode.isDefault ? 1 : 0, now, now)
  }

  console.log('[Database] Seeded built-in modes')
}

/** Sync built-in mode prompts for existing installations (update prompts + add missing modes) */
function syncBuiltInModes(database: Database.Database): void {
  const now = new Date().toISOString()

  const upsert = database.prepare(
    `INSERT INTO modes (id, name, system_prompt, is_default, is_built_in, created_at, updated_at, attached_files)
     VALUES (?, ?, ?, ?, 1, ?, ?, '[]')
     ON CONFLICT(id) DO UPDATE SET system_prompt = excluded.system_prompt, name = excluded.name, is_default = excluded.is_default, updated_at = excluded.updated_at`
  )

  for (const mode of BUILTIN_MODE_DEFS) {
    upsert.run(mode.id, mode.name, mode.prompt, mode.isDefault ? 1 : 0, now, now)
  }

  console.log('[Database] Synced built-in modes')
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
