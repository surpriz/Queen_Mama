import Foundation
import Accelerate

/// Acoustic Echo Canceller for the microphone stream.
///
/// Problem it solves: when the remote participant plays through the speakers,
/// the microphone picks that audio up ("bleed"). Deepgram then transcribes it on
/// the mic stream and it gets labelled "Moi" — the wrong speaker. The old approach
/// filtered this *after* transcription (`TranscriptDeduplicator`), which is lossy.
///
/// Here we cancel the echo at the **signal level, before transcription**, using the
/// system-audio stream (which we already capture for the "Interlocuteur" channel) as
/// the far-end reference. After cancellation the bleed never reaches Deepgram, so it
/// can never be mis-attributed to "Moi".
///
/// Algorithm: a normalized least-mean-squares (NLMS) adaptive FIR filter models the
/// speaker→air→mic echo path and subtracts its prediction from the mic signal.
///
/// Key design choices:
/// - **Self-aligning delay**: the mic and system streams arrive on independent clocks
///   via separate capture callbacks, so there is no shared sample timeline. Instead of
///   plumbing timestamps we estimate the bulk delay from the data itself with a
///   normalized cross-correlation, anchored to real-time arrival order (the echo of a
///   far-end sample reaches the mic a few tens of ms after we receive that far sample).
/// - **Double-talk freeze**: when the user speaks *over* the remote (near-end energy
///   dominates the predicted echo), adaptation is frozen so the filter does not diverge
///   trying to cancel the user's own voice. This is the main advantage over the old
///   blanket 1.5 s temporal suppression, which simply dropped the user's speech.
/// - **Safe passthrough**: with no reference (system audio unavailable) or with
///   headphones (reference present but no acoustic echo) the filter output ≈ mic input,
///   so the AEC is always safe to leave on.
///
/// All work happens on the MainActor because both the mic and system audio callbacks
/// already dispatch to the main thread. The per-block cost (NLMS over a 16 kHz mono
/// stream with a 512-tap filter) is a few million MACs/sec — negligible.
@MainActor
final class EchoCancellationService {

    // MARK: - Configuration

    /// Both streams are 16 kHz mono PCM16 (Deepgram target format).
    private let sampleRate = 16_000

    /// Adaptive FIR length (taps). 512 taps ≈ 32 ms of echo tail after bulk-delay
    /// compensation — enough for the short speaker→mic acoustic path once the larger,
    /// variable pipeline delay is removed by the delay estimator.
    private let filterLength = 512

    /// Far-end reference ring capacity. 2 s covers any realistic combined
    /// acoustic + capture-pipeline delay plus the filter tail and search range.
    private let referenceCapacity = 16_000 * 2

    /// Maximum bulk delay searched by the cross-correlation aligner (0.6 s).
    private let maxDelaySamples = 9_600

    /// NLMS step size (0 < mu <= 1). Conservative for stability; the normalization
    /// makes convergence largely level-independent.
    private let mu: Float = 0.5

    /// NLMS regularization, avoids divide-by-zero on silent reference blocks.
    private let regularization: Float = 1e-6

    /// Re-estimate the bulk delay at most this often (samples ≈ 0.5 s).
    private let delayRefreshInterval = 8_000

    /// Geigel-style double-talk threshold: freeze adaptation when the near-end sample
    /// energy exceeds the recent far-end peak by this factor (≈ user talking over).
    private let doubleTalkThreshold: Float = 2.0

    // MARK: - State

    /// Adaptive filter weights (echo path estimate).
    private var weights: [Float]

    /// Circular far-end (reference) buffer.
    private var farRing: [Float]
    private var farWrite = 0          // next write position in ring
    private var farCount = 0          // total far samples ever written (monotonic)

    /// Current bulk-delay estimate (far samples behind the write head).
    private var delaySamples = 1_600 // ~100 ms initial guess
    private var samplesSinceDelayRefresh = 0

    /// Recent far-end peak magnitude for the double-talk detector.
    private var farPeak: Float = 0

    /// ERLE accumulation for periodic logging.
    private var erleNearAcc: Float = 0
    private var erleResidAcc: Float = 0
    private var processedBlocks = 0

    private var hasReference = false

    // MARK: - Init

