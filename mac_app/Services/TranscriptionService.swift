import Foundation
import Combine

// MARK: - Connection State Machine

enum TranscriptionConnectionState: Equatable {
    case disconnected
    case connecting
    case connected
    case reconnecting(attempt: Int, maxAttempts: Int)
    case failed(reason: String)

    var isActive: Bool {
        switch self {
        case .connected, .connecting, .reconnecting:
            return true
        case .disconnected, .failed:
            return false
        }
    }

    var displayStatus: String {
        switch self {
        case .disconnected:
            return "Disconnected"
        case .connecting:
            return "Connecting..."
        case .connected:
            return "Connected"
        case .reconnecting(let attempt, let max):
            return "Reconnecting (\(attempt)/\(max))..."
        case .failed(let reason):
            return "Failed: \(reason)"
        }
    }
}

@MainActor
final class TranscriptionService: ObservableObject {
    // MARK: - Published Properties

    @Published var isConnected = false
    @Published var connectionState: TranscriptionConnectionState = .disconnected
    @Published var currentTranscript = ""
    @Published var interimTranscript = ""
    @Published var errorMessage: String?
    @Published var currentProvider: TranscriptionProviderType?

    // MARK: - Callbacks (Microphone)

    var onTranscript: ((String) -> Void)?
    var onInterimTranscript: ((String) -> Void)?
    var onError: ((Error) -> Void)?

    // MARK: - Callbacks (System Audio)

    var onSystemTranscript: ((String) -> Void)?
    var onSystemInterimTranscript: ((String) -> Void)?

    // MARK: - Providers
    // Fallback order: Deepgram Nova-3 -> AssemblyAI Universal -> Deepgram Flux

    private let deepgramProvider = DeepgramProvider()           // Nova-3 (primary)
    private let assemblyAIProvider = AssemblyAIProvider()       // Universal-Streaming (fallback)
    private let deepgramFluxProvider = DeepgramFluxProvider()   // Flux (backup)

    private var providers: [TranscriptionProvider] {
        [deepgramProvider, assemblyAIProvider, deepgramFluxProvider]
    }

    private var configuredProviders: [TranscriptionProvider] {
        providers.filter { $0.isConfigured }
    }

    private var currentActiveProvider: TranscriptionProvider?

    // MARK: - System Audio Provider (Second WebSocket)

    private var systemAudioProvider: DeepgramProvider?
    @Published var isSystemAudioConnected = false

    // MARK: - Reconnection Configuration

    private let maxReconnectAttempts = 8
    private let baseReconnectDelay: TimeInterval = 3.0  // Base delay in seconds
    private let maxReconnectDelay: TimeInterval = 30.0  // Max delay cap (30s, not 60s - faster retry during meetings)
    private var reconnectAttempts = 0
    private var intentionalDisconnect = false
    private var reconnectTask: Task<Void, Never>?

    // Session-level reconnect tracking with sliding window
    // Instead of a lifetime cap, we limit reconnections within a time window.
    // This allows long meetings to survive intermittent disconnections while
    // still catching rapid-fire reconnection loops.
    private var reconnectTimestamps: [Date] = []
    private let maxReconnectsInWindow = 20       // Max reconnections in window (~5 incidents)
    private let reconnectWindowDuration: TimeInterval = 600  // 10-minute sliding window

    // MARK: - Auto-Recovery Configuration
    // When reconnection budget is exhausted, periodically retry to recover
    private var autoRecoveryTask: Task<Void, Never>?
    private let autoRecoveryInterval: TimeInterval = 60  // Retry every 60 seconds
    @Published var autoRecoveryCountdown: Int = 0
    private var autoRecoveryAttempts = 0
    private let maxAutoRecoveryAttempts = 5
    private var connectionStabilityTask: Task<Void, Never>?

    // MARK: - Sentry Throttling
    // Prevents duplicate reports for recurring issues
    private var lastReconnectLimitReportTime: Date?
    private var lastAutoRecoveryExhaustedReportTime: Date?
    private let sentryThrottleInterval: TimeInterval = 600 // Report at most once per 10 minutes

