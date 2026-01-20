import Foundation

#if canImport(Sentry)
import Sentry

/// Manages crash reporting and error tracking using Sentry
///
/// To use Sentry, add it as a Swift Package dependency:
/// 1. In Xcode, go to File → Add Package Dependencies
/// 2. Enter URL: https://github.com/getsentry/sentry-cocoa
/// 3. Select "Up to Next Major Version" from 8.0.0
/// 4. Add to the QueenMama target
///
/// Also ensure you have:
/// - SENTRY_DSN environment variable set in your scheme
/// - Or configure the DSN directly in the start() method
@MainActor
final class CrashReporter {

    // MARK: - Singleton
    static let shared = CrashReporter()

    /// Whether Sentry is initialized
    private(set) var isInitialized = false

    /// Whether Sentry is available
    var isSentryAvailable: Bool { true }

    // MARK: - Initialization

    private init() {}

    // MARK: - Public Methods

    /// Start Sentry crash reporting
    /// Call this in your AppDelegate.applicationDidFinishLaunching
    func start(dsn: String? = nil) {
        guard !isInitialized else {
            print("[CrashReporter] Already initialized")
            return
        }

        // Get DSN from parameter, environment, or Info.plist
        let sentryDSN = dsn
            ?? ProcessInfo.processInfo.environment["SENTRY_DSN"]
            ?? Bundle.main.infoDictionary?["SentryDSN"] as? String

        guard let dsn = sentryDSN, !dsn.isEmpty else {
            print("[CrashReporter] No Sentry DSN configured. Skipping initialization.")
            return
        }

        SentrySDK.start { options in
            options.dsn = dsn

            // Set environment based on build configuration
            #if DEBUG
            options.environment = "development"
            options.debug = true
            #else
            options.environment = "production"
            #endif

            // Enable performance monitoring
            options.tracesSampleRate = 0.1 // Sample 10% of transactions

            // Enable auto session tracking
            options.enableAutoSessionTracking = true

            // Set max breadcrumbs
            options.maxBreadcrumbs = 100

            // Set release and dist
            if let version = Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String,
               let build = Bundle.main.infoDictionary?["CFBundleVersion"] as? String {
                options.releaseName = "com.queenmama.app@\(version)+\(build)"
                options.dist = build
            }

            // Before send callback - can be used to scrub sensitive data
            options.beforeSend = { event in
                // Remove any sensitive data from breadcrumbs
                event.breadcrumbs = event.breadcrumbs?.map { breadcrumb in
                    // Scrub API keys from breadcrumb messages
                    if let message = breadcrumb.message {
                        let scrubbed = Breadcrumb(level: breadcrumb.level, category: breadcrumb.category)
                        scrubbed.message = self.scrubSensitiveData(message)
                        scrubbed.type = breadcrumb.type
                        scrubbed.data = breadcrumb.data
                        scrubbed.timestamp = breadcrumb.timestamp
                        return scrubbed
                    }
                    return breadcrumb
                }
                return event
            }
        }

        isInitialized = true
        print("[CrashReporter] Sentry initialized successfully")
    }

    /// Capture a non-fatal error
    func captureError(_ error: Error, extras: [String: Any]? = nil) {
        guard isInitialized else { return }

        SentrySDK.capture(error: error) { scope in
            if let extras = extras {
                for (key, value) in extras {
                    scope.setExtra(value: value, key: key)
                }
            }
        }
        print("[CrashReporter] Error captured: \(error.localizedDescription)")
    }

    /// Capture a message (for non-error events)
    func captureMessage(_ message: String, level: SentryLevel = .info) {
        guard isInitialized else { return }

        SentrySDK.capture(message: message) { scope in
            scope.setLevel(level)
        }
    }

    /// Add a breadcrumb for debugging
    func addBreadcrumb(category: String, message: String, level: SentryLevel = .info) {
        guard isInitialized else { return }

        let crumb = Breadcrumb(level: level, category: category)
        crumb.message = scrubSensitiveData(message)
        SentrySDK.addBreadcrumb(crumb)
    }

