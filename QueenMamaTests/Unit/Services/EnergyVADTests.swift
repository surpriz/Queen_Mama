//
//  EnergyVADTests.swift
//  QueenMamaTests
//
//  Tests for the local energy-based voice-activity detector:
//  - Silence is gated (no output)
//  - Speech onset emits the chunk plus buffered pre-roll
//  - Sustained speech keeps emitting
//  - reset() clears state
//

import XCTest
@testable import QueenMama

@MainActor
final class EnergyVADTests: XCTestCase {

    /// 480-sample (30ms @16kHz) PCM16 chunk at a given amplitude.
    private func chunk(amplitude: Int16, samples: Int = 480) -> Data {
        var values = [Int16](repeating: amplitude, count: samples)
        // Alternate sign so it's a real signal, not DC (DC has RMS == |amp| too,
        // but alternating better mimics audio).
        for i in stride(from: 1, to: samples, by: 2) { values[i] = -amplitude }
        return values.withUnsafeBytes { Data($0) }
    }

    func test_silence_producesNoOutput() {
        let vad = EnergyVAD()
        let silence = Data(count: 480 * 2) // zeros
        for _ in 0..<10 {
            XCTAssertTrue(vad.process(silence).isEmpty)
        }
    }

    func test_speechOnset_emitsPreRollPlusChunk() {
        let vad = EnergyVAD(config: .default)
        let silence = Data(count: 480 * 2)

        // Feed several silent chunks (gated, but fill the pre-roll window).
        for _ in 0..<5 { XCTAssertTrue(vad.process(silence).isEmpty) }

        // First loud chunk: should flush pre-roll (3) + this chunk = 4.
        let out = vad.process(chunk(amplitude: 8000))
        XCTAssertEqual(out.count, EnergyVAD.Config.default.preSpeechPadChunks + 1)
    }

    func test_sustainedSpeech_keepsEmitting() {
        let vad = EnergyVAD()
        _ = vad.process(chunk(amplitude: 8000)) // onset
        for _ in 0..<5 {
            XCTAssertFalse(vad.process(chunk(amplitude: 8000)).isEmpty)
        }
    }

    func test_reset_clearsState() {
        let vad = EnergyVAD()
        _ = vad.process(chunk(amplitude: 8000))
        vad.reset()
        // After reset, a single silent chunk must be gated again.
        XCTAssertTrue(vad.process(Data(count: 480 * 2)).isEmpty)
    }
}
