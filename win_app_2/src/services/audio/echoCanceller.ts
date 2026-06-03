/**
 * EchoCanceller — acoustic echo cancellation on the microphone stream.
 *
 * Problem: when the remote participant plays through the speakers, the mic picks
 * that audio up ("bleed"). Deepgram transcribes it on the mic stream and it gets
 * labelled "Moi" — the wrong speaker. Filtering this *after* transcription
 * (transcriptDeduplicator) is lossy.
 *
 * Here we cancel the echo at the **signal level, before transcription**, using the
 * system-audio stream (already captured for the "Interlocuteur" channel) as the
 * far-end reference. After cancellation the bleed never reaches Deepgram, so it can
 * never be mis-attributed to "Moi".
 *
 * Algorithm: a normalized least-mean-squares (NLMS) adaptive FIR filter models the
 * speaker→air→mic echo path and subtracts its prediction from the mic signal.
 * This is a direct port of the macOS `EchoCancellationService.swift`; keep the two
 * in sync. See that file for the full rationale (self-aligning delay estimation,
 * double-talk freeze, safe passthrough with no reference / with headphones).
 *
 * Both streams are 16 kHz mono PCM16 (Deepgram target format).
 */

import { createLogger } from '@/lib/logger'

const log = createLogger('AEC')

// Configuration (aligned with mac_app/Utilities/EchoCancellationService.swift)
const SAMPLE_RATE = 16_000
const FILTER_LENGTH = 512 // taps ≈ 32 ms echo tail after bulk-delay compensation
const REFERENCE_CAPACITY = 16_000 * 2 // 2 s far-end ring
const MAX_DELAY_SAMPLES = 9_600 // 0.6 s cross-correlation search range
const MU = 0.5 // NLMS step size (0 < mu <= 1)
const REGULARIZATION = 1e-6
const DELAY_REFRESH_INTERVAL = 8_000 // re-estimate bulk delay ≈ every 0.5 s
const DOUBLE_TALK_THRESHOLD = 2.0 // freeze adaptation when near-end dominates the reference

// State
let weights = new Float32Array(FILTER_LENGTH)
let farRing = new Float32Array(REFERENCE_CAPACITY)
let farWrite = 0
let farCount = 0
let delaySamples = 1_600 // ~100 ms initial guess
let samplesSinceDelayRefresh = 0
let farPeak = 0
let erleNearAcc = 0
let erleResidAcc = 0
let processedBlocks = 0
let hasReference = false

/**
 * True once a far-end reference has been received and the filter has enough history
 * to cancel. When active, bleed is removed at the signal level so the text-level
 * deduplicator can drop its aggressive blanket suppression.
 */
export function isActive(): boolean {
  return hasReference && farCount >= FILTER_LENGTH
}

/** Decode little-endian PCM16 ArrayBuffer to normalized Float [-1, 1]. */
export function decodePCM16(buffer: ArrayBuffer): Float32Array {
  const view = new DataView(buffer)
  const count = Math.floor(buffer.byteLength / 2)
  const out = new Float32Array(count)
  for (let i = 0; i < count; i++) {
    out[i] = view.getInt16(i * 2, true) / 32767
  }
  return out
}

/** Encode normalized Float [-1, 1] back to little-endian PCM16 ArrayBuffer. */
export function encodePCM16(samples: Float32Array): ArrayBuffer {
  const buffer = new ArrayBuffer(samples.length * 2)
  const view = new DataView(buffer)
  for (let i = 0; i < samples.length; i++) {
    const clamped = Math.max(-1, Math.min(1, samples[i]))
    view.setInt16(i * 2, Math.round(clamped * 32767), true)
  }
  return buffer
}

/**
 * Feed a far-end (system audio) PCM16 chunk to use as the echo reference.
 * Call for every system-audio buffer, in addition to its normal transcription path.
 */
export function pushReference(buffer: ArrayBuffer): void {
  const samples = decodePCM16(buffer)
  if (samples.length === 0) return
  hasReference = true

  let blockPeak = 0
  for (let i = 0; i < samples.length; i++) {
    farRing[farWrite] = samples[i]
    farWrite = (farWrite + 1) % REFERENCE_CAPACITY
    const m = Math.abs(samples[i])
    if (m > blockPeak) blockPeak = m
  }
  farCount += samples.length
  farPeak = Math.max(blockPeak, farPeak * 0.95)
}

/**
 * Cancel echo from a microphone PCM16 chunk and return the cleaned PCM16.
 * If no reference is available the input is returned unchanged.
 */
