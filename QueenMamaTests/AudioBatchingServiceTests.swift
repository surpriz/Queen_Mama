//
//  AudioBatchingServiceTests.swift
//  QueenMamaTests
//
//  Tests for AudioBatchingService batching logic:
//  - Buffer accumulation and auto-flush at target size
//  - Minimum batch size threshold
//  - Callback firing with correct data
//  - Reset behavior
//

import XCTest
@testable import QueenMama

@MainActor
final class AudioBatchingServiceTests: XCTestCase {

    var service: AudioBatchingService!
    var receivedBatches: [Data]!

    override func setUp() {
        super.setUp()
        service = AudioBatchingService()
        receivedBatches = []
        service.onBatchReady = { [weak self] data in
            self?.receivedBatches.append(data)
        }
        service.start()
    }

    override func tearDown() {
        service.reset()
        service = nil
        receivedBatches = nil
        super.tearDown()
    }

    // MARK: - Buffer Accumulation

    func testAppendAccumulatesData() {
        let chunk = Data(repeating: 0xAA, count: 1000)
        service.append(chunk)

        // Should NOT flush yet (1KB < 8KB minimum)
        XCTAssertEqual(receivedBatches.count, 0, "Should not flush small data immediately")
    }

    func testAutoFlushAtTargetBatchSize() {
        // Target batch size is 32,000 bytes
        let chunk = Data(repeating: 0xBB, count: 32_000)
        service.append(chunk)

        XCTAssertEqual(receivedBatches.count, 1, "Should auto-flush when buffer reaches target size")
        XCTAssertEqual(receivedBatches.first?.count, 32_000, "Flushed batch should contain all data")
    }

    func testAutoFlushWithMultipleAppends() {
        // Append in smaller chunks that together exceed target
        let chunkSize = 8_000
        for _ in 0..<4 {
            service.append(Data(repeating: 0xCC, count: chunkSize))
        }

        // 4 * 8000 = 32000 = targetBatchSize, should trigger flush
        XCTAssertEqual(receivedBatches.count, 1, "Should flush when accumulated data reaches target")
        XCTAssertEqual(receivedBatches.first?.count, 32_000)
    }

    func testMultipleAutoFlushes() {
        // Send 3x the target size
        for _ in 0..<3 {
            service.append(Data(repeating: 0xDD, count: 32_000))
        }

        XCTAssertEqual(receivedBatches.count, 3, "Should flush 3 times for 3x target data")
        for batch in receivedBatches {
            XCTAssertEqual(batch.count, 32_000)
        }
    }

    // MARK: - Minimum Batch Size Threshold

    func testFlushRespectsMinBatchSize() {
        // Append less than minBatchSize (8000)
        service.append(Data(repeating: 0xEE, count: 4_000))
        service.flush()

        // Should NOT flush because data < minBatchSize and not enough time passed
        XCTAssertEqual(receivedBatches.count, 0, "Should not flush data below minimum batch size")
    }

    func testFlushSendsDataAboveMinBatchSize() {
        // Append more than minBatchSize
        service.append(Data(repeating: 0xFF, count: 10_000))
        service.flush()

        XCTAssertEqual(receivedBatches.count, 1, "Should flush data above minimum batch size")
        XCTAssertEqual(receivedBatches.first?.count, 10_000)
    }

    // MARK: - Callback Data Integrity

    func testCallbackReceivesCorrectData() {
        // Create recognizable data pattern
        var testData = Data(count: 32_000)
        for i in 0..<testData.count {
            testData[i] = UInt8(i % 256)
        }

        service.append(testData)

        XCTAssertEqual(receivedBatches.count, 1)
        XCTAssertEqual(receivedBatches.first, testData, "Callback should receive exact same data")
    }

    func testNoCallbackWhenNoListener() {
        service.onBatchReady = nil
        service.append(Data(repeating: 0x00, count: 32_000))

        // Should not crash even without callback
        XCTAssertEqual(receivedBatches.count, 0)
    }

    // MARK: - Reset Behavior

    func testResetClearsBuffer() {
        // Accumulate some data (below flush threshold)
        service.append(Data(repeating: 0x11, count: 10_000))

        // Reset should flush remaining data and clear state
        service.reset()

        // The reset calls flush() first, so we should get the accumulated data
        XCTAssertEqual(receivedBatches.count, 1, "Reset should flush remaining data")
        XCTAssertEqual(receivedBatches.first?.count, 10_000)
    }

    func testResetWithEmptyBuffer() {
        // Reset with nothing buffered - should not crash or callback
        service.reset()
        XCTAssertEqual(receivedBatches.count, 0, "Reset with empty buffer should not fire callback")
    }

    // MARK: - Realistic Audio Simulation

    func testRealisticAudioStream() {
        // Simulate real audio: 48kHz mono 16-bit = 96KB/s
        // After downsampling to 16kHz = 32KB/s
        // AudioCaptureService sends ~3200 bytes per callback (every ~100ms)

        let audioChunkSize = 3_200  // Realistic chunk from AudioCaptureService
        var totalBytesSent = 0
        var totalBytesReceived = 0

        for _ in 0..<100 {  // Simulate 100 audio callbacks (~10 seconds)
            let chunk = Data(repeating: 0x42, count: audioChunkSize)
            service.append(chunk)
            totalBytesSent += audioChunkSize
        }

        // Force flush any remaining
        if receivedBatches.isEmpty || totalBytesSent > receivedBatches.reduce(0, { $0 + $1.count }) {
            // Manually flush with enough data
            service.append(Data(repeating: 0x42, count: 32_000))
            totalBytesSent += 32_000
        }

        totalBytesReceived = receivedBatches.reduce(0) { $0 + $1.count }

        XCTAssertGreaterThan(receivedBatches.count, 0, "Should have produced batches")
        XCTAssertGreaterThan(totalBytesReceived, 0, "Should have received audio data")

        // Each batch should be at least minBatchSize
        for batch in receivedBatches {
            XCTAssertGreaterThanOrEqual(batch.count, 8_000,
                "Each batch should be at least minBatchSize (8KB)")
        }
    }
}
