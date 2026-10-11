import { createLogger } from '@/lib/logger'
import type { TranscriptionProvider, TranscriptionProviderType } from './types'
import { DeepgramProvider } from './deepgramProvider'
import { AssemblyAIProvider } from './assemblyAIProvider'
import { DeepgramFluxProvider } from './deepgramFluxProvider'
import { useConfigStore } from '@/stores/configStore'
import { captureError, addBreadcrumb } from '../crash/crashReporter'

const log = createLogger('Transcription')

const MAX_RECONNECT_ATTEMPTS = 8
const BASE_DELAY = 3000 // 3 seconds (matches macOS)
const MAX_DELAY = 60000 // 60 seconds
const MAX_RECONNECTS_IN_WINDOW = 20
const RECONNECT_WINDOW_DURATION = 600000 // 10 minutes in ms
const AUTO_RECOVERY_INTERVAL = 60000 // 60 seconds
const MAX_AUTO_RECOVERY_ATTEMPTS = 5 // matches macOS — then give up until next session
const STABILITY_CHECK_DELAY = 30000 // connection must survive 30s before budgets reset

// Audio batching config (aligned with macOS 2026-03-23 optimizations)
const BATCH_INTERVAL = 150 // ms (reduced from 400ms)
const MAX_BATCH_SIZE = 16000 // bytes (~0.5s at 16kHz mono, reduced from 32KB)

let currentProvider: TranscriptionProvider | null = null
let currentProviderType: TranscriptionProviderType | null = null
let isConnected = false
let isReconnecting = false
let reconnectAttempts = 0
let intentionalDisconnect = false
let reconnectTimestamps: number[] = [] // Sliding window budget
let autoRecoveryTimer: ReturnType<typeof setInterval> | null = null
let autoRecoveryCountdown = 0
let autoRecoveryAttempts = 0
let stabilityTimer: ReturnType<typeof setTimeout> | null = null
// Cancellable backoff sleeps (mic + system reconnects): stopping a session must
// abort a pending reconnect instead of letting it wake up and tear down the
// *next* session's provider.
const pendingSleeps = new Set<{ timer: ReturnType<typeof setTimeout>; wake: () => void }>()
// Reported to Sentry at most once per session (was: every retry)
let allProvidersFailedReported = false

// Audio batching state (one-shot timers: nothing fires while no audio flows)
let batchBuffer: ArrayBuffer[] = []
let batchBufferSize = 0
let batchTimer: ReturnType<typeof setTimeout> | null = null

// Diagnostic counters
let audioChunksReceived = 0
let audioBytesSent = 0
let lastDiagnosticLog = 0

let onTranscript: ((text: string) => void) | null = null
let onInterimTranscript: ((text: string) => void) | null = null
let onDiarizedTranscript: ((text: string, speaker: number) => void) | null = null
let onError: ((error: Error) => void) | null = null
let onConnectionChanged: ((connected: boolean, provider: string | null) => void) | null = null
let onReconnectionBudgetExhausted: ((countdown: number) => void) | null = null

// System audio callbacks (dual-stream diarization)
let onSystemTranscript: ((text: string) => void) | null = null
let onSystemInterimTranscript: ((text: string) => void) | null = null

const providers: TranscriptionProvider[] = [
  new DeepgramProvider(),       // Primary: WS proxy (API key stays on server)
  new DeepgramFluxProvider(),   // Fallback 1: Direct Deepgram connection
  new AssemblyAIProvider(),     // Fallback 2
]

// System audio provider (second Deepgram WebSocket for "Interlocuteur" stream)
let systemProvider: DeepgramProvider | DeepgramFluxProvider | null = null
let isSystemConnected = false
let isSystemReconnecting = false
let systemReconnectAttempts = 0
const MAX_SYSTEM_RECONNECT_ATTEMPTS = 8
let systemBatchBuffer: ArrayBuffer[] = []
let systemBatchBufferSize = 0
let systemBatchTimer: ReturnType<typeof setTimeout> | null = null
let reconnectCount = 0 // per session, for health reporting

