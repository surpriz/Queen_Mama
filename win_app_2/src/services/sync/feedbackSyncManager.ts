import { getAccessToken } from '@/services/auth/authenticationManager'
import { getApiBaseUrl } from '@/services/config/appEnvironment'
import { createLogger } from '@/lib/logger'

const log = createLogger('FeedbackSync')

interface FeedbackItem {
  id: string
  responseId: string
  sessionId: string
  rating: 'positive' | 'negative'
  comment?: string
  timestamp: string
}

const STORAGE_KEY = 'feedback_sync_queue'
let isSyncing = false

function getQueue(): FeedbackItem[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored ? JSON.parse(stored) : []
  } catch {
    return []
  }
}

function saveQueue(queue: FeedbackItem[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(queue))
}

export const feedbackSyncManager = {
  queueFeedback(item: FeedbackItem): void {
    const queue = getQueue()
    queue.push(item)
    saveQueue(queue)
  },

  async sync(): Promise<void> {
    if (isSyncing) return
    isSyncing = true

    try {
      const queue = getQueue()
      if (queue.length === 0) return

      let token: string
      try {
        token = await getAccessToken()
      } catch {
        log.warn('Not authenticated, skipping sync')
        return
      }

      const baseUrl = getApiBaseUrl()

      // Send in batches of 10
      const batchSize = 10
      const batches: FeedbackItem[][] = []
      for (let i = 0; i < queue.length; i += batchSize) {
        batches.push(queue.slice(i, i + batchSize))
      }

      const succeeded: string[] = []

      for (const batch of batches) {
        try {
          const response = await fetch(`${baseUrl}/api/sync/feedback`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ feedback: batch }),
          })
          if (response.ok) {
            succeeded.push(...batch.map((f) => f.id))
          } else {
            log.error(`Batch failed: ${response.status}`)
            break
          }
        } catch (error) {
          log.error('Batch failed:', error)
          break
        }
      }

      // Remove succeeded items from queue
      if (succeeded.length > 0) {
        const remaining = queue.filter((f) => !succeeded.includes(f.id))
        saveQueue(remaining)
        log.info(`Synced ${succeeded.length} feedback items`)
      }
    } finally {
      isSyncing = false
    }
  },

  getPendingCount(): number {
    return getQueue().length
  },

  clearQueue(): void {
    saveQueue([])
  },
}
