//
//  SessionModelTests.swift
//  QueenMamaTests
//
//  Tests for Session model computed properties and related types:
//  - duration computed property (endTime - startTime)
//  - formattedDuration (M:SS format)
//  - formattedDate (medium date, short time)
//  - TalkTimeStats struct (percentages)
//  - BalanceState enum (noData, balanced, slightImbalance, strongImbalance)
//
//  Note: Session is a @Model class requiring ModelContainer. We test TalkTimeStats
//  and BalanceState directly since they are value types, and use ModelContainer
//  for Session property tests.
//

import XCTest
import SwiftData
@testable import QueenMama

@MainActor
final class SessionModelTests: XCTestCase {

    var container: ModelContainer!
    var context: ModelContext!

    override func setUp() {
        super.setUp()
        do {
            let config = ModelConfiguration(isStoredInMemoryOnly: true)
            container = try ModelContainer(
                for: Session.self, TranscriptEntry.self, Contact.self, ContactNote.self,
                configurations: config
            )
            context = container.mainContext
        } catch {
            XCTFail("Failed to create in-memory ModelContainer: \(error)")
        }
    }

    override func tearDown() {
        container = nil
        context = nil
        super.tearDown()
    }

    // MARK: - Duration

    func test_duration_withEndTime_returnsInterval() {
        let start = Date()
        let end = start.addingTimeInterval(3600) // 1 hour
        let session = Session(startTime: start, endTime: end)
        context.insert(session)

        XCTAssertEqual(session.duration ?? -1, 3600, accuracy: 0.01,
            "Duration should be the interval between start and end")
    }

    func test_duration_withoutEndTime_returnsNil() {
        let session = Session(startTime: Date(), endTime: nil)
        context.insert(session)

        XCTAssertNil(session.duration, "Duration should be nil when endTime is nil")
    }

    func test_duration_zeroSeconds() {
        let now = Date()
        let session = Session(startTime: now, endTime: now)
        context.insert(session)

        XCTAssertEqual(session.duration ?? -1, 0, accuracy: 0.01,
            "Duration should be 0 when start equals end")
    }

    // MARK: - Formatted Duration

    func test_formattedDuration_withEndTime_returnsMinutesAndSeconds() {
        let start = Date()
        let end = start.addingTimeInterval(125) // 2 min 5 sec
        let session = Session(startTime: start, endTime: end)
        context.insert(session)

        XCTAssertEqual(session.formattedDuration, "2:05",
            "125 seconds should format as 2:05")
    }

    func test_formattedDuration_withoutEndTime_returnsInProgress() {
        let session = Session(startTime: Date(), endTime: nil)
        context.insert(session)

        XCTAssertEqual(session.formattedDuration, "In progress",
            "No endTime should show 'In progress'")
    }

    func test_formattedDuration_zeroSeconds() {
        let now = Date()
        let session = Session(startTime: now, endTime: now)
        context.insert(session)

        XCTAssertEqual(session.formattedDuration, "0:00",
            "Zero duration should format as 0:00")
    }

    func test_formattedDuration_exactMinute() {
        let start = Date()
        let session = Session(startTime: start, endTime: start.addingTimeInterval(60))
        context.insert(session)

        XCTAssertEqual(session.formattedDuration, "1:00",
            "Exactly 60 seconds should format as 1:00")
    }

    func test_formattedDuration_largeValue() {
        let start = Date()
        let session = Session(startTime: start, endTime: start.addingTimeInterval(7265)) // 121 min 5 sec
        context.insert(session)

        XCTAssertEqual(session.formattedDuration, "121:05",
            "7265 seconds should format as 121:05")
    }

    // MARK: - Formatted Date

    func test_formattedDate_returnsNonEmptyString() {
        let session = Session(startTime: Date())
        context.insert(session)

        XCTAssertFalse(session.formattedDate.isEmpty,
            "Formatted date should not be empty")
    }

    // MARK: - TalkTimeStats

    func test_talkTimeStats_emptyData_returnsZeros() {
        let stats = Session.TalkTimeStats(myCharCount: 0, theirCharCount: 0, totalCharCount: 0)

        XCTAssertEqual(stats.myPercentage, 0.0, "My percentage should be 0 for empty data")
        XCTAssertEqual(stats.theirPercentage, 0.0, "Their percentage should be 0 for empty data")
    }

