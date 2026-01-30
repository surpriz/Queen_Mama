import { createLogger } from '@/lib/logger'

const log = createLogger('AutoAnswer')

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
  silenceThreshold: 2.5,
  cooldown: 10,
  minWordsForSilence: 20,
  minWordsForQuestion: 10,
  minWordsForSentence: 50,
}

let config = { ...DEFAULT_CONFIG }
let lastTriggerTime = 0
let lastTranscriptLength = 0
let silenceStartTime = 0
let onTrigger: (() => void) | null = null

export function setConfig(newConfig: Partial<AutoAnswerConfig>): void {
  config = { ...config, ...newConfig }
}

export function setOnTrigger(callback: (() => void) | null): void {
  onTrigger = callback
}

export function onTranscriptReceived(fullTranscript: string): void {
  if (!config.enabled || !onTrigger) return

  const now = Date.now()

  // Cooldown check
  if (now - lastTriggerTime < config.cooldown * 1000) return

  const words = fullTranscript.trim().split(/\s+/).length
  const newContent = fullTranscript.length > lastTranscriptLength

  if (newContent) {
    lastTranscriptLength = fullTranscript.length
    silenceStartTime = now
  }

  const silenceDuration = (now - silenceStartTime) / 1000

  // Silence detection: no new content for threshold duration
  if (silenceDuration >= config.silenceThreshold && words >= config.minWordsForSilence) {
    log.info('Silence threshold reached, triggering')
    trigger()
    return
  }

  // Question detection: ends with "?" in last 100 chars
  const lastChunk = fullTranscript.slice(-100)
  if (lastChunk.includes('?') && words >= config.minWordsForQuestion) {
    log.info('Question detected, triggering')
    trigger()
    return
  }

  // Sentence completion: ends with "." or "!" with enough content
  const lastChar = fullTranscript.trim().slice(-1)
  if (
    (lastChar === '.' || lastChar === '!') &&
    words >= config.minWordsForSentence &&
    silenceDuration >= 1
  ) {
    log.info('Sentence completion detected, triggering')
    trigger()
  }
}

function trigger(): void {
  lastTriggerTime = Date.now()
  onTrigger?.()
}

export function reset(): void {
  lastTriggerTime = 0
  lastTranscriptLength = 0
  silenceStartTime = 0
}
