/**
 * Buffered pre-generation (port of mac_app PreGenerationService.swift).
 *
 * Silently generates an Assist response in the background after detecting
 * sentence completion or silence, so the response appears instantly when the
 * user triggers Assist. Enterprise-only (Feature.BufferedPreGen) and gated by
 * the `instantResponsesEnabled` user toggle.
 *
 * Pre-generation bypasses usage counting and the response cache — it is a
 * speculative request whose result is only "paid for" (counted) on consume.
 */
import { createLogger } from '@/lib/logger'
import { useConfigStore } from '@/stores/configStore'
import { useLicenseStore } from '@/stores/licenseStore'
import { Feature } from '@/types/auth'
import * as proxyApi from '../proxy/proxyApiClient'
import { buildSystemPrompt, buildUserMessage } from './aiContext'
import { screenCaptureService } from '../screenCapture/screenCaptureService'
import { getIsProcessing } from './aiService'
import type { AIMessage } from '@/types/api'
import type { Mode, ResponseType } from '@/types/models'

const log = createLogger('PreGen')

// Configuration (mirrors macOS values)
const WORD_TRIGGER_COUNT = 20 // new words before triggering
const SILENCE_THRESHOLD_MS = 2000 // silence backup trigger (with ≥1 word)
const COOLDOWN_MS = 10000 // between triggers
const STALE_THRESHOLD = 200 // chars of transcript growth before a ready buffer is stale
const SILENCE_TIMER_MAX_MS = 30000 // auto-stop polling
const RESTART_WORD_THRESHOLD = 10 // new words during generation that force a restart
const MAX_TOKENS = 600 // aligned with manual Assist

type State =
  | { kind: 'idle' }
  | { kind: 'generating'; generationId: number }
  | { kind: 'ready'; text: string }

let state: State = { kind: 'idle' }
let generationCounter = 0

let silenceTimer: ReturnType<typeof setInterval> | null = null
let silenceTimerStart = 0
let lastSpeechTime = 0
let wordsSinceLastTrigger = 0
let lastTriggeredTranscript = ''
let lastTriggerTime = 0
let transcriptLengthAtTrigger = 0
let lastTranscript = ''
let modeProvider: (() => Mode | null) | null = null

function isPreGenAvailable(): boolean {
  return (
    useConfigStore.getState().instantResponsesEnabled &&
    useLicenseStore.getState().isFeatureAvailable(Feature.BufferedPreGen)
  )
}

/** Inject the selected-mode getter (sessionLifecycle owns mode state). */
export function configure(getMode: () => Mode | null): void {
  modeProvider = getMode
}

/** Called on every transcript buffer flush with the full accumulated transcript. */
export function onTranscriptUpdated(fullTranscript: string): void {
  if (!isPreGenAvailable()) return

  const delta = fullTranscript.slice(lastTranscript.length)
  const newWords = countWords(delta)
  wordsSinceLastTrigger += newWords
  lastSpeechTime = Date.now()
  lastTranscript = fullTranscript

  // Invalidate stale buffer if transcript grew significantly
  if (state.kind === 'ready') {
    const growth = fullTranscript.length - transcriptLengthAtTrigger
    if (growth > STALE_THRESHOLD) {
      log.info(`Buffer invalidated — transcript grew by ${growth} chars`)
      state = { kind: 'idle' }
    }
  }

  // Cancel in-flight generation if significant new content arrived
  if (state.kind === 'generating' && newWords > RESTART_WORD_THRESHOLD) {
    log.info(`Restarting — ${newWords} new words during generation`)
    cancelGeneration()
  }

  // Word count trigger (fires DURING speech)
  if (wordsSinceLastTrigger >= WORD_TRIGGER_COUNT) {
    triggerPreGen(`${wordsSinceLastTrigger} words`)
  }

  // Silence timer as backup trigger
  if (wordsSinceLastTrigger >= 1 && state.kind === 'idle') {
    startSilenceTimer()
  } else if (state.kind === 'ready') {
    stopSilenceTimer()
  }
}

/**
 * Consume the pre-generated response. Returns null if not ready, not available,
 * or stale. Resets to idle after consumption.
 */
