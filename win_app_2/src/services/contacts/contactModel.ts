import type { Contact } from '@/types/models'

/** "Jean Dupont" → { firstName: "Jean", lastName: "Dupont" } (mac Contact.firstName/lastName). */
export function splitName(full: string): { firstName: string; lastName?: string } {
  const parts = full.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return { firstName: '' }
  if (parts.length === 1) return { firstName: parts[0] }
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') }
}

export function fullName(contact: Pick<Contact, 'firstName' | 'lastName'>): string {
  return [contact.firstName, contact.lastName].filter((p) => p && p.trim()).join(' ').trim()
}

/** Initials for the avatar: first letter of first + last name. */
export function initials(contact: Pick<Contact, 'firstName' | 'lastName' | 'name'>): string {
  const first = (contact.firstName || contact.name || '').trim().charAt(0)
  const last = (contact.lastName || '').trim().charAt(0)
  const value = (first + last).toUpperCase()
  if (value) return value
  return (contact.name || '?').slice(0, 2).toUpperCase()
}

/** "CTO @ Acme" subtitle (mac displaySubtitle). */
export function displaySubtitle(contact: Pick<Contact, 'role' | 'company'>): string | null {
  const parts = [contact.role, contact.company].filter((p) => p && p.trim())
  return parts.length ? parts.join(' @ ') : null
}

/** Build a complete Contact from form fields (keeps `name` = full name in sync). */
export function buildContact(
  fields: {
    id?: string
    firstName: string
    lastName?: string
    email?: string
    role?: string
    company?: string
  },
  base?: Partial<Contact>,
): Contact {
  const now = new Date().toISOString()
  const firstName = fields.firstName.trim()
  const lastName = fields.lastName?.trim() || undefined
  return {
    id: fields.id ?? base?.id ?? crypto.randomUUID(),
    firstName,
    lastName,
    name: fullName({ firstName, lastName }),
    email: fields.email?.trim() || undefined,
    role: fields.role?.trim() || undefined,
    company: fields.company?.trim() || undefined,
    notes: base?.notes ?? '',
    lastSeen: base?.lastSeen,
    sessionCount: base?.sessionCount ?? 0,
    isSynced: base?.isSynced ?? false,
    remoteId: base?.remoteId,
    createdAt: base?.createdAt ?? now,
    updatedAt: now,
  }
}