    init() {
        weights = [Float](repeating: 0, count: filterLength)
        farRing = [Float](repeating: 0, count: referenceCapacity)
    }

    // MARK: - Public API

    /// True once a far-end reference has been received and the filter has enough
    /// history to cancel. When active, the bleed is removed at the signal level so the
    /// text-level deduplicator can drop its aggressive blanket suppression.
    var isActive: Bool { hasReference && farCount >= filterLength }

    /// Feed a far-end (system audio) PCM16 chunk to use as the echo reference.
    /// Call this for every system-audio buffer, *in addition* to its normal
    /// transcription path. Cheap: just decodes and stores into the ring.
    func pushReference(_ data: Data) {
        let samples = Self.decodePCM16(data)
        guard !samples.isEmpty else { return }
        hasReference = true

        for s in samples {
            farRing[farWrite] = s
            farWrite = (farWrite + 1) % referenceCapacity
        }
        farCount += samples.count

        // Track a decaying peak for double-talk detection.
        var blockPeak: Float = 0
        vDSP_maxmgv(samples, 1, &blockPeak, vDSP_Length(samples.count))
        farPeak = max(blockPeak, farPeak * 0.95)
    }

    /// Cancel echo from a microphone PCM16 chunk and return the cleaned PCM16.
    /// If no reference is available the input is returned essentially unchanged.
    func process(_ data: Data) -> Data {
        let near = Self.decodePCM16(data)
        guard !near.isEmpty else { return data }

        // No reference yet → safe passthrough.
        guard hasReference, farCount >= filterLength else { return data }

        let n = near.count

        // Snapshot the most recent contiguous far-end window for this block:
        // it ends `delaySamples` behind the current write head and must be long
        // enough to provide a `filterLength` history for every near sample.
        let needed = n + filterLength + delaySamples
        let available = min(farCount, referenceCapacity)
        guard available >= needed else { return data }

        // Periodically refresh the bulk-delay estimate when both streams are active.
        samplesSinceDelayRefresh += n
        if samplesSinceDelayRefresh >= delayRefreshInterval {
            samplesSinceDelayRefresh = 0
            refreshDelay(near: near)
        }

        // Linearize the far window we need into a flat array indexed [0 ..< spanLen),
        // where the last sample corresponds to (write head - delaySamples).
        let spanLen = n + filterLength
        let endOffset = delaySamples                  // samples behind write head
        let far = linearizedFar(spanLen: spanLen, endOffset: endOffset)

        var out = [Float](repeating: 0, count: n)
        var nearEnergy: Float = 0
        var residEnergy: Float = 0

        // For near sample j, the aligned far history is far[j ..< j+filterLength],
        // with far[j+filterLength-1] the most recent (delay-compensated) far sample.
        for j in 0..<n {
            // Filter output yhat = w · far_window   (dot product via vDSP).
            var yhat: Float = 0
            far.withUnsafeBufferPointer { fp in
                weights.withUnsafeBufferPointer { wp in
                    vDSP_dotpr(fp.baseAddress! + j, 1, wp.baseAddress!, 1, &yhat, vDSP_Length(filterLength))
                }
            }

            let d = near[j]
            let e = d - yhat            // residual = cleaned mic sample
            out[j] = e

            nearEnergy += d * d
            residEnergy += e * e

            // Double-talk detector: skip the weight update when the near-end clearly
            // dominates the reference (user is talking over the remote), so we don't
            // adapt the filter onto the user's own voice.
            let isDoubleTalk = abs(d) > doubleTalkThreshold * farPeak && farPeak > 0
            if !isDoubleTalk {
                // NLMS update: w += mu * e * x / (||x||^2 + eps)
                var norm: Float = 0
                far.withUnsafeBufferPointer { fp in
                    vDSP_dotpr(fp.baseAddress! + j, 1, fp.baseAddress! + j, 1, &norm, vDSP_Length(filterLength))
                }
                let g = mu * e / (norm + regularization)
                if g != 0 {
                    var scale = g
                    far.withUnsafeBufferPointer { fp in
                        weights.withUnsafeMutableBufferPointer { wp in
                            // w[i] += scale * far[j+i]
                            vDSP_vsma(fp.baseAddress! + j, 1, &scale, wp.baseAddress!, 1, wp.baseAddress!, 1, vDSP_Length(filterLength))
                        }
                    }
                }
            }
        }

        // Accumulate ERLE (echo return loss enhancement) for diagnostics.
        erleNearAcc += nearEnergy
        erleResidAcc += residEnergy
        processedBlocks += 1
        if processedBlocks % 50 == 0 {
            let erle = erleResidAcc > 0 ? 10 * log10f(erleNearAcc / erleResidAcc) : 0
            print("[AEC] ERLE=\(String(format: "%.1f", erle))dB delay=\(delaySamples) (\(String(format: "%.0f", Double(delaySamples) / 16.0))ms)")
            erleNearAcc = 0
            erleResidAcc = 0
        }

        return Self.encodePCM16(out)
    }

