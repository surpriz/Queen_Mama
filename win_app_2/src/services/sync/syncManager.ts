import { createLogger } from '@/lib/logger'
import { captureError } from '@/services/crash/crashReporter'
import { getAccessToken, getDeviceId as getAuthDeviceId } from '../auth/authenticationManager'
import { getApiBaseUrl } from '../config/appEnvironment'
import { useSessionStore } from '@/stores/sessionStore'
import { useLicenseStore } from '@/stores/licenseStore'
import { useAuthStore } from '@/stores/authStore'
import { upsertImportedSession, markSessionsSynced, deleteSession as deleteLocalSession } from '@/services/session/sessionManager'
import { Feature } from '@/types/auth'
import type { Session } from '@/types/models'
import type { SyncSessionPayload, RemoteSession } from '@/types/api'

const log = createLogger('Sync')

interface SyncQueue {
  sessions: SyncSessionPayload[]
  lastSyncAt: string | null
  // originalId → checksum of the last successfully uploaded version. Lets the
  // periodic full sync skip unchanged sessions instead of re-uploading the
  // whole local history every 5 minutes.
  syncedChecksums?: Record<string, string>
}

interface ConflictResolution {
  sessionId: string
  resolution: 'local' | 'remote' | 'merge'
}

let syncQueue: SyncQueue = { sessions: [], lastSyncAt: null }
let isOnline = navigator.onLine
let syncInterval: ReturnType<typeof setInterval> | null = null
let isSyncing = false
let cachedDeviceId: string | null = null

const BATCH_SIZE = 10
const SYNC_INTERVAL = 5 * 60 * 1000 // 5 minutes
const PULL_LIMIT = 200

/** Sync requires an authenticated user with the session-sync feature. */
function canSyncNow(): boolean {
  if (!useAuthStore.getState().isAuthenticated) return false
  return useLicenseStore.getState().canUse(Feature.SessionSync).type === 'allowed'
}

/** Authenticated fetch with one token refresh + retry on 401. */
async function authedFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const baseHeaders = (init.headers ?? {}) as Record<string, string>
  let token = await getAccessToken()
  let response = await fetch(input, { ...init, headers: { ...baseHeaders, Authorization: `Bearer ${token}` } })
  if (response.status === 401) {
    log.warn('401 during sync, refreshing token once')
    token = await getAccessToken(true)
    response = await fetch(input, { ...init, headers: { ...baseHeaders, Authorization: `Bearer ${token}` } })
  }
  return response
}

// Listen for online/offline events
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    isOnline = true
    log.info('Network online, triggering sync')
    uploadPendingSessions().catch((e) => log.warn('Online-triggered sync failed', e))
  })
  window.addEventListener('offline', () => {
    isOnline = false
    log.info('Network offline')
  })
}

export function queueSession(session: Session): void {
  // Check if session sync is enabled for this license
  const canSync = useLicenseStore.getState().canUse(Feature.SessionSync)
  if (canSync.type !== 'allowed') {
    log.info('Session sync not available for current license')
    return
  }

  // Check for existing entry and update version
  const existingIndex = syncQueue.sessions.findIndex(
    (s) => s.originalId === session.id
  )

  // Build payload without null values (Zod expects undefined/absent, not null)
  const payload: SyncSessionPayload = {
    originalId: session.id,
    title: session.title || 'Untitled Session',
    startTime: session.startTime,
    transcript: session.transcript || '',
    actionItems: session.actionItems || [],
    deviceId: session.deviceId || getDeviceId(),
    version: existingIndex >= 0 ? syncQueue.sessions[existingIndex].version + 1 : 1,
    checksum: generateChecksum(session),
  }
  // Only add optional fields if they have values
  if (session.endTime) payload.endTime = session.endTime
  if (session.summary) payload.summary = session.summary
  if (session.modeId) payload.modeUsed = session.modeId

  if (existingIndex >= 0) {
    syncQueue.sessions[existingIndex] = payload
    log.info(`Session updated in queue: ${session.id} (v${payload.version})`)
  } else {
    syncQueue.sessions.push(payload)
    log.info(`Session queued for sync: ${session.id}`)
  }

  saveQueue()

  // Trigger immediate upload if online
  if (isOnline && !isSyncing) {
    uploadPendingSessions().catch((e) => log.warn('Queue-triggered sync failed', e))
  }
}

