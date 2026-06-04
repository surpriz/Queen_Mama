//
//  EchoCancellationServiceTests.swift
//  QueenMamaTests
//
//  Tests for EchoCancellationService (acoustic echo canceller on the mic stream):
//  - Echo cancellation: a delayed+scaled copy of the reference (speaker bleed) is
//    removed from the mic signal (high ERLE).
//  - Double-talk preservation: when the user speaks over the remote, the user's voice
//    survives (the filter does not cancel near-end speech).
//  - Safe passthrough: with no reference fed, the mic signal is returned unchanged.
//

import XCTest
@testable import QueenMama

@MainActor
final class EchoCancellationServiceTests: XCTestCase {

    // Streaming/echo parameters chosen so the echo delay lands inside the filter's
    // tap range around the service's initial 1600-sample delay guess, so the NLMS
    // converges without depending on the periodic cross-correlation search.
    private let blockSize = 320            // 20 ms @ 16 kHz
    private let echoDelay = 1_700          // samples (within initial guess + filterLength)
    private let echoGain: Float = 0.2      // realistic speaker→mic coupling (~ -14 dB)
    private let warmupBlocks = 200         // ~4 s to converge

    // Deterministic pseudo-random reference ("remote speaker" audio).
    private func makeReference(_ count: Int, seed: UInt64 = 0x9E3779B9) -> [Float] {
        var state = seed
        var out = [Float](repeating: 0, count: count)
        for i in 0..<count {
            state = state &* 6364136223846793005 &+ 1442695040888963407
            let u = Float(state >> 40) / Float(1 << 24)   // [0,1)
            out[i] = (u - 0.5) * 0.6                       // [-0.3, 0.3)
        }
        return out
    }

    private func energy(_ data: Data) -> Float {
        let s = EchoCancellationService.decodePCM16(data)
        var e: Float = 0
        for v in s { e += v * v }
        return e
    }

    // MARK: - Echo cancellation

    func test_process_cancelsDelayedEchoFromReference() {
        let aec = EchoCancellationService()

        let total = (warmupBlocks + 1) * blockSize + echoDelay
        let far = makeReference(total)

        var lastMicEnergy: Float = 0
        var lastResidualEnergy: Float = 0

        for b in 0..<(warmupBlocks + 1) {
            let t = b * blockSize
            let refBlock = Array(far[t..<t + blockSize])

            // mic = pure echo: a delayed, attenuated copy of the reference.
            var micBlock = [Float](repeating: 0, count: blockSize)
            for i in 0..<blockSize {
                let src = t + i - echoDelay
                micBlock[i] = src >= 0 ? echoGain * far[src] : 0
            }

            aec.pushReference(EchoCancellationService.encodePCM16(refBlock))
            let micData = EchoCancellationService.encodePCM16(micBlock)
            let cleaned = aec.process(micData)

            lastMicEnergy = energy(micData)
            lastResidualEnergy = energy(cleaned)
        }

        // After convergence the residual echo should be far below the mic energy.
        XCTAssertGreaterThan(lastMicEnergy, 0, "Mic block should carry echo energy")
        let erle = 10 * log10(lastMicEnergy / max(lastResidualEnergy, 1e-9))
        XCTAssertGreaterThan(erle, 12.0, "Expected >12 dB echo reduction, got \(erle) dB")
    }

    // MARK: - Double-talk

