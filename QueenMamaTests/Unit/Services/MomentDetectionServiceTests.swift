//
//  MomentDetectionServiceTests.swift
//  QueenMamaTests
//
//  Tests for MomentDetectionService:
//  - Bilingual pattern matching (FR/EN)
//  - Confidence scoring with match count
//  - Recency boost for recent matches
//  - Edge cases (empty text, no matches, generic)
//

import XCTest
@testable import QueenMama

@MainActor
final class MomentDetectionServiceTests: XCTestCase {

    var service: MomentDetectionService!

    override func setUp() {
        super.setUp()
        service = MomentDetectionService.shared
        service.minConfidence = 0.6
    }

    // MARK: - French Pattern Detection

    func testDetectsObjectionInFrench() {
        let text = "Oui mais c'est trop cher pour notre budget"
        let result = service.detect(in: text)

        XCTAssertNotNil(result, "Should detect objection in French text")
        XCTAssertEqual(result?.type, .objection)
        XCTAssertGreaterThanOrEqual(result?.confidence ?? 0, 0.6)
    }

    func testDetectsExpertiseQuestionInFrench() {
        let text = "Pouvez-vous expliquer comment ça fonctionne techniquement"
        let result = service.detect(in: text)

        XCTAssertNotNil(result, "Should detect expertise question in French")
        XCTAssertEqual(result?.type, .expertiseQuestion)
    }

    func testDetectsHesitationInFrench() {
        let text = "Euh je sais pas, bonne question, laissez-moi réfléchir"
        let result = service.detect(in: text)

        XCTAssertNotNil(result, "Should detect hesitation in French")
        XCTAssertEqual(result?.type, .hesitation)
    }

    func testDetectsClosingOpportunityInFrench() {
        let text = "D'accord ça m'intéresse, quelles sont les prochaine étape"
        let result = service.detect(in: text)

        XCTAssertNotNil(result, "Should detect closing opportunity in French")
        XCTAssertEqual(result?.type, .closingOpportunity)
    }

    // MARK: - English Pattern Detection

    func testDetectsObjectionInEnglish() {
        let text = "That's too expensive for our budget right now"
        let result = service.detect(in: text)

        XCTAssertNotNil(result, "Should detect objection in English")
        XCTAssertEqual(result?.type, .objection)
    }

    func testDetectsExpertiseQuestionInEnglish() {
        let text = "Can you explain how does this work technically"
        let result = service.detect(in: text)

        XCTAssertNotNil(result, "Should detect expertise question in English")
        XCTAssertEqual(result?.type, .expertiseQuestion)
    }

    func testDetectsHesitationInEnglish() {
        let text = "Umm I don't know, good question, let me think about it"
        let result = service.detect(in: text)

        XCTAssertNotNil(result, "Should detect hesitation in English")
        XCTAssertEqual(result?.type, .hesitation)
    }

    func testDetectsClosingOpportunityInEnglish() {
        let text = "Sounds good, I'm interested, what's next"
        let result = service.detect(in: text)

        XCTAssertNotNil(result, "Should detect closing opportunity in English")
        XCTAssertEqual(result?.type, .closingOpportunity)
    }

    // MARK: - Confidence Scoring

    func testSingleMatchGivesBaseConfidence() {
        let text = "C'est trop cher"
        let result = service.detect(in: text, minConfidence: 0.5)

        XCTAssertNotNil(result)
        // Single match = 0.6 base + 0.1 recency boost (text is short, match is in last 100 chars)
        XCTAssertGreaterThanOrEqual(result?.confidence ?? 0, 0.6)
    }

    func testMultipleMatchesIncreaseConfidence() {
        let text = "C'est trop cher, hors budget, on ne peut pas, la concurrence propose mieux"
        let result = service.detect(in: text, minConfidence: 0.5)

        XCTAssertNotNil(result)
        // 4+ matches should give high confidence (0.85+)
        XCTAssertGreaterThanOrEqual(result?.confidence ?? 0, 0.85)
    }

    func testTwoMatchesGivesMediumConfidence() {
        let text = "C'est trop cher et pas le budget pour ça"
        let result = service.detect(in: text, minConfidence: 0.5)

        XCTAssertNotNil(result)
        // 2 matches = 0.75 base (+ possible recency boost)
        XCTAssertGreaterThanOrEqual(result?.confidence ?? 0, 0.75)
    }

