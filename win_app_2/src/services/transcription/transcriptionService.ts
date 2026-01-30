import { createLogger } from '@/lib/logger'
import type { TranscriptionProvider, TranscriptionProviderType } from './types'
import { DeepgramProvider } from './deepgramProvider'
import { AssemblyAIProvider } from './assemblyAIProvider'
import { DeepgramFluxProvider } from './deepgramFluxProvider'
import { sleep } from '@/lib/utils'

const log = createLogger('Transcription')

const MAX_RECONNECT_ATTEMPTS = 3

let currentProvider: TranscriptionProvider | null = null
let currentProviderType: TranscriptionProviderType | null = null
let isConnected = false
let isReconnecting = false
let reconnectAttempts = 0
let intentionalDisconnect = false

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
  currentProvider?.disconnect()
  currentProvider = null
  currentProviderType = null
  isConnected = false
  isReconnecting = false
  onConnectionChanged?.(false, null)
}

export function sendAudio(data: ArrayBuffer): void {
  if (!isConnected || !currentProvider) return
  currentProvider.sendAudio(data)
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

  const delay = reconnectAttempts * 2000
  log.info(`Reconnecting in ${delay}ms (attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`)

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