    /// Set user context
    func setUser(id: String, email: String? = nil, username: String? = nil) {
        guard isInitialized else { return }

        let user = User(userId: id)
        user.email = email
        user.username = username
        SentrySDK.setUser(user)
    }

    /// Clear user context (on logout)
    func clearUser() {
        guard isInitialized else { return }
        SentrySDK.setUser(nil)
    }

    /// Set a custom tag
    func setTag(key: String, value: String) {
        guard isInitialized else { return }
        SentrySDK.configureScope { scope in
            scope.setTag(value: value, key: key)
        }
    }

    /// Start a performance transaction
    func startTransaction(name: String, operation: String) -> Any? {
        guard isInitialized else { return nil }
        return SentrySDK.startTransaction(name: name, operation: operation)
    }

    /// Finish a performance transaction
    func finishTransaction(_ transaction: Any?, status: SentrySpanStatus = .ok) {
        guard let span = transaction as? Span else { return }
        span.finish(status: status)
    }

    // MARK: - Private Methods

    private nonisolated func scrubSensitiveData(_ text: String) -> String {
        var scrubbed = text

        // Scrub API keys (common patterns)
        let patterns = [
            "sk-[a-zA-Z0-9]{20,}",           // OpenAI
            "sk-ant-[a-zA-Z0-9-]{20,}",      // Anthropic
            "xai-[a-zA-Z0-9]{20,}",          // xAI
            "[a-zA-Z0-9]{32,}"               // Generic long keys
        ]

        for pattern in patterns {
            if let regex = try? NSRegularExpression(pattern: pattern, options: []) {
                scrubbed = regex.stringByReplacingMatches(
                    in: scrubbed,
                    options: [],
                    range: NSRange(scrubbed.startIndex..., in: scrubbed),
                    withTemplate: "[REDACTED]"
                )
            }
        }

        return scrubbed
    }
}

#else

/// Stub CrashReporter when Sentry is not available
///
/// To enable crash reporting, add Sentry as a Swift Package dependency:
/// 1. In Xcode, go to File → Add Package Dependencies
/// 2. Enter URL: https://github.com/getsentry/sentry-cocoa
/// 3. Select "Up to Next Major Version" from 8.0.0
/// 4. Add to the QueenMama target
@MainActor
final class CrashReporter {

    // MARK: - Singleton
    static let shared = CrashReporter()

    /// Whether Sentry is initialized
    private(set) var isInitialized = false

    /// Whether Sentry is available
    var isSentryAvailable: Bool { false }

    // MARK: - Initialization

    private init() {}

    // MARK: - Stub Methods

    func start(dsn: String? = nil) {
        print("[CrashReporter] Sentry not installed. Add Sentry-Cocoa via Swift Package Manager to enable crash reporting.")
    }

    func captureError(_ error: Error, extras: [String: Any]? = nil) {
        print("[CrashReporter] Error (not reported): \(error.localizedDescription)")
    }

    func captureMessage(_ message: String, level: CrashReporterLevel = .info) {
        print("[CrashReporter] Message (not reported): \(message)")
    }

    func addBreadcrumb(category: String, message: String, level: CrashReporterLevel = .info) {
        // No-op when Sentry not available
    }

    func setUser(id: String, email: String? = nil, username: String? = nil) {
        // No-op when Sentry not available
    }

    func clearUser() {
        // No-op when Sentry not available
    }

    func setTag(key: String, value: String) {
        // No-op when Sentry not available
    }

    func startTransaction(name: String, operation: String) -> Any? {
        return nil
    }

    func finishTransaction(_ transaction: Any?, status: CrashReporterSpanStatus = .ok) {
        // No-op when Sentry not available
    }
}

/// Stub level enum when Sentry not available
enum CrashReporterLevel {
    case debug, info, warning, error, fatal
}

/// Stub span status when Sentry not available
enum CrashReporterSpanStatus {
    case ok, cancelled, unknownError
}

#endif
