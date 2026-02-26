import Foundation
import Combine

/// Proactive health monitoring service
/// Detects performance issues BEFORE users report them
@MainActor
final class HealthCheckService: ObservableObject {

    // MARK: - Singleton

    static let shared = HealthCheckService()

    // MARK: - Published State

    @Published private(set) var overallHealth: HealthStatus = .healthy
    @Published private(set) var checks: [HealthCheck] = []

    // MARK: - Configuration

    /// How often to run health checks (seconds)
    private let checkInterval: TimeInterval = 30

    /// Thresholds for various metrics
    struct Thresholds {
        static let maxMemoryMB: Double = 500
        static let maxAIResponseTimeMs: Int = 10_000
        static let maxTranscriptionLatencyMs: Int = 2_000
        static let minTranscriptionWordsPerMinute: Int = 10
        static let maxWebSocketReconnects: Int = 3
    }

    // MARK: - Private Properties

    private var checkTimer: Timer?
    private var aiResponseTimes: [Int] = []  // Last N response times in ms
    private var transcriptionLatencies: [Int] = []
    private var webSocketReconnectCount: Int = 0
    private var sessionStartTime: Date?
    private var wordsTranscribed: Int = 0

    private let maxSamples = 10  // Keep last 10 samples for averaging

    // MARK: - Initialization

    private init() {
        setupInitialChecks()
    }

    // MARK: - Public API

    /// Start monitoring (call when session starts)
    func startMonitoring() {
        print("[HealthCheck] Starting proactive monitoring...")
        sessionStartTime = Date()
        wordsTranscribed = 0
        webSocketReconnectCount = 0

        // Run initial check
        Task {
            await runAllChecks()
        }

        // Schedule periodic checks
        checkTimer = Timer.scheduledTimer(withTimeInterval: checkInterval, repeats: true) { [weak self] _ in
            Task { @MainActor in
                await self?.runAllChecks()
            }
        }

        // Track monitoring start
        AnalyticsService.shared.capture("health_monitoring_started", properties: [:])
    }

    /// Stop monitoring (call when session ends)
    func stopMonitoring() {
        print("[HealthCheck] Stopping monitoring...")
        checkTimer?.invalidate()
        checkTimer = nil

        // Report final health summary
        reportSessionHealthSummary()

        // Reset state
        aiResponseTimes.removeAll()
        transcriptionLatencies.removeAll()
        sessionStartTime = nil
    }

    /// Record an AI response time for monitoring
    func recordAIResponseTime(_ milliseconds: Int) {
        aiResponseTimes.append(milliseconds)
        if aiResponseTimes.count > maxSamples {
            aiResponseTimes.removeFirst()
        }

        // Check if this specific response was too slow
        if milliseconds > Thresholds.maxAIResponseTimeMs {
            reportAnomaly(
                type: .aiResponseSlow,
                message: "AI response took \(milliseconds)ms (threshold: \(Thresholds.maxAIResponseTimeMs)ms)",
                severity: .warning,
                extras: ["response_time_ms": milliseconds]
            )
        }
    }

    /// Record transcription latency
    func recordTranscriptionLatency(_ milliseconds: Int) {
        transcriptionLatencies.append(milliseconds)
        if transcriptionLatencies.count > maxSamples {
            transcriptionLatencies.removeFirst()
        }
    }

    /// Record words transcribed (for throughput calculation)
    func recordWordsTranscribed(_ count: Int) {
        wordsTranscribed += count
    }

    /// Record WebSocket reconnection attempt
    func recordWebSocketReconnect() {
        webSocketReconnectCount += 1

        if webSocketReconnectCount >= Thresholds.maxWebSocketReconnects {
            reportAnomaly(
                type: .connectionUnstable,
                message: "WebSocket reconnected \(webSocketReconnectCount) times this session",
                severity: .warning,
                extras: ["reconnect_count": webSocketReconnectCount]
            )
        }
    }

    // MARK: - Health Checks

    private func setupInitialChecks() {
        checks = [
            HealthCheck(id: "memory", name: "Memory Usage", status: .healthy),
            HealthCheck(id: "ai_response", name: "AI Response Time", status: .healthy),
            HealthCheck(id: "transcription", name: "Transcription", status: .healthy),
            HealthCheck(id: "connection", name: "Connection Stability", status: .healthy)
        ]
    }

