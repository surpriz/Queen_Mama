//
//  AudioConverterTests.swift
//  QueenMamaTests
//
//  Tests for audio format conversion logic:
//  - AVAudioConverter reset() behavior (the bug we caught!)
//  - Float32 to Int16 PCM conversion
//  - Sample rate conversion (48kHz → 16kHz)
//  - Multiple sequential conversions
//

import XCTest
import AVFoundation
@testable import QueenMama

final class AudioConverterTests: XCTestCase {

    // Standard formats matching AudioCaptureService
    var inputFormat: AVAudioFormat!   // 48kHz Float32 mono
    var outputFormat: AVAudioFormat!  // 16kHz Float32 mono

    override func setUp() {
        super.setUp()
        inputFormat = AVAudioFormat(
            commonFormat: .pcmFormatFloat32,
            sampleRate: 48000,
            channels: 1,
            interleaved: false
        )!
        outputFormat = AVAudioFormat(
            commonFormat: .pcmFormatFloat32,
            sampleRate: 16000,
            channels: 1,
            interleaved: false
        )!
    }

    // MARK: - Converter Creation

    func testConverterCreation() {
        let converter = AVAudioConverter(from: inputFormat, to: outputFormat)
        XCTAssertNotNil(converter, "Should create converter from 48kHz to 16kHz")
    }

    // MARK: - Single Buffer Conversion

    func testSingleBufferConversion() {
        let converter = AVAudioConverter(from: inputFormat, to: outputFormat)!
        let inputBuffer = createTestBuffer(format: inputFormat, frameCount: 4800)
        let result = convertBuffer(inputBuffer, using: converter)

        XCTAssertNotNil(result, "First conversion should succeed")
        XCTAssertGreaterThan(result!.frameLength, 0, "Should produce output frames")

        // 4800 frames at 48kHz → ~1600 frames at 16kHz
        let expectedFrames = AVAudioFrameCount(Double(4800) * 16000.0 / 48000.0)
        XCTAssertEqual(result!.frameLength, expectedFrames,
            "Output frame count should match sample rate ratio")
    }

    // MARK: - The converter.reset() Bug

    /// This test reproduces the exact bug that caused "sending 0 bytes" in production.
    /// Without reset(), the second conversion returns 0 frames because the converter
    /// is stuck in "endOfStream" state from the first conversion's inputBlock.
    func testConverterWithoutResetFailsOnSecondBuffer() {
        let converter = AVAudioConverter(from: inputFormat, to: outputFormat)!

        // First conversion succeeds
        let buffer1 = createTestBuffer(format: inputFormat, frameCount: 4800)
        let result1 = convertBuffer(buffer1, using: converter)
        XCTAssertNotNil(result1, "First conversion should succeed")
        XCTAssertGreaterThan(result1!.frameLength, 0, "First conversion should produce frames")

        // Second conversion WITHOUT reset - this is the bug!
        let buffer2 = createTestBuffer(format: inputFormat, frameCount: 4800)
        let result2 = convertBuffer(buffer2, using: converter)

        // The converter is stuck in endOfStream state
        XCTAssertTrue(
            result2 == nil || result2!.frameLength == 0,
            "Without reset(), second conversion should fail or produce 0 frames"
        )
    }

    /// This test validates the fix: calling reset() before each conversion.
    func testConverterWithResetSucceedsOnMultipleBuffers() {
        let converter = AVAudioConverter(from: inputFormat, to: outputFormat)!

        for i in 0..<10 {
            // Reset before each conversion (the fix!)
            converter.reset()

            let buffer = createTestBuffer(format: inputFormat, frameCount: 4800)
            let result = convertBuffer(buffer, using: converter)

            XCTAssertNotNil(result, "Conversion \(i) should succeed with reset()")
            XCTAssertGreaterThan(result!.frameLength, 0,
                "Conversion \(i) should produce frames with reset()")
        }
    }

    /// Simulates a continuous 10-second audio stream with conversions every ~100ms
    func testContinuousStreamConversion() {
        let converter = AVAudioConverter(from: inputFormat, to: outputFormat)!
        let framesPerCallback: AVAudioFrameCount = 4800  // ~100ms at 48kHz

        var totalInputFrames: AVAudioFrameCount = 0
        var totalOutputFrames: AVAudioFrameCount = 0
        let iterations = 100  // ~10 seconds of audio

        for _ in 0..<iterations {
            converter.reset()

            let buffer = createTestBuffer(format: inputFormat, frameCount: framesPerCallback)
            let result = convertBuffer(buffer, using: converter)

            XCTAssertNotNil(result)
            totalInputFrames += framesPerCallback
            totalOutputFrames += result?.frameLength ?? 0
        }

        // Verify overall ratio
        let expectedRatio = 16000.0 / 48000.0  // 1/3
        let actualRatio = Double(totalOutputFrames) / Double(totalInputFrames)
        XCTAssertEqual(actualRatio, expectedRatio, accuracy: 0.01,
            "Overall sample rate ratio should be ~1/3")
    }

    // MARK: - Float32 to Int16 Conversion

    func testFloat32ToInt16ConversionZero() {
        let result = convertFloat32ToInt16(0.0)
        XCTAssertEqual(result, 0, "Zero float should map to zero int16")
    }