    func testRecencyBoostWhenMatchIsVeryRecent() {
        // Match in last 100 chars gets +0.1 boost
        let text = "Discussion about pricing. C'est trop cher."
        let result = service.detect(in: text, minConfidence: 0.5)

        XCTAssertNotNil(result)
        // 0.6 base + 0.1 recency = 0.7
        XCTAssertGreaterThanOrEqual(result?.confidence ?? 0, 0.7)
    }

    // MARK: - Edge Cases

    func testNoMatchReturnsNil() {
        let text = "The weather is nice today and I had a good lunch"
        let result = service.detect(in: text)

        XCTAssertNil(result, "Should return nil for text with no patterns")
    }

    func testEmptyTextReturnsNil() {
        let result = service.detect(in: "")
        XCTAssertNil(result, "Should return nil for empty text")
    }

    func testHighThresholdFiltersLowConfidence() {
        let text = "C'est trop cher"
        let result = service.detect(in: text, minConfidence: 0.95)

        // Single match with recency boost = 0.7, below 0.95 threshold
        XCTAssertNil(result, "Single match should be below 0.95 threshold")
    }

    func testLongTextOnlyAnalyzesLast500Chars() {
        // Build text with pattern far from end
        let padding = String(repeating: "a ", count: 300) // 600 chars of padding
        let text = "c'est trop cher " + padding
        let result = service.detect(in: text)

        // The pattern "trop cher" is more than 500 chars from end,
        // so it should not be detected
        XCTAssertNil(result, "Patterns beyond last 500 chars should not be detected")
    }

    func testCaseInsensitiveDetection() {
        let text = "TOO EXPENSIVE for our BUDGET"
        let result = service.detect(in: text)

        XCTAssertNotNil(result, "Detection should be case-insensitive")
    }

    // MARK: - detectAll

    func testDetectAllReturnsMultipleMomentTypes() {
        // Text with patterns from multiple moment types
        let text = "C'est trop cher. Pouvez-vous expliquer comment ça fonctionne? Euh je sais pas."
        let results = service.detectAll(in: text, minConfidence: 0.5)

        XCTAssertGreaterThan(results.count, 1, "Should detect multiple moment types")
    }

    func testDetectAllSortedByConfidence() {
        let text = "C'est trop cher, hors budget, pas le budget. Euh hmm."
        let results = service.detectAll(in: text, minConfidence: 0.5)

        guard results.count >= 2 else {
            XCTFail("Expected at least 2 results")
            return
        }

        XCTAssertGreaterThanOrEqual(results[0].confidence, results[1].confidence,
            "Results should be sorted by confidence descending")
    }

    // MARK: - ConversationMoment Properties

    func testConversationMomentSuggestedResponseTypes() {
        XCTAssertEqual(MomentDetectionService.ConversationMoment.objection.suggestedResponseType, .whatToSay)
        XCTAssertEqual(MomentDetectionService.ConversationMoment.expertiseQuestion.suggestedResponseType, .assist)
        XCTAssertEqual(MomentDetectionService.ConversationMoment.hesitation.suggestedResponseType, .whatToSay)
        XCTAssertEqual(MomentDetectionService.ConversationMoment.closingOpportunity.suggestedResponseType, .whatToSay)
        XCTAssertEqual(MomentDetectionService.ConversationMoment.generic.suggestedResponseType, .assist)
    }

    func testConversationMomentLabels() {
        XCTAssertEqual(MomentDetectionService.ConversationMoment.objection.label, "OBJECTION")
        XCTAssertEqual(MomentDetectionService.ConversationMoment.expertiseQuestion.label, "QUESTION")
        XCTAssertEqual(MomentDetectionService.ConversationMoment.hesitation.label, "HESITATION")
        XCTAssertEqual(MomentDetectionService.ConversationMoment.closingOpportunity.label, "CLOSING")
        XCTAssertEqual(MomentDetectionService.ConversationMoment.generic.label, "ASSIST")
    }

    // MARK: - DetectedMoment

    func testDetectedMomentIsSignificant() {
        let moment = MomentDetectionService.DetectedMoment(
            type: .objection,
            confidence: 0.7,
            triggerPhrase: "trop cher",
            timestamp: Date()
        )
        XCTAssertTrue(moment.isSignificant, "Confidence >= 0.6 should be significant")
    }

    func testDetectedMomentIsNotSignificant() {
        let moment = MomentDetectionService.DetectedMoment(
            type: .objection,
            confidence: 0.5,
            triggerPhrase: "trop cher",
            timestamp: Date()
        )
        XCTAssertFalse(moment.isSignificant, "Confidence < 0.6 should not be significant")
    }
}
