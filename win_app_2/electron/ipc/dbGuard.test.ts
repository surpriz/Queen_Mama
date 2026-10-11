import { describe, it, expect } from 'vitest'
import { assertSafeSql, assertSafeTable, assertSafeWhere, assertSafeIdentifier } from './dbGuard'

describe('dbGuard', () => {
  it('accepts the statements the app actually runs', () => {
    expect(() => assertSafeSql('SELECT * FROM sessions WHERE owner_user_id = ? ORDER BY start_time DESC')).not.toThrow()
    expect(() => assertSafeSql(`SELECT r.id FROM ai_responses r JOIN sessions s ON s.id = r.session_id WHERE s.owner_user_id = ? ORDER BY r.timestamp DESC LIMIT ?`)).not.toThrow()
    expect(() => assertSafeSql('INSERT INTO sessions (id, title) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET title = excluded.title')).not.toThrow()
    expect(() => assertSafeSql('UPDATE sessions SET end_time = ? WHERE id = ?;')).not.toThrow()
    expect(() => assertSafeSql('DELETE FROM transcript_entries WHERE session_id = ?')).not.toThrow()
  })

  it('rejects statement chaining, DDL and pragmas', () => {
    expect(() => assertSafeSql('SELECT 1; DROP TABLE sessions')).toThrow(/multiple statements/)
    expect(() => assertSafeSql('PRAGMA user_version = 0')).toThrow()
    expect(() => assertSafeSql('ATTACH DATABASE ? AS x')).toThrow()
    expect(() => assertSafeSql('DROP TABLE sessions')).toThrow()
    expect(() => assertSafeSql("SELECT load_extension('x')")).toThrow(/forbidden/)
  })

  it('rejects unknown tables and identifiers', () => {
    expect(() => assertSafeSql('SELECT * FROM sqlite_master')).toThrow()
    expect(() => assertSafeSql('SELECT * FROM users')).toThrow(/unknown table users/)
    expect(() => assertSafeTable('users')).toThrow()
    expect(() => assertSafeTable('contacts')).not.toThrow()
    expect(() => assertSafeIdentifier('owner_user_id')).not.toThrow()
    expect(() => assertSafeIdentifier('id; DROP')).toThrow()
  })

  it('keeps where clauses simple', () => {
    expect(() => assertSafeWhere('id = ?')).not.toThrow()
    expect(() => assertSafeWhere('id IN (SELECT id FROM sessions)')).toThrow()
    expect(() => assertSafeWhere('id = ?; DELETE FROM sessions')).toThrow()
  })
})
