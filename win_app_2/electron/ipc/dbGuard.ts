/**
 * Guard rails for the renderer → main SQL bridge.
 *
 * The renderer runs third-party markdown/KaTeX/mermaid output; if any of that
 * ever escaped sanitization it would get raw SQL access through the `db:*`
 * channels. These checks keep that bridge to plain DML on the app's own
 * tables: one statement, known table, no PRAGMA/ATTACH/DDL.
 */

export const ALLOWED_TABLES = new Set([
  'sessions',
  'transcript_entries',
  'ai_responses',
  'modes',
  'contacts',
  'contact_notes',
  'session_contacts',
])

const FORBIDDEN = /\b(pragma|attach|detach|vacuum|create|drop|alter|replace\s+into|load_extension|sqlite_master)\b/i
const STATEMENT_START = /^\s*(select|insert|update|delete|with)\b/i

export function assertSafeTable(table: unknown): asserts table is string {
  if (typeof table !== 'string' || !ALLOWED_TABLES.has(table)) {
    throw new Error(`DB access denied: unknown table ${String(table)}`)
  }
}

export function assertSafeIdentifier(name: unknown): asserts name is string {
  if (typeof name !== 'string' || !/^[a-z_][a-z0-9_]*$/.test(name)) {
    throw new Error(`DB access denied: invalid identifier ${String(name)}`)
  }
}

/** Raw SQL from the renderer: single DML statement touching only known tables. */
export function assertSafeSql(sql: unknown): asserts sql is string {
  if (typeof sql !== 'string' || sql.length > 20_000) {
    throw new Error('DB access denied: invalid statement')
  }
  const trimmed = sql.trim().replace(/;\s*$/, '')
  if (trimmed.includes(';')) {
    throw new Error('DB access denied: multiple statements')
  }
  if (!STATEMENT_START.test(trimmed)) {
    throw new Error('DB access denied: statement must be SELECT/INSERT/UPDATE/DELETE')
  }
  if (FORBIDDEN.test(trimmed)) {
    throw new Error('DB access denied: forbidden keyword')
  }
  // Every table mentioned after FROM / INTO / UPDATE / JOIN must be ours
  // "DO UPDATE SET" in upserts is not a table reference
  const tables = [...trimmed.matchAll(/\b(?:from|into|update|join)\s+([a-z_][a-z0-9_]*)/gi)]
    .map((m) => m[1].toLowerCase())
    .filter((name) => name !== 'set')
  for (const table of tables) {
    if (!ALLOWED_TABLES.has(table)) {
      throw new Error(`DB access denied: unknown table ${table}`)
    }
  }
}

/** WHERE fragments built by the renderer (`db.update/delete`): no subqueries or statement breaks. */
export function assertSafeWhere(where: unknown): asserts where is string {
  if (typeof where !== 'string' || where.length > 2000 || where.includes(';') || FORBIDDEN.test(where) || /\bselect\b/i.test(where)) {
    throw new Error('DB access denied: invalid where clause')
  }
}