    // MARK: - Audio Batching Configuration
    // Accumulates audio buffers to reduce WebSocket message frequency by ~50%

    private var audioBatchBuffer = Data()
    private var audioBatchTimer: Timer?
    private let batchIntervalMs: Int = 150      // Max time before flushing batch (ms) — reduced from 400ms for lower transcript latency
    private let maxBatchSize: Int = 16000       // ~0.5 second of 16kHz mono audio — reduced from 32KB for more frequent flushes

    // MARK: - Initialization

    init() {
        setupProviderCallbacks()
    }

    // MARK: - Connection Management

    func connect(isReconnectAttempt: Bool = false) async throws {
        print("[Transcription] Connecting to transcription service...\(isReconnectAttempt ? " (reconnect)" : "")")

        // Cancel any pending reconnection
        reconnectTask?.cancel()
        reconnectTask = nil

        // Update state
        connectionState = .connecting

        // Clean up existing connection
        if let current = currentActiveProvider {
            current.disconnect()
            currentActiveProvider = nil
        }

        intentionalDisconnect = false
        // Only reset attempts on fresh connect (user-initiated), not on reconnect
        if !isReconnectAttempt {
            reconnectAttempts = 0
        }

        // Try each configured provider
        var lastError: Error?

        for provider in configuredProviders {
            do {
                print("[Transcription] Trying provider: \(provider.providerType.displayName)")
                try await provider.connect()
                currentActiveProvider = provider
                currentProvider = provider.providerType
                isConnected = true
                connectionState = .connected
                errorMessage = nil
                stopAutoRecovery()
                print("[Transcription] Successfully connected with \(provider.providerType.displayName)")
                return
            } catch {
                print("[Transcription] Provider \(provider.providerType.displayName) failed: \(error)")
                lastError = error
                continue
            }
        }

        // All providers failed
        isConnected = false
        connectionState = .failed(reason: lastError?.localizedDescription ?? "All providers failed")
        throw lastError ?? TranscriptionError.allProvidersFailed
    }

    func disconnect() {
        print("[Transcription] Disconnecting... (session had \(reconnectTimestamps.count) reconnections)")
        intentionalDisconnect = true

        // Cancel any pending reconnection and auto-recovery
        reconnectTask?.cancel()
        reconnectTask = nil
        connectionStabilityTask?.cancel()
        connectionStabilityTask = nil
        stopAutoRecovery()

        // Flush any pending audio before disconnecting
        flushAudioBatch()

        currentActiveProvider?.disconnect()
        currentActiveProvider = nil
        isConnected = false
        connectionState = .disconnected
        reconnectTimestamps.removeAll()
        currentProvider = nil
    }

    func sendAudio(_ data: Data) {
        guard isConnected, currentActiveProvider != nil else {
            return
        }

        // Accumulate audio data in batch buffer
        audioBatchBuffer.append(data)

        // Start batch timer if not already running
        if audioBatchTimer == nil {
            audioBatchTimer = Timer.scheduledTimer(
                withTimeInterval: TimeInterval(batchIntervalMs) / 1000.0,
                repeats: false
            ) { [weak self] _ in
                Task { @MainActor in
                    self?.flushAudioBatch()
                }
            }
        }

        // Flush immediately if batch exceeds max size (prevents excessive latency)
        if audioBatchBuffer.count >= maxBatchSize {
            flushAudioBatch()
        }
    }

    /// Flushes accumulated audio batch to the transcription provider
    private func flushAudioBatch() {
        // Cancel pending timer
        audioBatchTimer?.invalidate()
        audioBatchTimer = nil

        guard !audioBatchBuffer.isEmpty,
              isConnected,
              let provider = currentActiveProvider else {
            audioBatchBuffer.removeAll()
            return
        }

        let batchToSend = audioBatchBuffer
        audioBatchBuffer.removeAll()

        Task {
            do {
                try await provider.sendAudioData(batchToSend)
            } catch {
                print("[Transcription] Error sending audio batch: \(error)")
                handleError(error)
            }
        }
    }

