/**
 * Dictation Service
 *
 * Uses Deepgram Nova-3 via WebSocket for speech-to-text dictation.
 * Can share the existing audio pipeline when a session is active,
 * or capture standalone mic audio when no session is running.
 */

import { createLogger } from '@/lib/logger'
import { getAccessToken } from '@/services/auth/authenticationManager'
import { getApiBaseUrl } from '@/services/config/appEnvironment'
import { useAppStore } from '@/stores/appStore'

const log = createLogger('Dictation')

// WebSocket proxy port (same as transcription service)
const PROXY_PORT = import.meta.env.VITE_TRANSCRIPTION_PROXY_PORT || 3001

// Keepalive interval (matches macOS and transcription service)
const KEEPALIVE_INTERVAL = 8000

export interface DictationState {
  isRecording: boolean
  interimText: string
  finalText: string
}

type DictationListener = (state: DictationState) => void

let ws: WebSocket | null = null
let keepaliveTimer: ReturnType<typeof setInterval> | null = null
let isRecording = false
let interimText = ''
let finalText = ''

// Standalone mic capture (used when no session is active)
let standaloneAudioContext: AudioContext | null = null
let standaloneMicStream: MediaStream | null = null
let standaloneWorkletNode: AudioWorkletNode | null = null
let standaloneMicSource: MediaStreamAudioSourceNode | null = null
let usingSharedAudio = false

// Listeners for state changes
const listeners = new Set<DictationListener>()

function getState(): DictationState {
  return { isRecording, interimText, finalText }
}

function notifyListeners(): void {
  const state = getState()
  for (const listener of listeners) {
    listener(state)
  }
}

export function subscribe(listener: DictationListener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

async function connectWebSocket(): Promise<void> {
  const authToken = await getAccessToken()

  const baseUrl = getApiBaseUrl()
  const url = new URL(baseUrl)
  const wsProtocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
  const host = url.hostname

  // Build proxy URL with Deepgram Nova-3 params for dictation
  const params = new URLSearchParams({
    token: authToken,
    model: 'nova-3',
    language: 'multi',
    smart_format: 'true',
    interim_results: 'true',
    punctuate: 'true',
    encoding: 'linear16',
    sample_rate: '16000',
    channels: '1',
    endpointing: '300',
    utterance_end_ms: '1000',
  })

  const proxyUrl = `${wsProtocol}//${host}:${PROXY_PORT}?${params.toString()}`
  log.info(`Connecting to dictation proxy at ${wsProtocol}//${host}:${PROXY_PORT}...`)

  return new Promise<void>((resolve, reject) => {
    const socket = new WebSocket(proxyUrl)
    ws = socket

    socket.onopen = () => {
      log.info('WebSocket connected')
      startKeepalive()
      resolve()
    }

    socket.onmessage = async (event) => {
      try {
        let textData: string
        if (event.data instanceof Blob) {
          textData = await event.data.text()
        } else {
          textData = event.data
        }

        const data = JSON.parse(textData)

        // Handle proxy-specific messages
        if (data.type === 'connected') {
          log.info('Proxy connected to Deepgram')
          return
        }
        if (data.type === 'error') {
          log.error('Proxy error:', data.message)
          return
        }

        // Handle Deepgram transcription results
        if (data.type === 'Results') {
          const transcript = data.channel?.alternatives?.[0]?.transcript || ''
          if (transcript.trim()) {
            if (data.is_final) {
              // Accumulate final text with space separator
              const separator = finalText.length > 0 ? ' ' : ''
              finalText = finalText + separator + transcript
              interimText = ''
              log.debug(`Final: "${transcript}"`)
            } else {
              // Show interim text (replaces previous interim)
              interimText = transcript
              log.debug(`Interim: "${transcript}"`)
            }
            notifyListeners()
          }
        }
      } catch (error) {
        log.error('Parse error', error)
      }
    }

    socket.onerror = (event: Event) => {
      const wsEvent = event as ErrorEvent
      log.error('WebSocket error:', wsEvent.message || 'Unknown error')
      reject(new Error('Dictation proxy connection failed'))
    }

    socket.onclose = (event) => {
      log.info(`Disconnected - code: ${event.code}, reason: "${event.reason}"`)
      stopKeepalive()

      // If still recording, it was an unexpected disconnect
      if (isRecording) {
        log.warn('Unexpected disconnect during recording')
        isRecording = false
        notifyListeners()
      }
    }
  })
}

function startKeepalive(): void {
  stopKeepalive()
  keepaliveTimer = setInterval(() => {
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'KeepAlive' }))
    }
  }, KEEPALIVE_INTERVAL)
}

function stopKeepalive(): void {
  if (keepaliveTimer) {
    clearInterval(keepaliveTimer)
    keepaliveTimer = null
  }
}

/**
 * Start standalone microphone capture for dictation.
 * Used when no session is active and we need our own audio pipeline.
 */