export function consumeBuffer(): string | null {
  if (!isPreGenAvailable()) {
    if (state.kind === 'ready') state = { kind: 'idle' }
    return null
  }
  if (state.kind !== 'ready') return null

  const growth = lastTranscript.length - transcriptLengthAtTrigger
  if (growth > STALE_THRESHOLD) {
    log.info('Buffer stale on consume — discarding')
    state = { kind: 'idle' }
    return null
  }

  const text = state.text
  log.info(`Buffer consumed (${text.length} chars)`)
  state = { kind: 'idle' }
  wordsSinceLastTrigger = 0
  return text
}

/** Cancel any in-flight generation and reset to idle (e.g. on manual request). */
export function cancelAndReset(): void {
  cancelGeneration()
  stopSilenceTimer()
  state = { kind: 'idle' }
}

/** Full reset (called on session stop). */
export function reset(): void {
  cancelGeneration()
  stopSilenceTimer()
  state = { kind: 'idle' }
  lastSpeechTime = 0
  wordsSinceLastTrigger = 0
  lastTriggeredTranscript = ''
  lastTriggerTime = 0
  transcriptLengthAtTrigger = 0
  lastTranscript = ''
  log.info('Reset')
}

function triggerPreGen(reason: string): void {
  if (!isPreGenAvailable()) return
  if (!lastTranscript) return

  if (lastTriggerTime && Date.now() - lastTriggerTime < COOLDOWN_MS) {
    return
  }
  if (lastTranscript === lastTriggeredTranscript) {
    return
  }
  // Don't compete with a manual request in flight
  if (getIsProcessing()) {
    log.info('Skipped — manual AI request in flight')
    return
  }
  if (state.kind === 'ready') return

  log.info(`Triggering: ${reason}`)
  cancelGeneration()
  stopSilenceTimer()

  lastTriggeredTranscript = lastTranscript
  lastTriggerTime = Date.now()
  transcriptLengthAtTrigger = lastTranscript.length
  wordsSinceLastTrigger = 0

  const generationId = ++generationCounter
  state = { kind: 'generating', generationId }
  void generate(generationId, lastTranscript)
}

async function generate(generationId: number, transcript: string): Promise<void> {
  const isCancelled = () =>
    state.kind !== 'generating' || state.generationId !== generationId

  try {
    let screenshot: string | undefined
    if (useConfigStore.getState().autoScreenCapture) {
      screenshot = (await screenCaptureService.getCachedOrCapture()) ?? undefined
    }
    if (isCancelled()) return

    const params = {
      transcript,
      screenshot,
      mode: modeProvider?.() ?? null,
      responseType: 'Assist' as ResponseType,
    }
    const messages: AIMessage[] = [
      { role: 'system', content: buildSystemPrompt(params) },
      ...buildUserMessage(params),
    ]

    let accumulated = ''
    for await (const chunk of proxyApi.streamAIResponse({
      model: 'auto',
      messages,
      stream: true,
      max_tokens: MAX_TOKENS,
      cascadeMode: 'standard',
    })) {
      if (isCancelled()) return
      if (chunk.done) break
      accumulated += chunk.content
    }

    if (isCancelled()) return
    if (!accumulated) {
      log.info('Empty response — staying idle')
      state = { kind: 'idle' }
      return
    }

    state = { kind: 'ready', text: accumulated }
    log.info(`Ready (${accumulated.length} chars)`)
  } catch (err) {
    if (!isCancelled()) {
      log.warn(`Generation failed: ${err instanceof Error ? err.message : String(err)}`)
      state = { kind: 'idle' }
    }
  }
}

function cancelGeneration(): void {
  if (state.kind === 'generating') {
    state = { kind: 'idle' }
  }
}

function startSilenceTimer(): void {
  if (silenceTimer) return
  silenceTimerStart = Date.now()
  silenceTimer = setInterval(() => {
    if (!isPreGenAvailable()) {
      stopSilenceTimer()
      return
    }
    if (Date.now() - silenceTimerStart > SILENCE_TIMER_MAX_MS) {
      stopSilenceTimer()
      return
    }
    const silence = Date.now() - lastSpeechTime
    if (silence >= SILENCE_THRESHOLD_MS && wordsSinceLastTrigger >= 1) {
      stopSilenceTimer()
      triggerPreGen(`silence (${(silence / 1000).toFixed(1)}s)`)
    }
  }, 1000)
}

function stopSilenceTimer(): void {
  if (silenceTimer) {
    clearInterval(silenceTimer)
    silenceTimer = null
  }
}

function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length
}