    private func runAllChecks() async {
        var newChecks: [HealthCheck] = []
        var hasWarning = false
        var hasCritical = false

        // 1. Memory Check
        let memoryCheck = await checkMemory()
        newChecks.append(memoryCheck)
        if memoryCheck.status == .warning { hasWarning = true }
        if memoryCheck.status == .critical { hasCritical = true }

        // 2. AI Response Time Check
        let aiCheck = checkAIResponseTime()
        newChecks.append(aiCheck)
        if aiCheck.status == .warning { hasWarning = true }
        if aiCheck.status == .critical { hasCritical = true }

        // 3. Transcription Health Check
        let transcriptionCheck = checkTranscriptionHealth()
        newChecks.append(transcriptionCheck)
        if transcriptionCheck.status == .warning { hasWarning = true }
        if transcriptionCheck.status == .critical { hasCritical = true }

        // 4. Connection Stability Check
        let connectionCheck = checkConnectionStability()
        newChecks.append(connectionCheck)
        if connectionCheck.status == .warning { hasWarning = true }
        if connectionCheck.status == .critical { hasCritical = true }

        // Update state
        checks = newChecks
        overallHealth = hasCritical ? .critical : (hasWarning ? .warning : .healthy)

        // Log status periodically
        print("[HealthCheck] Status: \(overallHealth.rawValue) - Memory: \(memoryCheck.status.rawValue), AI: \(aiCheck.status.rawValue), Transcription: \(transcriptionCheck.status.rawValue), Connection: \(connectionCheck.status.rawValue)")
    }

    // MARK: - Individual Checks

    private func checkMemory() async -> HealthCheck {
        let memoryMB = getMemoryUsageMB()
        let status: HealthStatus

        if memoryMB > Thresholds.maxMemoryMB * 1.5 {
            status = .critical
            reportAnomaly(
                type: .highMemory,
                message: "Memory usage critical: \(Int(memoryMB))MB",
                severity: .error,
                extras: ["memory_mb": memoryMB, "threshold_mb": Thresholds.maxMemoryMB]
            )
        } else if memoryMB > Thresholds.maxMemoryMB {
            status = .warning
        } else {
            status = .healthy
        }

        return HealthCheck(
            id: "memory",
            name: "Memory Usage",
            status: status,
            detail: "\(Int(memoryMB))MB",
            value: memoryMB
        )
    }

    private func checkAIResponseTime() -> HealthCheck {
        guard !aiResponseTimes.isEmpty else {
            return HealthCheck(id: "ai_response", name: "AI Response Time", status: .healthy, detail: "No data")
        }

        let avgTime = aiResponseTimes.reduce(0, +) / aiResponseTimes.count
        let status: HealthStatus

        if avgTime > Thresholds.maxAIResponseTimeMs {
            status = .critical
        } else if avgTime > Thresholds.maxAIResponseTimeMs / 2 {
            status = .warning
        } else {
            status = .healthy
        }

        return HealthCheck(
            id: "ai_response",
            name: "AI Response Time",
            status: status,
            detail: "Avg: \(avgTime)ms",
            value: Double(avgTime)
        )
    }

    private func checkTranscriptionHealth() -> HealthCheck {
        guard let startTime = sessionStartTime else {
            return HealthCheck(id: "transcription", name: "Transcription", status: .healthy, detail: "No session")
        }

        let sessionMinutes = Date().timeIntervalSince(startTime) / 60
        guard sessionMinutes > 1 else {
            return HealthCheck(id: "transcription", name: "Transcription", status: .healthy, detail: "Starting...")
        }

        let wordsPerMinute = Int(Double(wordsTranscribed) / sessionMinutes)
        let status: HealthStatus

        if wordsPerMinute < Thresholds.minTranscriptionWordsPerMinute / 2 && sessionMinutes > 2 {
            status = .critical
            reportAnomaly(
                type: .lowTranscription,
                message: "Very low transcription rate: \(wordsPerMinute) words/min",
                severity: .warning,
                extras: ["words_per_minute": wordsPerMinute, "session_minutes": sessionMinutes]
            )
        } else if wordsPerMinute < Thresholds.minTranscriptionWordsPerMinute && sessionMinutes > 2 {
            status = .warning
        } else {
            status = .healthy
        }

        return HealthCheck(
            id: "transcription",
            name: "Transcription",
            status: status,
            detail: "\(wordsPerMinute) words/min",
            value: Double(wordsPerMinute)
        )
    }