    func clearTranscript() {
        currentTranscript = ""
        interimTranscript = ""

        // Clear any pending audio batch
        audioBatchTimer?.invalidate()
        audioBatchTimer = nil
        audioBatchBuffer.removeAll()
    }

    // MARK: - Network Error Classification

    private enum NetworkErrorClass {
        case transient   // Temporary network issue — breadcrumb only, reconnect
        case cancelled   // Intentional cancellation — ignore completely
        case permanent   // Persistent/unknown error — full Sentry event
    }

    /// Classifies a network error to determine Sentry reporting level.
    /// Transient errors (socket disconnects, timeouts) are downgraded to breadcrumbs
    /// to avoid flooding Sentry with noise from normal network conditions.
    private func classifyNetworkError(_ error: Error) -> NetworkErrorClass {
        // TranscriptionError cases are expected during disconnection/reconnection cycles
        // They are NOT permanent failures — classify as transient to avoid Sentry flooding
        if let transcriptionError = error as? TranscriptionError {
            switch transcriptionError {
            case .disconnected, .tokenExpired:
                return .transient
            default:
                return .permanent
            }
        }

        let nsError = error as NSError

        // NSPOSIXErrorDomain errors
        if nsError.domain == NSPOSIXErrorDomain {
            switch nsError.code {
            case 57:  // Socket is not connected
                return .transient
            case 60:  // Operation timed out
                return .transient
            default:
                return .permanent
            }
        }

        // NSURLErrorDomain errors
        if nsError.domain == NSURLErrorDomain {
            switch nsError.code {
            case -999:   // NSURLErrorCancelled
                return .cancelled
            case -1001:  // NSURLErrorTimedOut
                return .transient
            case -1005:  // NSURLErrorNetworkConnectionLost
                return .transient
            case -1009:  // NSURLErrorNotConnectedToInternet
                return .transient
            case -1004:  // NSURLErrorCannotConnectToHost
                return .transient
            default:
                return .permanent
            }
        }

        // WebSocket close codes (4xxx are custom, 1001 is going away)
        if nsError.domain == "WebSocket" || nsError.domain == "NWError" {
            return .transient
        }

        return .permanent
    }

    // MARK: - Private Methods

    private func setupProviderCallbacks() {
        for provider in providers {
            provider.onTranscript = { [weak self] transcript in
                Task { @MainActor in
                    self?.handleTranscript(transcript)
                }
            }

            provider.onInterimTranscript = { [weak self] transcript in
                Task { @MainActor in
                    self?.handleInterimTranscript(transcript)
                }
            }

            provider.onError = { [weak self] error in
                Task { @MainActor in
                    self?.handleError(error)
                }
            }
        }
    }

    private func handleTranscript(_ transcript: String) {
        currentTranscript += transcript + " "
        onTranscript?(transcript)
        interimTranscript = ""
    }

    private func handleInterimTranscript(_ transcript: String) {
        interimTranscript = transcript
        onInterimTranscript?(transcript)
    }

    private func handleError(_ error: Error) {
        print("[Transcription] Error: \(error.localizedDescription)")

        // Skip service-level reconnection if the provider is doing a planned token refresh
        // This prevents double-reconnection (provider + service simultaneously)
        if let provider = currentActiveProvider, provider.isTokenRefreshing {
            print("[Transcription] Suppressing reconnection during provider token refresh")
            return
        }

        let errorClass = classifyNetworkError(error)

        // Cancelled errors: log and return — no reconnection, no Sentry event
        if errorClass == .cancelled {
            print("[Transcription] Request cancelled — ignoring")
            return
        }

        errorMessage = error.localizedDescription
        isConnected = false
        onError?(error)

        // TRACKING: Report based on error classification
        switch errorClass {
        case .transient:
            // Breadcrumb only — avoids flooding Sentry with transient network errors
            CrashReporter.shared.addBreadcrumb(
                category: "transcription",
                message: "Transient error: \(error.localizedDescription) [provider: \(currentProvider?.rawValue ?? "unknown")]"
            )
        case .permanent:
            // Full Sentry event for persistent/unknown errors
            CrashReporter.shared.captureError(error, extras: [
                "provider": currentProvider?.rawValue ?? "unknown",
                "connection_state": connectionState.displayStatus,
                "reconnect_attempts": reconnectAttempts,
                "reconnects_in_window": reconnectTimestamps.count,
                "intentional_disconnect": intentionalDisconnect
            ])
        case .cancelled:
            break // Already handled above
        }

        AnalyticsService.shared.capture("transcription_error", properties: [
            "error": error.localizedDescription,
            "provider": currentProvider?.rawValue ?? "unknown",
            "will_reconnect": !intentionalDisconnect,
            "error_class": "\(errorClass)"
        ])

        // Try to reconnect if not intentionally disconnected
        if !intentionalDisconnect {
            scheduleReconnect()
        }
    }

