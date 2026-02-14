//
//  ExtensionsTests.swift
//  QueenMamaTests
//
//  Tests for utility extensions:
//  - String.isNotEmpty
//  - String.truncated(to:trailing:)
//  - Date.isToday
//  - Date.isYesterday
//  - Date.timeAgo()
//  - Data.sha256Hash()
//  - Data.prettyPrintedJSON
//

import XCTest
@testable import QueenMama

@MainActor
final class ExtensionsTests: XCTestCase {

    // MARK: - String.isNotEmpty

    func test_isNotEmpty_nonEmptyString_returnsTrue() {
        XCTAssertTrue("hello".isNotEmpty, "Non-empty string should return true")
    }

    func test_isNotEmpty_emptyString_returnsFalse() {
        XCTAssertFalse("".isNotEmpty, "Empty string should return false")
    }

    func test_isNotEmpty_whitespaceString_returnsTrue() {
        XCTAssertTrue(" ".isNotEmpty, "Whitespace-only string should return true (not empty)")
    }

    // MARK: - String.truncated

    func test_truncated_shortString_returnsUnchanged() {
        let result = "Hello".truncated(to: 10)
        XCTAssertEqual(result, "Hello", "Short string should not be truncated")
    }

    func test_truncated_exactLength_returnsUnchanged() {
        let result = "Hello".truncated(to: 5)
        XCTAssertEqual(result, "Hello", "String at exact length should not be truncated")
    }

    func test_truncated_longString_truncatesWithDefaultTrailing() {
        let result = "Hello World".truncated(to: 5)
        XCTAssertEqual(result, "Hello...",
            "Truncated string should have default '...' trailing")
    }

    func test_truncated_customTrailing() {
        let result = "Hello World".truncated(to: 5, trailing: "~")
        XCTAssertEqual(result, "Hello~",
            "Should use custom trailing string")
    }

    func test_truncated_emptyString() {
        let result = "".truncated(to: 5)
        XCTAssertEqual(result, "", "Empty string truncation should return empty")
    }

    func test_truncated_zeroLength() {
        let result = "Hello".truncated(to: 0)
        XCTAssertEqual(result, "...",
            "Truncating to 0 should return just trailing")
    }

    // MARK: - Date.isToday

    func test_isToday_now_returnsTrue() {
        XCTAssertTrue(Date().isToday, "Current date should be today")
    }

    func test_isToday_yesterday_returnsFalse() {
        let yesterday = Calendar.current.date(byAdding: .day, value: -1, to: Date())!
        XCTAssertFalse(yesterday.isToday, "Yesterday should not be today")
    }

    func test_isToday_tomorrow_returnsFalse() {
        let tomorrow = Calendar.current.date(byAdding: .day, value: 1, to: Date())!
        XCTAssertFalse(tomorrow.isToday, "Tomorrow should not be today")
    }

    // MARK: - Date.isYesterday

    func test_isYesterday_yesterday_returnsTrue() {
        let yesterday = Calendar.current.date(byAdding: .day, value: -1, to: Date())!
        XCTAssertTrue(yesterday.isYesterday, "Yesterday date should be yesterday")
    }

    func test_isYesterday_today_returnsFalse() {
        XCTAssertFalse(Date().isYesterday, "Today should not be yesterday")
    }

    func test_isYesterday_twoDaysAgo_returnsFalse() {
        let twoDaysAgo = Calendar.current.date(byAdding: .day, value: -2, to: Date())!
        XCTAssertFalse(twoDaysAgo.isYesterday, "Two days ago should not be yesterday")
    }

    // MARK: - Date.timeAgo

    func test_timeAgo_returnsNonEmptyString() {
        let date = Date()
        let result = date.timeAgo()
        XCTAssertFalse(result.isEmpty, "timeAgo should return non-empty string")
    }

    func test_timeAgo_pastDate_producesText() {
        let oneHourAgo = Date().addingTimeInterval(-3600)
        let result = oneHourAgo.timeAgo()
        XCTAssertFalse(result.isEmpty, "Past date timeAgo should produce text")
    }

    // MARK: - Data.sha256Hash

    func test_sha256Hash_producesHexString() {
        let data = "Hello, World!".data(using: .utf8)!
        let hash = data.sha256Hash()

        XCTAssertEqual(hash.count, 64,
            "SHA256 hex string should be 64 characters")
    }

    func test_sha256Hash_consistentForSameInput() {
        let data = "test data".data(using: .utf8)!
        let hash1 = data.sha256Hash()
        let hash2 = data.sha256Hash()

        XCTAssertEqual(hash1, hash2,
            "Same input should produce same SHA256 hash")
    }

    func test_sha256Hash_differentForDifferentInput() {
        let data1 = "hello".data(using: .utf8)!
        let data2 = "world".data(using: .utf8)!

        XCTAssertNotEqual(data1.sha256Hash(), data2.sha256Hash(),
            "Different inputs should produce different hashes")
    }

    func test_sha256Hash_emptyData() {
        let data = Data()
        let hash = data.sha256Hash()

        XCTAssertEqual(hash.count, 64,
            "Empty data should still produce a 64-char hash")
        // Known SHA256 of empty input: e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
        XCTAssertEqual(hash, "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855")
    }

    func test_sha256Hash_onlyLowercaseHex() {
        let data = "test".data(using: .utf8)!
        let hash = data.sha256Hash()

        let validHexChars = CharacterSet(charactersIn: "0123456789abcdef")
        let hashChars = CharacterSet(charactersIn: hash)

        XCTAssertTrue(validHexChars.isSuperset(of: hashChars),
            "SHA256 hash should contain only lowercase hex characters")
    }

    // MARK: - Data.prettyPrintedJSON

    func test_prettyPrintedJSON_validJSON_returnsFormatted() {
        let json = #"{"key":"value","number":42}"#
        let data = json.data(using: .utf8)!
        let pretty = data.prettyPrintedJSON

        XCTAssertNotNil(pretty, "Valid JSON should produce pretty-printed output")
        XCTAssertTrue(pretty!.contains("\"key\""), "Should contain key")
        XCTAssertTrue(pretty!.contains("\"value\""), "Should contain value")
    }

    func test_prettyPrintedJSON_invalidJSON_returnsNil() {
        let notJSON = "this is not json"
        let data = notJSON.data(using: .utf8)!

        XCTAssertNil(data.prettyPrintedJSON, "Invalid JSON should return nil")
    }

    func test_prettyPrintedJSON_emptyObject() {
        let json = "{}"
        let data = json.data(using: .utf8)!
        let pretty = data.prettyPrintedJSON

        XCTAssertNotNil(pretty)
    }
}
