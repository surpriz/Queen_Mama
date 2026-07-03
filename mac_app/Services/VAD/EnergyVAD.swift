//
//  EnergyVAD.swift
//  QueenMama
//
//  Dependency-free voice-activity detector. Decides speech vs. silence per
//  incoming PCM16 chunk using RMS energy against an adaptive noise floor, with
//  hysteresis (separate onset/offset thresholds), a hangover ("redemption")
//  window so trailing speech isn't cut, and a pre-roll ring buffer so word
//  starts survive the silence→speech transition.
//
//  Parameters intentionally mirror the Silero/@ricky0123 VAD vocabulary so a
//  future `SileroVAD` can reuse the same tuning concepts.
//

import Foundation
import Accelerate

@MainActor
final class EnergyVAD: VoiceActivityDetector {

    // MARK: - Tunables

    struct Config {
        /// Onset: speech starts when RMS exceeds noiseFloor * this factor.
        var positiveSpeechThreshold: Float = 3.0
        /// Offset: speech ends when RMS falls below noiseFloor * this factor.
        var negativeSpeechThreshold: Float = 1.6
        /// Absolute RMS floor (normalized 0...1) below which we never call speech,
        /// guarding against the adaptive floor collapsing to ~0 in pure silence.
        var minAbsoluteRMS: Float = 0.0030
        /// Chunks of sub-threshold audio tolerated before declaring end of speech
        /// (hangover). At ~85ms/chunk, 8 ≈ 680ms.
        var redemptionChunks: Int = 8
        /// Chunks of pre-speech audio replayed on onset so word starts aren't clipped.
        var preSpeechPadChunks: Int = 3
        /// Smoothing for the adaptive noise floor (EWMA, per sub-threshold chunk).
        var noiseFloorAdaptation: Float = 0.05

        static let `default` = Config()
    }

    private let config: Config
    private let label: String

    // MARK: - State

    private enum State { case silence, speech }
    private var state: State = .silence
    private var noiseFloor: Float = 0.01
    private var redemptionCounter: Int = 0
    private var preRoll: [Data] = []

    #if DEBUG
    // Debug stats: how much audio is gated as silence.
    private var totalChunks: Int = 0
    private var gatedChunks: Int = 0
    #endif

    // MARK: - Init

    init(config: Config = .default, label: String = "vad") {
        self.config = config
        self.label = label
    }

    // MARK: - VoiceActivityDetector

    func process(_ chunk: Data) -> [Data] {
        guard !chunk.isEmpty else { return [] }

        let out = classify(chunk)
        #if DEBUG
        totalChunks += 1
        if out.isEmpty { gatedChunks += 1 }
        if totalChunks % 100 == 0 {
            let pct = Int(Double(gatedChunks) / Double(totalChunks) * 100)
            print("[VAD \(label)] \(gatedChunks)/\(totalChunks) chunks gated as silence (\(pct)% dropped), noiseFloor=\(String(format: "%.4f", noiseFloor))")
        }
        #endif
        return out
    }

    private func classify(_ chunk: Data) -> [Data] {
        let rms = Self.rms(of: chunk)
        let onset = max(noiseFloor * config.positiveSpeechThreshold, config.minAbsoluteRMS)
        let offset = max(noiseFloor * config.negativeSpeechThreshold, config.minAbsoluteRMS * 0.5)

        switch state {
        case .silence:
            // Keep a rolling window of recent silence for pre-roll.
            preRoll.append(chunk)
            if preRoll.count > config.preSpeechPadChunks {
                preRoll.removeFirst(preRoll.count - config.preSpeechPadChunks)
            }

            if rms > onset {
                // Speech onset: flush pre-roll + this chunk, enter speech.
                state = .speech
                redemptionCounter = 0
                let out = preRoll + [chunk]
                preRoll.removeAll(keepingCapacity: true)
                return out
            } else {
                // Still silence: learn the noise floor, forward nothing.
                adaptNoiseFloor(rms)
                return []
            }

        case .speech:
            if rms < offset {
                redemptionCounter += 1
                if redemptionCounter >= config.redemptionChunks {
                    // Sustained silence: end of utterance.
                    state = .silence
                    redemptionCounter = 0
                    adaptNoiseFloor(rms)
                    // Forward this trailing chunk so the tail isn't clipped.
                    return [chunk]
                }
                // Within hangover window: still treat as speech.
                return [chunk]
            } else {
                // Clear speech: reset hangover, keep forwarding.
                redemptionCounter = 0
                return [chunk]
            }
        }
    }

    func reset() {
        state = .silence
        noiseFloor = 0.01
        redemptionCounter = 0
        preRoll.removeAll(keepingCapacity: true)
    }

    // MARK: - Helpers

    private func adaptNoiseFloor(_ rms: Float) {
        // EWMA toward observed quiet-chunk energy; clamp to a sane range.
        noiseFloor = (1 - config.noiseFloorAdaptation) * noiseFloor
                   + config.noiseFloorAdaptation * rms
        noiseFloor = min(max(noiseFloor, 0.0005), 0.2)
    }

    /// Root-mean-square of a PCM16 chunk, normalized to 0...1.
    static func rms(of data: Data) -> Float {
        let sampleCount = data.count / 2
        guard sampleCount > 0 else { return 0 }

        return data.withUnsafeBytes { raw -> Float in
            let int16 = raw.bindMemory(to: Int16.self)
            var floats = [Float](repeating: 0, count: sampleCount)
            vDSP_vflt16(int16.baseAddress!, 1, &floats, 1, vDSP_Length(sampleCount))
            // Normalize Int16 range to -1...1.
            var scale = Float(1.0 / 32768.0)
            vDSP_vsmul(floats, 1, &scale, &floats, 1, vDSP_Length(sampleCount))
            var meanSquare: Float = 0
            vDSP_measqv(floats, 1, &meanSquare, vDSP_Length(sampleCount))
            return sqrt(meanSquare)
        }
    }
}