    /// Reset reconnection budget for manual retry from UI
    func resetReconnectionBudget() {
        reconnectTimestamps.removeAll()
        reconnectAttempts = 0
        autoRecoveryAttempts = 0
        connectionStabilityTask?.cancel()
        connectionStabilityTask = nil
        stopAutoRecovery()
        print("[Transcription] Reconnection budget reset by user")
    }

    /// Schedule a reconnection attempt with exponential backoff and jitter
    private func scheduleReconnect() {
        // Don't schedule if already reconnecting or intentionally disconnected
        guard reconnectTask == nil, !intentionalDisconnect else { return }

        reconnectAttempts += 1

        // Track reconnection timestamp and prune old entries outside the window
        let now = Date()
        reconnectTimestamps.append(now)
        reconnectTimestamps.removeAll { now.timeIntervalSince($0) > reconnectWindowDuration }

        // Track reconnection for health monitoring
        HealthCheckService.shared.recordWebSocketReconnect()

        // Sliding window cap: too many reconnections in the last 10 minutes
        if reconnectTimestamps.count > maxReconnectsInWindow {
            print("[Transcription] Session reconnect limit reached (\(reconnectTimestamps.count) reconnections in \(Int(reconnectWindowDuration))s window)")
            connectionState = .failed(reason: "Connection unstable - too many reconnections")

            // Throttle: report to Sentry at most once per 10 minutes
            let now = Date()
            if lastReconnectLimitReportTime == nil || now.timeIntervalSince(lastReconnectLimitReportTime!) > sentryThrottleInterval {
                lastReconnectLimitReportTime = now
                CrashReporter.shared.captureMessage(
                    "Transcription session reconnect limit reached (\(reconnectTimestamps.count) reconnections in \(Int(reconnectWindowDuration))s)",
                    level: .error
                )
            } else {
                CrashReporter.shared.addBreadcrumb(
                    category: "transcription",
                    message: "Reconnect limit reached (throttled) — \(reconnectTimestamps.count) reconnections"
                )
            }
            AnalyticsService.shared.capture("transcription_session_reconnect_limit", properties: [
                "total_reconnects": reconnectTimestamps.count,
                "provider": currentProvider?.rawValue ?? "unknown"
            ])
            startAutoRecovery()
            return
        }

        if reconnectAttempts > maxReconnectAttempts {
            print("[Transcription] Max reconnection attempts reached (\(maxReconnectAttempts))")
            connectionState = .failed(reason: "Max reconnection attempts reached")

            // Throttle: report to Sentry at most once per 10 minutes
            let now = Date()
            if lastReconnectLimitReportTime == nil || now.timeIntervalSince(lastReconnectLimitReportTime!) > sentryThrottleInterval {
                lastReconnectLimitReportTime = now
                CrashReporter.shared.captureMessage(
                    "Transcription max reconnection attempts reached",
                    level: .error
                )
            } else {
                CrashReporter.shared.addBreadcrumb(
                    category: "transcription",
                    message: "Max reconnect attempts reached (throttled)"
                )
            }
            AnalyticsService.shared.capture("transcription_reconnect_exhausted", properties: [
                "max_attempts": maxReconnectAttempts,
                "provider": currentProvider?.rawValue ?? "unknown"
            ])
            startAutoRecovery()
            return
        }

        // Update state
        connectionState = .reconnecting(attempt: reconnectAttempts, maxAttempts: maxReconnectAttempts)

        // Calculate delay with exponential backoff + jitter
        let exponentialDelay = baseReconnectDelay * pow(2.0, Double(reconnectAttempts - 1))
        let jitter = Double.random(in: 0...0.5) * exponentialDelay
        let delay = min(exponentialDelay + jitter, maxReconnectDelay)

        print("[Transcription] Reconnecting in \(String(format: "%.1f", delay))s (attempt \(reconnectAttempts)/\(maxReconnectAttempts))")

        reconnectTask = Task { [weak self] in
            do {
                try await Task.sleep(nanoseconds: UInt64(delay * 1_000_000_000))

                // Check if still needed
                guard let self = self, !self.intentionalDisconnect else { return }

                await MainActor.run {
                    self.reconnectTask = nil
                }

                try await self.connect(isReconnectAttempt: true)
                print("[Transcription] Reconnected successfully!")

                // Reset attempts after successful reconnection
                await MainActor.run {
                    self.reconnectAttempts = 0
                }

            } catch is CancellationError {
                print("[Transcription] Reconnection cancelled")
            } catch {
                print("[Transcription] Reconnection failed: \(error)")

                await MainActor.run { [weak self] in
                    self?.reconnectTask = nil
                    // Schedule next attempt
                    self?.scheduleReconnect()
                }
            }
        }
    }