// Track providers that returned 403 (not available for plan) to avoid retrying
const unavailableProviders = new Set<string>()

function setupProviderCallbacks(provider: TranscriptionProvider): void {
  provider.onTranscript = (text) => {
    onTranscript?.(text)
  }
  provider.onInterimTranscript = (text) => {
    onInterimTranscript?.(text)
  }
  // Wire diarization callback for any provider that exposes it (DeepgramProvider, DeepgramFluxProvider)
  if ('onDiarizedTranscript' in provider) {
    (provider as { onDiarizedTranscript: ((text: string, speaker: number) => void) | null }).onDiarizedTranscript = (text: string, speaker: number) => {
      onDiarizedTranscript?.(text, speaker)
    }
  }
  provider.onError = (error) => {
    // A provider that lost the connect race (or an old one we already replaced)
    // must not trigger a reconnect that replaces the working provider.
    if (currentProvider !== provider) {
      log.warn(`Ignoring error from inactive provider ${provider.name}: ${error.message}`)
      return
    }
    log.error(`Provider error: ${error.message}`)
    addBreadcrumb('transcription', `Provider ${provider.name} error: ${error.message}`, 'error')
    isConnected = false
    onConnectionChanged?.(false, null)
    onError?.(error)

    if (!intentionalDisconnect && !isReconnecting) {
      attemptReconnect()
    }
  }
}

export function setCallbacks(callbacks: {
  onTranscript?: (text: string) => void
  onInterimTranscript?: (text: string) => void
  onDiarizedTranscript?: (text: string, speaker: number) => void
  onSystemTranscript?: (text: string) => void
  onSystemInterimTranscript?: (text: string) => void
  onError?: (error: Error) => void
  onConnectionChanged?: (connected: boolean, provider: string | null) => void
  onReconnectionBudgetExhausted?: (countdown: number) => void
}): void {
  onTranscript = callbacks.onTranscript || null
  onInterimTranscript = callbacks.onInterimTranscript || null
  onDiarizedTranscript = callbacks.onDiarizedTranscript || null
  onSystemTranscript = callbacks.onSystemTranscript || null
  onSystemInterimTranscript = callbacks.onSystemInterimTranscript || null
  onError = callbacks.onError || null
  onConnectionChanged = callbacks.onConnectionChanged || null
  onReconnectionBudgetExhausted = callbacks.onReconnectionBudgetExhausted || null
}

/**
 * Reset intentional disconnect flag — must be called before connect() when starting a new session.
 * This is the only place the reconnection budgets are reset: `connect()` is also
 * used by retries, and resetting there made the 8-attempt cap / 10-min window
 * unreachable (backoff never grew past ~3–4.5 s, auto-recovery never ran).
 */
export function resetDisconnectFlag(): void {
  intentionalDisconnect = false
  autoRecoveryAttempts = 0 // fresh session = fresh recovery budget
  reconnectAttempts = 0
  reconnectTimestamps = []
  reconnectCount = 0
  allProvidersFailedReported = false
}

/** Number of reconnections performed during the current session (health reporting). */
export function getReconnectCount(): number {
  return reconnectCount
}

/** Explicitly set Deepgram diarization for the next connection (never sticks across sessions). */
export function setDiarization(enabled: boolean): void {
  for (const p of providers) {
    if (p instanceof DeepgramProvider || p instanceof DeepgramFluxProvider) {
      p.diarize = enabled
    }
  }
  log.info(`Diarization ${enabled ? 'enabled (single-stream fallback)' : 'disabled (dual-stream)'}`)
}

