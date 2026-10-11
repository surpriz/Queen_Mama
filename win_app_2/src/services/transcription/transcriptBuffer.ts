/**
 * TranscriptBuffer - Batches transcript updates to reduce UI redraws
 *
 * Accumulates transcript text and flushes on a per-instance interval
 * (mic 0.5 s, system audio 2 s — mac parity: fewer fragmented
 * "Interlocuteur" entries, fewer DeepL calls, fewer DB rows).
 * The timer only runs while there is pending text.
 */

import { createLogger } from '@/lib/logger'

const log = createLogger('TranscriptBuffer')

export const MIC_FLUSH_INTERVAL = 500 // ms
export const SYSTEM_FLUSH_INTERVAL = 2000 // ms

export class TranscriptBuffer {
  private pendingText = ''
  private flushTimer: ReturnType<typeof setTimeout> | null = null
  private onFlush: ((text: string) => void) | null = null
  private totalUpdates = 0
  private totalFlushes = 0
  private active = false

  constructor(private readonly flushInterval: number = MIC_FLUSH_INTERVAL) {}

  start(callback: (text: string) => void): void {
    this.onFlush = callback
    this.pendingText = ''
    this.totalUpdates = 0
    this.totalFlushes = 0
    this.active = true
  }

  stop(): void {
    // Force flush any remaining text
    this.flush()

    if (this.flushTimer) {
      clearTimeout(this.flushTimer)
      this.flushTimer = null
    }

    this.active = false
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
    if (this.active && !this.flushTimer) {
      this.flushTimer = setTimeout(() => {
        this.flushTimer = null
        this.flush()
      }, this.flushInterval)
    }
  }

  flush(): void {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer)
      this.flushTimer = null
    }
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

// Singleton instance (mic / "Moi" stream)
export const transcriptBuffer = new TranscriptBuffer(MIC_FLUSH_INTERVAL)
