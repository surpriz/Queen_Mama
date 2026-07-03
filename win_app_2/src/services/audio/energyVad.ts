// energyVad.ts
//
// Dependency-free voice-activity detector (TS port of the macOS EnergyVAD).
// Gates silence before audio reaches Deepgram: fewer billed seconds, cleaner
// transcripts, fewer false auto-triggers.
//
// Windows produces very small audio chunks (~2.7ms from the worklet), so unlike
// the macOS chunk-granular version this buffers into fixed 20ms analysis frames
// and decides per frame. Input/output are raw PCM16 mono @16kHz ArrayBuffers.
//
// Decision: RMS energy vs an adaptive noise floor, with hysteresis (separate
// onset/offset thresholds), a hangover ("redemption") window so trailing speech
// isn't cut, and a pre-roll ring so word starts survive the silence→speech edge.

export interface EnergyVadConfig {
  /** Onset: speech starts when RMS exceeds noiseFloor * this. */
  positiveSpeechThreshold: number
  /** Offset: speech ends when RMS falls below noiseFloor * this. */
  negativeSpeechThreshold: number
  /** Absolute RMS floor (0..1) below which we never call speech. */
  minAbsoluteRMS: number
  /** Frames of sub-threshold audio tolerated before ending speech (~20ms each). */
  redemptionFrames: number
  /** Frames of pre-speech audio replayed on onset so word starts aren't clipped. */
  preSpeechPadFrames: number
  /** EWMA factor for the adaptive noise floor. */
  noiseFloorAdaptation: number
}

export const DEFAULT_VAD_CONFIG: EnergyVadConfig = {
  positiveSpeechThreshold: 3.0,
  negativeSpeechThreshold: 1.6,
  minAbsoluteRMS: 0.003,
  redemptionFrames: 25, // ~500ms
  preSpeechPadFrames: 8, // ~160ms
  noiseFloorAdaptation: 0.05,
}

const FRAME_BYTES = 640 // 320 samples * 2 bytes = 20ms @16kHz mono PCM16

export class EnergyVAD {
  private readonly config: EnergyVadConfig
  private readonly label: string

  private state: 'silence' | 'speech' = 'silence'
  private noiseFloor = 0.01
  private redemptionCounter = 0
  private preRoll: ArrayBuffer[] = []

  // Leftover bytes that didn't fill a full frame yet.
  private pending = new Uint8Array(0)

  // Debug stats
  private totalFrames = 0
  private gatedFrames = 0

  constructor(config: Partial<EnergyVadConfig> = {}, label = 'vad') {
    this.config = { ...DEFAULT_VAD_CONFIG, ...config }
    this.label = label
  }

  /** Feed a PCM16 chunk; returns the frames to forward (empty during silence). */
  process(chunk: ArrayBuffer): ArrayBuffer[] {
    if (chunk.byteLength === 0) return []

    // Accumulate with any leftover, then slice complete 20ms frames.
    const incoming = new Uint8Array(chunk)
    const merged = new Uint8Array(this.pending.length + incoming.length)
    merged.set(this.pending, 0)
    merged.set(incoming, this.pending.length)

    const out: ArrayBuffer[] = []
    let offset = 0
    while (merged.length - offset >= FRAME_BYTES) {
      const frame = merged.slice(offset, offset + FRAME_BYTES).buffer
      offset += FRAME_BYTES
      for (const f of this.classify(frame)) out.push(f)
    }
    this.pending = merged.slice(offset)
    return out
  }

  reset(): void {
    this.state = 'silence'
    this.noiseFloor = 0.01
    this.redemptionCounter = 0
    this.preRoll = []
    this.pending = new Uint8Array(0)
    this.totalFrames = 0
    this.gatedFrames = 0
  }

  private classify(frame: ArrayBuffer): ArrayBuffer[] {
    const rms = EnergyVAD.rms(frame)
    const onset = Math.max(this.noiseFloor * this.config.positiveSpeechThreshold, this.config.minAbsoluteRMS)
    const offset = Math.max(this.noiseFloor * this.config.negativeSpeechThreshold, this.config.minAbsoluteRMS * 0.5)

    let result: ArrayBuffer[]

    if (this.state === 'silence') {
      this.preRoll.push(frame)
      if (this.preRoll.length > this.config.preSpeechPadFrames) {
        this.preRoll.splice(0, this.preRoll.length - this.config.preSpeechPadFrames)
      }
      if (rms > onset) {
        this.state = 'speech'
        this.redemptionCounter = 0
        result = [...this.preRoll, frame]
        this.preRoll = []
      } else {
        this.adaptNoiseFloor(rms)
        result = []
      }
    } else {
      if (rms < offset) {
        this.redemptionCounter += 1
        if (this.redemptionCounter >= this.config.redemptionFrames) {
          this.state = 'silence'
          this.redemptionCounter = 0
          this.adaptNoiseFloor(rms)
        }
        result = [frame] // keep forwarding through the hangover / final trailing frame
      } else {
        this.redemptionCounter = 0
        result = [frame]
      }
    }

    if (import.meta.env.DEV) {
      this.totalFrames += 1
      if (result.length === 0) this.gatedFrames += 1
      if (this.totalFrames % 200 === 0) {
        const pct = Math.round((this.gatedFrames / this.totalFrames) * 100)
        console.log(
          `[VAD ${this.label}] ${this.gatedFrames}/${this.totalFrames} frames gated (${pct}% dropped), noiseFloor=${this.noiseFloor.toFixed(4)}`,
        )
      }
    }

    return result
  }

  private adaptNoiseFloor(rms: number): void {
    const a = this.config.noiseFloorAdaptation
    this.noiseFloor = (1 - a) * this.noiseFloor + a * rms
    this.noiseFloor = Math.min(Math.max(this.noiseFloor, 0.0005), 0.2)
  }

  /** Root-mean-square of a PCM16 frame, normalized to 0..1. */
  static rms(buffer: ArrayBuffer): number {
    const samples = new Int16Array(buffer)
    if (samples.length === 0) return 0
    let sum = 0
    for (let i = 0; i < samples.length; i++) {
      const s = samples[i] / 32768
      sum += s * s
    }
    return Math.sqrt(sum / samples.length)
  }
}
