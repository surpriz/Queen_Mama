//
//  TranscriptionConnectionStateTests.swift
//  QueenMamaTests
//
//  Tests for TranscriptionConnectionState enum:
//  - isActive computed property for each state
//  - displayStatus computed property for each state
//

import XCTest
@testable import QueenMama

@MainActor
final class TranscriptionConnectionStateTests: XCTestCase {

    // MARK: - isActive

    func test_isActive_disconnected_returnsFalse() {
        let state = TranscriptionConnectionState.disconnected
        XCTAssertFalse(state.isActive, ".disconnected should not be active")
    }

    func test_isActive_connecting_returnsTrue() {
        let state = TranscriptionConnectionState.connecting
        XCTAssertTrue(state.isActive, ".connecting should be active")
    }

    func test_isActive_connected_returnsTrue() {
        let state = TranscriptionConnectionState.connected
        XCTAssertTrue(state.isActive, ".connected should be active")
    }

    func test_isActive_reconnecting_returnsTrue() {
        let state = TranscriptionConnectionState.reconnecting(attempt: 1, maxAttempts: 5)
        XCTAssertTrue(state.isActive, ".reconnecting should be active")
    }

    func test_isActive_failed_returnsFalse() {
        let state = TranscriptionConnectionState.failed(reason: "Network error")
        XCTAssertFalse(state.isActive, ".failed should not be active")
    }

    // MARK: - displayStatus

    func test_displayStatus_disconnected() {
        let state = TranscriptionConnectionState.disconnected
        XCTAssertEqual(state.displayStatus, "Disconnected")
    }

    func test_displayStatus_connecting() {
        let state = TranscriptionConnectionState.connecting
        XCTAssertEqual(state.displayStatus, "Connecting...")
    }

    func test_displayStatus_connected() {
        let state = TranscriptionConnectionState.connected
        XCTAssertEqual(state.displayStatus, "Connected")
    }

    func test_displayStatus_reconnecting_includesAttemptCount() {
        let state = TranscriptionConnectionState.reconnecting(attempt: 2, maxAttempts: 5)
        XCTAssertEqual(state.displayStatus, "Reconnecting (2/5)...",
            "Should display attempt/max format")
    }

    func test_displayStatus_reconnecting_differentValues() {
        let state = TranscriptionConnectionState.reconnecting(attempt: 3, maxAttempts: 10)
        XCTAssertEqual(state.displayStatus, "Reconnecting (3/10)...")
    }

    func test_displayStatus_failed_includesReason() {
        let state = TranscriptionConnectionState.failed(reason: "API key invalid")
        XCTAssertEqual(state.displayStatus, "Failed: API key invalid",
            "Should include failure reason")
    }

    func test_displayStatus_failed_emptyReason() {
        let state = TranscriptionConnectionState.failed(reason: "")
        XCTAssertEqual(state.displayStatus, "Failed: ",
            "Should show 'Failed: ' even with empty reason")
    }

    // MARK: - Equatable

    func test_equatable_sameStates() {
        XCTAssertEqual(
            TranscriptionConnectionState.disconnected,
            TranscriptionConnectionState.disconnected
        )
        XCTAssertEqual(
            TranscriptionConnectionState.connected,
            TranscriptionConnectionState.connected
        )
        XCTAssertEqual(
            TranscriptionConnectionState.connecting,
            TranscriptionConnectionState.connecting
        )
    }

    func test_equatable_reconnecting_sameValues() {
        XCTAssertEqual(
            TranscriptionConnectionState.reconnecting(attempt: 1, maxAttempts: 3),
            TranscriptionConnectionState.reconnecting(attempt: 1, maxAttempts: 3)
        )
    }

    func test_equatable_reconnecting_differentValues() {
        XCTAssertNotEqual(
            TranscriptionConnectionState.reconnecting(attempt: 1, maxAttempts: 3),
            TranscriptionConnectionState.reconnecting(attempt: 2, maxAttempts: 3)
        )
    }

    func test_equatable_failed_sameReason() {
        XCTAssertEqual(
            TranscriptionConnectionState.failed(reason: "timeout"),
            TranscriptionConnectionState.failed(reason: "timeout")
        )
    }

    func test_equatable_failed_differentReason() {
        XCTAssertNotEqual(
            TranscriptionConnectionState.failed(reason: "timeout"),
            TranscriptionConnectionState.failed(reason: "auth error")
        )
    }

    func test_equatable_differentStates() {
        XCTAssertNotEqual(
            TranscriptionConnectionState.connected,
            TranscriptionConnectionState.connecting
        )
        XCTAssertNotEqual(
            TranscriptionConnectionState.disconnected,
            TranscriptionConnectionState.failed(reason: "")
        )
    }
}
