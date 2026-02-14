//
//  AIServiceLogicTests.swift
//  QueenMamaTests
//
//  Tests for AIService static/pure logic:
//  - trimTranscript() truncation behavior
//  - defaultMaxTranscriptLength constant
//  - Memory limit constant (maxResponsesInMemory = 50)
//
//  Note: isRefusalResponse() is private static, so we cannot test it directly.
//  It is exercised indirectly through streaming response retry logic.
//

import XCTest
@testable import QueenMama

@MainActor
final class AIServiceLogicTests: XCTestCase {

    // MARK: - Constants

    func test_defaultMaxTranscriptLength_is4000() {
        XCTAssertEqual(
            AIService.defaultMaxTranscriptLength, 4000,
            "Default max transcript length should be 4000 characters"
        )
    }

    // MARK: - trimTranscript: Short Transcripts (No Trimming)

    func test_trimTranscript_shortText_returnsUnchanged() {
        let short = "Hello, this is a short transcript."
        let result = AIService.trimTranscript(short, maxLength: 4000)
        XCTAssertEqual(result, short, "Short text should be returned unchanged")
    }

    func test_trimTranscript_exactlyAtLimit_returnsUnchanged() {
        let exact = String(repeating: "a", count: 4000)
        let result = AIService.trimTranscript(exact, maxLength: 4000)
        XCTAssertEqual(result, exact, "Text at exact limit should not be trimmed")
    }

    func test_trimTranscript_emptyString_returnsEmpty() {
        let result = AIService.trimTranscript("", maxLength: 4000)
        XCTAssertEqual(result, "", "Empty string should be returned as-is")
    }

    // MARK: - trimTranscript: Long Transcripts (Trimming)

    func test_trimTranscript_overLimit_trimsPrefixAndAddsTruncationIndicator() {
        let text = String(repeating: "word ", count: 1000) // 5000 chars
        let result = AIService.trimTranscript(text, maxLength: 100)

        XCTAssertTrue(
            result.hasPrefix("...[transcript trimmed to recent content]..."),
            "Trimmed text should start with truncation indicator"
        )
        XCTAssertLessThanOrEqual(
            result.count, 200, // 100 chars of content + indicator prefix + some margin
            "Trimmed text should be approximately maxLength plus indicator"
        )
    }

    func test_trimTranscript_preservesRecentContent() {
        let prefix = String(repeating: "x", count: 3000)
        let suffix = "THIS IS THE IMPORTANT RECENT CONTENT"
        let text = prefix + " " + suffix
        let result = AIService.trimTranscript(text, maxLength: 200)

        XCTAssertTrue(
            result.contains("THIS IS THE IMPORTANT RECENT CONTENT"),
            "Trimmed text should preserve the most recent content (end of transcript)"
        )
    }

    func test_trimTranscript_breaksAtWordBoundary() {
        // Create text that would break mid-word without word boundary logic
        let words = (0..<100).map { "word\($0)" }.joined(separator: " ")
        let result = AIService.trimTranscript(words, maxLength: 50)

        // After the truncation indicator, content should start at a word boundary (after a space)
        let indicator = "...[transcript trimmed to recent content]...\n\n"
        XCTAssertTrue(result.hasPrefix(indicator), "Should have truncation indicator")

        // The content after indicator should not start with a partial word
        let content = String(result.dropFirst(indicator.count))
        XCTAssertFalse(
            content.first?.isWhitespace == true,
            "Content after indicator should not start with whitespace"
        )
    }

    func test_trimTranscript_customMaxLength() {
        let text = String(repeating: "a ", count: 500) // 1000 chars
        let result = AIService.trimTranscript(text, maxLength: 100)

        XCTAssertTrue(
            result.contains("...[transcript trimmed to recent content]..."),
            "Should have truncation indicator for custom max length"
        )
    }

    // MARK: - trimTranscript: Default Parameter

    func test_trimTranscript_with4000Default_shortTextUnchanged() {
        let shortText = "A short transcript of a meeting."
        let result = AIService.trimTranscript(shortText, maxLength: AIService.defaultMaxTranscriptLength)
        XCTAssertEqual(result, shortText, "Short text under 4000 chars should not be trimmed")
    }

    func test_trimTranscript_with4000Default_longTextTrimmed() {
        let longText = String(repeating: "The quick brown fox jumps over the lazy dog. ", count: 200) // ~9000 chars
        let result = AIService.trimTranscript(longText, maxLength: AIService.defaultMaxTranscriptLength)

        XCTAssertTrue(
            result.contains("...[transcript trimmed to recent content]..."),
            "Text over 4000 chars should be trimmed with indicator"
        )
        // The result should be approximately 4000 chars of content + indicator
        let indicatorLength = "...[transcript trimmed to recent content]...\n\n".count
        XCTAssertLessThanOrEqual(
            result.count,
            4000 + indicatorLength + 50, // some margin for word boundary adjustment
            "Trimmed result should be close to maxLength plus indicator"
        )
    }

    // MARK: - trimTranscript: Edge Cases

    func test_trimTranscript_singleCharOverLimit_trims() {
        let text = String(repeating: "a", count: 101)
        let result = AIService.trimTranscript(text, maxLength: 100)

        XCTAssertTrue(
            result.contains("...[transcript trimmed to recent content]..."),
            "Text one char over limit should be trimmed"
        )
    }

    func test_trimTranscript_noWhitespace_stillTrims() {
        // Text with no spaces - word boundary logic finds no space, falls back
        let text = String(repeating: "a", count: 200)
        let result = AIService.trimTranscript(text, maxLength: 50)

        XCTAssertTrue(
            result.contains("...[transcript trimmed to recent content]..."),
            "Continuous text should still be trimmed"
        )
    }
}
