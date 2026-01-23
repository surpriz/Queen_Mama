import Foundation

/// Centralized URL configuration manager for the Queen Mama app.
/// Provides environment-aware URLs (localhost in DEBUG, production in Release).
final class URLConfigManager: @unchecked Sendable {
    nonisolated(unsafe) static let shared = URLConfigManager()

    let apiBaseURL: URL
    let webBaseURL: URL

    private init() {
        #if DEBUG
        let defaultBase = "http://localhost:3000"
        #else
        let defaultBase = "https://www.queenmama.co"
        #endif

        let baseString = ProcessInfo.processInfo.environment["API_BASE_URL"] ?? defaultBase

        self.apiBaseURL = URL(string: baseString)!
        self.webBaseURL = URL(string: baseString)!
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
}