    func testFloat32ToInt16ConversionPositiveMax() {
        let result = convertFloat32ToInt16(1.0)
        XCTAssertEqual(result, Int16.max, "1.0 should map to Int16.max")
    }

    func testFloat32ToInt16ConversionNegativeMax() {
        let result = convertFloat32ToInt16(-1.0)
        XCTAssertEqual(result, -Int16.max, "-1.0 should map to -Int16.max")
    }

    func testFloat32ToInt16ConversionClamping() {
        // Values beyond [-1, 1] should be clamped
        let overMax = convertFloat32ToInt16(2.0)
        XCTAssertEqual(overMax, Int16.max, "Values > 1.0 should clamp to Int16.max")

        let underMin = convertFloat32ToInt16(-2.0)
        XCTAssertEqual(underMin, -Int16.max, "Values < -1.0 should clamp to -Int16.max")
    }

    func testFloat32ToInt16ConversionHalfAmplitude() {
        let result = convertFloat32ToInt16(0.5)
        let expected = Int16(0.5 * Float(Int16.max))
        XCTAssertEqual(result, expected, "0.5 should map to half of Int16.max")
    }

    // MARK: - Sample Rate Ratio

    func testSampleRateRatio() {
        let ratio = outputFormat.sampleRate / inputFormat.sampleRate
        XCTAssertEqual(ratio, 1.0 / 3.0, accuracy: 0.0001,
            "16kHz/48kHz should give 1/3 ratio")
    }

    func testOutputFrameCountCalculation() {
        let inputFrames: AVAudioFrameCount = 4800
        let ratio = outputFormat.sampleRate / inputFormat.sampleRate
        let outputFrames = AVAudioFrameCount(Double(inputFrames) * ratio)

        XCTAssertEqual(outputFrames, 1600,
            "4800 input frames should produce 1600 output frames")
    }

    // MARK: - Audio Level Calculation

    func testAudioLevelFromSilence() {
        let level = calculateAudioLevel(samples: [Float](repeating: 0.0, count: 100))
        XCTAssertEqual(level, 0.0, "Silence should produce level 0")
    }

    func testAudioLevelFromMaxAmplitude() {
        let level = calculateAudioLevel(samples: [Float](repeating: 1.0, count: 100))
        XCTAssertEqual(level, 1.0, "Max amplitude should produce level 1.0")
    }

    func testAudioLevelFromLowAmplitude() {
        // Very quiet signal
        let samples = [Float](repeating: 0.001, count: 100)
        let level = calculateAudioLevel(samples: samples)
        XCTAssertGreaterThan(level, 0.0, "Non-zero signal should produce non-zero level")
        XCTAssertLessThan(level, 0.5, "Very quiet signal should produce low level")
    }

    // MARK: - Helpers

    /// Creates a test audio buffer with a 440Hz sine wave
    private func createTestBuffer(format: AVAudioFormat, frameCount: AVAudioFrameCount) -> AVAudioPCMBuffer {
        let buffer = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: frameCount)!
        buffer.frameLength = frameCount
        let channelData = buffer.floatChannelData![0]
        let sampleRate = Float(format.sampleRate)
        for i in 0..<Int(frameCount) {
            channelData[i] = sin(Float(i) * 2 * .pi * 440 / sampleRate)
        }
        return buffer
    }

    /// Converts a buffer using the same pattern as AudioCaptureService
    private func convertBuffer(_ buffer: AVAudioPCMBuffer, using converter: AVAudioConverter) -> AVAudioPCMBuffer? {
        let ratio = outputFormat.sampleRate / inputFormat.sampleRate
        let frameCount = AVAudioFrameCount(Double(buffer.frameLength) * ratio)
        guard frameCount > 0 else { return nil }

        guard let convertedBuffer = AVAudioPCMBuffer(pcmFormat: outputFormat, frameCapacity: frameCount) else {
            return nil
        }

        var convError: NSError?
        var hasProvidedInput = false
        let inputBlock: AVAudioConverterInputBlock = { _, outStatus in
            if hasProvidedInput {
                outStatus.pointee = .endOfStream
                return nil
            }
            hasProvidedInput = true
            outStatus.pointee = .haveData
            return buffer
        }

        let status = converter.convert(to: convertedBuffer, error: &convError, withInputFrom: inputBlock)

        if convError != nil || (status != .haveData && status != .inputRanDry) {
            return convertedBuffer.frameLength > 0 ? convertedBuffer : nil
        }

        return convertedBuffer
    }

    /// Mirrors the Float32→Int16 conversion from AudioCaptureService
    private func convertFloat32ToInt16(_ sample: Float) -> Int16 {
        let clamped = max(-1.0, min(1.0, sample))
        return Int16(clamped * Float(Int16.max))
    }

    /// Mirrors the audio level calculation from AudioCaptureService
    private func calculateAudioLevel(samples: [Float]) -> Float {
        guard !samples.isEmpty else { return 0 }

        let rms = sqrt(samples.map { $0 * $0 }.reduce(0, +) / Float(samples.count))
        let avgPower = 20 * log10(rms)

        let minDb: Float = -80
        let maxDb: Float = 0
        if avgPower < minDb { return 0 }
        else if avgPower >= maxDb { return 1 }
        else { return (avgPower - minDb) / (maxDb - minDb) }
    }
}
