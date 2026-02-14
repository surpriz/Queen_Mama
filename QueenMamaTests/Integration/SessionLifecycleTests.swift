//
//  SessionLifecycleTests.swift
//  QueenMamaTests
//
//  Integration tests for TranscriptBuffer + AutoAnswerService interaction:
//  - Transcript accumulation in TranscriptBuffer
//  - AutoAnswerService trigger detection from buffered transcript
//  - Buffer flush -> AutoAnswer transcript update flow
//  - Cooldown and trigger condition verification
//

import XCTest
@testable import QueenMama

@MainActor
final class SessionLifecycleTests: XCTestCase {

    var buffer: TranscriptBuffer!
    var autoAnswer: AutoAnswerService!

    override func setUp() {
        super.setUp()
        buffer = TranscriptBuffer()
        autoAnswer = AutoAnswerService()
    }

    override func tearDown() {
        buffer = nil
        autoAnswer = nil
        super.tearDown()
    }

    // MARK: - TranscriptBuffer -> AutoAnswer Flow

    func test_bufferFlush_feedsAutoAnswer() {
        var flushedText = ""

        // Wire buffer to auto answer
        buffer.onFlush = { [weak self] text in
            flushedText = text
            self?.autoAnswer.onTranscriptReceived(text)
        }

        autoAnswer.isEnabled = true

        // Append text to buffer
        buffer.append("Hello, how are you doing today?")
        buffer.append("I wanted to discuss the project timeline.")

        // Force flush
        buffer.flush()

        XCTAssertTrue(flushedText.contains("Hello"),
            "Flushed text should contain appended content")
        XCTAssertTrue(flushedText.contains("project timeline"),
            "Flushed text should contain all appended content")
    }

    // MARK: - AutoAnswer Trigger Conditions

    func test_autoAnswer_questionDetection_triggersWhenEnabled() {
        var triggerCalled = false
        autoAnswer.onTrigger = {
            triggerCalled = true
        }
        autoAnswer.isEnabled = true

        // Need at least minWordsForQuestion (10) words with a question mark
        let transcript = "We have been discussing the budget for the new marketing campaign and I think we need more resources. What do you think about increasing the budget by twenty percent?"
        autoAnswer.onTranscriptReceived(transcript)

        XCTAssertTrue(triggerCalled,
            "Question mark with sufficient words should trigger auto-answer")
    }

    func test_autoAnswer_questionDetection_belowMinWords_doesNotTrigger() {
        var triggerCalled = false
        autoAnswer.onTrigger = {
            triggerCalled = true
        }
        autoAnswer.isEnabled = true

        // Below minWordsForQuestion (10) words
        let shortTranscript = "What do you think?"
        autoAnswer.onTranscriptReceived(shortTranscript)

        XCTAssertFalse(triggerCalled,
            "Question with too few words should not trigger")
    }

    func test_autoAnswer_disabled_doesNotTrigger() {
        var triggerCalled = false
        autoAnswer.onTrigger = {
            triggerCalled = true
        }
        autoAnswer.isEnabled = false

        let transcript = "We have been discussing the budget for the new marketing campaign and I think we need more resources. What do you think about increasing the budget by twenty percent?"
        autoAnswer.onTranscriptReceived(transcript)

        XCTAssertFalse(triggerCalled,
            "Disabled auto-answer should not trigger")
    }

    // MARK: - Cooldown

    func test_autoAnswer_cooldown_preventsDuplicateTrigger() {
        var triggerCount = 0
        autoAnswer.onTrigger = {
            triggerCount += 1
        }
        autoAnswer.isEnabled = true
        autoAnswer.cooldownPeriod = 10.0 // 10 second cooldown

        let transcript1 = "We have been discussing the budget for the new marketing campaign and I think we need more resources. What do you think about increasing the budget?"
        autoAnswer.onTranscriptReceived(transcript1)

        // First trigger should fire
        XCTAssertEqual(triggerCount, 1, "First trigger should fire")

        // Immediately send another qualifying transcript - should be blocked by cooldown
        let transcript2 = "Also we need to review the quarterly numbers and the sales projections for next year. Can you share the updated report?"
        autoAnswer.onTranscriptReceived(transcript2)

        XCTAssertEqual(triggerCount, 1,
            "Second trigger should be blocked by cooldown")
    }

    // MARK: - Reset

