import Foundation
import SwiftData

@Model
final class Contact {
    var id: UUID
    var firstName: String
    var lastName: String?
    var email: String?
    var company: String?
    var role: String?
    var lastSeenAt: Date
    var createdAt: Date

    /// Tracks if this contact has been synced to the server
    var isSynced: Bool

    /// Server-side ID after sync (for bidirectional sync)
    var remoteId: String?

    @Relationship(deleteRule: .nullify, inverse: \Session.contact)
    var sessions: [Session]

    @Relationship(deleteRule: .cascade)
    var notes: [ContactNote]

    init(
        id: UUID = UUID(),
        firstName: String,
        lastName: String? = nil,
        email: String? = nil,
        company: String? = nil,
        role: String? = nil,
        lastSeenAt: Date = Date(),
        createdAt: Date = Date(),
        isSynced: Bool = false,
        remoteId: String? = nil
    ) {
        self.id = id
        self.firstName = firstName
        self.lastName = lastName
        self.email = email
        self.company = company
        self.role = role
        self.lastSeenAt = lastSeenAt
        self.createdAt = createdAt
        self.isSynced = isSynced
        self.remoteId = remoteId
        self.sessions = []
        self.notes = []
    }

    /// Full display name (firstName + lastName)
    var fullName: String {
        [firstName, lastName].compactMap { $0 }.joined(separator: " ")
    }

    /// Subtitle for display (role @ company)
    var displaySubtitle: String? {
        let parts = [role, company].compactMap { $0 }
        guard !parts.isEmpty else { return nil }
        return parts.joined(separator: " @ ")
    }

    /// Initials for avatar display
    var initials: String {
        let first = firstName.prefix(1).uppercased()
        let last = lastName?.prefix(1).uppercased() ?? ""
        return first + last
    }

    /// Number of sessions with this contact
    var sessionCount: Int {
        sessions.count
    }

    /// Most recent session with this contact
    var lastSession: Session? {
        sessions.sorted { $0.startTime > $1.startTime }.first
    }

    /// Formatted lastSeenAt date
    var formattedLastSeen: String {
        let formatter = RelativeDateTimeFormatter()
        formatter.unitsStyle = .abbreviated
        return formatter.localizedString(for: lastSeenAt, relativeTo: Date())
    }
}

@Model
final class ContactNote {
    var id: UUID
    var content: String
    var createdAt: Date

    /// Tracks if this note has been synced to the server
    var isSynced: Bool

    init(
        id: UUID = UUID(),
        content: String,
        createdAt: Date = Date(),
        isSynced: Bool = false
    ) {
        self.id = id
        self.content = content
        self.createdAt = createdAt
        self.isSynced = isSynced
    }

    /// Formatted date for display
    var formattedDate: String {
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        formatter.timeStyle = .short
        return formatter.string(from: createdAt)
    }

    /// Truncated content for preview
    var preview: String {
        if content.count <= 100 {
            return content
        }
        return String(content.prefix(100)) + "..."
    }
}
