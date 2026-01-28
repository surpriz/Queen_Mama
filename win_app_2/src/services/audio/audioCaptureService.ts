import { createLogger } from '@/lib/logger'

const log = createLogger('AudioCapture')

export type AudioBufferCallback = (buffer: ArrayBuffer) => void
export type AudioLevelCallback = (level: number) => void

let audioContext: AudioContext | null = null
let mediaStream: MediaStream | null = null
let workletNode: AudioWorkletNode | null = null
let sourceNode: MediaStreamAudioSourceNode | null = null
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

export async function startCapture(): Promise<void> {
  if (isCapturing) {
    log.warn('Already capturing')
    return
  }

  log.info('Starting capture...')

  // Request microphone access
  try {
    mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
        channelCount: 1,
        sampleRate: { ideal: 48000 },
      },
    })
  } catch (error) {
    log.error('Microphone permission denied', error)
    throw new Error('Microphone permission denied. Please enable in system settings.')
  }

  // Create AudioContext
  audioContext = new AudioContext({ sampleRate: 48000 })
  log.info(`AudioContext sample rate: ${audioContext.sampleRate}`)

  // Load AudioWorklet
  try {
    const workletUrl = new URL('../../workers/audioProcessor.worklet.ts', import.meta.url).href
    await audioContext.audioWorklet.addModule(workletUrl)
  } catch {
    // Fallback: use inline worklet
    log.warn('Failed to load worklet module, using ScriptProcessorNode fallback')
    startWithScriptProcessor()
    return
  }

  // Create nodes
  sourceNode = audioContext.createMediaStreamSource(mediaStream)
  workletNode = new AudioWorkletNode(audioContext, 'audio-processor', {
    processorOptions: { sampleRate: audioContext.sampleRate },
  })

  // Handle messages from worklet
  workletNode.port.onmessage = (event) => {
    const { type, pcm16, audioLevel } = event.data
    if (type === 'audio') {
      onAudioBuffer?.(pcm16)
      onAudioLevel?.(scalePower(audioLevel))
    }
  }

  // Connect pipeline: mic → worklet
  sourceNode.connect(workletNode)
  // Don't connect worklet to destination (we don't want playback)

  isCapturing = true
  log.info('Audio capture started')
}

// Fallback for environments where AudioWorklet isn't available
function startWithScriptProcessor(): void {
  if (!audioContext || !mediaStream) return

  sourceNode = audioContext.createMediaStreamSource(mediaStream)

  // Use deprecated ScriptProcessorNode as fallback
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

  sourceNode.connect(scriptNode)
  scriptNode.connect(audioContext.destination) // Required for ScriptProcessor to work

  isCapturing = true
  log.info('Audio capture started (ScriptProcessor fallback)')
}

export function stopCapture(): void {
  if (!isCapturing) return

  workletNode?.disconnect()
  sourceNode?.disconnect()
  mediaStream?.getTracks().forEach((track) => track.stop())
  audioContext?.close()

  workletNode = null
  sourceNode = null
  mediaStream = null
  audioContext = null
  isCapturing = false

  onAudioLevel?.(0)
  log.info('Audio capture stopped')
}

export function getIsCapturing(): boolean {
  return isCapturing
}