    func test_autoAnswer_reset_clearsState() {
        autoAnswer.isEnabled = true

        let transcript = "We have been discussing the budget for the new marketing campaign and I think we need more resources. What do you think about increasing the budget?"
        autoAnswer.onTranscriptReceived(transcript)

        autoAnswer.reset()

        XCTAssertNil(autoAnswer.lastAutoAnswerTime,
            "Reset should clear lastAutoAnswerTime")
    }

    // MARK: - Buffer Start/Reset Lifecycle

    func test_buffer_startResetLifecycle() {
        var flushCount = 0
        buffer.onFlush = { _ in
            flushCount += 1
        }

        // Session 1
        buffer.start()
        buffer.append("Session 1 text")
        buffer.flush()
        XCTAssertEqual(flushCount, 1)

        // End session 1
        buffer.reset()
        // Reset flushes remaining (already flushed, so no extra flush)

        // Session 2
        buffer.start()
        buffer.append("Session 2 text")
        buffer.flush()

        // Verify session 2 flush occurred
        XCTAssertGreaterThanOrEqual(flushCount, 2,
            "Second session should produce its own flush")
    }

    // MARK: - Buffer -> AutoAnswer Full Pipeline

    func test_fullPipeline_bufferAccumulation_triggersAutoAnswer() {
        var triggerFired = false
        var accumulatedTranscript = ""

        // Wire the pipeline: buffer.onFlush -> autoAnswer.onTranscriptReceived
        buffer.onFlush = { [weak self] text in
            accumulatedTranscript += text
            self?.autoAnswer.onTranscriptReceived(accumulatedTranscript)
        }

        autoAnswer.onTrigger = {
            triggerFired = true
        }

        autoAnswer.isEnabled = true
        buffer.start()

        // Simulate incoming transcript fragments
        buffer.append("We have been discussing")
        buffer.append("the budget for the")
        buffer.append("new marketing campaign")
        buffer.append("and I think we need")
        buffer.append("more resources to complete it.")
        buffer.append("What do you think about that?")

        // Force flush to simulate timer expiry
        buffer.flush()

        XCTAssertTrue(accumulatedTranscript.contains("What do you think"),
            "Accumulated transcript should contain question")

        XCTAssertTrue(triggerFired,
            "Full pipeline should trigger auto-answer on question with sufficient words")
    }

    // MARK: - Proactive Mode

    func test_autoAnswer_proactiveDismiss_tracking() {
        autoAnswer.proactiveEnabled = true

        // Record dismisses
        autoAnswer.recordProactiveDismiss()
        autoAnswer.recordProactiveDismiss()

        // Third dismiss should trigger pause (internal state)
        autoAnswer.recordProactiveDismiss()

        // After pause, engagement should reset
        autoAnswer.recordProactiveEngagement()

        // Should not crash - verifying state management
    }

    func test_autoAnswer_resetProactiveState() {
        autoAnswer.proactiveEnabled = true
        autoAnswer.resetProactiveState()

        XCTAssertNil(autoAnswer.lastDetectedMoment,
            "resetProactiveState should clear lastDetectedMoment")
    }

    // MARK: - Configuration Properties

    func test_autoAnswer_defaultConfiguration() {
        XCTAssertEqual(autoAnswer.silenceThreshold, 2.5,
            "Default silence threshold should be 2.5 seconds")
        XCTAssertEqual(autoAnswer.cooldownPeriod, 10.0,
            "Default cooldown period should be 10 seconds")
        XCTAssertEqual(autoAnswer.minWordsForSilence, 20,
            "Minimum words for silence trigger should be 20")
        XCTAssertEqual(autoAnswer.minWordsForQuestion, 10,
            "Minimum words for question trigger should be 10")
        XCTAssertEqual(autoAnswer.minWordsForSentence, 50,
            "Minimum words for sentence trigger should be 50")
    }

    func test_autoAnswer_proactiveDefaultConfiguration() {
        XCTAssertFalse(autoAnswer.proactiveEnabled,
            "Proactive mode should be disabled by default")
        XCTAssertEqual(autoAnswer.proactiveCooldown, 15.0,
            "Default proactive cooldown should be 15 seconds")
        XCTAssertEqual(autoAnswer.proactiveSensitivity, 0.7, accuracy: 0.01,
            "Default proactive sensitivity should be 0.7")
    }
}
