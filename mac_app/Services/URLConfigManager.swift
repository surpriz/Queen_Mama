import Foundation

/// Centralized URL configuration manager for the Queen Mama app.
/// Provides environment-aware URLs (localhost in DEBUG, production in Release).
final class URLConfigManager: @unchecked Sendable {
    nonisolated(unsafe) static let shared = URLConfigManager()

    let apiBaseURL: URL
    let webBaseURL: URL

    private init() {
        let baseString = ProcessInfo.processInfo.environment["API_BASE_URL"]
            ?? AppEnvironment.current.apiBaseURL

        self.apiBaseURL = URL(string: baseString) ?? URL(string: "https://www.queenmama.co")!
        self.webBaseURL = URL(string: baseString) ?? URL(string: "https://www.queenmama.co")!
    }

    // MARK: - Helper URLs

    var dashboardSessionsURL: URL {
        webBaseURL.appendingPathComponent("dashboard/sessions")
    }

    var dashboardBillingURL: URL {
        webBaseURL.appendingPathComponent("dashboard/billing")
    }

    var changelogURL: URL {
        webBaseURL.appendingPathComponent("changelog")
    }

    var syncSessionsURL: URL {
        apiBaseURL.appendingPathComponent("api/sync/sessions")
    }

    var syncContactsURL: URL {
        apiBaseURL.appendingPathComponent("api/sync/contacts")
    }

    var feedbackURL: URL {
        apiBaseURL.appendingPathComponent("api/feedback")
    }

    var knowledgeURL: URL {
        apiBaseURL.appendingPathComponent("api/knowledge")
    }
}
