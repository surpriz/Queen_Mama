// AudioWorklet processor: resample from native sample rate to 16kHz PCM16
// This runs in the AudioWorklet thread

class AudioProcessor extends AudioWorkletProcessor {
  private inputSampleRate: number
  private targetSampleRate = 16000
  private resampleBuffer: Float32Array = new Float32Array(0)

  constructor(options: AudioWorkletNodeOptions) {
    super()
    this.inputSampleRate = options.processorOptions?.sampleRate || 48000
  }

  process(inputs: Float32Array[][], _outputs: Float32Array[][], _parameters: Record<string, Float32Array>): boolean {
    const input = inputs[0]
    if (!input || input.length === 0 || !input[0]) return true

    const inputData = input[0] // mono channel

    // Calculate RMS for audio level
    let sum = 0
    for (let i = 0; i < inputData.length; i++) {
      sum += inputData[i] * inputData[i]
    }
    const rms = Math.sqrt(sum / inputData.length)

    // Resample: linear interpolation from inputSampleRate to 16kHz
    const ratio = this.targetSampleRate / this.inputSampleRate
    const outputLength = Math.round(inputData.length * ratio)
    const resampled = new Float32Array(outputLength)

    for (let i = 0; i < outputLength; i++) {
      const srcIndex = i / ratio
      const srcIndexFloor = Math.floor(srcIndex)
      const srcIndexCeil = Math.min(srcIndexFloor + 1, inputData.length - 1)
      const frac = srcIndex - srcIndexFloor

      resampled[i] = inputData[srcIndexFloor] * (1 - frac) + inputData[srcIndexCeil] * frac
    }

    // Convert Float32 to Int16 PCM
    const pcm16 = new Int16Array(outputLength)
    for (let i = 0; i < outputLength; i++) {
      const s = Math.max(-1, Math.min(1, resampled[i]))
      pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff
    }

    // Post PCM16 data and audio level to main thread
    this.port.postMessage({
      type: 'audio',
      pcm16: pcm16.buffer,
      audioLevel: rms,
    }, [pcm16.buffer])

    return true
  }
}

registerProcessor('audio-processor', AudioProcessor)