export function queueSessionForSync(sessionId: string): void {
  const session = useSessionStore.getState().sessions.find((s) => s.id === sessionId)
  if (session) {
    queueSession(session)
  } else {
    log.warn(`Session not found for sync: ${sessionId}`)
  }
}

export async function uploadPendingSessions(): Promise<{ uploaded: number; failed: number }> {
  if (syncQueue.sessions.length === 0) return { uploaded: 0, failed: 0 }
  if (!isOnline) {
    log.info('Offline, skipping upload')
    return { uploaded: 0, failed: syncQueue.sessions.length }
  }

  // Ensure deviceId is properly set and clean null values for all queued sessions
  const correctDeviceId = await ensureDeviceId()

  // Clean sessions: rebuild without null values (Zod expects undefined/absent, not null)
  log.info(`Cleaning ${syncQueue.sessions.length} sessions before upload`)
  syncQueue.sessions = syncQueue.sessions.map((session) => {
    const cleaned: SyncSessionPayload = {
      originalId: session.originalId,
      title: session.title || 'Untitled Session',
      startTime: session.startTime,
      transcript: session.transcript || '',
      actionItems: session.actionItems || [],
      deviceId: session.deviceId && session.deviceId !== 'pending-init' && session.deviceId !== 'pending'
        ? session.deviceId
        : correctDeviceId,
      version: session.version || 1,
      checksum: session.checksum || '',
    }
    // Only add optional fields if they have truthy values
    if (session.endTime) cleaned.endTime = session.endTime
    if (session.summary) cleaned.summary = session.summary
    if (session.modeUsed) cleaned.modeUsed = session.modeUsed
    if (session.duration) cleaned.duration = session.duration
    log.info(`Session ${session.originalId}: endTime=${session.endTime}, cleaned has endTime=${Object.prototype.hasOwnProperty.call(cleaned, 'endTime')}`)
    return cleaned
  })
  log.info(`Sessions cleaned, uploading...`)
  if (isSyncing) {
    log.info('Sync already in progress')
    return { uploaded: 0, failed: 0 }
  }

  isSyncing = true
  let uploaded = 0
  let failed = 0

  try {
    const baseUrl = getApiBaseUrl()

    // Upload in batches
    while (syncQueue.sessions.length > 0) {
      const batch = syncQueue.sessions.splice(0, BATCH_SIZE)

      try {
        const response = await authedFetch(`${baseUrl}/api/sync/sessions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessions: batch }),
        })

        if (!response.ok) {
          // Handle specific error cases
          if (response.status === 409) {
            // Conflict - need to resolve
            const conflicts = await response.json()
            await handleConflicts(conflicts.conflicts || [])
          } else {
            // Put back in queue on failure
            syncQueue.sessions.unshift(...batch)
            failed += batch.length
            const error = new Error(`Sync upload failed: HTTP ${response.status}`)
            captureError(error, { service: 'sync', operation: 'upload', status: response.status, batchSize: batch.length })
            log.error(`Upload failed: ${response.status}`)
            break
          }
        } else {
          const result = (await response.json()) as {
            synced?: number
            results?: Array<{ originalId: string; status: string }>
            errors?: Array<{ originalId: string; error: string }>
          }
          // Per-session outcome: the server reports partial failures in
          // `errors`; those items stay queued instead of being dropped.
          const failedIds = new Set((result.errors ?? []).map((e) => e.originalId))
          const okItems = batch.filter((item) => !failedIds.has(item.originalId))
          const failedItems = batch.filter((item) => failedIds.has(item.originalId))
          uploaded += okItems.length
          failed += failedItems.length
          if (failedItems.length) {
            syncQueue.sessions.push(...failedItems)
            log.error('Sync errors:', result.errors)
          }
          // Remember what was uploaded so the periodic full sync can skip
          // unchanged sessions (dirty check in requeueAllLocalSessions)
          syncQueue.syncedChecksums = syncQueue.syncedChecksums ?? {}
          for (const item of okItems) {
            if (item.checksum) syncQueue.syncedChecksums[item.originalId] = item.checksum
          }
          await markSessionsSynced(okItems.map((i) => i.originalId))
          log.info(`Uploaded ${okItems.length}/${batch.length} sessions`)
          if (failedItems.length === batch.length) break // nothing got through — stop hammering
        }
      } catch (error) {
        syncQueue.sessions.unshift(...batch)
        failed += batch.length
        captureError(
          error instanceof Error ? error : new Error('Sync upload network error'),
          { service: 'sync', operation: 'upload', batchSize: batch.length },
        )
        log.error('Upload error', error)
        break
      }
    }

    syncQueue.lastSyncAt = new Date().toISOString()
    saveQueue()
  } catch (error) {
    log.error('Auth error during sync', error)
    captureError(
      error instanceof Error ? error : new Error('Sync auth error'),
      { service: 'sync', operation: 'auth' },
    )
    failed = syncQueue.sessions.length
  } finally {
    isSyncing = false
  }

  return { uploaded, failed }
}

async function handleConflicts(conflicts: Array<{ sessionId: string; localVersion: number; remoteVersion: number; remoteData: RemoteSession }>): Promise<void> {
  const resolutions: ConflictResolution[] = []

  for (const conflict of conflicts) {
    // Default strategy: remote wins if newer, local wins if same or newer
    // More sophisticated merging could be implemented here
    const localSession = useSessionStore.getState().sessions.find(
      (s) => s.id === conflict.sessionId
    )

    if (!localSession) {
      // Local deleted, accept remote
      resolutions.push({ sessionId: conflict.sessionId, resolution: 'remote' })
      continue
    }

    // Compare timestamps for resolution
    const localTime = localSession.endTime ? new Date(localSession.endTime).getTime() : Date.now()
    const remoteTime = conflict.remoteData.endTime ? new Date(conflict.remoteData.endTime).getTime() : 0

    if (remoteTime > localTime) {
      // Remote is newer, merge by taking remote (persisted, not just in memory)
      resolutions.push({ sessionId: conflict.sessionId, resolution: 'remote' })
      await upsertImportedSession(remoteToSession(conflict.remoteData, localSession))
    } else {
      // Local is newer or same, keep local
      resolutions.push({ sessionId: conflict.sessionId, resolution: 'local' })
    }
  }

  log.info(`Resolved ${resolutions.length} conflicts`)
}

/** Map a server row onto a local Session (modeUsed → modeId, mac parity). */
function remoteToSession(remote: RemoteSession, local?: Session): Session {
  return {
    id: remote.originalId,
    title: remote.title,
    startTime: remote.startTime,
    endTime: remote.endTime ?? null,
    transcript: remote.transcript ?? local?.transcript ?? '',
    summary: remote.summary ?? local?.summary ?? null,
    actionItems: remote.actionItems ?? local?.actionItems ?? [],
    modeId: remote.modeUsed ?? local?.modeId ?? null,
    entries: local?.entries ?? [],
    syncStatus: 'synced',
    remoteId: remote.id,
    deviceId: remote.deviceId,
  }
}

export async function pullRemoteSessions(): Promise<RemoteSession[]> {
  if (!isOnline) return []
  if (!canSyncNow()) {
    log.info('Pull skipped: sync not available (unauthenticated or plan)')
    return []
  }

  try {
    const baseUrl = getApiBaseUrl()

    // `full=true` is required to get transcript/summary/actionItems/modeUsed;
    // the server ignores `since`, so we page the latest PULL_LIMIT rows.
    const params = new URLSearchParams({ allDevices: 'true', full: 'true', limit: String(PULL_LIMIT) })

    const response = await authedFetch(`${baseUrl}/api/sync/sessions?${params}`)

    if (!response.ok) {
      captureError(new Error(`Sync pull failed: HTTP ${response.status}`), { service: 'sync', operation: 'pull', status: response.status })
      log.error(`Pull failed: ${response.status}`)
      return []
    }

    const data = await response.json()
    return data.sessions || []
  } catch (error) {
    captureError(error instanceof Error ? error : new Error('Sync pull error'), { service: 'sync', operation: 'pull' })
    log.error('Pull error', error)
    return []
  }
}

/** Sessions that were deleted on the web dashboard, found by the last reconcile. */
let lastRemoteDeletions: string[] = []

export function getRemoteDeletions(): string[] {
  return lastRemoteDeletions
}

export async function reconcileRemoteSessions(): Promise<{ imported: number; deleted: number }> {
  if (!canSyncNow()) return { imported: 0, deleted: 0 }
  const remoteSessions = await pullRemoteSessions()
  const sessionStore = useSessionStore.getState()
  let imported = 0
  let deleted = 0

  const remoteIds = new Set(remoteSessions.map((r) => r.originalId))

  for (const remote of remoteSessions) {
    const local = sessionStore.sessions.find((s) => s.id === remote.originalId)
    if (!local) {
      // New remote session: persisted to SQLite so it survives a restart
      await upsertImportedSession(remoteToSession(remote))
      imported++
      log.info(`Imported remote session: ${remote.originalId}`)
    } else if (local.syncStatus !== 'synced') {
      // Known locally and present remotely → mark as synced
      await markSessionsSynced([local.id])
    }
  }

  // Remote deletions (mac SessionListView.processRemoteDeletions): a session we
  // know is on the server but that the full listing no longer contains was
  // deleted on the web — mirror it locally. Only trusted when the listing is
  // non-empty and not truncated (a failed pull must never wipe local data).
  if (remoteSessions.length > 0 && remoteSessions.length < PULL_LIMIT) {
    const deletedRemotely = useSessionStore
      .getState()
      .sessions.filter((s) => s.syncStatus === 'synced' && s.endTime && !remoteIds.has(s.id))
      .map((s) => s.id)
    for (const id of deletedRemotely) {
      await deleteLocalSession(id)
      deleted++
      log.info(`Removed session deleted remotely: ${id}`)
    }
    lastRemoteDeletions = deletedRemotely
  }

  return { imported, deleted }
}

/**
 * Delete a session from the remote server.
 * Called when user manually deletes a session locally.
 */
export async function deleteRemoteSession(sessionId: string): Promise<void> {
  if (!isOnline) {
    log.warn(`Offline, cannot delete remote session ${sessionId}`)
    return
  }
  if (!useAuthStore.getState().isAuthenticated) return

  try {
    const baseUrl = getApiBaseUrl()
    const response = await authedFetch(`${baseUrl}/api/sync/sessions/${sessionId}`, { method: 'DELETE' })

    if (response.ok) {
      log.info(`Remote session deleted: ${sessionId}`)
    } else if (response.status === 404) {
      log.info(`Remote session not found (already deleted): ${sessionId}`)
    } else {
      captureError(new Error(`Sync delete failed: HTTP ${response.status}`), { service: 'sync', operation: 'delete', sessionId, status: response.status })
      log.error(`Failed to delete remote session: ${response.status}`)
    }
  } catch (error) {
    captureError(error instanceof Error ? error : new Error('Sync delete error'), { service: 'sync', operation: 'delete', sessionId })
    log.error('Remote session delete error', error)
  }
}

/**
 * Re-queue all local sessions that aren't already in the sync queue.
 * Useful for initial sync or manual "Sync Now" to catch sessions that were
 * never queued (e.g., created before sync was working).
 */
export function requeueAllLocalSessions(): number {
  const sessions = useSessionStore.getState().sessions
  const alreadyQueued = new Set(syncQueue.sessions.map((s) => s.originalId))
  let queued = 0

  // Temporarily prevent auto-upload while re-queuing to avoid race conditions
  const wasSyncing = isSyncing
  isSyncing = true

  for (const session of sessions) {
    if (alreadyQueued.has(session.id) || !session.endTime) continue
    // Dirty check: skip sessions whose content hasn't changed since last upload
    if (syncQueue.syncedChecksums?.[session.id] === generateChecksum(session)) continue
    queueSession(session)
    queued++
  }

  // Restore syncing state
  isSyncing = wasSyncing

  if (queued > 0) {
    log.info(`Re-queued ${queued} local sessions for sync`)
  }
  return queued
}

export async function performFullSync(): Promise<void> {
  if (!canSyncNow()) {
    log.info('Full sync skipped: not available')
    return
  }
  log.info('Performing full sync...')

  // Re-queue any local sessions that haven't been synced yet
  requeueAllLocalSessions()

  await uploadPendingSessions()
  await reconcileRemoteSessions()

  syncQueue.lastSyncAt = new Date().toISOString()
  saveQueue()

  log.info('Full sync complete')
}

export function startPeriodicSync(): void {
  stopPeriodicSync()

  // Initial sync
  performFullSync().catch((err) => log.error('Initial sync failed', err))

  // Periodic sync
  syncInterval = setInterval(() => {
    if (isOnline) {
      performFullSync().catch((err) => log.error('Periodic sync failed', err))
    }
  }, SYNC_INTERVAL)

  log.info('Periodic sync started')
}

export function stopPeriodicSync(): void {
  if (syncInterval) {
    clearInterval(syncInterval)
    syncInterval = null
  }
}

export function getPendingCount(): number {
  return syncQueue.sessions.length
}

export function getLastSyncTime(): string | null {
  return syncQueue.lastSyncAt
}

export function isNetworkOnline(): boolean {
  return isOnline
}

function generateChecksum(session: Session): string {
  const content = session.title + session.transcript + (session.summary || '')
  let hash = 0
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash = hash & hash
  }
  return Math.abs(hash).toString(16)
}

function getDeviceId(): string {
  // Return cached device ID
  // The cache is populated by initDeviceId() during app startup
  return cachedDeviceId || 'pending'
}

// Initialize device ID cache - call this at app startup
export async function initDeviceId(): Promise<void> {
  try {
    // Use the same deviceId source as authentication
    cachedDeviceId = await getAuthDeviceId()
    log.info(`Device ID cached: ${cachedDeviceId}`)
  } catch (err) {
    log.warn(`Failed to get device ID: ${err}`)
  }
}

// Export for use by sessionManager (sync version for session creation)
export function getCachedDeviceId(): string {
  // Return cached value - initDeviceId should be called during app startup
  return cachedDeviceId || 'pending-init'
}

// Async version for when we need to ensure it's loaded
export async function ensureDeviceId(): Promise<string> {
  if (!cachedDeviceId) {
    cachedDeviceId = await getAuthDeviceId()
  }
  return cachedDeviceId
}

function saveQueue(): void {
  window.electronAPI?.store.set('sync_queue', JSON.stringify(syncQueue))
}

/** Forget pending uploads (sign-out): the queue is account-specific. */
export function clearQueue(): void {
  syncQueue = { sessions: [], lastSyncAt: null }
  saveQueue()
}

export async function loadQueue(): Promise<void> {
  const saved = (await window.electronAPI?.store.get('sync_queue')) as string | null
  if (saved) {
    try {
      const parsed = JSON.parse(saved)
      // Clean sessions when loading - remove null values that Zod rejects
      if (parsed.sessions && Array.isArray(parsed.sessions)) {
        parsed.sessions = parsed.sessions.map((session: SyncSessionPayload) => {
          const cleaned: SyncSessionPayload = {
            originalId: session.originalId,
            title: session.title || 'Untitled Session',
            startTime: session.startTime,
            transcript: session.transcript || '',
            actionItems: session.actionItems || [],
            deviceId: session.deviceId || 'pending-init',
            version: session.version || 1,
            checksum: session.checksum || '',
          }
          // Only add optional fields if they have truthy, non-null values
          if (session.endTime && session.endTime !== null) cleaned.endTime = session.endTime
          if (session.summary && session.summary !== null) cleaned.summary = session.summary
          if (session.modeUsed && session.modeUsed !== null) cleaned.modeUsed = session.modeUsed
          if (session.duration && session.duration !== null) cleaned.duration = session.duration
          return cleaned
        })
        log.info(`Loaded and cleaned ${parsed.sessions.length} sessions from queue`)
      }
      syncQueue = parsed
    } catch {
      syncQueue = { sessions: [], lastSyncAt: null }
    }
  }
}

// Export for backwards compatibility
export { uploadPendingSessions as reconcileRemoteDeletions }
export { performFullSync as performInitialSync }
