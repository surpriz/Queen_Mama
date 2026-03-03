//
//  SessionManagerPersistenceTests.swift
//  QueenMamaTests
//
//  Tests for SessionManager session lifecycle: start, end, transcript,
//  metadata updates, ghost session detection, and deletion.
//
//  Uses in-memory ModelContainer (same pattern as SessionModelTests).
//

import XCTest
import SwiftData
@testable import QueenMama

@MainActor
final class SessionManagerPersistenceTests: XCTestCase {

    var container: ModelContainer!
    var context: ModelContext!
    var sessionManager: SessionManager!

    override func setUp() {
        super.setUp()
        do {
            let config = ModelConfiguration(isStoredInMemoryOnly: true)
            container = try ModelContainer(
                for: Session.self, TranscriptEntry.self, Contact.self, ContactNote.self,
                configurations: config
            )
            context = container.mainContext
            sessionManager = SessionManager()
            sessionManager.setModelContext(context)
        } catch {
            XCTFail("Failed to create in-memory ModelContainer: \(error)")
        }
    }

    override func tearDown() {
        sessionManager = nil
        container = nil
        context = nil
        super.tearDown()
    }

    // MARK: - Start Session

    func test_startSession_setsCurrentSession() {
        let session = sessionManager.startSession(title: "Test")
        XCTAssertNotNil(sessionManager.currentSession,
            "currentSession should be set after startSession")
        XCTAssertEqual(sessionManager.currentSession?.id, session.id)
    }

    func test_startSession_isSessionActiveTrue() {
        _ = sessionManager.startSession()
        XCTAssertTrue(sessionManager.isSessionActive,
            "isSessionActive should be true after startSession")
    }

    func test_startSession_endTimeIsNil() {
        let session = sessionManager.startSession()
        XCTAssertNil(session.endTime,
            "endTime must be nil on a freshly started session")
    }

    func test_startSession_persistsToContext() {
        _ = sessionManager.startSession(title: "Persisted")

        let descriptor = FetchDescriptor<Session>()
        let sessions = try? context.fetch(descriptor)
        XCTAssertEqual(sessions?.count, 1,
            "Session should be persisted to SwiftData context")
        XCTAssertEqual(sessions?.first?.title, "Persisted")
    }

    func test_startSession_withCustomTitle() {
        let session = sessionManager.startSession(title: "Interview Q3")
        XCTAssertEqual(session.title, "Interview Q3")
    }

    // MARK: - End Session

    func test_endSession_setsEndTime() {
        _ = sessionManager.startSession()
        let finished = sessionManager.endSession()
        XCTAssertNotNil(finished?.endTime,
            "endTime should be set after endSession")
    }

    func test_endSession_isSessionActiveFalse() {
        _ = sessionManager.startSession()
        _ = sessionManager.endSession()
        XCTAssertFalse(sessionManager.isSessionActive,
            "isSessionActive should be false after endSession")
    }

    func test_endSession_clearsCurrentSession() {
        _ = sessionManager.startSession()
        _ = sessionManager.endSession()
        XCTAssertNil(sessionManager.currentSession,
            "currentSession should be nil after endSession")
    }

    func test_endSession_withoutStart_returnsNil() {
        let result = sessionManager.endSession()
        XCTAssertNil(result,
            "endSession without an active session should return nil")
    }

    // MARK: - Ghost Session Detection

    func test_ghostDetection_activeSessionHasNilEndTime() {
        let session = sessionManager.startSession()
        // A session with endTime == nil is potentially orphaned (ghost)
        XCTAssertNil(session.endTime,
            "Active session should have nil endTime (detectable as potential ghost)")
    }

    func test_ghostDetection_endedSessionHasEndTime() {
        _ = sessionManager.startSession()
        let finished = sessionManager.endSession()
        XCTAssertNotNil(finished?.endTime,
            "Properly ended session should NOT appear as ghost (endTime is set)")
    }

    // MARK: - Transcript

    func test_addTranscriptEntry_persistsEntry() {
        _ = sessionManager.startSession()
        sessionManager.addTranscriptEntry(speaker: "Moi", text: "Bonjour", isFinal: true)

        let entries = sessionManager.currentSession?.entries ?? []
        XCTAssertEqual(entries.count, 1)
        XCTAssertEqual(entries.first?.text, "Bonjour")
        XCTAssertEqual(entries.first?.speaker, "Moi")
    }

    func test_addTranscriptEntry_updatesTranscriptString() {
        _ = sessionManager.startSession()
        sessionManager.addTranscriptEntry(speaker: "Moi", text: "Bonjour", isFinal: true)

        XCTAssertTrue(sessionManager.currentSession?.transcript.contains("Bonjour") ?? false,
            "Transcript string should include the entry text")
    }

    // MARK: - Metadata Updates

    func test_setTitle_updatesCurrentSession() {
        _ = sessionManager.startSession(title: "Original")
        sessionManager.setTitle("Updated Title")
        XCTAssertEqual(sessionManager.currentSession?.title, "Updated Title")
    }

    func test_setSummary_updatesCurrentSession() {
        _ = sessionManager.startSession()
        sessionManager.setSummary("This is a summary")
        XCTAssertEqual(sessionManager.currentSession?.summary, "This is a summary")
    }

    // MARK: - Delete

    func test_deleteSession_removesFromContext() {
        let session = sessionManager.startSession(title: "ToDelete")
        _ = sessionManager.endSession()

        sessionManager.deleteSession(session)

        let descriptor = FetchDescriptor<Session>()
        let sessions = try? context.fetch(descriptor)
        XCTAssertEqual(sessions?.count, 0,
            "Deleted session should be removed from context")
    }
}
