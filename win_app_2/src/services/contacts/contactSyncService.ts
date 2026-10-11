/**
 * ContactSyncService - Bidirectional contact sync with backend
 * Matches macOS ContactSyncManager behavior:
 * - Push: Local unsynced contacts (+ their notes) → Server (batch of 10)
 * - Pull: Server contacts (+ notes) → Local (match by remoteId / email, merge notes)
 * - Authentication-gated (requires pro subscription)
 *
 * Wire format (`landing/lib/validations.ts` contactSyncSchema): firstName,
 * lastName, email, company, role, lastSeenAt, notes[{originalId, content, createdAt}].
 */

import { createLogger } from '@/lib/logger'
import { getApiBaseUrl } from '@/services/config/appEnvironment'
import { getAccessToken } from '@/services/auth/authenticationManager'
import * as contactDb from './contactDb'
import { fullName } from './contactModel'
import type { Contact } from '@/types/models'

const log = createLogger('ContactSync')
const BATCH_SIZE = 10

interface SyncableNote {
  originalId: string
  content: string
  createdAt: string
}

interface SyncableContact {
  deviceId: string
  originalId: string
  firstName: string
  lastName?: string
  email?: string
  company?: string
  role?: string
  lastSeenAt: string
  version: number
  notes?: SyncableNote[]
}

interface RemoteNote {
  id: string
  content: string
  createdAt: string
}

interface RemoteContact {
  id: string
  firstName: string
  lastName?: string | null
  email?: string | null
  company?: string | null
  role?: string | null
  originalId?: string | null
  lastSeenAt?: string
  createdAt?: string
  updatedAt?: string
  notes?: RemoteNote[]
}

interface SyncState {
  isSyncing: boolean
  isPulling: boolean
  pendingCount: number
  lastSyncAt: string | null
  lastError: string | null
}

type SyncListener = (state: SyncState) => void

let state: SyncState = {
  isSyncing: false,
  isPulling: false,
  pendingCount: 0,
  lastSyncAt: null,
  lastError: null,
}

const listeners: Set<SyncListener> = new Set()

function notify(): void {
  for (const fn of listeners) fn({ ...state })
}

export function onSyncStateChanged(listener: SyncListener): () => void {
  listeners.add(listener)
  listener({ ...state })
  return () => listeners.delete(listener)
}

export function getSyncState(): SyncState {
  return { ...state }
}

async function getAuthHeaders(): Promise<Record<string, string> | null> {
  try {
    const token = await getAccessToken()
    return { Authorization: `Bearer ${token}` }
  } catch {
    return null
  }
}

async function getDeviceId(): Promise<string> {
  return window.electronAPI?.getDeviceId?.() ?? 'unknown'
}

function getBaseUrl(): string {
  return getApiBaseUrl()
}

/**
 * Push unsynced contacts (with their notes) to server
 */
export async function pushContacts(): Promise<void> {
  if (state.isSyncing) return

  state.isSyncing = true
  state.lastError = null
  notify()

  try {
    const headers = await getAuthHeaders()
    if (!headers) {
      log.warn('Push skipped: not authenticated')
      return
    }

    const unsyncedContacts = await contactDb.getUnsyncedContacts()
    if (unsyncedContacts.length === 0) {
      log.info('No unsynced contacts to push')
      return
    }

    const deviceId = await getDeviceId()
    const baseUrl = getBaseUrl()

    for (let i = 0; i < unsyncedContacts.length; i += BATCH_SIZE) {
      const batch = unsyncedContacts.slice(i, i + BATCH_SIZE)
      const payload: SyncableContact[] = []
      const noteIdsByContact = new Map<string, string[]>()

      for (const c of batch) {
        const notes = await contactDb.getNotes(c.id)
        noteIdsByContact.set(c.id, notes.map((n) => n.id))
        payload.push({
          deviceId,
          originalId: c.id,
          firstName: c.firstName || c.name,
          lastName: c.lastName,
          email: c.email,
          company: c.company,
          role: c.role,
          lastSeenAt: c.lastSeen || c.createdAt,
          version: 1,
          notes: notes.length
            ? notes.map((n) => ({ originalId: n.id, content: n.text, createdAt: n.createdAt }))
            : undefined,
        })
      }

      const response = await fetch(`${baseUrl}/api/sync/contacts`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ contacts: payload }),
      })

      if (response.status === 401 || response.status === 403) {
        log.warn(`Push rejected: ${response.status}`)
        state.lastError = response.status === 401 ? 'Not authenticated' : 'Subscription required'
        return
      }

      if (!response.ok) {
        throw new Error(`Push failed: ${response.status}`)
      }

      const result = await response.json()

      if (result.results && Array.isArray(result.results)) {
        for (const synced of result.results) {
          if (synced.originalId && synced.syncedId) {
            await contactDb.markContactSynced(synced.originalId, synced.syncedId)
            // The server stores pushed notes as `${syncedId}-${originalId}`
            for (const noteId of noteIdsByContact.get(synced.originalId) ?? []) {
              await contactDb.markNoteSynced(noteId, `${synced.syncedId}-${noteId}`)
            }
          }
        }
      }

      log.info(`Pushed batch: ${batch.length} contacts`)
    }

    state.lastSyncAt = new Date().toISOString()
    log.info(`Push complete: ${unsyncedContacts.length} contacts synced`)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Push failed'
    log.error(msg)
    state.lastError = msg
  } finally {
    state.isSyncing = false
    state.pendingCount = (await contactDb.getUnsyncedContacts()).length
    notify()
  }
}

