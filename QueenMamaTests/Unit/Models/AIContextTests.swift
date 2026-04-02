//
//  AIContextTests.swift
//  QueenMamaTests
//
//  Tests for AIContext:
//  - System prompt building for built-in and custom modes
//  - Transcript truncation at 8000 chars
//  - Smart mode additions
//  - Contact context enrichment
//  - User message generation per response type
//

import XCTest
@testable import QueenMama

final class AIContextTests: XCTestCase {

    // MARK: - System Prompt Building

    func testDefaultModeSystemPrompt() {
        let context = AIContext(
            transcript: "Hello",
            responseType: .assist
        )

        let prompt = context.systemPrompt
        XCTAssertTrue(prompt.contains("real-time assistant"), "Default mode prompt should contain real-time assistant identity")
        XCTAssertTrue(prompt.contains("LANGUAGE RULE"), "Should include language rule")
    }

    func testBuiltInModeIncludesResponseTypeAddition() {
        let mode = Mode(name: "Professional", systemPrompt: "You are a professional assistant.")
        let context = AIContext(
            transcript: "Hello",
            mode: mode,
            responseType: .whatToSay
        )

        let prompt = context.systemPrompt
        XCTAssertTrue(prompt.contains("NZT for communication"),
            "Built-in mode should include responseType system prompt addition")
    }

    func testCustomModeUsesOnlyModePrompt() {
        let mode = Mode(name: "My Custom Mode", systemPrompt: "You are a custom bot.")
        let context = AIContext(
            transcript: "Hello",
            mode: mode,
            responseType: .assist
        )

        let prompt = context.systemPrompt
        XCTAssertTrue(prompt.contains("custom bot"), "Custom mode should use its own prompt")
        // Custom mode should NOT include the .assist system prompt addition
        XCTAssertFalse(prompt.contains("NZT"),
            "Custom mode should not include default responseType additions")
    }

    func testBuiltInModeNames() {
        // Verify the built-in names are correctly classified
        // Developer Exam intentionally skips responseType addition to avoid conflicting instructions
        // Default uses classic coaching prompts, others use NZT-enhanced prompts
        let nztModes = ["Limitless", "Professional", "Interview", "Sales"]

        for name in nztModes {
            let mode = Mode(name: name, systemPrompt: "test")
            let context = AIContext(transcript: "test", mode: mode, responseType: .assist)
            // NZT modes should include the NZT responseType addition
            XCTAssertTrue(context.systemPrompt.contains("NZT"),
                "\(name) should use NZT prompt additions")
        }

        // Default mode uses classic coaching prompts (no NZT)
        let defaultMode = Mode(name: "Default", systemPrompt: "test")
        let defaultContext = AIContext(transcript: "test", mode: defaultMode, responseType: .assist)
        XCTAssertTrue(defaultContext.systemPrompt.contains("whispering real-time advice"),
            "Default should use classic prompt additions")
        XCTAssertFalse(defaultContext.systemPrompt.contains("NZT"),
            "Default should NOT use NZT prompt additions")

        // Developer Exam is built-in but skips responseType addition
        let examMode = Mode(name: "Developer Exam", systemPrompt: "test")
        let examContext = AIContext(transcript: "test", mode: examMode, responseType: .assist)
        XCTAssertFalse(examContext.systemPrompt.contains("CRITICAL RULES"),
            "Developer Exam should not be treated as custom mode")
    }

    // MARK: - Transcript Truncation

    func testShortTranscriptNotTruncated() {
        let shortTranscript = "Short conversation here"
        let context = AIContext(transcript: shortTranscript, responseType: .assist)
        let message = context.userMessage

        XCTAssertTrue(message.contains(shortTranscript), "Short transcript should not be truncated")
        XCTAssertFalse(message.contains("tronquée"), "Short transcript should not show truncation marker")
    }

    func testLongTranscriptIsTruncated() {
        // Use a non-Default mode to test background truncation (Default mode has no background)
        let mode = Mode(name: "Limitless", systemPrompt: "test")
        let longTranscript = String(repeating: "word ", count: 5000) // ~25000 chars, exceeds limit
        let context = AIContext(transcript: longTranscript, mode: mode, responseType: .assist)
        let message = context.userMessage

        XCTAssertTrue(message.contains("tronquée"), "Long transcript should show truncation marker for non-Default modes")
    }

