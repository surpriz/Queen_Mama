//
//  TranscriptBufferTests.swift
//  QueenMamaTests
//
//  Tests for TranscriptBuffer:
//  - Batch accumulation and text concatenation
//  - Flush timing with onFlush callback
//  - Reset behavior (flushes remaining, clears state)
//  - Empty buffer handling
//

import XCTest
@testable import QueenMama

@MainActor
final class TranscriptBufferTests: XCTestCase {

    var buffer: TranscriptBuffer!
    var flushedTexts: [String]!

    override func setUp() {
        super.setUp()
        buffer = TranscriptBuffer()
        flushedTexts = []
        buffer.onFlush = { [weak self] text in
            self?.flushedTexts.append(text)
        }
    }

    override func tearDown() {
        buffer = nil
        flushedTexts = nil
        super.tearDown()
    }

    // MARK: - Append and Flush

    func testAppendAccumulatesText() {
        buffer.append("Hello")
        buffer.append("World")

        // Force flush to get accumulated text
        buffer.flush()

        XCTAssertEqual(flushedTexts.count, 1, "Should flush once")
        XCTAssertTrue(flushedTexts[0].contains("Hello"), "Flushed text should contain first append")
        XCTAssertTrue(flushedTexts[0].contains("World"), "Flushed text should contain second append")
    }

    func testAppendAddsSpaceSeparator() {
        buffer.append("Hello")
        buffer.append("World")
        buffer.flush()

        // append() adds " " after each text
        XCTAssertEqual(flushedTexts[0], "Hello World ", "Text should be space-separated")
    }

    func testFlushEmptyBufferDoesNotCallback() {
        buffer.flush()
        XCTAssertEqual(flushedTexts.count, 0, "Empty buffer flush should not fire callback")
    }

    func testFlushClearsBuffer() {
        buffer.append("First batch")
        buffer.flush()
        XCTAssertEqual(flushedTexts.count, 1)

        buffer.append("Second batch")
        buffer.flush()
        XCTAssertEqual(flushedTexts.count, 2)
        XCTAssertTrue(flushedTexts[1].contains("Second batch"))
        XCTAssertFalse(flushedTexts[1].contains("First batch"),
            "Second flush should not contain first batch text")
    }

    // MARK: - Reset

    func testResetFlushesRemainingText() {
        buffer.append("Pending text")
        buffer.reset()

        XCTAssertEqual(flushedTexts.count, 1, "Reset should flush pending text")
        XCTAssertTrue(flushedTexts[0].contains("Pending text"))
    }

    func testResetWithEmptyBufferDoesNotCallback() {
        buffer.start()
        buffer.reset()
        XCTAssertEqual(flushedTexts.count, 0, "Reset with empty buffer should not fire callback")
    }

    func testResetClearsStateForNextSession() {
        buffer.append("Session 1 text")
        buffer.reset()
        flushedTexts.removeAll()

        buffer.start()
        buffer.append("Session 2 text")
        buffer.flush()

        XCTAssertEqual(flushedTexts.count, 1)
        XCTAssertFalse(flushedTexts[0].contains("Session 1"),
            "After reset, no text from previous session should remain")
    }

    // MARK: - Start

    func testStartClearsState() {
        buffer.append("Old text")
        // Don't flush - text is pending
        buffer.start() // Should clear pending text

        buffer.flush()
        // After start(), pendingText is cleared, so flush should produce nothing
        XCTAssertEqual(flushedTexts.count, 0, "Start should clear pending text without flushing")
    }

    // MARK: - No Callback

    func testNoCallbackDoesNotCrash() {
        buffer.onFlush = nil
        buffer.append("Test text")
        buffer.flush()
        // Should not crash even without callback
    }

    // MARK: - Timer-Based Flush

    func testTimerBasedFlush() async {
        buffer.append("Timed text")

        // Wait for flush interval (0.5s) + margin
        let expectation = XCTestExpectation(description: "Timer flush")
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.8) {
            expectation.fulfill()
        }
        await fulfillment(of: [expectation], timeout: 2.0)

        XCTAssertGreaterThanOrEqual(flushedTexts.count, 1, "Should auto-flush after timer interval")
    }
}
