// AudioWorklet processor: resample from the native sample rate to 16 kHz PCM16.
// Runs on the audio rendering thread. Bundled by Vite through `?worker&url`
// (see audioCaptureService) so the shared PcmResampler is inlined.

import { PcmResampler, rms } from '../services/audio/resampler'

// AudioWorklet globals (available in worklet scope, not in main thread)
declare class AudioWorkletProcessor {
  readonly port: MessagePort
  constructor(options?: AudioWorkletNodeOptions)
  process(inputs: Float32Array[][], outputs: Float32Array[][], parameters: Record<string, Float32Array>): boolean
}
declare function registerProcessor(name: string, processorCtor: new (options?: AudioWorkletNodeOptions) => AudioWorkletProcessor): void

const TARGET_SAMPLE_RATE = 16000

class AudioProcessor extends AudioWorkletProcessor {
  private readonly resampler: PcmResampler

  constructor(options?: AudioWorkletNodeOptions) {
    super()
    const inputSampleRate = options?.processorOptions?.sampleRate || 48000
    this.resampler = new PcmResampler(inputSampleRate, TARGET_SAMPLE_RATE)
  }

  process(inputs: Float32Array[][], _outputs: Float32Array[][], _parameters: Record<string, Float32Array>): boolean {
    const input = inputs[0]
    if (!input || input.length === 0 || !input[0]) return true

    const inputData = input[0] // mono channel
    const audioLevel = rms(inputData)
    const pcm16 = this.resampler.process(inputData)
    if (pcm16.length === 0) return true

    this.port.postMessage(
      {
        type: 'audio',
        pcm16: pcm16.buffer,
        audioLevel,
      },
      [pcm16.buffer],
    )

    return true
  }
}

registerProcessor('audio-processor', AudioProcessor)
