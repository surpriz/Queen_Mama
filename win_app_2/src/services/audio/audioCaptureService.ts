import { createLogger } from '@/lib/logger'
import { useConfigStore } from '@/stores/configStore'
import { addBreadcrumb } from '../crash/crashReporter'
import { PcmResampler, rms } from './resampler'
// Bundled as a classic worker script so the worklet (and the resampler it
// imports) ships in production. The previous `new URL(...)` reference was never
// emitted by the build, so packaged apps silently fell back to ScriptProcessor.
import workletUrl from '@/workers/audioProcessor.worklet.ts?worker&url'

const log = createLogger('AudioCapture')

const LEVEL_EMIT_INTERVAL_MS = 100 // meter updates at 10 Hz (was every worklet block ≈ 375/s)
let lastLevelEmitAt = 0
let levelPeak = 0

function emitLevel(level: number): void {
  if (level > levelPeak) levelPeak = level
  const now = Date.now()
  if (now - lastLevelEmitAt < LEVEL_EMIT_INTERVAL_MS) return
  lastLevelEmitAt = now
  onAudioLevel?.(levelPeak)
  levelPeak = 0
}

let micUnavailable = false
let lastSystemBufferAt = 0

/** True when the user enabled the mic but capture failed (permission / device). */
export function isMicUnavailable(): boolean {
  return micUnavailable
}

/** Timestamp (ms) of the last system-audio buffer, 0 if none yet. */
export function getLastSystemBufferAt(): number {
  return lastSystemBufferAt
}

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
  log.info('[diag] captureSystemAudio — calling getUserMedia chromeMediaSource:desktop')
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

    log.info(`[diag] getUserMedia resolved — stream.id=${stream.id}`)
    stream.getVideoTracks().forEach((track) => track.stop())

    const audioTracks = stream.getAudioTracks()
    log.info(`[diag] audio tracks count=${audioTracks.length}`)
    if (audioTracks.length === 0) {
      log.warn('[diag] System audio: 0 audio tracks — likely missing setDisplayMediaRequestHandler')
      return null
    }

    audioTracks.forEach((t, i) => {
      log.info(`[diag] track[${i}] label="${t.label}" enabled=${t.enabled} muted=${t.muted} state=${t.readyState}`)
    })

    log.info(`System audio captured: ${audioTracks.length} track(s)`)
    return new MediaStream(audioTracks)
  } catch (error) {
    const err = error as Error
    log.warn(`[diag] getUserMedia REJECTED — name="${err.name}" msg="${err.message}"`)
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
  micUnavailable = false
  lastSystemBufferAt = 0
  lastLevelEmitAt = 0
  levelPeak = 0

  const config = useConfigStore.getState()
  const useMic = config.captureMicrophone
  const useSystem = config.captureSystemAudio

  log.info(`[diag] startCapture config — useMic=${useMic} useSystem=${useSystem} platform=${navigator.platform}`)

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
      micUnavailable = true
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
    await audioContext.audioWorklet.addModule(workletUrl)
  } catch (err) {
    log.warn('Failed to load worklet module, using ScriptProcessorNode fallback', err)
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
        emitLevel(scalePower(audioLevel))
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
        lastSystemBufferAt = Date.now()
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

  function createProcessor(callback: AudioBufferCallback | null, trackLevel: boolean, isSystem: boolean): ScriptProcessorNode {
    const scriptNode = audioContext!.createScriptProcessor(bufferSize, 1, 1)
    const resampler = new PcmResampler(inputSampleRate, targetSampleRate)
    scriptNode.onaudioprocess = (event) => {
      const inputData = event.inputBuffer.getChannelData(0)

      if (trackLevel) {
        emitLevel(scalePower(rms(inputData)))
      }

      const pcm16 = resampler.process(inputData)
      if (pcm16.length === 0) return
      if (isSystem) lastSystemBufferAt = Date.now()
      callback?.(pcm16.buffer)
    }
    scriptNode.connect(audioContext!.destination) // Required for ScriptProcessor to work
    return scriptNode
  }

  if (micStream) {
    const micProcessor = createProcessor(onMicAudioBuffer, true, false)
    micSourceNode = audioContext.createMediaStreamSource(micStream)
    micSourceNode.connect(micProcessor)
  }

  if (systemStream) {
    const sysProcessor = createProcessor(onSystemAudioBuffer, false, true)
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
