import Foundation
import SwiftData
import Combine

/// Manages feedback synchronization with the server
@MainActor
final class FeedbackSyncManager: ObservableObject {
    static let shared = FeedbackSyncManager()

    // MARK: - Dependencies

    private let authManager = AuthenticationManager.shared
    private let licenseManager = LicenseManager.shared

    // MARK: - Persistence

    private let queueFileURL: URL
    private var pendingFeedback: [PendingFeedbackItem] = []

    private init() {
        // Set up queue persistence file
        let appSupport = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first!
        let appFolder = appSupport.appendingPathComponent("QueenMama", isDirectory: true)
        try? FileManager.default.createDirectory(at: appFolder, withIntermediateDirectories: true)
        queueFileURL = appFolder.appendingPathComponent("feedback_queue.json")

        loadQueue()
    }

    // MARK: - Public Methods

    /// Submit feedback for an AI response
    func submitFeedback(
        responseId: String? = nil,
        sessionId: String? = nil,
        isHelpful: Bool,
        atomsUsed: [String] = []
    ) {
        guard authManager.isAuthenticated else { return }
        guard licenseManager.isFeatureAvailable(.knowledgeBase) else { return }

        let feedback = PendingFeedbackItem(
            id: UUID().uuidString,
            responseId: responseId,
            sessionId: sessionId,
            isHelpful: isHelpful,
            atomsUsed: atomsUsed,
            createdAt: Date()
        )

        pendingFeedback.append(feedback)
        saveQueue()

        // Try to sync immediately
        Task {
            await syncPendingFeedback()
        }
    }

    /// Sync all pending feedback
    func syncPendingFeedback() async {
        guard !pendingFeedback.isEmpty else { return }
        guard authManager.isAuthenticated else { return }

        do {
            let accessToken = try await authManager.getAccessToken()

            // Sync each feedback item
            for feedback in pendingFeedback {
                do {
                    try await sendFeedbackToServer(feedback, accessToken: accessToken)

                    // Remove synced feedback
                    pendingFeedback.removeAll { $0.id == feedback.id }
                    saveQueue()
                } catch {
                    print("[FeedbackSync] Failed to sync feedback \(feedback.id): \(error)")
                }
            }
        } catch {
            print("[FeedbackSync] Failed to get access token: \(error)")
        }
    }

    // MARK: - Private Methods

    private func sendFeedbackToServer(_ feedback: PendingFeedbackItem, accessToken: String) async throws {
        let url = URLConfigManager.shared.feedbackURL

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("Bearer \(accessToken)", forHTTPHeaderField: "Authorization")

        let body: [String: Any] = [
            "responseId": feedback.responseId as Any,
            "sessionId": feedback.sessionId as Any,
            "isHelpful": feedback.isHelpful,
            "atomsUsed": feedback.atomsUsed,
        ]

        request.httpBody = try JSONSerialization.data(withJSONObject: body)

        let (data, response) = try await URLSession.shared.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse else {
            throw FeedbackSyncError.invalidResponse
        }

        switch httpResponse.statusCode {
        case 200...299:
            print("[FeedbackSync] Feedback synced successfully")
        case 401:
            throw FeedbackSyncError.unauthorized
        default:
            let message = String(data: data, encoding: .utf8) ?? "Unknown error"
            throw FeedbackSyncError.serverError(message)
        }
    }

    // MARK: - Queue Persistence

    private func loadQueue() {
        guard FileManager.default.fileExists(atPath: queueFileURL.path) else { return }

        do {
            let data = try Data(contentsOf: queueFileURL)
            pendingFeedback = try JSONDecoder().decode([PendingFeedbackItem].self, from: data)
        } catch {
            print("[FeedbackSync] Failed to load queue: \(error)")
        }
    }

    private func saveQueue() {
        do {
            let data = try JSONEncoder().encode(pendingFeedback)
            try data.write(to: queueFileURL, options: .atomic)
        } catch {
            print("[FeedbackSync] Failed to save queue: \(error)")
        }
    }
}

// MARK: - Types

struct PendingFeedbackItem: Codable {
    let id: String
    let responseId: String?
    let sessionId: String?
    let isHelpful: Bool
    let atomsUsed: [String]
    let createdAt: Date
}

enum FeedbackSyncError: LocalizedError {
    case invalidResponse
    case unauthorized
    case serverError(String)

    var errorDescription: String? {
        switch self {
        case .invalidResponse:
            return "Invalid server response"
        case .unauthorized:
            return "Please sign in again"
        case .serverError(let message):
            return message
        }
    }
}