    /// Reset reconnection state (call after successful manual connect)
    private func resetReconnectionState() {
        reconnectTask?.cancel()
        reconnectTask = nil
        reconnectAttempts = 0
    }

    // MARK: - Auto-Recovery

    /// Start periodic auto-recovery when reconnection budget is exhausted.
    /// Runs every 60s with a visible countdown, resets attempt counter (but NOT timestamps),
    /// and tries to reconnect. Caps at maxAutoRecoveryAttempts to avoid infinite loops.
    private func startAutoRecovery() {
        stopAutoRecovery()
        autoRecoveryCountdown = Int(autoRecoveryInterval)

        autoRecoveryTask = Task { [weak self] in
            guard let self = self else { return }

            while !Task.isCancelled {
                // Check auto-recovery attempt cap
                let currentAttempt = await MainActor.run { self.autoRecoveryAttempts }
                if currentAttempt >= self.maxAutoRecoveryAttempts {
                    print("[Transcription] Auto-recovery exhausted (\(self.maxAutoRecoveryAttempts) attempts)")
                    await MainActor.run {
                        self.connectionState = .failed(reason: "Connection could not be restored. Please retry manually.")
                        self.stopAutoRecovery()

                        // Throttle: report to Sentry at most once per 10 minutes
                        let now = Date()
                        if self.lastAutoRecoveryExhaustedReportTime == nil || now.timeIntervalSince(self.lastAutoRecoveryExhaustedReportTime!) > self.sentryThrottleInterval {
                            self.lastAutoRecoveryExhaustedReportTime = now
                            CrashReporter.shared.captureMessage(
                                "Transcription auto-recovery exhausted after \(self.maxAutoRecoveryAttempts) attempts",
                                level: .error
                            )
                        } else {
                            CrashReporter.shared.addBreadcrumb(
                                category: "transcription",
                                message: "Auto-recovery exhausted (throttled)"
                            )
                        }
                        AnalyticsService.shared.capture("transcription_auto_recovery_exhausted", properties: [
                            "max_attempts": self.maxAutoRecoveryAttempts,
                            "provider": self.currentProvider?.rawValue ?? "unknown"
                        ])
                    }
                    return
                }

                // Countdown loop (1 tick per second)
                for remaining in stride(from: Int(self.autoRecoveryInterval), through: 1, by: -1) {
                    guard !Task.isCancelled else { return }
                    await MainActor.run { self.autoRecoveryCountdown = remaining }
                    try? await Task.sleep(nanoseconds: 1_000_000_000)
                }

                guard !Task.isCancelled, !self.intentionalDisconnect else { return }

                // Reset attempt counter only (preserve timestamps for sliding window protection)
                await MainActor.run {
                    self.autoRecoveryCountdown = 0
                    self.autoRecoveryAttempts += 1
                    self.reconnectAttempts = 0
                    print("[Transcription] Auto-recovery attempt \(self.autoRecoveryAttempts)/\(self.maxAutoRecoveryAttempts): resetting attempt counter")
                }

                do {
                    try await self.connect(isReconnectAttempt: false)
                    print("[Transcription] Auto-recovery succeeded!")
                    await MainActor.run {
                        self.stopAutoRecovery()
                        // Schedule delayed cleanup: only clear timestamps if connection stays stable for 30s
                        self.scheduleConnectionStabilityCheck()
                    }
                    return
                } catch {
                    print("[Transcription] Auto-recovery failed: \(error.localizedDescription)")
                    // Will loop and try again after countdown
                }
            }
        }
    }

