import { db } from '@/db/client'
import type { Contact } from '@/types/models'

interface ContactRow {
  id: string
  name: string
  role: string | null
  company: string | null
  notes: string
  last_seen: string | null
  session_count: number
  created_at: string
  updated_at: string
}

function rowToContact(row: ContactRow): Contact {
  return {
    id: row.id,
    name: row.name,
    role: row.role ?? undefined,
    company: row.company ?? undefined,
    notes: row.notes,
    lastSeen: row.last_seen ?? undefined,
    sessionCount: row.session_count,
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
    `INSERT INTO contacts (id, name, role, company, notes, last_seen, session_count, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       name = excluded.name,
       role = excluded.role,
       company = excluded.company,
       notes = excluded.notes,
       last_seen = excluded.last_seen,
       session_count = excluded.session_count,
       updated_at = excluded.updated_at`,
    [
      contact.id,
      contact.name,
      contact.role ?? null,
      contact.company ?? null,
      contact.notes,
      contact.lastSeen ?? null,
      contact.sessionCount,
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

export async function searchContacts(query: string): Promise<Contact[]> {
  const rows = await db.queryAll<ContactRow>(
    `SELECT * FROM contacts
     WHERE name LIKE ? OR role LIKE ? OR company LIKE ?
     ORDER BY updated_at DESC`,
    [`%${query}%`, `%${query}%`, `%${query}%`]
  )
  return rows.map(rowToContact)
}
