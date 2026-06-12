import { describe, it, expect, beforeEach } from 'vitest'
import * as aec from './echoCanceller'

// Mirrors mac_app/QueenMamaTests/Unit/Services/EchoCancellationServiceTests.swift.
// Verifies the NLMS echo canceller removes delayed speaker bleed (high ERLE),
// preserves the user's voice during double-talk, and passes audio through unchanged
// when no reference has been fed.

const BLOCK = 320 // 20 ms @ 16 kHz
const ECHO_DELAY = 1_700 // within the initial 1600 delay guess + filter length
const ECHO_GAIN = 0.2 // realistic speaker→mic coupling (~ -14 dB)
const WARMUP = 200

function makeReference(count: number, seed = 0x9e3779b9n): Float32Array {
  let state = seed & 0xffffffffffffffffn
  const out = new Float32Array(count)
  const mask = 0xffffffffffffffffn
  for (let i = 0; i < count; i++) {
    state = (state * 6364136223846793005n + 1442695040888963407n) & mask
    const u = Number(state >> 40n) / (1 << 24) // [0,1)
    out[i] = (u - 0.5) * 0.6 // [-0.3, 0.3)
  }
  return out
}

function energy(buffer: ArrayBuffer): number {
  const s = aec.decodePCM16(buffer)
  let e = 0
  for (let i = 0; i < s.length; i++) e += s[i] * s[i]
  return e
}

describe('echoCanceller', () => {
  beforeEach(() => aec.reset())

  it('cancels delayed echo from the reference (high ERLE)', () => {
    const total = (WARMUP + 1) * BLOCK + ECHO_DELAY
    const far = makeReference(total)

    let lastMic = 0
    let lastResid = 0
    for (let b = 0; b < WARMUP + 1; b++) {
      const t = b * BLOCK
      const ref = far.subarray(t, t + BLOCK)
      const mic = new Float32Array(BLOCK)
      for (let i = 0; i < BLOCK; i++) {
        const src = t + i - ECHO_DELAY
        mic[i] = src >= 0 ? ECHO_GAIN * far[src] : 0
      }
      aec.pushReference(aec.encodePCM16(ref))
      const micData = aec.encodePCM16(mic)
      const cleaned = aec.process(micData)
      lastMic = energy(micData)
      lastResid = energy(cleaned)
    }

    expect(lastMic).toBeGreaterThan(0)
    const erle = 10 * Math.log10(lastMic / Math.max(lastResid, 1e-9))
    expect(erle).toBeGreaterThan(12)
  })

  it('preserves near-end speech during double-talk', () => {
    const total = (WARMUP + 1) * BLOCK + ECHO_DELAY
    const far = makeReference(total)

    for (let b = 0; b < WARMUP; b++) {
      const t = b * BLOCK
      const ref = far.subarray(t, t + BLOCK)
      const mic = new Float32Array(BLOCK)
      for (let i = 0; i < BLOCK; i++) {
        const src = t + i - ECHO_DELAY
        mic[i] = src >= 0 ? ECHO_GAIN * far[src] : 0
      }
      aec.pushReference(aec.encodePCM16(ref))
      aec.process(aec.encodePCM16(mic))
    }

    const t = WARMUP * BLOCK
    const ref = far.subarray(t, t + BLOCK)
    const near = new Float32Array(BLOCK)
    const mic = new Float32Array(BLOCK)
    for (let i = 0; i < BLOCK; i++) {
      const src = t + i - ECHO_DELAY
      const echo = src >= 0 ? ECHO_GAIN * far[src] : 0
      const nv = 0.4 * Math.sin((2 * Math.PI * 440 * (t + i)) / 16_000)
      near[i] = nv
      mic[i] = echo + nv
    }

    aec.pushReference(aec.encodePCM16(ref))
    const cleaned = aec.process(aec.encodePCM16(mic))

    let nearEnergy = 0
    for (let i = 0; i < BLOCK; i++) nearEnergy += near[i] * near[i]
    expect(energy(cleaned)).toBeGreaterThan(nearEnergy * 0.4)
  })

  it('survives sustained double-talk without corrupting the filter', () => {
    // Regression guard: one onset sample adapting with the user's voice as the error
    // used to knock the converged filter off its optimum (dropping the user's words).
    // After many double-talk blocks, echo cancellation must resume at full strength.
    const dtBlocks = 60
    const total = (WARMUP + dtBlocks + 10) * BLOCK + ECHO_DELAY
    const far = makeReference(total)
    const near = makeReference(70 * BLOCK, 0xabcdefn) // user voice, uncorrelated

    const echoBlock = (t: number) => {
      const m = new Float32Array(BLOCK)
      for (let i = 0; i < BLOCK; i++) {
        const src = t + i - ECHO_DELAY
        m[i] = src >= 0 ? ECHO_GAIN * far[src] : 0
      }
      return m
    }

    for (let b = 0; b < WARMUP; b++) {
      const t = b * BLOCK
      aec.pushReference(aec.encodePCM16(far.subarray(t, t + BLOCK)))
      aec.process(aec.encodePCM16(echoBlock(t)))
    }
    for (let k = 0; k < dtBlocks; k++) {
      const t = (WARMUP + k) * BLOCK
      aec.pushReference(aec.encodePCM16(far.subarray(t, t + BLOCK)))
      const eb = echoBlock(t)
      const m = new Float32Array(BLOCK)
      for (let i = 0; i < BLOCK; i++) m[i] = eb[i] + near[k * BLOCK + i]
      aec.process(aec.encodePCM16(m))
    }
    const t = (WARMUP + dtBlocks) * BLOCK
    aec.pushReference(aec.encodePCM16(far.subarray(t, t + BLOCK)))
    const micData = aec.encodePCM16(echoBlock(t))
    const cleaned = aec.process(micData)
    const erle = 10 * Math.log10(energy(micData) / Math.max(energy(cleaned), 1e-9))
    expect(erle).toBeGreaterThan(30)
  })

  it('passes the mic signal through unchanged when no reference is fed', () => {
    const mic = makeReference(BLOCK, 0x1234n)
    const micData = aec.encodePCM16(mic)
    const out = aec.process(micData)
    expect(new Int16Array(out)).toEqual(new Int16Array(micData))
  })
})
