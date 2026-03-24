import { createLogger } from '@/lib/logger'
import { useConfigStore } from '@/stores/configStore'
import { addBreadcrumb } from '../crash/crashReporter'

const log = createLogger('AudioCapture')

export type AudioBufferCallback = (buffer: ArrayBuffer) => void
export type AudioLevelCallback = (level: number) => void

let audioContext: AudioContext | null = null
let micStream: MediaStream | null = null
let systemStream: MediaStream | null = null
let workletNode: AudioWorkletNode | null = null
let micSourceNode: MediaStreamAudioSourceNode | null = null
let systemSourceNode: MediaStreamAudioSourceNode | null = null
let mergerNode: ChannelMergerNode | null = null
let isCapturing = false

let onAudioBuffer: AudioBufferCallback | null = null
let onAudioLevel: AudioLevelCallback | null = null

export function setOnAudioBuffer(callback: AudioBufferCallback): void {
  onAudioBuffer = callback
}

export function setOnAudioLevel(callback: AudioLevelCallback): void {
  onAudioLevel = callback
}

function scalePower(rms: number): number {
  // Convert RMS to dB then to 0-1 scale
  const db = 20 * Math.log10(Math.max(rms, 0.0001))
  const minDb = -80
  const maxDb = 0
  if (db < minDb) return 0
  if (db >= maxDb) return 1
  return (db - minDb) / (maxDb - minDb)
}

async function captureSystemAudio(): Promise<MediaStream | null> {
  try {
    // In Electron, desktopCapturer + getUserMedia with chromeMediaSource: 'desktop'
    // captures system audio output (loopback). Video track is required but we discard it.
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

    // Remove video tracks - we only need audio
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

  log.info('Starting capture...')

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
      // Continue with system audio only
    }
  }

  // 2. Capture system audio if enabled
  if (useSystem) {
    systemStream = await captureSystemAudio()
  }

  // Ensure we have at least one source
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
    startWithWorklet()
  } else {
    startWithScriptProcessor()
  }

  isCapturing = true
  log.info(`Audio capture started (mic: ${!!micStream}, system: ${!!systemStream})`)
  addBreadcrumb('audio', `Capture started (mic=${!!micStream}, system=${!!systemStream}, sampleRate=${audioContext?.sampleRate})`, 'info')
}

function startWithWorklet(): void {
  if (!audioContext) return

  workletNode = new AudioWorkletNode(audioContext, 'audio-processor', {
    processorOptions: { sampleRate: audioContext.sampleRate },
  })

  workletNode.port.onmessage = (event) => {
    const { type, pcm16, audioLevel } = event.data
    if (type === 'audio') {
      onAudioBuffer?.(pcm16)
      onAudioLevel?.(scalePower(audioLevel))
    }
  }

  // Connect sources: mic and/or system audio → merger → worklet
  if (micStream && systemStream) {
    // Both sources: mix them together via ChannelMergerNode
    micSourceNode = audioContext.createMediaStreamSource(micStream)
    systemSourceNode = audioContext.createMediaStreamSource(systemStream)
    // Use a GainNode merger approach: both into a single destination
    const micGain = audioContext.createGain()
    const sysGain = audioContext.createGain()
    micGain.gain.value = 1.0
    sysGain.gain.value = 0.8 // Slightly lower system audio to balance with mic
    micSourceNode.connect(micGain)
    systemSourceNode.connect(sysGain)
    micGain.connect(workletNode)
    sysGain.connect(workletNode)
  } else if (micStream) {
    micSourceNode = audioContext.createMediaStreamSource(micStream)
    micSourceNode.connect(workletNode)
  } else if (systemStream) {
    systemSourceNode = audioContext.createMediaStreamSource(systemStream)
    systemSourceNode.connect(workletNode)
  }
}

function startWithScriptProcessor(): void {
  if (!audioContext) return

  const bufferSize = 4096
  const scriptNode = audioContext.createScriptProcessor(bufferSize, 1, 1)
  const inputSampleRate = audioContext.sampleRate
  const targetSampleRate = 16000

  scriptNode.onaudioprocess = (event) => {
    const inputData = event.inputBuffer.getChannelData(0)

    // Calculate RMS
    let sum = 0
    for (let i = 0; i < inputData.length; i++) {
      sum += inputData[i] * inputData[i]
    }
    const rms = Math.sqrt(sum / inputData.length)
    onAudioLevel?.(scalePower(rms))

    // Resample
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

    onAudioBuffer?.(pcm16.buffer)
  }

  // Connect sources
  if (micStream && systemStream) {
    micSourceNode = audioContext.createMediaStreamSource(micStream)
    systemSourceNode = audioContext.createMediaStreamSource(systemStream)
    const micGain = audioContext.createGain()
    const sysGain = audioContext.createGain()
    micGain.gain.value = 1.0
    sysGain.gain.value = 0.8
    micSourceNode.connect(micGain)
    systemSourceNode.connect(sysGain)
    micGain.connect(scriptNode)
    sysGain.connect(scriptNode)
  } else if (micStream) {
    micSourceNode = audioContext.createMediaStreamSource(micStream)
    micSourceNode.connect(scriptNode)
  } else if (systemStream) {
    systemSourceNode = audioContext.createMediaStreamSource(systemStream)
    systemSourceNode.connect(scriptNode)
  }

  scriptNode.connect(audioContext.destination) // Required for ScriptProcessor to work
}

export function stopCapture(): void {
  if (!isCapturing) return

  workletNode?.disconnect()
  micSourceNode?.disconnect()
  systemSourceNode?.disconnect()
  mergerNode?.disconnect()
  micStream?.getTracks().forEach((track) => track.stop())
  systemStream?.getTracks().forEach((track) => track.stop())
  audioContext?.close()

  workletNode = null
  micSourceNode = null
  systemSourceNode = null
  mergerNode = null
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
