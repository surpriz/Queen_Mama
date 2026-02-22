import { db } from '@/db/client'
import type { Contact } from '@/types/models'

interface ContactRow {
  id: string
  name: string
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

function rowToContact(row: ContactRow): Contact {
  return {
    id: row.id,
    name: row.name,
    email: row.email ?? undefined,
    role: row.role ?? undefined,
    company: row.company ?? undefined,
    notes: row.notes,
    lastSeen: row.last_seen ?? undefined,
    sessionCount: row.session_count,
    isSynced: row.is_synced === 1,
    remoteId: row.remote_id ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export async function getAllContacts(): Promise<Contact[]> {
  const rows = await db.queryAll<ContactRow>(
    'SELECT * FROM contacts ORDER BY updated_at DESC'
  )
  return rows.map(rowToContact)
}

export async function getContact(id: string): Promise<Contact | undefined> {
  const row = await db.queryGet<ContactRow>(
    'SELECT * FROM contacts WHERE id = ?',
    [id]
  )
  return row ? rowToContact(row) : undefined
}

export async function upsertContact(contact: Contact): Promise<void> {
  const now = new Date().toISOString()
  await db.query(
    `INSERT INTO contacts (id, name, email, role, company, notes, last_seen, session_count, is_synced, remote_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       name = excluded.name,
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
      contact.name,
      contact.email ?? null,
      contact.role ?? null,
      contact.company ?? null,
      contact.notes,
      contact.lastSeen ?? null,
      contact.sessionCount,
      contact.isSynced ? 1 : 0,
      contact.remoteId ?? null,
      contact.createdAt || now,
      now,
    ]
  )
}

export async function deleteContact(id: string): Promise<void> {
  await db.query('DELETE FROM contacts WHERE id = ?', [id])
}

export async function linkContactToSession(
  contactId: string,
  sessionId: string,
): Promise<void> {
  await db.query(
    `INSERT OR IGNORE INTO session_contacts (session_id, contact_id) VALUES (?, ?)`,
    [sessionId, contactId]
  )
}

export async function unlinkContactFromSession(
  contactId: string,
  sessionId: string,
): Promise<void> {
  await db.query(
    `DELETE FROM session_contacts WHERE session_id = ? AND contact_id = ?`,
    [sessionId, contactId]
  )
}

export async function getContactsForSession(sessionId: string): Promise<Contact[]> {
  const rows = await db.queryAll<ContactRow>(
    `SELECT c.* FROM contacts c
     INNER JOIN session_contacts sc ON sc.contact_id = c.id
     WHERE sc.session_id = ?
     ORDER BY c.name`,
    [sessionId]
  )
  return rows.map(rowToContact)
}

export async function getSessionsForContact(contactId: string): Promise<string[]> {
  const rows = await db.queryAll<{ session_id: string }>(
    `SELECT session_id FROM session_contacts WHERE contact_id = ? ORDER BY session_id DESC`,
    [contactId]
  )
  return rows.map((r) => r.session_id)
}

export async function searchContacts(query: string): Promise<Contact[]> {
  const rows = await db.queryAll<ContactRow>(
    `SELECT * FROM contacts
     WHERE name LIKE ? OR email LIKE ? OR role LIKE ? OR company LIKE ?
     ORDER BY updated_at DESC`,
    [`%${query}%`, `%${query}%`, `%${query}%`, `%${query}%`]
  )
  return rows.map(rowToContact)
}

export async function getUnsyncedContacts(): Promise<Contact[]> {
  const rows = await db.queryAll<ContactRow>(
    'SELECT * FROM contacts WHERE is_synced = 0 ORDER BY updated_at DESC'
  )
  return rows.map(rowToContact)
}

export async function markContactSynced(id: string, remoteId: string): Promise<void> {
  await db.query(
    'UPDATE contacts SET is_synced = 1, remote_id = ?, updated_at = ? WHERE id = ?',
    [remoteId, new Date().toISOString(), id]
  )
}
