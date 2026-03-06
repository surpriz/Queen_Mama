/**
 * ContactSyncService - Bidirectional contact sync with backend
 * Matches macOS ContactSyncManager behavior:
 * - Push: Local unsynced contacts → Server (batch of 10)
 * - Pull: Server contacts → Local (deduplication by remoteId/email)
 * - Authentication-gated (requires pro subscription)
 */

import { createLogger } from '@/lib/logger'
import { getApiBaseUrl } from '@/services/config/appEnvironment'
import { getAccessToken } from '@/services/auth/authenticationManager'
import * as contactDb from './contactDb'
import type { Contact } from '@/types/models'

const log = createLogger('ContactSync')
const BATCH_SIZE = 10

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
  notes?: string
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
 * Push unsynced contacts to server
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

    // Process in batches of 10
    for (let i = 0; i < unsyncedContacts.length; i += BATCH_SIZE) {
      const batch = unsyncedContacts.slice(i, i + BATCH_SIZE)
      const payload: SyncableContact[] = batch.map((c) => {
        const nameParts = c.name.trim().split(/\s+/)
        const firstName = nameParts[0] || c.name
        const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : undefined
        return {
          deviceId,
          originalId: c.id,
          firstName,
          lastName,
          email: c.email,
          company: c.company,
          role: c.role,
          lastSeenAt: c.lastSeen || c.createdAt,
          version: 1,
          notes: c.notes || undefined,
        }
      })

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

      // Mark contacts as synced with remote IDs
      if (result.results && Array.isArray(result.results)) {
        for (const synced of result.results) {
          if (synced.originalId && synced.syncedId) {
            await contactDb.markContactSynced(synced.originalId, synced.syncedId)
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
 * Pull contacts from server
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

    const response = await fetch(`${baseUrl}/api/contacts`, {
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
    const remoteContacts = result.contacts || []

    // Get existing contacts for deduplication
    const existingContacts = await contactDb.getAllContacts()
    const existingRemoteIds = new Set(existingContacts.map((c) => c.remoteId).filter(Boolean))
    const existingEmails = new Set(existingContacts.map((c) => c.email?.toLowerCase()).filter(Boolean))

    const imported: Contact[] = []
    const now = new Date().toISOString()

    for (const remote of remoteContacts) {
      // Skip if already imported by remoteId
      if (existingRemoteIds.has(remote.id)) continue
      // Skip if email matches an existing contact
      if (remote.email && existingEmails.has(remote.email.toLowerCase())) continue

      const fullName = [remote.firstName, remote.lastName].filter(Boolean).join(' ') || 'Unknown'
      const sessionCount = remote._count?.sessions ?? 0

      const newContact: Contact = {
        id: crypto.randomUUID(),
        name: fullName,
        email: remote.email ?? undefined,
        role: remote.role ?? undefined,
        company: remote.company ?? undefined,
        notes: '',
        lastSeen: remote.lastSeenAt,
        sessionCount,
        isSynced: true,
        remoteId: remote.id,
        createdAt: remote.createdAt || now,
        updatedAt: now,
      }

      await contactDb.upsertContact(newContact)
      imported.push(newContact)
    }

    state.lastSyncAt = now
    log.info(`Pull complete: ${imported.length} new contacts imported (${remoteContacts.length} total on server)`)
    return imported
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