    func test_talkTimeStats_equalSplit_returns50Percent() {
        let stats = Session.TalkTimeStats(myCharCount: 100, theirCharCount: 100, totalCharCount: 200)

        XCTAssertEqual(stats.myPercentage, 0.5, accuracy: 0.001,
            "Equal split should give 50% each")
        XCTAssertEqual(stats.theirPercentage, 0.5, accuracy: 0.001)
    }

    func test_talkTimeStats_myPercentage_computesCorrectly() {
        let stats = Session.TalkTimeStats(myCharCount: 75, theirCharCount: 25, totalCharCount: 100)

        XCTAssertEqual(stats.myPercentage, 0.75, accuracy: 0.001,
            "75/100 should be 75%")
        XCTAssertEqual(stats.theirPercentage, 0.25, accuracy: 0.001)
    }

    // MARK: - BalanceState

    func test_balanceState_noData_forEmptyStats() {
        let stats = Session.TalkTimeStats(myCharCount: 0, theirCharCount: 0, totalCharCount: 0)
        XCTAssertEqual(stats.balanceState, .noData,
            "Zero total should be .noData")
    }

    func test_balanceState_balanced_at50Percent() {
        let stats = Session.TalkTimeStats(myCharCount: 50, theirCharCount: 50, totalCharCount: 100)
        XCTAssertEqual(stats.balanceState, .balanced,
            "50/50 split should be .balanced")
    }

    func test_balanceState_balanced_at40Percent() {
        let stats = Session.TalkTimeStats(myCharCount: 40, theirCharCount: 60, totalCharCount: 100)
        XCTAssertEqual(stats.balanceState, .balanced,
            "40% my talk should be .balanced (40-60% range)")
    }

    func test_balanceState_balanced_at60Percent() {
        let stats = Session.TalkTimeStats(myCharCount: 60, theirCharCount: 40, totalCharCount: 100)
        XCTAssertEqual(stats.balanceState, .balanced,
            "60% my talk should be .balanced (40-60% range)")
    }

    func test_balanceState_slightImbalance_at30Percent() {
        let stats = Session.TalkTimeStats(myCharCount: 30, theirCharCount: 70, totalCharCount: 100)
        XCTAssertEqual(stats.balanceState, .slightImbalance,
            "30% my talk should be .slightImbalance (30-70% but not 40-60%)")
    }

    func test_balanceState_slightImbalance_at39Percent() {
        let stats = Session.TalkTimeStats(myCharCount: 39, theirCharCount: 61, totalCharCount: 100)
        XCTAssertEqual(stats.balanceState, .slightImbalance,
            "39% my talk should be .slightImbalance")
    }

    func test_balanceState_slightImbalance_at70Percent() {
        let stats = Session.TalkTimeStats(myCharCount: 70, theirCharCount: 30, totalCharCount: 100)
        XCTAssertEqual(stats.balanceState, .slightImbalance,
            "70% my talk should be .slightImbalance")
    }

    func test_balanceState_strongImbalance_at29Percent() {
        let stats = Session.TalkTimeStats(myCharCount: 29, theirCharCount: 71, totalCharCount: 100)
        XCTAssertEqual(stats.balanceState, .strongImbalance,
            "29% my talk should be .strongImbalance (below 30%)")
    }

    func test_balanceState_strongImbalance_at71Percent() {
        let stats = Session.TalkTimeStats(myCharCount: 71, theirCharCount: 29, totalCharCount: 100)
        XCTAssertEqual(stats.balanceState, .strongImbalance,
            "71% my talk should be .strongImbalance (above 70%)")
    }

    func test_balanceState_strongImbalance_at0Percent() {
        let stats = Session.TalkTimeStats(myCharCount: 0, theirCharCount: 100, totalCharCount: 100)
        XCTAssertEqual(stats.balanceState, .strongImbalance,
            "0% my talk should be .strongImbalance")
    }

    func test_balanceState_strongImbalance_at100Percent() {
        let stats = Session.TalkTimeStats(myCharCount: 100, theirCharCount: 0, totalCharCount: 100)
        XCTAssertEqual(stats.balanceState, .strongImbalance,
            "100% my talk should be .strongImbalance")
    }

    // MARK: - BalanceState Equality

    func test_balanceState_equatable() {
        XCTAssertEqual(Session.BalanceState.noData, Session.BalanceState.noData)
        XCTAssertEqual(Session.BalanceState.balanced, Session.BalanceState.balanced)
        XCTAssertNotEqual(Session.BalanceState.balanced, Session.BalanceState.slightImbalance)
    }
}
