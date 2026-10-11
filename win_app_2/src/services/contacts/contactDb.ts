import { db } from '@/db/client'
import type { Contact, ContactNote, Session } from '@/types/models'
import { fullName, splitName } from './contactModel'

interface ContactRow {
  id: string
  name: string
  first_name: string | null
  last_name: string | null
  email: string | null
  role: string | null
  company: string | null
  notes: string
  last_seen: string | null
  session_count: number
  is_synced: number
  remote_id: string | null
  created_at: string
  updated_at: string
}

interface NoteRow {
  id: string
  contact_id: string
  text: string
  created_at: string
  remote_id: string | null
}

function rowToContact(row: ContactRow): Contact {
  const split = row.first_name ? { firstName: row.first_name, lastName: row.last_name ?? undefined } : splitName(row.name)
  return {
    id: row.id,
    firstName: split.firstName,
    lastName: split.lastName,
    name: row.name || fullName(split),
    email: row.email ?? undefined,
    role: row.role ?? undefined,
    company: row.company ?? undefined,
    notes: row.notes ?? '',
    lastSeen: row.last_seen ?? undefined,
    sessionCount: row.session_count,
    isSynced: row.is_synced === 1,
    remoteId: row.remote_id ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function rowToNote(row: NoteRow): ContactNote {
  return {
    id: row.id,
    contactId: row.contact_id,
    text: row.text,
    createdAt: row.created_at,
    remoteId: row.remote_id ?? undefined,
  }
}

export async function getAllContacts(): Promise<Contact[]> {
  const rows = await db.queryAll<ContactRow>('SELECT * FROM contacts ORDER BY updated_at DESC')
  return rows.map(rowToContact)
}

export async function getContact(id: string): Promise<Contact | undefined> {
  const row = await db.queryGet<ContactRow>('SELECT * FROM contacts WHERE id = ?', [id])
  return row ? rowToContact(row) : undefined
}

export async function upsertContact(contact: Contact): Promise<void> {
  const now = new Date().toISOString()
  const name = contact.name?.trim() || fullName(contact)
  await db.query(
    `INSERT INTO contacts (id, name, first_name, last_name, email, role, company, notes, last_seen, session_count, is_synced, remote_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       name = excluded.name,
       first_name = excluded.first_name,
       last_name = excluded.last_name,
       email = excluded.email,
       role = excluded.role,
       company = excluded.company,
       notes = excluded.notes,
       last_seen = excluded.last_seen,
       session_count = excluded.session_count,
       is_synced = excluded.is_synced,
       remote_id = excluded.remote_id,
       updated_at = excluded.updated_at`,
    [
      contact.id,
      name,
      contact.firstName || splitName(name).firstName,
      contact.lastName ?? null,
      contact.email ?? null,
      contact.role ?? null,
      contact.company ?? null,
      contact.notes ?? '',
      contact.lastSeen ?? null,
      contact.sessionCount,
      contact.isSynced ? 1 : 0,
      contact.remoteId ?? null,
      contact.createdAt || now,
      now,
    ],
  )
}

export async function deleteContact(id: string): Promise<void> {
  await db.query('DELETE FROM contact_notes WHERE contact_id = ?', [id])
  await db.query('DELETE FROM contacts WHERE id = ?', [id])
}

export async function linkContactToSession(contactId: string, sessionId: string): Promise<void> {
  await db.query(`INSERT OR IGNORE INTO session_contacts (session_id, contact_id) VALUES (?, ?)`, [sessionId, contactId])
}

export async function unlinkContactFromSession(contactId: string, sessionId: string): Promise<void> {
  await db.query(`DELETE FROM session_contacts WHERE session_id = ? AND contact_id = ?`, [sessionId, contactId])
}

export async function getContactsForSession(sessionId: string): Promise<Contact[]> {
  const rows = await db.queryAll<ContactRow>(
    `SELECT c.* FROM contacts c
     INNER JOIN session_contacts sc ON sc.contact_id = c.id
     WHERE sc.session_id = ?
     ORDER BY c.name`,
    [sessionId],
  )
  return rows.map(rowToContact)
}

/** Ids of the sessions linked to a contact. */
export async function getSessionIdsForContact(contactId: string): Promise<string[]> {
  const rows = await db.queryAll<{ session_id: string }>(
    `SELECT session_id FROM session_contacts WHERE contact_id = ?`,
    [contactId],
  )
  return rows.map((r) => r.session_id)
}

interface SessionSummaryRow {
  id: string
  title: string
  start_time: string
  end_time: string | null
  summary: string | null
}

/** Sessions linked to a contact, newest first (title/date/summary for briefings and the contact page). */
export async function getSessionsForContact(contactId: string, limit = 20): Promise<Pick<Session, 'id' | 'title' | 'startTime' | 'endTime' | 'summary'>[]> {
  const rows = await db.queryAll<SessionSummaryRow>(
    `SELECT s.id, s.title, s.start_time, s.end_time, s.summary
     FROM sessions s
     INNER JOIN session_contacts sc ON sc.session_id = s.id
     WHERE sc.contact_id = ?
     ORDER BY s.start_time DESC
     LIMIT ?`,
    [contactId, limit],
  )
  return rows.map((r) => ({ id: r.id, title: r.title, startTime: r.start_time, endTime: r.end_time, summary: r.summary }))
}

export async function searchContacts(query: string): Promise<Contact[]> {
  const like = `%${query}%`
  const rows = await db.queryAll<ContactRow>(
    `SELECT * FROM contacts
     WHERE name LIKE ? OR email LIKE ? OR role LIKE ? OR company LIKE ?
     ORDER BY updated_at DESC`,
    [like, like, like, like],
  )
  return rows.map(rowToContact)
}

/** Exact match by email (case-insensitive) or full name — used to merge extracted contacts. */
export async function findMatchingContact(fields: { email?: string; name: string }): Promise<Contact | undefined> {
  if (fields.email) {
    const byEmail = await db.queryGet<ContactRow>('SELECT * FROM contacts WHERE lower(email) = lower(?)', [fields.email.trim()])
    if (byEmail) return rowToContact(byEmail)
  }
  if (fields.name.trim()) {
    const byName = await db.queryGet<ContactRow>('SELECT * FROM contacts WHERE lower(name) = lower(?)', [fields.name.trim()])
    if (byName) return rowToContact(byName)
  }
  return undefined
}

export async function getUnsyncedContacts(): Promise<Contact[]> {
  const rows = await db.queryAll<ContactRow>('SELECT * FROM contacts WHERE is_synced = 0 ORDER BY updated_at DESC')
  return rows.map(rowToContact)
}

export async function markContactSynced(id: string, remoteId: string): Promise<void> {
  await db.query('UPDATE contacts SET is_synced = 1, remote_id = ?, updated_at = ? WHERE id = ?', [remoteId, new Date().toISOString(), id])
}

/** Flag a contact as needing a push (after an edit or a new note). */
export async function markContactDirty(id: string): Promise<void> {
  await db.query('UPDATE contacts SET is_synced = 0, updated_at = ? WHERE id = ?', [new Date().toISOString(), id])
}

// ── Notes (timestamped timeline, mac ContactNote parity) ──────────────

export async function getNotes(contactId: string): Promise<ContactNote[]> {
  const rows = await db.queryAll<NoteRow>(
    'SELECT * FROM contact_notes WHERE contact_id = ? ORDER BY created_at DESC',
    [contactId],
  )
  return rows.map(rowToNote)
}

/** Joined notes text (newest first) kept on the contact row for the AI "known people" context. */
async function refreshNotesSummary(contactId: string): Promise<string> {
  const notes = await getNotes(contactId)
  const summary = notes.map((n) => n.text.trim()).filter(Boolean).join(' · ')
  await db.query('UPDATE contacts SET notes = ?, updated_at = ? WHERE id = ?', [summary, new Date().toISOString(), contactId])
  return summary
}

export async function addNote(contactId: string, text: string, options?: { id?: string; createdAt?: string; remoteId?: string }): Promise<ContactNote> {
  const note: ContactNote = {
    id: options?.id ?? crypto.randomUUID(),
    contactId,
    text: text.trim(),
    createdAt: options?.createdAt ?? new Date().toISOString(),
    remoteId: options?.remoteId,
  }
  await db.query(
    `INSERT OR IGNORE INTO contact_notes (id, contact_id, text, created_at, remote_id) VALUES (?, ?, ?, ?, ?)`,
    [note.id, note.contactId, note.text, note.createdAt, note.remoteId ?? null],
  )
  await refreshNotesSummary(contactId)
  return note
}

export async function deleteNote(noteId: string, contactId: string): Promise<void> {
  await db.query('DELETE FROM contact_notes WHERE id = ?', [noteId])
  await refreshNotesSummary(contactId)
}

/** Notes without a remote id are new since the last sync; `remote_id` is set on pull/push. */
export async function markNoteSynced(noteId: string, remoteId: string): Promise<void> {
  await db.query('UPDATE contact_notes SET remote_id = ? WHERE id = ?', [remoteId, noteId])
}
