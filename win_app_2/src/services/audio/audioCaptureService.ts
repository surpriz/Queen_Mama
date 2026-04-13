import { createLogger } from '@/lib/logger'
import { useConfigStore } from '@/stores/configStore'
import { addBreadcrumb } from '../crash/crashReporter'

const log = createLogger('AudioCapture')

export type AudioBufferCallback = (buffer: ArrayBuffer) => void
export type AudioLevelCallback = (level: number) => void

let audioContext: AudioContext | null = null
let micStream: MediaStream | null = null
let systemStream: MediaStream | null = null
let micWorkletNode: AudioWorkletNode | null = null
let systemWorkletNode: AudioWorkletNode | null = null
let micSourceNode: MediaStreamAudioSourceNode | null = null
let systemSourceNode: MediaStreamAudioSourceNode | null = null
let isCapturing = false

// Dual-stream callbacks: separate mic and system audio
let onMicAudioBuffer: AudioBufferCallback | null = null
let onSystemAudioBuffer: AudioBufferCallback | null = null
let onAudioLevel: AudioLevelCallback | null = null

/** Set callback for mic audio data (user's voice) */
export function setOnMicAudioBuffer(callback: AudioBufferCallback): void {
  onMicAudioBuffer = callback
}

/** Set callback for system audio data (remote participants) */
export function setOnSystemAudioBuffer(callback: AudioBufferCallback): void {
  onSystemAudioBuffer = callback
}

export function setOnAudioLevel(callback: AudioLevelCallback): void {
  onAudioLevel = callback
}

function scalePower(rms: number): number {
  const db = 20 * Math.log10(Math.max(rms, 0.0001))
  const minDb = -80
  const maxDb = 0
  if (db < minDb) return 0
  if (db >= maxDb) return 1
  return (db - minDb) / (maxDb - minDb)
}

async function captureSystemAudio(): Promise<MediaStream | null> {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        mandatory: {
          chromeMediaSource: 'desktop',
        },
      } as unknown as MediaTrackConstraints,
      video: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        mandatory: {
          chromeMediaSource: 'desktop',
          minWidth: 1,
          maxWidth: 1,
          minHeight: 1,
          maxHeight: 1,
        },
      } as unknown as MediaTrackConstraints,
    })

    stream.getVideoTracks().forEach((track) => track.stop())

    const audioTracks = stream.getAudioTracks()
    if (audioTracks.length === 0) {
      log.warn('System audio: no audio tracks available')
      return null
    }

    log.info(`System audio captured: ${audioTracks.length} track(s)`)
    return new MediaStream(audioTracks)
  } catch (error) {
    log.warn('System audio capture not available:', error)
    return null
  }
}

export async function startCapture(): Promise<void> {
  if (isCapturing) {
    log.warn('Already capturing')
    return
  }

  log.info('Starting dual-stream capture...')

  const config = useConfigStore.getState()
  const useMic = config.captureMicrophone
  const useSystem = config.captureSystemAudio

  if (!useMic && !useSystem) {
    log.warn('Both mic and system audio disabled, nothing to capture')
    return
  }

  // 1. Capture microphone if enabled
  if (useMic) {
    try {
      micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          channelCount: 1,
          sampleRate: { ideal: 48000 },
        },
      })
      log.info('Microphone captured')
    } catch (error) {
      log.error('Microphone permission denied', error)
      if (!useSystem) {
        throw new Error('Microphone permission denied. Please enable in system settings.')
      }
    }
  }

  // 2. Capture system audio if enabled
  if (useSystem) {
    systemStream = await captureSystemAudio()
  }

  if (!micStream && !systemStream) {
    throw new Error('No audio sources available. Please enable microphone or system audio.')
  }

  // Create AudioContext
  audioContext = new AudioContext({ sampleRate: 48000 })
  log.info(`AudioContext sample rate: ${audioContext.sampleRate}`)

  // Load AudioWorklet
  let useWorklet = true
  try {
    const workletUrl = new URL('../../workers/audioProcessor.worklet.ts', import.meta.url).href
    await audioContext.audioWorklet.addModule(workletUrl)
  } catch {
    log.warn('Failed to load worklet module, using ScriptProcessorNode fallback')
    useWorklet = false
  }

  if (useWorklet) {
    startDualStreamWorklet()
  } else {
    startDualStreamScriptProcessor()
  }

  isCapturing = true
  log.info(`Dual-stream capture started (mic: ${!!micStream}, system: ${!!systemStream})`)
  addBreadcrumb('audio', `Dual-stream capture started (mic=${!!micStream}, system=${!!systemStream})`, 'info')
}

