import { createLogger } from '@/lib/logger'
import type { TranscriptionProvider, TranscriptionProviderType } from './types'
import { DeepgramProvider } from './deepgramProvider'
import { AssemblyAIProvider } from './assemblyAIProvider'
import { DeepgramFluxProvider } from './deepgramFluxProvider'
import { sleep } from '@/lib/utils'
import { useConfigStore } from '@/stores/configStore'

const log = createLogger('Transcription')

const MAX_RECONNECT_ATTEMPTS = 5
const BASE_DELAY = 1000 // 1 second
const MAX_DELAY = 30000 // 30 seconds

// Audio batching config
const BATCH_INTERVAL = 400 // ms
const MAX_BATCH_SIZE = 32000 // bytes (~1s at 16kHz mono)

let currentProvider: TranscriptionProvider | null = null
let currentProviderType: TranscriptionProviderType | null = null
let isConnected = false
let isReconnecting = false
let reconnectAttempts = 0
let intentionalDisconnect = false

// Audio batching state
let batchBuffer: ArrayBuffer[] = []
let batchBufferSize = 0
let batchTimer: ReturnType<typeof setInterval> | null = null

let onTranscript: ((text: string) => void) | null = null
let onInterimTranscript: ((text: string) => void) | null = null
let onError: ((error: Error) => void) | null = null
let onConnectionChanged: ((connected: boolean, provider: string | null) => void) | null = null

const providers: TranscriptionProvider[] = [
  new DeepgramProvider(),
  new AssemblyAIProvider(),
  new DeepgramFluxProvider(),
]

function setupProviderCallbacks(provider: TranscriptionProvider): void {
  provider.onTranscript = (text) => {
    onTranscript?.(text)
  }
  provider.onInterimTranscript = (text) => {
    onInterimTranscript?.(text)
  }
  provider.onError = (error) => {
    log.error(`Provider error: ${error.message}`)
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
}): void {
  onTranscript = callbacks.onTranscript || null
  onInterimTranscript = callbacks.onInterimTranscript || null
  onError = callbacks.onError || null
  onConnectionChanged = callbacks.onConnectionChanged || null
}

export async function connect(): Promise<void> {
  log.info('Connecting to transcription service...')

  if (currentProvider) {
    currentProvider.disconnect()
    currentProvider = null
  }

  intentionalDisconnect = false
  reconnectAttempts = 0

  // Set language from user config on all providers
  const language = useConfigStore.getState().primaryLanguage || 'fr'
  for (const p of providers) {
    p.language = language
  }
  log.info(`Language set to: ${language}`)

  const configuredProviders = providers.filter((p) => p.isConfigured)
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
      log.warn(`Provider ${provider.name} failed`, error)
      lastError = error as Error
    }
  }

  isConnected = false
  onConnectionChanged?.(false, null)
  throw lastError || new Error('All transcription providers failed')
}

export function disconnect(): void {
  log.info('Disconnecting...')
  intentionalDisconnect = true

  // Flush any remaining batched audio before disconnecting
  flushBatch()
  stopBatchTimer()

  currentProvider?.disconnect()
  currentProvider = null
  currentProviderType = null
  isConnected = false
  isReconnecting = false
  batchBuffer = []
  batchBufferSize = 0
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
  reconnectAttempts++

  if (reconnectAttempts > MAX_RECONNECT_ATTEMPTS) {
    log.warn('Max reconnection attempts reached')
    isReconnecting = false
    return
  }

  // Exponential backoff with jitter
  const exponentialDelay = Math.min(MAX_DELAY, BASE_DELAY * Math.pow(2, reconnectAttempts))
  const jitter = Math.random() * 1000
  const delay = exponentialDelay + jitter
  log.info(`Reconnecting in ${Math.round(delay)}ms (attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS}, base delay: ${exponentialDelay}ms)`)

  await sleep(delay)

  try {
    await connect()
    isReconnecting = false
    log.info('Reconnected successfully')
  } catch {
    isReconnecting = false
    attemptReconnect()
  }
}

export function getIsConnected(): boolean {
  return isConnected
}

export function getCurrentProviderType(): TranscriptionProviderType | null {
  return currentProviderType
}