/**
 * Pull contacts (with notes) from server. New contacts are imported; known
 * ones (by remoteId or email) get missing fields and new notes merged in.
 * Returns the contacts that were created or updated.
 */
export async function pullContacts(): Promise<Contact[]> {
  if (state.isPulling) return []

  state.isPulling = true
  state.lastError = null
  notify()

  try {
    const headers = await getAuthHeaders()
    if (!headers) {
      log.warn('Pull skipped: not authenticated')
      return []
    }

    const baseUrl = getBaseUrl()

    const response = await fetch(`${baseUrl}/api/sync/contacts?includeNotes=true&limit=500`, {
      method: 'GET',
      headers,
    })

    if (response.status === 401 || response.status === 403) {
      log.warn(`Pull rejected: ${response.status}`)
      state.lastError = response.status === 401 ? 'Not authenticated' : 'Subscription required'
      return []
    }

    if (!response.ok) {
      throw new Error(`Pull failed: ${response.status}`)
    }

    const result = await response.json()
    const remoteContacts: RemoteContact[] = result.contacts || []

    const existingContacts = await contactDb.getAllContacts()
    const byRemoteId = new Map(existingContacts.filter((c) => c.remoteId).map((c) => [c.remoteId as string, c]))
    const byLocalId = new Map(existingContacts.map((c) => [c.id, c]))
    const byEmail = new Map(
      existingContacts.filter((c) => c.email).map((c) => [(c.email as string).toLowerCase(), c]),
    )

    const touched: Contact[] = []
    const now = new Date().toISOString()

    for (const remote of remoteContacts) {
      const local =
        byRemoteId.get(remote.id) ??
        (remote.originalId ? byLocalId.get(remote.originalId) : undefined) ??
        (remote.email ? byEmail.get(remote.email.toLowerCase()) : undefined)

      let contact: Contact
      if (local) {
        contact = {
          ...local,
          firstName: local.firstName || remote.firstName,
          lastName: local.lastName ?? remote.lastName ?? undefined,
          name: local.name || fullName({ firstName: remote.firstName, lastName: remote.lastName ?? undefined }),
          email: local.email ?? remote.email ?? undefined,
          role: local.role ?? remote.role ?? undefined,
          company: local.company ?? remote.company ?? undefined,
          remoteId: remote.id,
          isSynced: true,
          updatedAt: now,
        }
      } else {
        contact = {
          id: crypto.randomUUID(),
          firstName: remote.firstName,
          lastName: remote.lastName ?? undefined,
          name: fullName({ firstName: remote.firstName, lastName: remote.lastName ?? undefined }) || 'Unknown',
          email: remote.email ?? undefined,
          role: remote.role ?? undefined,
          company: remote.company ?? undefined,
          notes: '',
          lastSeen: remote.lastSeenAt,
          sessionCount: 0,
          isSynced: true,
          remoteId: remote.id,
          createdAt: remote.createdAt || now,
          updatedAt: now,
        }
      }
      await contactDb.upsertContact(contact)

      // Merge notes: skip the ones we already have (by remote id, or that were
      // pushed from here: `${remoteContactId}-${localNoteId}`)
      if (remote.notes?.length) {
        const localNotes = await contactDb.getNotes(contact.id)
        const knownRemote = new Set(localNotes.map((n) => n.remoteId).filter(Boolean))
        const knownLocal = new Set(localNotes.map((n) => `${remote.id}-${n.id}`))
        for (const note of remote.notes) {
          if (knownRemote.has(note.id) || knownLocal.has(note.id)) continue
          await contactDb.addNote(contact.id, note.content, { createdAt: note.createdAt, remoteId: note.id })
        }
      }

      const refreshed = await contactDb.getContact(contact.id)
      if (refreshed) touched.push(refreshed)
    }

    state.lastSyncAt = now
    log.info(`Pull complete: ${touched.length} contacts created/updated (${remoteContacts.length} total on server)`)
    return touched
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Pull failed'
    log.error(msg)
    state.lastError = msg
    return []
  } finally {
    state.isPulling = false
    state.pendingCount = (await contactDb.getUnsyncedContacts()).length
    notify()
  }
}

/**
 * Full bidirectional sync: push then pull
 */
export async function syncNow(): Promise<void> {
  await pushContacts()
  await pullContacts()
}

/**
 * Update pending count (call after contact changes)
 */
export async function refreshPendingCount(): Promise<void> {
  state.pendingCount = (await contactDb.getUnsyncedContacts()).length
  notify()
}