export async function connect(): Promise<void> {
  if (intentionalDisconnect) {
    log.info('Connect skipped: intentional disconnect active')
    return
  }

  log.info('Connecting to transcription service...')
  audioChunksReceived = 0
  audioBytesSent = 0
  lastDiagnosticLog = Date.now()

  if (currentProvider) {
    currentProvider.disconnect()
    currentProvider = null
  }
  stopAutoRecovery()

  // Set language from user config on all providers
  const language = useConfigStore.getState().primaryLanguage || 'multi'
  for (const p of providers) {
    p.language = language
  }
  log.info(`Language set to: ${language}`)

  const configuredProviders = providers.filter((p) => p.isConfigured && !unavailableProviders.has(p.name))
  const skippedProviders = providers.filter((p) => !p.isConfigured || unavailableProviders.has(p.name))
  log.info(`Available providers: [${configuredProviders.map(p => p.name).join(', ')}] | Skipped: [${skippedProviders.map(p => `${p.name}(configured=${p.isConfigured},unavail=${unavailableProviders.has(p.name)})`).join(', ')}]`)
  let lastError: Error | null = null

  for (const provider of configuredProviders) {
    try {
      log.info(`Trying provider: ${provider.name}`)
      setupProviderCallbacks(provider)
      await provider.connect()

      // Session stopped while we were connecting → don't leak the socket
      if (intentionalDisconnect) {
        log.info('Connect completed after stop; closing provider')
        provider.disconnect()
        return
      }

      currentProvider = provider
      currentProviderType = provider.name.toLowerCase().includes('assemblyai')
        ? 'assemblyai'
        : provider.name.toLowerCase().includes('flux')
          ? 'deepgram-flux'
          : 'deepgram'
      isConnected = true
      onConnectionChanged?.(true, provider.name)

      log.info(`Connected with ${provider.name}`)
      return
    } catch (error) {
      const errMsg = (error as Error)?.message || ''
      // Track 403 providers to avoid retrying them on reconnect
      if (errMsg.includes('403')) {
        log.warn(`Provider ${provider.name} not available for plan, skipping in future attempts`)
        unavailableProviders.add(provider.name)
      } else {
        log.warn(`Provider ${provider.name} failed: ${errMsg}`)
      }
      lastError = error as Error
    }
  }

  isConnected = false
  onConnectionChanged?.(false, null)
  const finalError = lastError || new Error('All transcription providers failed')
  if (!allProvidersFailedReported) {
    allProvidersFailedReported = true
    captureError(finalError, {
      service: 'transcription',
      phase: 'all_providers_failed',
      unavailable: Array.from(unavailableProviders),
    })
  }
  throw finalError
}

function cancelPendingReconnect(): void {
  for (const entry of pendingSleeps) {
    clearTimeout(entry.timer)
    entry.wake()
  }
  pendingSleeps.clear()
}

function reconnectSleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    const entry = {
      timer: setTimeout(() => {
        pendingSleeps.delete(entry)
        resolve()
      }, ms),
      wake: resolve,
    }
    pendingSleeps.add(entry)
  })
}

export function disconnect(): void {
  log.info('Disconnecting...')
  intentionalDisconnect = true

  // Flush any remaining batched audio before disconnecting
  flushBatch()
  stopBatchTimer()
  stopAutoRecovery()
  cancelPendingReconnect()
  if (stabilityTimer) {
    clearTimeout(stabilityTimer)
    stabilityTimer = null
  }
  autoRecoveryAttempts = 0

  // Disconnect system audio too
  disconnectSystemAudio()

  currentProvider?.disconnect()
  currentProvider = null
  currentProviderType = null
  isConnected = false
  isReconnecting = false
  reconnectTimestamps = []
  batchBuffer = []
  batchBufferSize = 0
  unavailableProviders.clear() // Reset on full disconnect so providers are retried on next session
  onConnectionChanged?.(false, null)
}

export function flushBatch(): void {
  if (batchBuffer.length === 0 || !isConnected || !currentProvider) return

  // Concatenate all buffered ArrayBuffers into a single one
  const totalSize = batchBufferSize
  const merged = new Uint8Array(totalSize)
  let offset = 0
  for (const buf of batchBuffer) {
    merged.set(new Uint8Array(buf), offset)
    offset += buf.byteLength
  }

  batchBuffer = []
  batchBufferSize = 0

  currentProvider.sendAudio(merged.buffer)
  audioBytesSent += totalSize

  // Log diagnostics every 5 seconds
  const now = Date.now()
  if (now - lastDiagnosticLog > 5000) {
    log.info(`[Diag] chunks=${audioChunksReceived}, bytesSent=${audioBytesSent}, provider=${currentProvider?.name}, connected=${isConnected}`)
    lastDiagnosticLog = now
  }
}

