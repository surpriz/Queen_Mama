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
// Geigel double-talk threshold: declare double-talk (freeze adaptation) when the mic
// peak reaches this fraction of the far peak. Echo is an attenuated copy of the far
// signal so it stays below; the user's voice crosses it. Biased low so we err toward
// freezing — the user's own words must never be eaten.
const GEIGEL_THRESHOLD = 0.5
// Keep adaptation frozen for this many samples (~0.15 s) after double-talk so brief dips
// between syllables don't re-arm the filter mid-utterance.
const HANGOVER_SAMPLES = 2_400
// Minimum far-end peak (normalized) for adaptation to run — no reference energy means no
// echo to learn, so freeze.
const FAR_ACTIVITY_FLOOR = 0.01

// State
let weights = new Float32Array(FILTER_LENGTH)
let farRing = new Float32Array(REFERENCE_CAPACITY)
let farWrite = 0
let farCount = 0
let delaySamples = 1_600 // ~100 ms initial guess
let samplesSinceDelayRefresh = 0
let dtHold = 0 // remaining hangover samples during which adaptation stays frozen
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

  for (let i = 0; i < samples.length; i++) {
    farRing[farWrite] = samples[i]
    farWrite = (farWrite + 1) % REFERENCE_CAPACITY
  }
  farCount += samples.length
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

  // Periodically refresh the bulk-delay estimate — but only outside double-talk, since
  // the cross-correlation needs clean echo (the user's voice is uncorrelated with the
  // reference and would bias the lag estimate).
  samplesSinceDelayRefresh += n
  if (samplesSinceDelayRefresh >= DELAY_REFRESH_INTERVAL && dtHold === 0) {
    samplesSinceDelayRefresh = 0
    refreshDelay(near)
  }

  // Linearize the far window we need: ends `delaySamples` behind the write head and
  // is long enough to give every near sample a FILTER_LENGTH history.
  const spanLen = n + FILTER_LENGTH
  const far = linearizedFar(spanLen, delaySamples)

  // Block-level Geigel double-talk detection. Deciding per-block UP FRONT (mic buffers
  // are short) is critical: a per-sample detector arms only AFTER the first
  // supra-threshold sample, and that one onset sample would adapt with the user's voice
  // as the error (≫ echo) and corrupt the converged filter in a single NLMS step.
  // Freezing the whole block prevents that; the hangover spans the following blocks.
  let blockFarMax = 0
  for (let i = 0; i < spanLen; i++) {
    const m = Math.abs(far[i])
    if (m > blockFarMax) blockFarMax = m
  }
  let blockNearMax = 0
  for (let i = 0; i < n; i++) {
    const m = Math.abs(near[i])
    if (m > blockNearMax) blockNearMax = m
  }
  const farActive = blockFarMax > FAR_ACTIVITY_FLOOR
  if (blockNearMax >= GEIGEL_THRESHOLD * blockFarMax) {
    dtHold = HANGOVER_SAMPLES
  }
  // Freeze adaptation during double-talk (and its hangover) or when there is no far-end
  // energy. We still subtract the converged estimate, so the echo keeps being cancelled
  // while the user's own voice passes through untouched.
  const frozen = dtHold > 0 || !farActive

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

    if (!frozen) {
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

  // Age the double-talk hangover by this block's length.
  dtHold = Math.max(0, dtHold - n)

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
  dtHold = 0
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