async function startStandaloneMicCapture(): Promise<void> {
  log.info('Starting standalone mic capture for dictation...')

  standaloneMicStream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
      channelCount: 1,
      sampleRate: { ideal: 48000 },
    },
  })

  standaloneAudioContext = new AudioContext({ sampleRate: 48000 })

  // Try AudioWorklet first, fall back to ScriptProcessor
  let useWorklet = true
  try {
    const workletUrl = new URL('../../../workers/audioProcessor.worklet.ts', import.meta.url).href
    await standaloneAudioContext.audioWorklet.addModule(workletUrl)
  } catch {
    log.warn('Worklet unavailable, using ScriptProcessor fallback')
    useWorklet = false
  }

  standaloneMicSource = standaloneAudioContext.createMediaStreamSource(standaloneMicStream)

  if (useWorklet) {
    standaloneWorkletNode = new AudioWorkletNode(standaloneAudioContext, 'audio-processor', {
      processorOptions: { sampleRate: standaloneAudioContext.sampleRate },
    })

    standaloneWorkletNode.port.onmessage = (event) => {
      const { type, pcm16 } = event.data
      if (type === 'audio') {
        sendAudio(pcm16)
      }
    }

    standaloneMicSource.connect(standaloneWorkletNode)
  } else {
    const bufferSize = 4096
    const scriptNode = standaloneAudioContext.createScriptProcessor(bufferSize, 1, 1)
    const inputSampleRate = standaloneAudioContext.sampleRate
    const targetSampleRate = 16000

    scriptNode.onaudioprocess = (event) => {
      const inputData = event.inputBuffer.getChannelData(0)
      const ratio = targetSampleRate / inputSampleRate
      const outputLength = Math.round(inputData.length * ratio)
      const pcm16 = new Int16Array(outputLength)

      for (let i = 0; i < outputLength; i++) {
        const srcIndex = i / ratio
        const srcFloor = Math.floor(srcIndex)
        const srcCeil = Math.min(srcFloor + 1, inputData.length - 1)
        const frac = srcIndex - srcFloor
        const sample = inputData[srcFloor] * (1 - frac) + inputData[srcCeil] * frac
        const clamped = Math.max(-1, Math.min(1, sample))
        pcm16[i] = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff
      }

      sendAudio(pcm16.buffer)
    }

    standaloneMicSource.connect(scriptNode)
    scriptNode.connect(standaloneAudioContext.destination)
  }

  log.info('Standalone mic capture started')
}

function stopStandaloneMicCapture(): void {
  standaloneWorkletNode?.disconnect()
  standaloneMicSource?.disconnect()
  standaloneMicStream?.getTracks().forEach((track) => track.stop())
  standaloneAudioContext?.close()

  standaloneWorkletNode = null
  standaloneMicSource = null
  standaloneMicStream = null
  standaloneAudioContext = null

  log.info('Standalone mic capture stopped')
}

/**
 * Start dictation recording.
 *
 * @param useSharedAudio - If true, uses the existing session audio pipeline
 *   (caller must route audio via sendAudio). If false or omitted, auto-detects:
 *   uses shared audio when a session is active, otherwise captures standalone mic.
 */
export async function startRecording(useSharedAudio?: boolean): Promise<void> {
  if (isRecording) {
    log.warn('Already recording')
    return
  }

  try {
    // Auto-detect: share audio if a session is active
    const sessionActive = useAppStore.getState().isSessionActive
    usingSharedAudio = useSharedAudio ?? sessionActive

    log.info(`Starting dictation (sharedAudio: ${usingSharedAudio})`)

    // Connect WebSocket to Deepgram
    await connectWebSocket()

    // Start standalone mic capture if not sharing audio
    if (!usingSharedAudio) {
      await startStandaloneMicCapture()
    }

    isRecording = true
    notifyListeners()

    log.info('Dictation recording started')
  } catch (error) {
    log.error('Failed to start dictation:', error)
    cleanup()
    throw error
  }
}

/**
 * Stop dictation recording.
 */
export function stopRecording(): void {
  if (!isRecording) return

  log.info('Stopping dictation...')
  cleanup()

  isRecording = false
  notifyListeners()

  log.info('Dictation recording stopped')
}

/**
 * Send audio data to the dictation WebSocket.
 * Used when sharing the existing session audio pipeline.
 */
export function sendAudio(data: ArrayBuffer): void {
  if (ws?.readyState === WebSocket.OPEN) {
    ws.send(data)
  }
}

/**
 * Reset the dictation state (clear all accumulated text).
 */
export function reset(): void {
  interimText = ''
  finalText = ''
  notifyListeners()
  log.debug('Dictation state reset')
}

/**
 * Get the current dictation state snapshot.
 */
export function getDictationState(): DictationState {
  return getState()
}

function cleanup(): void {
  // Close WebSocket
  stopKeepalive()
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'CloseStream' }))
    ws.close(1000)
  }
  ws = null

  // Stop standalone mic if we started one
  if (!usingSharedAudio) {
    stopStandaloneMicCapture()
  }
  usingSharedAudio = false
}

// Singleton instance (functional module pattern, consistent with transcription/audio services)
export const dictationService = {
  startRecording,
  stopRecording,
  sendAudio,
  reset,
  subscribe,
  getState: getDictationState,
}
