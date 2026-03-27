import { createLogger } from '@/lib/logger'
import type { TranscriptionProvider, TranscriptionProviderType } from './types'
import { DeepgramProvider } from './deepgramProvider'
import { AssemblyAIProvider } from './assemblyAIProvider'
import { DeepgramFluxProvider } from './deepgramFluxProvider'
import { sleep } from '@/lib/utils'
import { useConfigStore } from '@/stores/configStore'
import { captureError, addBreadcrumb } from '../crash/crashReporter'

const log = createLogger('Transcription')

const MAX_RECONNECT_ATTEMPTS = 8
const BASE_DELAY = 3000 // 3 seconds (matches macOS)
const MAX_DELAY = 60000 // 60 seconds
const MAX_RECONNECTS_IN_WINDOW = 20
const RECONNECT_WINDOW_DURATION = 600000 // 10 minutes in ms
const AUTO_RECOVERY_INTERVAL = 60000 // 60 seconds

// Audio batching config
const BATCH_INTERVAL = 400 // ms
const MAX_BATCH_SIZE = 32000 // bytes (~1s at 16kHz mono)

let currentProvider: TranscriptionProvider | null = null
let currentProviderType: TranscriptionProviderType | null = null
let isConnected = false
let isReconnecting = false
let reconnectAttempts = 0
let intentionalDisconnect = false
let reconnectTimestamps: number[] = [] // Sliding window budget
let autoRecoveryTimer: ReturnType<typeof setInterval> | null = null
let autoRecoveryCountdown = 0

// Audio batching state
let batchBuffer: ArrayBuffer[] = []
let batchBufferSize = 0
let batchTimer: ReturnType<typeof setInterval> | null = null

// Diagnostic counters
let audioChunksReceived = 0
let audioBytesSent = 0
let lastDiagnosticLog = 0

let onTranscript: ((text: string) => void) | null = null
let onInterimTranscript: ((text: string) => void) | null = null
let onError: ((error: Error) => void) | null = null
let onConnectionChanged: ((connected: boolean, provider: string | null) => void) | null = null
let onReconnectionBudgetExhausted: ((countdown: number) => void) | null = null

const providers: TranscriptionProvider[] = [
  new DeepgramProvider(),       // Primary: WS proxy (API key stays on server)
  new DeepgramFluxProvider(),   // Fallback 1: Direct Deepgram connection
  new AssemblyAIProvider(),     // Fallback 2
]

// Track providers that returned 403 (not available for plan) to avoid retrying
const unavailableProviders = new Set<string>()

function setupProviderCallbacks(provider: TranscriptionProvider): void {
  provider.onTranscript = (text) => {
    onTranscript?.(text)
  }
  provider.onInterimTranscript = (text) => {
    onInterimTranscript?.(text)
  }
  provider.onError = (error) => {
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
  onError?: (error: Error) => void
  onConnectionChanged?: (connected: boolean, provider: string | null) => void
  onReconnectionBudgetExhausted?: (countdown: number) => void
}): void {
  onTranscript = callbacks.onTranscript || null
  onInterimTranscript = callbacks.onInterimTranscript || null
  onError = callbacks.onError || null
  onConnectionChanged = callbacks.onConnectionChanged || null
  onReconnectionBudgetExhausted = callbacks.onReconnectionBudgetExhausted || null
}

/**
 * Reset intentional disconnect flag — must be called before connect() when starting a new session
 */
export function resetDisconnectFlag(): void {
  intentionalDisconnect = false
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
  reconnectAttempts = 0
  reconnectTimestamps = []
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

      currentProvider = provider
      currentProviderType = provider.name.toLowerCase().includes('assemblyai')
        ? 'assemblyai'
        : provider.name.toLowerCase().includes('flux')
          ? 'deepgram-flux'
          : 'deepgram'
      isConnected = true
      onConnectionChanged?.(true, provider.name)

      // Start audio batch timer
      startBatchTimer()

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
  captureError(finalError, {
    service: 'transcription',
    phase: 'all_providers_failed',
    unavailable: Array.from(unavailableProviders),
  })
  throw finalError
}

export function disconnect(): void {
  log.info('Disconnecting...')
  intentionalDisconnect = true

  // Flush any remaining batched audio before disconnecting
  flushBatch()
  stopBatchTimer()
  stopAutoRecovery()

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

function flushBatch(): void {
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

function startBatchTimer(): void {
  stopBatchTimer()
  batchTimer = setInterval(() => {
    flushBatch()
  }, BATCH_INTERVAL)
}

function stopBatchTimer(): void {
  if (batchTimer) {
    clearInterval(batchTimer)
    batchTimer = null
  }
}

export function sendAudio(data: ArrayBuffer): void {
  if (!isConnected || !currentProvider) return

  audioChunksReceived++
  batchBuffer.push(data)
  batchBufferSize += data.byteLength

  // Flush immediately if batch exceeds max size
  if (batchBufferSize >= MAX_BATCH_SIZE) {
    flushBatch()
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

  await sleep(delay)

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

  autoRecoveryCountdown = AUTO_RECOVERY_INTERVAL / 1000
  log.info(`Starting auto-recovery: retrying in ${autoRecoveryCountdown}s`)
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
      } catch {
        log.warn('Auto-recovery: reconnection failed, restarting countdown')
        startAutoRecovery()
      }
    } else {
      onReconnectionBudgetExhausted?.(autoRecoveryCountdown)
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

export function getIsConnected(): boolean {
  return isConnected
}

export function getCurrentProviderType(): TranscriptionProviderType | null {
  return currentProviderType
}

export function getAutoRecoveryCountdown(): number {
  return autoRecoveryCountdown
}