function scheduleBatchFlush(): void {
  if (batchTimer) return
  batchTimer = setTimeout(() => {
    batchTimer = null
    flushBatch()
  }, BATCH_INTERVAL)
}

function stopBatchTimer(): void {
  if (batchTimer) {
    clearTimeout(batchTimer)
    batchTimer = null
  }
}

export function sendAudio(data: ArrayBuffer): void {
  if (!isConnected || !currentProvider) return

  audioChunksReceived++
  batchBuffer.push(data)
  batchBufferSize += data.byteLength

  // Flush immediately if batch exceeds max size, otherwise on the next tick
  if (batchBufferSize >= MAX_BATCH_SIZE) {
    stopBatchTimer()
    flushBatch()
  } else {
    scheduleBatchFlush()
  }
}

async function attemptReconnect(): Promise<void> {
  if (isReconnecting) return
  isReconnecting = true

  const now = Date.now()

  // Record this reconnection attempt in the sliding window
  reconnectTimestamps.push(now)
  // Prune old entries outside the window
  reconnectTimestamps = reconnectTimestamps.filter(
    (ts) => now - ts < RECONNECT_WINDOW_DURATION
  )

  // Check sliding window budget
  if (reconnectTimestamps.length > MAX_RECONNECTS_IN_WINDOW) {
    log.warn(`Reconnection budget exhausted: ${reconnectTimestamps.length} reconnections in ${RECONNECT_WINDOW_DURATION / 1000}s window`)
    isReconnecting = false
    startAutoRecovery()
    return
  }

  reconnectAttempts++

  // Check linear attempt limit
  if (reconnectAttempts > MAX_RECONNECT_ATTEMPTS) {
    log.warn('Max reconnection attempts reached')
    isReconnecting = false
    startAutoRecovery()
    return
  }

  // Exponential backoff with proportional jitter (0-50% of delay, matches macOS)
  const exponentialDelay = Math.min(MAX_DELAY, BASE_DELAY * Math.pow(2, reconnectAttempts - 1))
  const jitter = Math.random() * 0.5 * exponentialDelay
  const delay = exponentialDelay + jitter
  log.info(`Reconnecting in ${Math.round(delay)}ms (attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS}, window: ${reconnectTimestamps.length}/${MAX_RECONNECTS_IN_WINDOW})`)

  await reconnectSleep(delay)

  // Check if session was stopped during the sleep
  if (intentionalDisconnect) {
    log.info('Reconnection cancelled: session was stopped')
    isReconnecting = false
    return
  }

  try {
    await connect()
    isReconnecting = false
    reconnectAttempts = 0 // Reset linear counter on success (keep window history)
    reconnectCount++
    log.info('Reconnected successfully')
  } catch {
    isReconnecting = false
    if (!intentionalDisconnect) {
      attemptReconnect()
    }
  }
}

function startAutoRecovery(): void {
  if (autoRecoveryTimer) return

  // Cap recovery cycles (matches macOS): after that, stay down until the user
  // restarts the session. countdown=-1 signals permanent failure to the UI.
  if (autoRecoveryAttempts >= MAX_AUTO_RECOVERY_ATTEMPTS) {
    log.warn(`Auto-recovery exhausted (${MAX_AUTO_RECOVERY_ATTEMPTS} attempts), giving up`)
    captureError(new Error('Transcription auto-recovery exhausted'), {
      service: 'transcription',
      phase: 'auto_recovery_exhausted',
      attempts: autoRecoveryAttempts,
    })
    onReconnectionBudgetExhausted?.(-1)
    return
  }

  autoRecoveryAttempts++
  autoRecoveryCountdown = AUTO_RECOVERY_INTERVAL / 1000
  log.info(`Starting auto-recovery ${autoRecoveryAttempts}/${MAX_AUTO_RECOVERY_ATTEMPTS}: retrying in ${autoRecoveryCountdown}s`)
  // Fired once per cycle (not every second) so the UI can show a single banner/toast
  onReconnectionBudgetExhausted?.(autoRecoveryCountdown)

  autoRecoveryTimer = setInterval(async () => {
    autoRecoveryCountdown--

    if (autoRecoveryCountdown <= 0) {
      stopAutoRecovery()

      // Reset budgets and retry
      reconnectAttempts = 0
      reconnectTimestamps = []
      log.info('Auto-recovery: resetting budgets and retrying connection')

      try {
        await connect()
        log.info('Auto-recovery: reconnected successfully')
        scheduleStabilityCheck()
      } catch {
        log.warn('Auto-recovery: reconnection failed, restarting countdown')
        startAutoRecovery()
      }
    }
  }, 1000)
}