    /// Clear all adaptive state. Call on session end.
    func reset() {
        for i in weights.indices { weights[i] = 0 }
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

    // MARK: - Delay estimation

    /// Estimate the bulk delay between near-end and far-end via normalized
    /// cross-correlation, searching lags in [0, maxDelaySamples]. The lag with the
    /// strongest correlation becomes the new `delaySamples`.
    private func refreshDelay(near: [Float]) {
        // Use a short, energetic slice of the near block for the search.
        let win = min(near.count, 1_600)
        guard win >= 256 else { return }
        let nearSlice = Array(near.suffix(win))

        var nearNorm: Float = 0
        vDSP_dotpr(nearSlice, 1, nearSlice, 1, &nearNorm, vDSP_Length(win))
        guard nearNorm > regularization else { return }   // near-end silent → keep estimate

        var bestLag = delaySamples
        var bestScore: Float = -1

        // Coarse search (step) then nothing fancy — good enough to seat the NLMS,
        // which then fine-tunes within its tap range.
        let step = 16
        var lag = 0
        while lag <= maxDelaySamples {
            let far = linearizedFar(spanLen: win, endOffset: lag)
            var dot: Float = 0
            var farNorm: Float = 0
            vDSP_dotpr(far, 1, nearSlice, 1, &dot, vDSP_Length(win))
            vDSP_dotpr(far, 1, far, 1, &farNorm, vDSP_Length(win))
            if farNorm > regularization {
                let score = (dot * dot) / (farNorm * nearNorm)  // normalized, squared
                if score > bestScore {
                    bestScore = score
                    bestLag = lag
                }
            }
            lag += step
        }

        // Only accept a confident correlation, else keep the previous delay.
        if bestScore > 0.05 {
            delaySamples = bestLag
        }
    }

    // MARK: - Far-end ring helpers

    /// Copy `spanLen` contiguous far-end samples ending `endOffset` samples behind the
    /// write head into a flat array (index 0 = oldest, last = most recent in window).
    private func linearizedFar(spanLen: Int, endOffset: Int) -> [Float] {
        var span = [Float](repeating: 0, count: spanLen)
        // Absolute end position (exclusive) in the monotonic far stream.
        let endAbs = farCount - endOffset
        let startAbs = endAbs - spanLen
        guard startAbs >= 0 else { return span }

        for i in 0..<spanLen {
            let abs = startAbs + i
            span[i] = farRing[abs % referenceCapacity]
        }
        return span
    }

    // MARK: - PCM helpers

    /// Decode little-endian PCM16 `Data` to normalized Float [-1, 1].
    nonisolated static func decodePCM16(_ data: Data) -> [Float] {
        let count = data.count / 2
        guard count > 0 else { return [] }
        var floats = [Float](repeating: 0, count: count)
        data.withUnsafeBytes { (raw: UnsafeRawBufferPointer) in
            let int16 = raw.bindMemory(to: Int16.self)
            for i in 0..<count {
                floats[i] = Float(Int16(littleEndian: int16[i])) / Float(Int16.max)
            }
        }
        return floats
    }

    /// Encode normalized Float [-1, 1] back to little-endian PCM16 `Data`.
    nonisolated static func encodePCM16(_ samples: [Float]) -> Data {
        var int16 = [Int16](repeating: 0, count: samples.count)
        for i in samples.indices {
            let clamped = max(-1.0, min(1.0, samples[i]))
            int16[i] = Int16((clamped * Float(Int16.max)).rounded())
        }
        return int16.withUnsafeBytes { Data($0) }
    }
}
