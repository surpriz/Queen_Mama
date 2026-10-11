import { describe, it, expect, beforeEach } from 'vitest'
import * as aec from './echoCanceller'

const RATE = 16000

function pcm(samples: Float32Array): ArrayBuffer {
  return aec.encodePCM16(samples)
}

/** Deterministic wideband "speech-like" signal (sum of sines + pseudo-noise). */
function farSignal(n: number): Float32Array {
  const out = new Float32Array(n)
  let seed = 12345
  for (let i = 0; i < n; i++) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff
    const noise = (seed / 0x7fffffff - 0.5) * 0.2
    out[i] = 0.3 * Math.sin((2 * Math.PI * 320 * i) / RATE) + 0.2 * Math.sin((2 * Math.PI * 1150 * i) / RATE) + noise
  }
  return out
}

describe('echoCanceller delay estimation', () => {
  beforeEach(() => aec.reset())

  it('converges on an injected 60 ms echo delay with 43-sample mic blocks', () => {
    const delay = 960 // 60 ms — far from the 1600-sample default
    const total = RATE * 3
    const far = farSignal(total + delay)
    const block = 43 // one 128-frame worklet block at 48 kHz → 16 kHz

    for (let pos = 0; pos < total; pos += block) {
      const len = Math.min(block, total - pos)
      aec.pushReference(pcm(far.subarray(pos + delay, pos + delay + len)))
      const near = new Float32Array(len)
      for (let i = 0; i < len; i++) near[i] = 0.3 * far[pos + i] // echo = attenuated, delayed far-end
      aec.process(pcm(near))
    }

    expect(Math.abs(aec.getDelaySamples() - delay)).toBeLessThanOrEqual(16)
  })

  it('cancels most of the echo once the delay is found', () => {
    const delay = 480 // 30 ms
    const total = RATE * 4
    const far = farSignal(total + delay)
    const block = 43
    let nearEnergy = 0
    let residEnergy = 0

    for (let pos = 0; pos < total; pos += block) {
      const len = Math.min(block, total - pos)
      aec.pushReference(pcm(far.subarray(pos + delay, pos + delay + len)))
      const near = new Float32Array(len)
      for (let i = 0; i < len; i++) near[i] = 0.3 * far[pos + i]
      const out = aec.decodePCM16(aec.process(pcm(near)))
      if (pos > RATE * 2) {
        for (let i = 0; i < len; i++) {
          nearEnergy += near[i] * near[i]
          residEnergy += out[i] * out[i]
        }
      }
    }

    const erleDb = 10 * Math.log10(nearEnergy / Math.max(residEnergy, 1e-12))
    expect(erleDb).toBeGreaterThan(10)
  })
})
