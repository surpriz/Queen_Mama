//
//  AudioPipelineIntegrationTests.swift
//  QueenMamaTests
//
//  Integration tests for the audio pipeline:
//  AudioCapture → AudioBatching → TranscriptionService
//
//  These tests verify data flows correctly through the chain
//  using mock audio data (no hardware required).
//

import XCTest
import AVFoundation
@testable import QueenMama

@MainActor
final class AudioPipelineIntegrationTests: XCTestCase {

    // MARK: - AudioBatching → Callback Pipeline

    /// Tests the core pipeline: audio data flows from append() through onBatchReady
    func testAudioDataFlowsThroughBatching() {
        let batchingService = AudioBatchingService()
        var receivedData = Data()
        let expectation = XCTestExpectation(description: "Batch ready callback fired")

        batchingService.onBatchReady = { batch in
            receivedData.append(batch)
            expectation.fulfill()
        }
        batchingService.start()

        // Simulate AudioCaptureService sending 3200-byte chunks
        let audioChunk = Data(repeating: 0x42, count: 3_200)
        for _ in 0..<10 {  // 10 * 3200 = 32KB = targetBatchSize
            batchingService.append(audioChunk)
        }

        wait(for: [expectation], timeout: 2.0)

        XCTAssertGreaterThan(receivedData.count, 0, "Should receive batched audio data")
        XCTAssertEqual(receivedData.count, 32_000, "Should receive exactly one target batch")

        batchingService.reset()
    }

    /// Tests multiple batches flowing through the pipeline
    func testMultipleBatchesFlowCorrectly() {
        let batchingService = AudioBatchingService()
        var batchCount = 0
        var totalBytes = 0

        batchingService.onBatchReady = { batch in
            batchCount += 1
            totalBytes += batch.count
        }
        batchingService.start()

        // Send 5 seconds of audio (5 * 32KB = 160KB)
        let audioChunk = Data(repeating: 0x42, count: 3_200)
        for _ in 0..<50 {
            batchingService.append(audioChunk)
        }

        // 50 * 3200 = 160,000 bytes / 32,000 targetBatchSize = 5 batches
        XCTAssertEqual(batchCount, 5, "Should produce 5 batches for 160KB of data")
        XCTAssertEqual(totalBytes, 160_000, "Total bytes should match input")

        batchingService.reset()
    }

    // MARK: - Full Conversion Pipeline (AVAudioConverter → Batching)

    /// Simulates the complete audio pipeline:
    /// Raw audio buffer → Format conversion → Int16 encoding → Batching
    func testFullConversionPipeline() {
        let inputFormat = AVAudioFormat(
            commonFormat: .pcmFormatFloat32,
            sampleRate: 48000,
            channels: 1,
            interleaved: false
        )!
        let outputFormat = AVAudioFormat(
            commonFormat: .pcmFormatFloat32,
            sampleRate: 16000,
            channels: 1,
            interleaved: false
        )!

        let converter = AVAudioConverter(from: inputFormat, to: outputFormat)!
        let batchingService = AudioBatchingService()
        var totalBytesReceived = 0

        batchingService.onBatchReady = { batch in
            totalBytesReceived += batch.count
        }
        batchingService.start()

        // Simulate 50 audio callbacks (~5 seconds at 48kHz)
        for _ in 0..<50 {
            converter.reset()

            // Create input buffer (4800 frames = 100ms at 48kHz)
            let inputBuffer = AVAudioPCMBuffer(pcmFormat: inputFormat, frameCapacity: 4800)!
            inputBuffer.frameLength = 4800
            let channelData = inputBuffer.floatChannelData![0]
            for i in 0..<4800 {
                channelData[i] = sin(Float(i) * 2 * .pi * 440 / 48000)
            }

            // Convert 48kHz → 16kHz
            let ratio = outputFormat.sampleRate / inputFormat.sampleRate
            let outputFrameCount = AVAudioFrameCount(Double(4800) * ratio)
            let convertedBuffer = AVAudioPCMBuffer(pcmFormat: outputFormat, frameCapacity: outputFrameCount)!

            var convError: NSError?
            var hasProvidedInput = false
            let inputBlock: AVAudioConverterInputBlock = { _, outStatus in
                if hasProvidedInput {
                    outStatus.pointee = .endOfStream
                    return nil
                }
                hasProvidedInput = true
                outStatus.pointee = .haveData
                return inputBuffer
            }

            converter.convert(to: convertedBuffer, error: &convError, withInputFrom: inputBlock)

            guard convError == nil, convertedBuffer.frameLength > 0 else {
                XCTFail("Conversion should succeed with reset()")
                return
            }

            // Convert Float32 → Int16 PCM
            let floatData = convertedBuffer.floatChannelData![0]
            let frameCount = Int(convertedBuffer.frameLength)
            var int16Data = [Int16](repeating: 0, count: frameCount)
            for i in 0..<frameCount {
                let sample = floatData[i]
                let clamped = max(-1.0, min(1.0, sample))
                int16Data[i] = Int16(clamped * Float(Int16.max))
            }

            let pcmData = Data(bytes: &int16Data, count: frameCount * 2)

            // Feed into batching service
            batchingService.append(pcmData)
        }

        // Force flush remaining
        batchingService.reset()

        // 50 callbacks * 1600 output frames * 2 bytes = 160,000 bytes expected
        XCTAssertEqual(totalBytesReceived, 160_000,
            "Pipeline should produce expected bytes: 50 * 1600 frames * 2 bytes/frame")
    }

    // MARK: - Data Integrity Through Pipeline

    /// Verifies that audio data is not corrupted through the batching pipeline
    func testDataIntegrityThroughBatching() {
        let batchingService = AudioBatchingService()
        var allReceivedData = Data()

        batchingService.onBatchReady = { batch in
            allReceivedData.append(batch)
        }
        batchingService.start()

        // Create data with known pattern
        var knownData = Data()
        for i in 0..<40 {
            var chunk = Data(count: 3_200)
            for j in 0..<chunk.count {
                chunk[j] = UInt8((i * 3200 + j) % 256)
            }
            knownData.append(chunk)
            batchingService.append(chunk)
        }

        // Flush remaining
        batchingService.reset()

        XCTAssertEqual(allReceivedData.count, knownData.count,
            "All bytes should be preserved through batching")
        XCTAssertEqual(allReceivedData, knownData,
            "Data should not be corrupted through batching pipeline")
    }

    // MARK: - Edge Cases

    /// Tests pipeline with very small audio chunks
    func testPipelineWithSmallChunks() {
        let batchingService = AudioBatchingService()
        var batchCount = 0

        batchingService.onBatchReady = { _ in
            batchCount += 1
        }
        batchingService.start()

        // Send many tiny chunks (simulating very small buffer sizes)
        for _ in 0..<1000 {
            batchingService.append(Data(repeating: 0x01, count: 100))
        }

        // 1000 * 100 = 100,000 bytes / 32,000 = 3 full batches + remainder
        XCTAssertEqual(batchCount, 3, "Should produce 3 full batches from 100KB in tiny chunks")

        batchingService.reset()
    }

    /// Tests pipeline with empty data
    func testPipelineWithEmptyData() {
        let batchingService = AudioBatchingService()
        var batchCount = 0

        batchingService.onBatchReady = { _ in
            batchCount += 1
        }
        batchingService.start()

        // Append empty data
        batchingService.append(Data())
        batchingService.flush()

        XCTAssertEqual(batchCount, 0, "Empty data should not produce batches")

        batchingService.reset()
    }
}