    func testTranscriptTruncationKeepsEnd() {
        let prefix = "START_MARKER "
        let suffix = String(repeating: "recent ", count: 500) + "END_MARKER"
        let longTranscript = prefix + String(repeating: "filler ", count: 1000) + suffix

        let context = AIContext(transcript: longTranscript, responseType: .assist)
        let message = context.userMessage

        XCTAssertTrue(message.contains("END_MARKER"), "Truncation should keep the end of transcript")
    }

    // MARK: - Smart Mode

    func testSmartModeAddsEnhancedInstructions() {
        let context = AIContext(
            transcript: "Hello",
            responseType: .assist,
            smartMode: true
        )

        let prompt = context.systemPrompt
        XCTAssertTrue(prompt.contains("SMART MODE ENABLED"), "Smart mode should add enhanced reasoning instructions")
        XCTAssertTrue(prompt.contains("step-by-step"), "Smart mode should mention step-by-step reasoning")
    }

    func testNonSmartModeNoEnhancedInstructions() {
        let context = AIContext(
            transcript: "Hello",
            responseType: .assist,
            smartMode: false
        )

        let prompt = context.systemPrompt
        XCTAssertFalse(prompt.contains("SMART MODE"), "Non-smart mode should not have SMART MODE text")
    }

    // MARK: - User Message by Response Type

    func testUserMessageAssist() {
        let context = AIContext(transcript: "test", responseType: .assist)
        XCTAssertTrue(context.userMessage.contains("Assist") || context.userMessage.contains("Aide"), "Assist should contain bilingual prompt")
    }

    func testUserMessageWhatToSay() {
        let context = AIContext(transcript: "test", responseType: .whatToSay)
        XCTAssertTrue(context.userMessage.contains("Suggest what to say") || context.userMessage.contains("Suggère quoi dire"), "WhatToSay should contain bilingual prompt")
    }

    func testUserMessageFollowUp() {
        let context = AIContext(transcript: "test", responseType: .followUp)
        XCTAssertTrue(context.userMessage.contains("questions") || context.userMessage.contains("suivi"), "FollowUp should contain bilingual prompt about questions")
    }

    func testUserMessageRecap() {
        let context = AIContext(transcript: "test", responseType: .recap)
        XCTAssertTrue(context.userMessage.contains("summary") || context.userMessage.contains("résumé"), "Recap should contain bilingual summary prompt")
    }

    func testUserMessageCustomPrompt() {
        let context = AIContext(
            transcript: "test",
            responseType: .assist,
            customPrompt: "Translate this to Spanish"
        )
        XCTAssertTrue(context.userMessage.contains("Translate this to Spanish"),
            "Custom prompt should override default message")
    }

    // MARK: - Screenshot Context

    func testScreenshotAttachedIndicator() {
        let context = AIContext(
            transcript: "test",
            screenshot: Data([0x01, 0x02]),
            responseType: .assist
        )
        XCTAssertTrue(context.userMessage.contains("Screenshot attached"),
            "Should indicate screenshot is attached")
    }

    func testNoScreenshotNoIndicator() {
        let context = AIContext(
            transcript: "test",
            responseType: .assist
        )
        XCTAssertFalse(context.userMessage.contains("Screenshot"),
            "Should not mention screenshot when none attached")
    }

    // MARK: - Response Type System Prompts

    func testAllResponseTypesHaveSystemPrompts() {
        for type in AIResponse.ResponseType.allCases {
            let prompt = type.systemPromptAddition
            // All types except custom should have substantial prompts
            if type != .custom {
                XCTAssertGreaterThan(prompt.count, 50,
                    "\(type.rawValue) should have a substantial system prompt")
            }
        }
    }

    func testRecapSystemPromptIncludesMeetingMinutesStructure() {
        let prompt = AIResponse.ResponseType.recap.systemPromptAddition
        XCTAssertTrue(prompt.contains("meeting minutes") || prompt.contains("Meeting Minutes"),
            "Recap prompt should mention meeting minutes")
        XCTAssertTrue(prompt.contains("Action Items") || prompt.contains("action"),
            "Recap prompt should mention action items")
    }
}
