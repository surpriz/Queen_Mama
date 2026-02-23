/**
 * TranscriptBuffer - Batches transcript updates to reduce UI redraws
 *
 * Accumulates transcript text and flushes every 500ms,
 * reducing SwiftUI-equivalent re-renders by ~3-5x.
 * Matches macOS TranscriptBuffer behavior.
 */

import { createLogger } from '@/lib/logger'

const log = createLogger('TranscriptBuffer')

const FLUSH_INTERVAL = 500 // ms - matches macOS

export class TranscriptBuffer {
  private pendingText = ''
  private flushTimer: ReturnType<typeof setInterval> | null = null
  private onFlush: ((text: string) => void) | null = null
  private totalUpdates = 0
  private totalFlushes = 0

  start(callback: (text: string) => void): void {
    this.onFlush = callback
    this.pendingText = ''
    this.totalUpdates = 0
    this.totalFlushes = 0

    this.flushTimer = setInterval(() => {
      this.flush()
    }, FLUSH_INTERVAL)
  }

  stop(): void {
    // Force flush any remaining text
    this.flush()

    if (this.flushTimer) {
      clearInterval(this.flushTimer)
      this.flushTimer = null
    }

    this.onFlush = null

    if (this.totalFlushes > 0) {
      const ratio = (this.totalUpdates / this.totalFlushes).toFixed(1)
      log.info(`Session stats: ${this.totalUpdates} updates → ${this.totalFlushes} flushes (${ratio}x reduction)`)
    }
  }

  append(text: string): void {
    this.totalUpdates++
    const separator = this.pendingText.length > 0 ? ' ' : ''
    this.pendingText += separator + text
  }

  private flush(): void {
    if (this.pendingText.length === 0) return

    this.totalFlushes++
    const text = this.pendingText
    this.pendingText = ''
    this.onFlush?.(text)

    // Log batch ratio periodically
    if (this.totalFlushes % 20 === 0) {
      const ratio = (this.totalUpdates / this.totalFlushes).toFixed(1)
      log.info(`Batch ratio: ${ratio}x (${this.totalUpdates} updates → ${this.totalFlushes} flushes)`)
    }
  }
}

// Singleton instance
export const transcriptBuffer = new TranscriptBuffer()
