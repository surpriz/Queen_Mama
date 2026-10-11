import { createLogger } from '@/lib/logger'

const log = createLogger('AutoAnswer')

/**
 * Auto-answer triggers (port of macOS `AutoAnswerService.swift`):
 *  - silence ≥ threshold with ≥ minWordsForSilence words, evaluated by a 0.5 s
 *    repeating timer (the old implementation only re-evaluated when a new
 *    transcript arrived, so "silence" could never be observed);
 *  - a "?" in the last 100 chars with ≥ minWordsForQuestion words;
 *  - sentence end (. or !) with ≥ minWordsForSentence words after 1 s of calm;
 *  - cooldown between triggers; a transcript hash prevents answering the same
 *    text twice; interim speech cancels a pending trigger.
 */

export interface AutoAnswerConfig {
  enabled: boolean
  silenceThreshold: number // seconds
  cooldown: number // seconds
  minWordsForSilence: number
  minWordsForQuestion: number
  minWordsForSentence: number
}

const DEFAULT_CONFIG: AutoAnswerConfig = {
  enabled: false,
  silenceThreshold: 2.0,
  cooldown: 10,
  minWordsForSilence: 20,
  minWordsForQuestion: 10,
  minWordsForSentence: 50,
}

const TICK_MS = 500
const SENTENCE_END_DELAY_S = 1

let config = { ...DEFAULT_CONFIG }
let lastTriggerTime = 0
let lastTranscript = ''
let lastContentAt = 0
let lastTriggeredHash = ''
let interimActive = false
let onTrigger: (() => void) | null = null
let timer: ReturnType<typeof setInterval> | null = null

function hash(text: string): string {
  // FNV-1a over the tail: cheap and good enough to dedup "same text twice"
  let h = 0x811c9dc5
  const tail = text.slice(-2000)
  for (let i = 0; i < tail.length; i++) {
    h ^= tail.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return `${tail.length}:${h.toString(16)}`
}

function wordCount(text: string): number {
  const trimmed = text.trim()
  return trimmed ? trimmed.split(/\s+/).length : 0
}

function startTimer(): void {
  if (timer) return
  timer = setInterval(evaluate, TICK_MS)
}

function stopTimer(): void {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
}

/** Live config: toggling Auto mid-session starts/stops monitoring immediately. */
export function setConfig(newConfig: Partial<AutoAnswerConfig>): void {
  const wasEnabled = config.enabled
  config = { ...config, ...newConfig }
  if (config.enabled && !wasEnabled) {
    log.info('Auto-answer enabled')
    if (onTrigger) startTimer()
  } else if (!config.enabled && wasEnabled) {
    log.info('Auto-answer disabled')
    stopTimer()
  }
}

export function setOnTrigger(callback: (() => void) | null): void {
  onTrigger = callback
  if (callback && config.enabled) startTimer()
  if (!callback) stopTimer()
}

/** Final transcript text changed. */
export function onTranscriptReceived(fullTranscript: string): void {
  if (fullTranscript !== lastTranscript) {
    lastTranscript = fullTranscript
    lastContentAt = Date.now()
  }
  interimActive = false
  if (config.enabled && onTrigger) evaluate(true)
}

/** Interim speech is arriving: the user is still talking, hold any pending trigger. */
export function onInterimTranscript(text: string): void {
  interimActive = text.trim().length > 0
  if (interimActive) lastContentAt = Date.now()
}

function evaluate(onNewContent = false): void {
  if (!config.enabled || !onTrigger) return
  if (!lastTranscript) return

  const now = Date.now()
  if (now - lastTriggerTime < config.cooldown * 1000) return
  if (interimActive) return

  const words = wordCount(lastTranscript)
  const calmSeconds = (now - lastContentAt) / 1000

  if (calmSeconds >= config.silenceThreshold && words >= config.minWordsForSilence) {
    trigger('silence')
    return
  }

  if (onNewContent) {
    const lastChunk = lastTranscript.slice(-100)
    if (lastChunk.includes('?') && words >= config.minWordsForQuestion) {
      trigger('question')
      return
    }
  }

  const lastChar = lastTranscript.trim().slice(-1)
  if ((lastChar === '.' || lastChar === '!') && words >= config.minWordsForSentence && calmSeconds >= SENTENCE_END_DELAY_S) {
    trigger('sentence end')
  }
}

function trigger(reason: string): void {
  const h = hash(lastTranscript)
  if (h === lastTriggeredHash) return // same text already answered
  lastTriggeredHash = h
  lastTriggerTime = Date.now()
  log.info(`Triggering (${reason})`)
  onTrigger?.()
}

/** Reset all state (called on session stop). */
export function reset(): void {
  stopTimer()
  lastTriggerTime = 0
  lastTranscript = ''
  lastContentAt = 0
  lastTriggeredHash = ''
  interimActive = false
}

/**
 * Record that a manual AI request was just made (e.g. the Assist tab).
 * Resets the cooldown so auto-answer won't fire right after, and marks the
 * current text as answered.
 */
export function recordManualTrigger(): void {
  lastTriggerTime = Date.now()
  lastTriggeredHash = hash(lastTranscript)
}
