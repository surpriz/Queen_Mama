import { proxyApiClient } from '@/services/proxy/proxyApiClient'
import { authTokenStore } from '@/services/auth/authTokenStore'

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

      const token = await authTokenStore.getAccessToken()
      if (!token) return

      // Send in batches of 10
      const batchSize = 10
      const batches: FeedbackItem[][] = []
      for (let i = 0; i < queue.length; i += batchSize) {
        batches.push(queue.slice(i, i + batchSize))
      }

      const succeeded: string[] = []

      for (const batch of batches) {
        try {
          await proxyApiClient.fetchWithAuth('/api/sync/feedback', {
            method: 'POST',
            body: JSON.stringify({ feedback: batch }),
          })
          succeeded.push(...batch.map((f) => f.id))
        } catch (error) {
          console.error('[FeedbackSync] Batch failed:', error)
          break
        }
      }

      // Remove succeeded items from queue
      if (succeeded.length > 0) {
        const remaining = queue.filter((f) => !succeeded.includes(f.id))
        saveQueue(remaining)
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
