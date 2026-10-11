import { describe, it, expect } from 'vitest'
import { PcmResampler } from './resampler'

function sine(freq: number, rate: number, seconds: number): Float32Array {
  const n = Math.round(rate * seconds)
  const out = new Float32Array(n)
  for (let i = 0; i < n; i++) out[i] = 0.5 * Math.sin((2 * Math.PI * freq * i) / rate)
  return out
}

/** Feed in 128-sample blocks (like the AudioWorklet) and concatenate the output. */
function run(resampler: PcmResampler, input: Float32Array, block = 128): Int16Array {
  const chunks: Int16Array[] = []
  for (let i = 0; i < input.length; i += block) {
    chunks.push(resampler.process(input.subarray(i, Math.min(input.length, i + block))))
  }
  const total = chunks.reduce((s, c) => s + c.length, 0)
  const out = new Int16Array(total)
  let o = 0
  for (const c of chunks) {
    out.set(c, o)
    o += c.length
  }
  return out
}

/** Goertzel power at `freq` for an Int16 signal. */
function power(signal: Int16Array, freq: number, rate: number): number {
  const w = (2 * Math.PI * freq) / rate
  const coeff = 2 * Math.cos(w)
  let s0 = 0
  let s1 = 0
  let s2 = 0
  for (let i = 0; i < signal.length; i++) {
    s0 = signal[i] / 32768 + coeff * s1 - s2
    s2 = s1
    s1 = s0
  }
  return (s1 * s1 + s2 * s2 - coeff * s1 * s2) / signal.length
}

describe('PcmResampler', () => {
  it('produces an exact 16 kHz output rate over time (no 0.8 % block-rounding skew)', () => {
    const r = new PcmResampler(48000, 16000)
    const out = run(r, sine(440, 48000, 2))
    // 2 s → 32000 samples (±kernel latency of 16 input samples)
    expect(Math.abs(out.length - 32000)).toBeLessThanOrEqual(8)
  })

  it('preserves a 1 kHz tone with phase continuity across blocks', () => {
    const r = new PcmResampler(48000, 16000)
    const out = run(r, sine(1000, 48000, 1))
    const steady = out.subarray(2000) // skip start-up
    const p1k = power(steady, 1000, 16000)
    const p3k = power(steady, 3000, 16000) // would appear with block-boundary phase jumps
    expect(p1k).toBeGreaterThan(0.1) // 0.5 amplitude sine → power 0.125
    expect(p3k / p1k).toBeLessThan(1e-3)
  })

  it('rejects content above the output Nyquist instead of aliasing it into the speech band', () => {
    const r = new PcmResampler(48000, 16000)
    // 13 kHz at 48 kHz would alias to 3 kHz at 16 kHz with no low-pass.
    const out = run(r, sine(13000, 48000, 1))
    const steady = out.subarray(2000)
    const aliased = power(steady, 3000, 16000)
    expect(aliased).toBeLessThan(0.125 * 1e-3)
  })

  it('handles non-integer ratios (44.1 kHz → 16 kHz)', () => {
    const r = new PcmResampler(44100, 16000)
    const out = run(r, sine(500, 44100, 1), 441)
    expect(Math.abs(out.length - 16000)).toBeLessThanOrEqual(8)
    const p = power(out.subarray(2000), 500, 16000)
    expect(p).toBeGreaterThan(0.1)
  })

  it('is silent for silence and clamps to the Int16 range', () => {
    const r = new PcmResampler(48000, 16000)
    expect(Array.from(run(r, new Float32Array(4800))).every((v) => v === 0)).toBe(true)
    const loud = new Float32Array(4800).fill(1.5)
    const out = run(new PcmResampler(48000, 16000), loud)
    expect(Math.max(...Array.from(out))).toBeLessThanOrEqual(32767)
  })
})
