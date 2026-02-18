import Foundation
import PostHog

/// Analytics service using PostHog for unified web + macOS analytics
@MainActor
final class AnalyticsService {
    static let shared = AnalyticsService()

    private var isInitialized = false

    private init() {
        // Observe auth notifications to sync identity
        NotificationCenter.default.addObserver(
            forName: .userDidLogout,
            object: nil,
            queue: .main
        ) { [weak self] _ in
            Task { @MainActor in
                self?.trackLogout()
                self?.reset()
            }
        }
    }

    // MARK: - Configuration

    /// PostHog API key (same as web app)
    private let apiKey = "phc_n7ZlROEDA8wZ0MAVB4FFeLwFub7rX1FPTlYks131w7v"
    private let host = "https://eu.i.posthog.com"

    // MARK: - Initialization

    func start() {
        guard !isInitialized else { return }

        let config = PostHogConfig(apiKey: apiKey, host: host)

        // Capture app lifecycle events
        config.captureApplicationLifecycleEvents = true

        // Capture screen views
        config.captureScreenViews = true

        // Flush events when app goes to background
        config.flushAt = 20
        config.flushIntervalSeconds = 30

        // Debug mode in development
        #if DEBUG
        config.debug = true
        #endif

        PostHogSDK.shared.setup(config)
        isInitialized = true

        print("[Analytics] PostHog initialized")
    }

    // MARK: - User Identification

    /// Identify user after login
    func identify(userId: String, email: String?, name: String? = nil, plan: String? = nil) {
        var properties: [String: Any] = [:]

        if let email = email {
            properties["email"] = email
        }
        if let name = name {
            properties["name"] = name
        }
        if let plan = plan {
            properties["plan"] = plan
        }
        properties["platform"] = "macos"
        properties["app_version"] = Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "unknown"

        PostHogSDK.shared.identify(userId, userProperties: properties)
        print("[Analytics] User identified: \(userId)")
    }

    /// Reset identity on logout
    func reset() {
        PostHogSDK.shared.reset()
        print("[Analytics] User reset")
    }

    // MARK: - Event Tracking

    /// Track a custom event
    func capture(_ event: String, properties: [String: Any]? = nil) {
        var props = properties ?? [:]
        props["platform"] = "macos"

        PostHogSDK.shared.capture(event, properties: props)

        #if DEBUG
        print("[Analytics] Event: \(event) - \(props)")
        #endif
    }

    // MARK: - Predefined Events

    /// User started a recording session
    func trackSessionStarted(modeId: UUID?, modeName: String?) {
        var props: [String: Any] = [:]
        if let modeId = modeId {
            props["mode_id"] = modeId.uuidString
        }
        if let modeName = modeName {
            props["mode_name"] = modeName
        }
        capture("session_started", properties: props)
    }

    /// User stopped a recording session
    func trackSessionEnded(durationSeconds: Int, transcriptLength: Int, hadAIResponses: Bool) {
        capture("session_ended", properties: [
            "duration_seconds": durationSeconds,
            "transcript_length": transcriptLength,
            "had_ai_responses": hadAIResponses
        ])
    }

    /// AI response was generated
    func trackAIResponse(responseType: String, provider: String?, latencyMs: Int?) {
        var props: [String: Any] = ["response_type": responseType]
        if let provider = provider {
            props["ai_provider"] = provider
        }
        if let latency = latencyMs {
            props["latency_ms"] = latency
        }
        capture("ai_response_generated", properties: props)
    }

    /// User logged in
    func trackLogin(method: String) {
        capture("user_logged_in", properties: ["method": method])
    }

    /// User logged out
    func trackLogout() {
        capture("user_logged_out")
    }

    /// Subscription changed
    func trackSubscriptionChange(from oldPlan: String?, to newPlan: String) {
        capture("subscription_changed", properties: [
            "old_plan": oldPlan ?? "none",
            "new_plan": newPlan
        ])
    }

    /// Feature used
    func trackFeatureUsed(_ feature: String) {
        capture("feature_used", properties: ["feature": feature])
    }

    /// Error occurred
    func trackError(_ error: String, context: String? = nil) {
        var props: [String: Any] = ["error": error]
        if let context = context {
            props["context"] = context
        }
        capture("error_occurred", properties: props)
    }

    /// Overlay toggled
    func trackOverlayToggled(visible: Bool) {
        capture("overlay_toggled", properties: ["visible": visible])
    }

    /// Mode selected
    func trackModeSelected(modeId: UUID, modeName: String) {
        capture("mode_selected", properties: [
            "mode_id": modeId.uuidString,
            "mode_name": modeName
        ])
    }
}
