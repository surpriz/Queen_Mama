//
//  ContactModelTests.swift
//  QueenMamaTests
//
//  Tests for Contact model computed properties:
//  - fullName (firstName + lastName joined)
//  - initials (first letter of each name)
//  - displaySubtitle (role @ company)
//  - sessionCount (count of sessions relationship)
//  - formattedLastSeen (relative date)
//
//  Note: Contact is a @Model class; we use an in-memory ModelContainer.
//

import XCTest
import SwiftData
@testable import QueenMama

@MainActor
final class ContactModelTests: XCTestCase {

    var container: ModelContainer!
    var context: ModelContext!

    override func setUp() {
        super.setUp()
        do {
            let config = ModelConfiguration(isStoredInMemoryOnly: true)
            container = try ModelContainer(
                for: Contact.self, ContactNote.self, Session.self, TranscriptEntry.self,
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

    // MARK: - Full Name

    func test_fullName_firstAndLastName() {
        let contact = Contact(firstName: "John", lastName: "Doe")
        context.insert(contact)

        XCTAssertEqual(contact.fullName, "John Doe",
            "Full name should combine first and last name with space")
    }

    func test_fullName_firstNameOnly() {
        let contact = Contact(firstName: "Alice", lastName: nil)
        context.insert(contact)

        XCTAssertEqual(contact.fullName, "Alice",
            "Full name should be just first name when lastName is nil")
    }

    func test_fullName_emptyFirstName_withLastName() {
        let contact = Contact(firstName: "", lastName: "Smith")
        context.insert(contact)

        // compactMap { $0 } won't remove empty strings, so we get " Smith"
        // Actually: ["", "Smith"].compactMap { $0 } = ["", "Smith"] joined = " Smith"
        XCTAssertEqual(contact.fullName, " Smith",
            "Empty firstName with lastName should join with space")
    }

    // MARK: - Initials

    func test_initials_firstAndLastName() {
        let contact = Contact(firstName: "John", lastName: "Doe")
        context.insert(contact)

        XCTAssertEqual(contact.initials, "JD",
            "Initials should be first letter of each name uppercased")
    }

    func test_initials_firstNameOnly() {
        let contact = Contact(firstName: "Alice", lastName: nil)
        context.insert(contact)

        XCTAssertEqual(contact.initials, "A",
            "Initials should be just first letter when no last name")
    }

    func test_initials_lowercaseNames() {
        let contact = Contact(firstName: "john", lastName: "doe")
        context.insert(contact)

        XCTAssertEqual(contact.initials, "JD",
            "Initials should be uppercased")
    }

    func test_initials_emptyLastName() {
        let contact = Contact(firstName: "Bob", lastName: "")
        context.insert(contact)

        // lastName?.prefix(1).uppercased() for "" => ""
        XCTAssertEqual(contact.initials, "B",
            "Empty lastName should produce single initial")
    }

    // MARK: - Display Subtitle

    func test_displaySubtitle_roleAndCompany() {
        let contact = Contact(firstName: "A", company: "Acme Inc", role: "Engineer")
        context.insert(contact)

        XCTAssertEqual(contact.displaySubtitle, "Engineer @ Acme Inc",
            "Subtitle should be 'role @ company'")
    }

    func test_displaySubtitle_roleOnly() {
        let contact = Contact(firstName: "A", company: nil, role: "Designer")
        context.insert(contact)

        XCTAssertEqual(contact.displaySubtitle, "Designer",
            "Subtitle with only role should show just role")
    }

    func test_displaySubtitle_companyOnly() {
        let contact = Contact(firstName: "A", company: "BigCorp", role: nil)
        context.insert(contact)

        XCTAssertEqual(contact.displaySubtitle, "BigCorp",
            "Subtitle with only company should show just company")
    }

    func test_displaySubtitle_neitherRoleNorCompany() {
        let contact = Contact(firstName: "A", company: nil, role: nil)
        context.insert(contact)

        XCTAssertNil(contact.displaySubtitle,
            "Subtitle should be nil when no role and no company")
    }

    // MARK: - Session Count

    func test_sessionCount_noSessions() {
        let contact = Contact(firstName: "A")
        context.insert(contact)

        XCTAssertEqual(contact.sessionCount, 0,
            "New contact should have 0 sessions")
    }

    func test_sessionCount_withSessions() {
        let contact = Contact(firstName: "A")
        context.insert(contact)

        let session1 = Session(title: "Session 1")
        let session2 = Session(title: "Session 2")
        session1.contact = contact
        session2.contact = contact
        context.insert(session1)
        context.insert(session2)

        XCTAssertEqual(contact.sessionCount, 2,
            "Contact should count linked sessions")
    }

    // MARK: - Formatted Last Seen

    func test_formattedLastSeen_returnsNonEmptyString() {
        let contact = Contact(firstName: "A", lastSeenAt: Date())
        context.insert(contact)

        XCTAssertFalse(contact.formattedLastSeen.isEmpty,
            "Formatted last seen should not be empty")
    }

    func test_formattedLastSeen_recentDate_containsRelativeText() {
        // Just now should produce some relative text like "0 sec. ago" or "now"
        let contact = Contact(firstName: "A", lastSeenAt: Date())
        context.insert(contact)

        let formatted = contact.formattedLastSeen
        // RelativeDateTimeFormatter with .abbreviated will produce something
        XCTAssertFalse(formatted.isEmpty,
            "Relative formatter should produce non-empty text")
    }

    // MARK: - ContactNote Computed Properties

    func test_contactNote_preview_shortContent() {
        let note = ContactNote(content: "Short note")
        context.insert(note)

        XCTAssertEqual(note.preview, "Short note",
            "Short content should return as-is")
    }

    func test_contactNote_preview_longContent() {
        let longContent = String(repeating: "a", count: 150)
        let note = ContactNote(content: longContent)
        context.insert(note)

        XCTAssertEqual(note.preview.count, 103, // 100 chars + "..."
            "Long content preview should be truncated to 100 chars + ellipsis")
        XCTAssertTrue(note.preview.hasSuffix("..."),
            "Truncated preview should end with '...'")
    }

    func test_contactNote_preview_exactly100Chars() {
        let exact = String(repeating: "b", count: 100)
        let note = ContactNote(content: exact)
        context.insert(note)

        XCTAssertEqual(note.preview, exact,
            "Exactly 100 chars should not be truncated")
    }

    func test_contactNote_formattedDate_isNotEmpty() {
        let note = ContactNote(content: "test")
        context.insert(note)

        XCTAssertFalse(note.formattedDate.isEmpty,
            "Formatted date should not be empty")
    }
}