    func test_process_preservesNearEndSpeechDuringDoubleTalk() {
        let aec = EchoCancellationService()

        let total = (warmupBlocks + 1) * blockSize + echoDelay
        let far = makeReference(total)

        // Converge on echo-only first.
        for b in 0..<warmupBlocks {
            let t = b * blockSize
            let refBlock = Array(far[t..<t + blockSize])
            var micBlock = [Float](repeating: 0, count: blockSize)
            for i in 0..<blockSize {
                let src = t + i - echoDelay
                micBlock[i] = src >= 0 ? echoGain * far[src] : 0
            }
            aec.pushReference(EchoCancellationService.encodePCM16(refBlock))
            _ = aec.process(EchoCancellationService.encodePCM16(micBlock))
        }

        // Now add a strong near-end tone (user talking over the remote).
        let t = warmupBlocks * blockSize
        let refBlock = Array(far[t..<t + blockSize])
        var nearBlock = [Float](repeating: 0, count: blockSize)
        var micBlock = [Float](repeating: 0, count: blockSize)
        for i in 0..<blockSize {
            let src = t + i - echoDelay
            let echo = src >= 0 ? echoGain * far[src] : 0
            let near = 0.4 * sinf(2 * .pi * 440 * Float(t + i) / 16_000)
            nearBlock[i] = near
            micBlock[i] = echo + near
        }

        aec.pushReference(EchoCancellationService.encodePCM16(refBlock))
        let cleaned = aec.process(EchoCancellationService.encodePCM16(micBlock))

        // The user's voice must survive — residual retains most of the near-end energy.
        var nearEnergy: Float = 0
        for v in nearBlock { nearEnergy += v * v }
        let residualEnergy = energy(cleaned)
        XCTAssertGreaterThan(residualEnergy, nearEnergy * 0.4,
            "Near-end speech should be preserved during double-talk")
    }

    // MARK: - Sustained double-talk (regression guard)

    /// Regression guard: SUSTAINED double-talk must not corrupt the converged filter.
    /// A single onset sample adapting with the user's voice as the error used to knock
    /// the filter off its optimum (dropping the user's words). After many double-talk
    /// blocks, echo cancellation must resume at full strength on clean echo-only audio.
    func test_process_survivesSustainedDoubleTalk() {
        let aec = EchoCancellationService()
        let dtBlocks = 60
        let total = (warmupBlocks + dtBlocks + 10) * blockSize + echoDelay
        let far = makeReference(total)
        let near = makeReference(70 * blockSize, seed: 0xABCDEF) // user voice, uncorrelated

        func echoBlock(_ t: Int) -> [Float] {
            var m = [Float](repeating: 0, count: blockSize)
            for i in 0..<blockSize {
                let src = t + i - echoDelay
                m[i] = src >= 0 ? echoGain * far[src] : 0
            }
            return m
        }

        // Converge on clean echo.
        for b in 0..<warmupBlocks {
            let t = b * blockSize
            aec.pushReference(EchoCancellationService.encodePCM16(Array(far[t..<t + blockSize])))
            _ = aec.process(EchoCancellationService.encodePCM16(echoBlock(t)))
        }
        // Sustained double-talk: echo + continuous user voice.
        for k in 0..<dtBlocks {
            let t = (warmupBlocks + k) * blockSize
            aec.pushReference(EchoCancellationService.encodePCM16(Array(far[t..<t + blockSize])))
            let eb = echoBlock(t)
            var m = [Float](repeating: 0, count: blockSize)
            for i in 0..<blockSize { m[i] = eb[i] + near[k * blockSize + i] }
            _ = aec.process(EchoCancellationService.encodePCM16(m))
        }
        // Echo-only again: the filter must still cancel (it was frozen, not corrupted).
        let t = (warmupBlocks + dtBlocks) * blockSize
        aec.pushReference(EchoCancellationService.encodePCM16(Array(far[t..<t + blockSize])))
        let micData = EchoCancellationService.encodePCM16(echoBlock(t))
        let cleaned = aec.process(micData)
        let erle = 10 * log10(energy(micData) / max(energy(cleaned), 1e-9))
        XCTAssertGreaterThan(erle, 30.0,
            "Echo cancellation must survive sustained double-talk, got \(erle) dB")
    }

    // MARK: - Passthrough

    func test_process_withoutReference_returnsInputUnchanged() {
        let aec = EchoCancellationService()
        let mic = makeReference(blockSize, seed: 0x1234)
        let micData = EchoCancellationService.encodePCM16(mic)

        let out = aec.process(micData)

        XCTAssertEqual(out, micData, "With no reference the mic signal must pass through unchanged")
    }
}