export function process(buffer: ArrayBuffer): ArrayBuffer {
  const near = decodePCM16(buffer)
  if (near.length === 0) return buffer

  // No reference yet → safe passthrough.
  if (!hasReference || farCount < FILTER_LENGTH) return buffer

  const n = near.length
  const needed = n + FILTER_LENGTH + delaySamples
  const available = Math.min(farCount, REFERENCE_CAPACITY)
  if (available < needed) return buffer

  // Periodically refresh the bulk-delay estimate when both streams are active.
  samplesSinceDelayRefresh += n
  if (samplesSinceDelayRefresh >= DELAY_REFRESH_INTERVAL) {
    samplesSinceDelayRefresh = 0
    refreshDelay(near)
  }

  // Linearize the far window we need: ends `delaySamples` behind the write head and
  // is long enough to give every near sample a FILTER_LENGTH history.
  const spanLen = n + FILTER_LENGTH
  const far = linearizedFar(spanLen, delaySamples)

  const out = new Float32Array(n)
  let nearEnergy = 0
  let residEnergy = 0

  for (let j = 0; j < n; j++) {
    // Filter output yhat = w · far[j .. j+FILTER_LENGTH)
    let yhat = 0
    for (let i = 0; i < FILTER_LENGTH; i++) {
      yhat += weights[i] * far[j + i]
    }

    const d = near[j]
    const e = d - yhat // residual = cleaned mic sample
    out[j] = e

    nearEnergy += d * d
    residEnergy += e * e

    // Double-talk detector: skip the weight update when the near-end clearly
    // dominates the reference (user talking over the remote), so we don't adapt
    // the filter onto the user's own voice.
    const isDoubleTalk = farPeak > 0 && Math.abs(d) > DOUBLE_TALK_THRESHOLD * farPeak
    if (!isDoubleTalk) {
      let norm = 0
      for (let i = 0; i < FILTER_LENGTH; i++) {
        const x = far[j + i]
        norm += x * x
      }
      const g = (MU * e) / (norm + REGULARIZATION)
      if (g !== 0) {
        for (let i = 0; i < FILTER_LENGTH; i++) {
          weights[i] += g * far[j + i]
        }
      }
    }
  }

  // Accumulate ERLE (echo return loss enhancement) for diagnostics.
  erleNearAcc += nearEnergy
  erleResidAcc += residEnergy
  processedBlocks += 1
  if (processedBlocks % 50 === 0) {
    const erle = erleResidAcc > 0 ? 10 * Math.log10(erleNearAcc / erleResidAcc) : 0
    log.info(`ERLE=${erle.toFixed(1)}dB delay=${delaySamples} (${((delaySamples / SAMPLE_RATE) * 1000).toFixed(0)}ms)`)
    erleNearAcc = 0
    erleResidAcc = 0
  }

  return encodePCM16(out)
}

/** Clear all adaptive state. Call on session end. */
export function reset(): void {
  weights = new Float32Array(FILTER_LENGTH)
  farRing = new Float32Array(REFERENCE_CAPACITY)
  farWrite = 0
  farCount = 0
  delaySamples = 1_600
  samplesSinceDelayRefresh = 0
  farPeak = 0
  erleNearAcc = 0
  erleResidAcc = 0
  processedBlocks = 0
  hasReference = false
}

/**
 * Estimate the bulk delay between near-end and far-end via normalized
 * cross-correlation, searching lags in [0, MAX_DELAY_SAMPLES]. The lag with the
 * strongest correlation becomes the new `delaySamples`.
 */
function refreshDelay(near: Float32Array): void {
  const win = Math.min(near.length, 1_600)
  if (win < 256) return
  const nearSlice = near.subarray(near.length - win)

  let nearNorm = 0
  for (let i = 0; i < win; i++) nearNorm += nearSlice[i] * nearSlice[i]
  if (nearNorm <= REGULARIZATION) return // near-end silent → keep estimate

  let bestLag = delaySamples
  let bestScore = -1
  const step = 16
  for (let lag = 0; lag <= MAX_DELAY_SAMPLES; lag += step) {
    const far = linearizedFar(win, lag)
    let dot = 0
    let farNorm = 0
    for (let i = 0; i < win; i++) {
      dot += far[i] * nearSlice[i]
      farNorm += far[i] * far[i]
    }
    if (farNorm > REGULARIZATION) {
      const score = (dot * dot) / (farNorm * nearNorm) // normalized, squared
      if (score > bestScore) {
        bestScore = score
        bestLag = lag
      }
    }
  }

  if (bestScore > 0.05) {
    delaySamples = bestLag
  }
}

/**
 * Copy `spanLen` contiguous far-end samples ending `endOffset` samples behind the
 * write head into a flat array (index 0 = oldest, last = most recent in window).
 */
function linearizedFar(spanLen: number, endOffset: number): Float32Array {
  const span = new Float32Array(spanLen)
  const endAbs = farCount - endOffset
  const startAbs = endAbs - spanLen
  if (startAbs < 0) return span
  for (let i = 0; i < spanLen; i++) {
    span[i] = farRing[(startAbs + i) % REFERENCE_CAPACITY]
  }
  return span
}
