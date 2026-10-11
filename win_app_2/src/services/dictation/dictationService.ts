/**
 * Dictation Service
 *
 * Speech-to-text for the overlay input, via Deepgram Nova-3 over a direct
 * WebSocket (short-lived token from the backend, same path as the main
 * transcription provider — the old port-3001 proxy was never deployed).
 *
 * Runs in the hidden session window:
 *  - during a session it is fed the echo-cancelled mic stream by
 *    sessionLifecycle (`sendAudio`), so it hears exactly what Deepgram hears;
 *  - outside a session it opens its own mic capture.
 */

import { createLogger } from '@/lib/logger'
import { getTranscriptionToken } from '@/services/proxy/proxyApiClient'
import { useAppStore } from '@/stores/appStore'
import { PcmResampler } from '@/services/audio/resampler'
import workletUrl from '@/workers/audioProcessor.worklet.ts?worker&url'

const log = createLogger('Dictation')

const KEEPALIVE_INTERVAL = 8000
const CONNECT_TIMEOUT_MS = 10000

export interface DictationState {
  isRecording: boolean
  interimText: string
  finalText: string
  error: string | null
}

type DictationListener = (state: DictationState) => void

let ws: WebSocket | null = null
let keepaliveTimer: ReturnType<typeof setInterval> | null = null
let isRecording = false
let interimText = ''
let finalText = ''
let lastError: string | null = null

let standaloneAudioContext: AudioContext | null = null
let standaloneMicStream: MediaStream | null = null
let standaloneWorkletNode: AudioWorkletNode | null = null
let standaloneMicSource: MediaStreamAudioSourceNode | null = null
let standaloneScriptNode: ScriptProcessorNode | null = null
let usingSharedAudio = false

const listeners = new Set<DictationListener>()

function getState(): DictationState {
  return { isRecording, interimText, finalText, error: lastError }
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
  const { token } = await getTranscriptionToken('deepgram')

  const params = new URLSearchParams({
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
  const url = `wss://api.deepgram.com/v1/listen?${params.toString()}`
  log.info('Connecting to Deepgram for dictation...')

  return new Promise<void>((resolve, reject) => {
    let settled = false
    // Deepgram browser auth: Sec-WebSocket-Protocol subprotocol
    const socket = new WebSocket(url, ['token', token])
    ws = socket

    const timeout = setTimeout(() => {
      if (settled) return
      settled = true
      socket.close()
      reject(new Error('Dictation connection timed out'))
    }, CONNECT_TIMEOUT_MS)

    socket.onopen = () => {
      clearTimeout(timeout)
      if (settled) return
      settled = true
      log.info('WebSocket connected')
      startKeepalive()
      resolve()
    }

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(typeof event.data === 'string' ? event.data : '{}')

        if (data.type === 'Results') {
          const transcript: string = data.channel?.alternatives?.[0]?.transcript || ''
          if (transcript.trim()) {
            if (data.is_final) {
              const separator = finalText.length > 0 ? ' ' : ''
              finalText = finalText + separator + transcript
              interimText = ''
              log.debug(`Final: "${transcript}"`)
            } else {
              interimText = transcript
            }
            notifyListeners()
          }
        } else if (data.type === 'Error' || data.type === 'error') {
          lastError = data.message || 'Deepgram error'
          log.error('Deepgram error:', data)
          notifyListeners()
        }
      } catch (error) {
        log.error('Parse error', error)
      }
    }

    socket.onerror = () => {
      clearTimeout(timeout)
      if (!settled) {
        settled = true
        reject(new Error('Dictation connection failed'))
      }
    }

    socket.onclose = (event) => {
      clearTimeout(timeout)
      log.info(`Disconnected - code: ${event.code}, reason: "${event.reason}"`)
      stopKeepalive()

      if (isRecording) {
        log.warn('Unexpected disconnect during recording')
        lastError = event.reason || `Connection closed (${event.code})`
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

  let useWorklet = true
  try {
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
    const resampler = new PcmResampler(standaloneAudioContext.sampleRate, 16000)
    standaloneScriptNode = standaloneAudioContext.createScriptProcessor(4096, 1, 1)
    standaloneScriptNode.onaudioprocess = (event) => {
      const pcm16 = resampler.process(event.inputBuffer.getChannelData(0))
      if (pcm16.length > 0) sendAudio(pcm16.buffer)
    }
    standaloneMicSource.connect(standaloneScriptNode)
    standaloneScriptNode.connect(standaloneAudioContext.destination)
  }

  log.info('Standalone mic capture started')
}

function stopStandaloneMicCapture(): void {
  standaloneWorkletNode?.disconnect()
  standaloneScriptNode?.disconnect()
  standaloneMicSource?.disconnect()
  standaloneMicStream?.getTracks().forEach((track) => track.stop())
  standaloneAudioContext?.close().catch(() => undefined)

  standaloneWorkletNode = null
  standaloneScriptNode = null
  standaloneMicSource = null
  standaloneMicStream = null
  standaloneAudioContext = null
}

/**
 * Start dictation recording.
 *
 * @param useSharedAudio - If true, uses the existing session audio pipeline
 *   (sessionLifecycle routes audio via sendAudio). If omitted, auto-detects:
 *   shared audio when a session is active, otherwise standalone mic.
 */
export async function startRecording(useSharedAudio?: boolean): Promise<void> {
  if (isRecording) {
    log.warn('Already recording')
    return
  }

  lastError = null
  try {
    const sessionActive = useAppStore.getState().isSessionActive
    usingSharedAudio = useSharedAudio ?? sessionActive

    log.info(`Starting dictation (sharedAudio: ${usingSharedAudio})`)

    await connectWebSocket()

    if (!usingSharedAudio) {
      await startStandaloneMicCapture()
    }

    isRecording = true
    notifyListeners()

    log.info('Dictation recording started')
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    log.error('Failed to start dictation:', message)
    lastError = message
    cleanup()
    notifyListeners()
    throw error
  }
}

/**
 * Stop dictation recording. Any pending interim text is promoted to final so
 * the last words spoken before the click are not lost.
 */
export function stopRecording(): void {
  if (!isRecording) return

  log.info('Stopping dictation...')
  if (interimText.trim()) {
    const separator = finalText.length > 0 ? ' ' : ''
    finalText = finalText + separator + interimText.trim()
    interimText = ''
  }
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

/** Reset the dictation state (clear all accumulated text). */
export function reset(): void {
  interimText = ''
  finalText = ''
  lastError = null
  notifyListeners()
}

export function getDictationState(): DictationState {
  return getState()
}

export function isDictating(): boolean {
  return isRecording
}

function cleanup(): void {
  stopKeepalive()
  const socket = ws
  ws = null
  if (socket) {
    socket.onclose = null
    socket.onerror = null
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: 'CloseStream' }))
      socket.close(1000)
    } else if (socket.readyState === WebSocket.CONNECTING) {
      socket.close()
    }
  }

  if (!usingSharedAudio) {
    stopStandaloneMicCapture()
  }
  usingSharedAudio = false
}

export const dictationService = {
  startRecording,
  stopRecording,
  sendAudio,
  reset,
  subscribe,
  getState: getDictationState,
  isRecording: isDictating,
}
