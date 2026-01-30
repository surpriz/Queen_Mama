import { createLogger } from '@/lib/logger'
import { getAccessToken } from '../auth/authenticationManager'
import { getApiBaseUrl } from '../config/appEnvironment'
import type { Session } from '@/types/models'
import type { SyncSessionPayload, RemoteSession } from '@/types/api'

const log = createLogger('Sync')

interface SyncQueue {
  sessions: SyncSessionPayload[]
}

let syncQueue: SyncQueue = { sessions: [] }
const BATCH_SIZE = 10

export function queueSession(session: Session): void {
  const payload: SyncSessionPayload = {
    originalId: session.id,
    title: session.title,
    startTime: session.startTime,
    endTime: session.endTime,
    transcript: session.transcript,
    summary: session.summary,
    actionItems: session.actionItems,
    modeId: session.modeId,
    deviceId: session.deviceId || '',
    version: 1,
    checksum: generateChecksum(session),
  }

  syncQueue.sessions.push(payload)
  log.info(`Session queued for sync: ${session.id}`)

  // Persist queue
  saveQueue()
}

export async function uploadPendingSessions(): Promise<void> {
  if (syncQueue.sessions.length === 0) return

  const token = await getAccessToken()
  const baseUrl = getApiBaseUrl()

  // Upload in batches
  while (syncQueue.sessions.length > 0) {
    const batch = syncQueue.sessions.splice(0, BATCH_SIZE)

    try {
      const response = await fetch(`${baseUrl}/api/sync/sessions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ sessions: batch }),
      })

      if (!response.ok) {
        // Put back in queue on failure
        syncQueue.sessions.unshift(...batch)
        log.error(`Upload failed: ${response.status}`)
        break
      }

      const result = await response.json()
      log.info(`Uploaded ${result.uploaded} sessions`)
    } catch (error) {
      syncQueue.sessions.unshift(...batch)
      log.error('Upload error', error)
      break
    }
  }

  saveQueue()
}

export async function pullRemoteSessions(): Promise<RemoteSession[]> {
  try {
    const token = await getAccessToken()
    const baseUrl = getApiBaseUrl()

    const response = await fetch(`${baseUrl}/api/sync/sessions?allDevices=true`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })

    if (!response.ok) {
      log.error(`Pull failed: ${response.status}`)
      return []
    }

    const data = await response.json()
    return data.sessions || []
  } catch (error) {
    log.error('Pull error', error)
    return []
  }
}

export async function reconcileRemoteDeletions(): Promise<void> {
  const remoteSessions = await pullRemoteSessions()
  const deletedIds = remoteSessions
    .filter((s) => s.deletedAt !== null)
    .map((s) => s.originalId)

  if (deletedIds.length > 0) {
    log.info(`Found ${deletedIds.length} remotely deleted sessions`)
  }
}

export async function performInitialSync(): Promise<void> {
  log.info('Performing initial sync...')
  await uploadPendingSessions()
  await reconcileRemoteDeletions()
  log.info('Initial sync complete')
}

function generateChecksum(session: Session): string {
  // Simple checksum based on content
  const content = session.title + session.transcript + (session.summary || '')
  let hash = 0
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash = hash & hash // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(16)
}

function saveQueue(): void {
  window.electronAPI?.store.set('sync_queue', JSON.stringify(syncQueue))
}

export async function loadQueue(): Promise<void> {
  const saved = (await window.electronAPI?.store.get('sync_queue')) as string | null
  if (saved) {
    try {
      syncQueue = JSON.parse(saved)
    } catch {
      syncQueue = { sessions: [] }
    }
  }
}