function stopAutoRecovery(): void {
  if (autoRecoveryTimer) {
    clearInterval(autoRecoveryTimer)
    autoRecoveryTimer = null
  }
  autoRecoveryCountdown = 0
}

/** Reset the auto-recovery budget only after the connection stays up for 30s,
 *  so rapid connect→drop cycles can't bypass the recovery cap. */
function scheduleStabilityCheck(): void {
  if (stabilityTimer) clearTimeout(stabilityTimer)
  stabilityTimer = setTimeout(() => {
    stabilityTimer = null
    if (isConnected) {
      log.info('Connection stable for 30s, resetting auto-recovery budget')
      autoRecoveryAttempts = 0
    }
  }, STABILITY_CHECK_DELAY)
}

export function getIsConnected(): boolean {
  return isConnected
}

/**
 * User-initiated "Retry now" from the overlay banner: skip the remaining
 * auto-recovery countdown / exhausted state and try the providers again.
 */
export async function retryNow(): Promise<void> {
  if (intentionalDisconnect) return
  if (isConnected) return
  stopAutoRecovery()
  cancelPendingReconnect()
  isReconnecting = false
  reconnectAttempts = 0
  reconnectTimestamps = []
  autoRecoveryAttempts = 0
  log.info('Manual retry requested')
  await connect()
  scheduleStabilityCheck()
}

export function getCurrentProviderType(): TranscriptionProviderType | null {
  return currentProviderType
}

export function getAutoRecoveryCountdown(): number {
  return autoRecoveryCountdown
}

/** @deprecated use setDiarization(true); kept for callers that predate per-session reset */
export function enableDiarization(): void {
  setDiarization(true)
}

// ============================================================
// SYSTEM AUDIO — Second Deepgram WebSocket ("Interlocuteur")
// ============================================================

/** Connect a second Deepgram WebSocket for system audio transcription.
 *  Mirrors whichever provider class is currently active for the mic stream so
 *  the system stream uses the same auth path (proxy or direct). */
export async function connectSystemAudio(): Promise<void> {
  try {
    log.info('Connecting system audio WebSocket...')
    const sysProvider: DeepgramProvider | DeepgramFluxProvider =
      currentProvider instanceof DeepgramFluxProvider
        ? new DeepgramFluxProvider()
        : new DeepgramProvider()
    log.info(`System audio provider: ${sysProvider.name}`)
    const language = useConfigStore.getState().primaryLanguage || 'multi'
    sysProvider.language = language

    sysProvider.onTranscript = (text) => {
      log.info(`System audio transcript: "${text.substring(0, 80)}"`)
      onSystemTranscript?.(text)
    }
    sysProvider.onInterimTranscript = (text) => {
      onSystemInterimTranscript?.(text)
    }
    sysProvider.onError = (error) => {
      log.warn(`System audio error: ${error.message}`)
      isSystemConnected = false
      // Without this, a mid-session drop silently kills "Interlocuteur" transcripts
      // for the rest of the meeting.
      if (!intentionalDisconnect) {
        void attemptSystemReconnect()
      }
    }

    await sysProvider.connect()
    if (intentionalDisconnect) {
      log.info('System audio connected after stop; closing')
      sysProvider.disconnect()
      return
    }
    systemProvider = sysProvider
    isSystemConnected = true
    // Reset the reconnect budget only after 30s of stability so rapid
    // connect→drop flapping can't retry forever on a 3s cycle.
    setTimeout(() => {
      if (isSystemConnected) systemReconnectAttempts = 0
    }, STABILITY_CHECK_DELAY)

    log.info('System audio WebSocket connected')
  } catch (error) {
    log.warn(`System audio connection failed (continuing without): ${(error as Error).message}`)
    systemProvider = null
    isSystemConnected = false
  }
}

