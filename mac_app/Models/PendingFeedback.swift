import Foundation
import SwiftData

/// Model for storing pending feedback to sync with server
@Model
final class PendingFeedback: Identifiable {
    @Attribute(.unique) var id: UUID
    var responseId: String?
    var sessionId: String?
    var isHelpful: Bool
    var atomsUsed: [String]
    var createdAt: Date
    var synced: Bool

    init(
        id: UUID = UUID(),
        responseId: String? = nil,
        sessionId: String? = nil,
        isHelpful: Bool,
        atomsUsed: [String] = [],
        createdAt: Date = Date(),
        synced: Bool = false
    ) {
        self.id = id
        self.responseId = responseId
        self.sessionId = sessionId
        self.isHelpful = isHelpful
        self.atomsUsed = atomsUsed
        self.createdAt = createdAt
        self.synced = synced
    }
}