/**
 * Dual-stream with AudioWorklet: separate worklet nodes for mic and system audio.
 * Each stream goes to its own Deepgram connection for speaker separation.
 */
function startDualStreamWorklet(): void {
  if (!audioContext) return

  // Mic stream → dedicated worklet → onMicAudioBuffer
  if (micStream) {
    micWorkletNode = new AudioWorkletNode(audioContext, 'audio-processor', {
      processorOptions: { sampleRate: audioContext.sampleRate },
    })
    micWorkletNode.port.onmessage = (event) => {
      const { type, pcm16, audioLevel } = event.data
      if (type === 'audio') {
        onMicAudioBuffer?.(pcm16)
        onAudioLevel?.(scalePower(audioLevel))
      }
    }
    micSourceNode = audioContext.createMediaStreamSource(micStream)
    micSourceNode.connect(micWorkletNode)
  }

  // System audio stream → dedicated worklet → onSystemAudioBuffer
  if (systemStream) {
    systemWorkletNode = new AudioWorkletNode(audioContext, 'audio-processor', {
      processorOptions: { sampleRate: audioContext.sampleRate },
    })
    systemWorkletNode.port.onmessage = (event) => {
      const { type, pcm16 } = event.data
      if (type === 'audio') {
        onSystemAudioBuffer?.(pcm16)
      }
    }
    systemSourceNode = audioContext.createMediaStreamSource(systemStream)
    systemSourceNode.connect(systemWorkletNode)
  }
}

/**
 * Dual-stream fallback with ScriptProcessorNode.
 */
function startDualStreamScriptProcessor(): void {
  if (!audioContext) return

  const bufferSize = 4096
  const inputSampleRate = audioContext.sampleRate
  const targetSampleRate = 16000

  function createProcessor(callback: AudioBufferCallback | null, trackLevel: boolean): ScriptProcessorNode {
    const scriptNode = audioContext!.createScriptProcessor(bufferSize, 1, 1)
    scriptNode.onaudioprocess = (event) => {
      const inputData = event.inputBuffer.getChannelData(0)

      if (trackLevel) {
        let sum = 0
        for (let i = 0; i < inputData.length; i++) sum += inputData[i] * inputData[i]
        onAudioLevel?.(scalePower(Math.sqrt(sum / inputData.length)))
      }

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
      callback?.(pcm16.buffer)
    }
    scriptNode.connect(audioContext!.destination) // Required for ScriptProcessor to work
    return scriptNode
  }

  if (micStream) {
    const micProcessor = createProcessor(onMicAudioBuffer, true)
    micSourceNode = audioContext.createMediaStreamSource(micStream)
    micSourceNode.connect(micProcessor)
  }

  if (systemStream) {
    const sysProcessor = createProcessor(onSystemAudioBuffer, false)
    systemSourceNode = audioContext.createMediaStreamSource(systemStream)
    systemSourceNode.connect(sysProcessor)
  }
}

export function stopCapture(): void {
  if (!isCapturing) return

  micWorkletNode?.disconnect()
  systemWorkletNode?.disconnect()
  micSourceNode?.disconnect()
  systemSourceNode?.disconnect()
  micStream?.getTracks().forEach((track) => track.stop())
  systemStream?.getTracks().forEach((track) => track.stop())
  audioContext?.close()

  micWorkletNode = null
  systemWorkletNode = null
  micSourceNode = null
  systemSourceNode = null
  micStream = null
  systemStream = null
  audioContext = null
  isCapturing = false

  onAudioLevel?.(0)
  log.info('Audio capture stopped')
}

export function getIsCapturing(): boolean {
  return isCapturing
}

/** Returns true if system audio (desktop loopback) was successfully captured */
export function hasSystemAudio(): boolean {
  return systemStream !== null
}