/** Reconnect the system audio WebSocket with exponential backoff after a mid-session drop. */
async function attemptSystemReconnect(): Promise<void> {
  if (isSystemReconnecting) return
  isSystemReconnecting = true

  try {
    while (!intentionalDisconnect && !isSystemConnected) {
      systemReconnectAttempts++
      if (systemReconnectAttempts > MAX_SYSTEM_RECONNECT_ATTEMPTS) {
        log.warn('System audio: max reconnection attempts reached — "Interlocuteur" stream stays offline')
        captureError(new Error('System audio reconnection exhausted'), {
          service: 'transcription',
          phase: 'system_audio_reconnect_exhausted',
          attempts: systemReconnectAttempts,
        })
        return
      }

      const exponentialDelay = Math.min(MAX_DELAY, BASE_DELAY * Math.pow(2, systemReconnectAttempts - 1))
      const delay = exponentialDelay + Math.random() * 0.5 * exponentialDelay
      log.info(`System audio: reconnecting in ${Math.round(delay)}ms (attempt ${systemReconnectAttempts}/${MAX_SYSTEM_RECONNECT_ATTEMPTS})`)
      await reconnectSleep(delay)

      if (intentionalDisconnect) return

      // Tear down the dead provider before recreating it
      if (systemBatchTimer) {
        clearTimeout(systemBatchTimer)
        systemBatchTimer = null
      }
      systemProvider?.disconnect()
      systemProvider = null
      systemBatchBuffer = []
      systemBatchBufferSize = 0

      await connectSystemAudio() // swallows errors; success sets isSystemConnected
      if (isSystemConnected) {
        log.info('System audio: reconnected successfully')
        return
      }
    }
  } finally {
    isSystemReconnecting = false
  }
}

/** Disconnect the system audio WebSocket */
export function disconnectSystemAudio(): void {
  log.info('Disconnecting system audio...')
  flushSystemBatch()
  if (systemBatchTimer) {
    clearTimeout(systemBatchTimer)
    systemBatchTimer = null
  }
  systemProvider?.disconnect()
  systemProvider = null
  isSystemConnected = false
  systemBatchBuffer = []
  systemBatchBufferSize = 0
}

/** Send audio data to the system audio transcription WebSocket */
export function sendSystemAudio(data: ArrayBuffer): void {
  if (!isSystemConnected || !systemProvider) return

  systemBatchBuffer.push(data)
  systemBatchBufferSize += data.byteLength

  if (systemBatchBufferSize >= MAX_BATCH_SIZE) {
    if (systemBatchTimer) {
      clearTimeout(systemBatchTimer)
      systemBatchTimer = null
    }
    flushSystemBatch()
  } else if (!systemBatchTimer) {
    systemBatchTimer = setTimeout(() => {
      systemBatchTimer = null
      flushSystemBatch()
    }, BATCH_INTERVAL)
  }
}

/** Flush system audio batch */
export function flushSystemBatch(): void {
  if (systemBatchBuffer.length === 0 || !isSystemConnected || !systemProvider) return

  const totalSize = systemBatchBufferSize
  const merged = new Uint8Array(totalSize)
  let offset = 0
  for (const buf of systemBatchBuffer) {
    merged.set(new Uint8Array(buf), offset)
    offset += buf.byteLength
  }

  systemBatchBuffer = []
  systemBatchBufferSize = 0
  systemProvider.sendAudio(merged.buffer)
}

/** Get system audio connection state */
export function getIsSystemConnected(): boolean {
  return isSystemConnected
}

/** Test hook: the active mic provider (undefined when disconnected). */
export function __test_getProvider(): TranscriptionProvider | undefined {
  return currentProvider ?? undefined
}