    /// Stop auto-recovery countdown and cancel the task.
    private func stopAutoRecovery() {
        autoRecoveryTask?.cancel()
        autoRecoveryTask = nil
        autoRecoveryCountdown = 0
    }

    /// After a successful auto-recovery reconnection, wait 30s to confirm stability
    /// before clearing the sliding window timestamps. This prevents rapid disconnect→reconnect
    /// cycles from bypassing the circuit breaker.
    private func scheduleConnectionStabilityCheck() {
        connectionStabilityTask?.cancel()
        connectionStabilityTask = Task { [weak self] in
            try? await Task.sleep(nanoseconds: 30_000_000_000) // 30 seconds
            guard let self = self, !Task.isCancelled else { return }

            await MainActor.run {
                if self.isConnected && self.connectionState == .connected {
                    print("[Transcription] Connection stable for 30s, clearing reconnection history")
                    self.reconnectTimestamps.removeAll()
                    self.autoRecoveryAttempts = 0
                }
            }
        }
    }

    // MARK: - System Audio Connection (Second WebSocket)

    /// Connect a second WebSocket for system audio transcription
    func connectSystemAudio() async throws {
        print("[Transcription] Connecting system audio WebSocket...")

        // Create dedicated provider for system audio
        systemAudioProvider = DeepgramProvider()

        guard let provider = systemAudioProvider else {
            throw TranscriptionError.allProvidersFailed
        }

        // Setup callbacks for system audio transcripts
        provider.onTranscript = { [weak self] transcript in
            Task { @MainActor in
                self?.handleSystemTranscript(transcript)
            }
        }

        provider.onInterimTranscript = { [weak self] transcript in
            Task { @MainActor in
                self?.handleSystemInterimTranscript(transcript)
            }
        }

        provider.onError = { [weak self] error in
            Task { @MainActor in
                self?.handleSystemAudioError(error)
            }
        }

        // Connect
        do {
            try await provider.connect()
            isSystemAudioConnected = true
            print("[Transcription] System audio WebSocket connected successfully!")
        } catch {
            print("[Transcription] System audio connection failed: \(error)")
            systemAudioProvider = nil
            isSystemAudioConnected = false
            throw error
        }
    }

    /// Disconnect the system audio WebSocket
    func disconnectSystemAudio() {
        print("[Transcription] Disconnecting system audio...")
        systemAudioProvider?.disconnect()
        systemAudioProvider = nil
        isSystemAudioConnected = false
    }

    /// Send audio data to the system audio transcription WebSocket
    func sendSystemAudio(_ data: Data) {
        guard isSystemAudioConnected, let provider = systemAudioProvider else {
            // Log when we receive audio but can't send it (for debugging)
            if !isSystemAudioConnected {
                print("[Transcription] System audio received but WebSocket not connected")
            }
            return
        }

        Task {
            do {
                try await provider.sendAudioData(data)
            } catch {
                print("[Transcription] Error sending system audio: \(error)")
            }
        }
    }

    private func handleSystemTranscript(_ transcript: String) {
        onSystemTranscript?(transcript)
    }

    private func handleSystemInterimTranscript(_ transcript: String) {
        onSystemInterimTranscript?(transcript)
    }

    private func handleSystemAudioError(_ error: Error) {
        print("[Transcription] System audio error: \(error.localizedDescription)")
        isSystemAudioConnected = false
        // Don't trigger reconnection for system audio - it's optional
    }
}