    private func checkConnectionStability() -> HealthCheck {
        let status: HealthStatus

        if webSocketReconnectCount >= Thresholds.maxWebSocketReconnects * 2 {
            status = .critical
        } else if webSocketReconnectCount >= Thresholds.maxWebSocketReconnects {
            status = .warning
        } else {
            status = .healthy
        }

        return HealthCheck(
            id: "connection",
            name: "Connection Stability",
            status: status,
            detail: "\(webSocketReconnectCount) reconnects",
            value: Double(webSocketReconnectCount)
        )
    }

    // MARK: - Reporting

    private func reportAnomaly(type: AnomalyType, message: String, severity: Severity, extras: [String: Any]) {
        print("[HealthCheck] ANOMALY: \(type.rawValue) - \(message)")

        // Only report highMemory as a full Sentry event.
        // connectionUnstable, aiResponseSlow, lowTranscription are already reported
        // by their respective services (TranscriptionService, AIService) — sending
        // duplicate captureMessage here floods Sentry with noise.
        switch type {
        case .highMemory:
            CrashReporter.shared.captureMessage(message, level: severity.sentryLevel)
        case .connectionUnstable, .aiResponseSlow, .lowTranscription:
            // Breadcrumb only — avoids duplicate Sentry events
            break
        }

        // Always add breadcrumb for debugging context
        CrashReporter.shared.addBreadcrumb(
            category: "health_check",
            message: "\(type.rawValue): \(message)",
            level: severity.sentryLevel
        )

        // Report to PostHog (keep analytics for all anomaly types)
        var properties: [String: Any] = [
            "anomaly_type": type.rawValue,
            "message": message,
            "severity": severity.rawValue
        ]
        properties.merge(extras) { _, new in new }
        AnalyticsService.shared.capture("health_anomaly_detected", properties: properties)
    }

    private func reportSessionHealthSummary() {
        guard let startTime = sessionStartTime else { return }

        let sessionDuration = Date().timeIntervalSince(startTime)
        let avgAITime = aiResponseTimes.isEmpty ? 0 : aiResponseTimes.reduce(0, +) / aiResponseTimes.count

        let summary: [String: Any] = [
            "session_duration_seconds": Int(sessionDuration),
            "total_words_transcribed": wordsTranscribed,
            "websocket_reconnects": webSocketReconnectCount,
            "avg_ai_response_ms": avgAITime,
            "final_health_status": overallHealth.rawValue,
            "memory_mb": getMemoryUsageMB()
        ]

        // Log to PostHog for analysis
        AnalyticsService.shared.capture("health_session_summary", properties: summary)

        print("[HealthCheck] Session summary: \(summary)")
    }

    // MARK: - Helpers

    private func getMemoryUsageMB() -> Double {
        var info = mach_task_basic_info()
        var count = mach_msg_type_number_t(MemoryLayout<mach_task_basic_info>.size) / 4

        let result = withUnsafeMutablePointer(to: &info) {
            $0.withMemoryRebound(to: integer_t.self, capacity: Int(count)) {
                task_info(mach_task_self_, task_flavor_t(MACH_TASK_BASIC_INFO), $0, &count)
            }
        }

        guard result == KERN_SUCCESS else {
            return 0
        }

        return Double(info.resident_size) / 1_000_000  // Convert to MB
    }
}

// MARK: - Models

extension HealthCheckService {

    enum HealthStatus: String {
        case healthy = "healthy"
        case warning = "warning"
        case critical = "critical"

        var color: String {
            switch self {
            case .healthy: return "green"
            case .warning: return "yellow"
            case .critical: return "red"
            }
        }
    }

    struct HealthCheck: Identifiable {
        let id: String
        let name: String
        let status: HealthStatus
        var detail: String = ""
        var value: Double = 0
    }

    enum AnomalyType: String {
        case highMemory = "high_memory"
        case aiResponseSlow = "ai_response_slow"
        case lowTranscription = "low_transcription"
        case connectionUnstable = "connection_unstable"
    }

    enum Severity: String {
        case info = "info"
        case warning = "warning"
        case error = "error"

        var sentryLevel: SentryLevel {
            switch self {
            case .info: return .info
            case .warning: return .warning
            case .error: return .error
            }
        }
    }
}

// MARK: - SentryLevel Compatibility

#if canImport(Sentry)
import Sentry
typealias SentryLevel = Sentry.SentryLevel
#else
enum SentryLevel {
    case info, warning, error
}
#endif
