/**
 * PcmResampler — streaming, phase-continuous, anti-aliased sample-rate
 * conversion (Float32 in → Int16 PCM out).
 *
 * Replaces the per-block linear interpolation that:
 *  - rounded every 128-sample block to 43 output samples (48k→16k is 42.67),
 *    i.e. ~0.8 % too fast with a phase jump at every block boundary;
 *  - had no low-pass filter, folding 8–24 kHz content into the speech band.
 *
 * Design: windowed-sinc interpolation with the cutoff at the output Nyquist
 * (scaled when downsampling), evaluated from a polyphase table so the hot
 * loop is TAPS multiply-adds per output sample. The read position carries its
 * fractional phase across blocks, so the output rate is exact over time.
 *
 * Self-contained (no imports) so the same source runs inside the AudioWorklet.
 */

const TAPS_PER_SIDE = 16 // 32-tap kernel ≈ 0.67 ms at 48 kHz
const TAPS = TAPS_PER_SIDE * 2
const PHASES = 64 // fractional-position resolution of the polyphase table

function kaiserBessel(x: number): number {
  // Zeroth-order modified Bessel function I0, series expansion.
  let sum = 1
  let term = 1
  const y = (x * x) / 4
  for (let k = 1; k < 25; k++) {
    term *= y / (k * k)
    sum += term
    if (term < 1e-12 * sum) break
  }
  return sum
}

function buildPolyphaseTable(inputRate: number, outputRate: number): Float32Array {
  // Relative cutoff (fraction of input Nyquist). Downsampling: output Nyquist.
  // Slightly below to leave a transition band for the short kernel.
  const ratio = outputRate / inputRate
  const cutoff = Math.min(1, ratio) * 0.92
  const beta = 7.0 // Kaiser β — ~70 dB stopband for a 32-tap kernel
  const denom = kaiserBessel(beta)
  const table = new Float32Array(PHASES * TAPS)

  for (let p = 0; p < PHASES; p++) {
    const frac = p / PHASES
    let sum = 0
    for (let t = 0; t < TAPS; t++) {
      // Sample positions relative to the (fractional) output instant.
      const x = t - TAPS_PER_SIDE + 1 - frac
      const sinc = x === 0 ? 1 : Math.sin(Math.PI * cutoff * x) / (Math.PI * cutoff * x)
      const w = Math.abs(x) >= TAPS_PER_SIDE ? 0 : kaiserBessel(beta * Math.sqrt(1 - (x / TAPS_PER_SIDE) ** 2)) / denom
      const h = sinc * cutoff * w
      table[p * TAPS + t] = h
      sum += h
    }
    // Normalize each phase to unity DC gain.
    if (sum !== 0) {
      for (let t = 0; t < TAPS; t++) table[p * TAPS + t] /= sum
    }
  }
  return table
}

const tableCache = new Map<string, Float32Array>()

export class PcmResampler {
  private readonly step: number
  private readonly table: Float32Array
  private history: Float32Array
  private historyLen = 0
  private position = 0 // read position (input-sample units) within `history`

  constructor(
    readonly inputRate: number,
    readonly outputRate: number,
  ) {
    if (!(inputRate > 0) || !(outputRate > 0)) throw new Error('Invalid sample rates')
    this.step = inputRate / outputRate
    const key = `${inputRate}:${outputRate}`
    let table = tableCache.get(key)
    if (!table) {
      table = buildPolyphaseTable(inputRate, outputRate)
      tableCache.set(key, table)
    }
    this.table = table
    this.history = new Float32Array(4096)
    // Start with TAPS_PER_SIDE zeros so the kernel has left context immediately.
    this.historyLen = TAPS_PER_SIDE
    this.position = TAPS_PER_SIDE
  }

  /** Convert a block of Float32 samples; returns Int16 PCM (little-endian, machine order). */
  process(input: Float32Array): Int16Array<ArrayBuffer> {
    if (input.length === 0) return new Int16Array(new ArrayBuffer(0))

    // Append input to history (grow if needed).
    if (this.historyLen + input.length > this.history.length) {
      const grown = new Float32Array(Math.max(this.history.length * 2, this.historyLen + input.length))
      grown.set(this.history.subarray(0, this.historyLen))
      this.history = grown
    }
    this.history.set(input, this.historyLen)
    this.historyLen += input.length

    // Number of output samples we can produce with full right context.
    const lastUsable = this.historyLen - TAPS_PER_SIDE // exclusive upper bound for floor(position)
    let count = 0
    if (lastUsable > this.position) {
      count = Math.floor((lastUsable - this.position) / this.step) + 1
      // Guard: the last one must still satisfy floor(pos) < lastUsable
      while (count > 0 && Math.floor(this.position + (count - 1) * this.step) >= lastUsable) count--
    }
    const out = new Int16Array(new ArrayBuffer(count * 2))
    const table = this.table
    const history = this.history

    let pos = this.position
    for (let n = 0; n < count; n++) {
      const base = Math.floor(pos)
      const frac = pos - base
      const phase = Math.min(PHASES - 1, Math.round(frac * PHASES))
      const start = base - TAPS_PER_SIDE + 1
      const row = phase * TAPS
      let acc = 0
      for (let t = 0; t < TAPS; t++) {
        acc += table[row + t] * history[start + t]
      }
      const clamped = acc > 1 ? 1 : acc < -1 ? -1 : acc
      out[n] = clamped < 0 ? Math.round(clamped * 0x8000) : Math.round(clamped * 0x7fff)
      pos += this.step
    }
    this.position = pos

    // Drop consumed history, keeping TAPS_PER_SIDE samples of left context.
    const keepFrom = Math.max(0, Math.floor(this.position) - TAPS_PER_SIDE)
    if (keepFrom > 0) {
      this.history.copyWithin(0, keepFrom, this.historyLen)
      this.historyLen -= keepFrom
      this.position -= keepFrom
    }
    return out
  }

  reset(): void {
    this.history.fill(0)
    this.historyLen = TAPS_PER_SIDE
    this.position = TAPS_PER_SIDE
  }
}

/** RMS of a Float32 block (used for the level meter). */
export function rms(input: Float32Array): number {
  if (input.length === 0) return 0
  let sum = 0
  for (let i = 0; i < input.length; i++) sum += input[i] * input[i]
  return Math.sqrt(sum / input.length)
}
