import Foundation
import Combine
import SwiftData

// MARK: - SwiftData Save Helper
// Uses @MainActor to ensure ModelContext.save() runs on the same thread where context was created
// This prevents "ModelContext unbinding from main queue" warnings and potential deadlocks
@MainActor
private final class SwiftDataSaveHelper {
    private var saveTask: Task<Void, Never>?
    private let saveDebounceInterval: TimeInterval = 0.3

    func save(context: ModelContext?, immediate: Bool) {
        guard let context = context else { return }

        if immediate {
            // Cancel pending debounced save
            saveTask?.cancel()
            saveTask = nil

            // Save immediately on main actor (where context was created)
            do {
                try context.save()
            } catch {
                print("[AIService] Error saving context: \(error)")
            }
        } else {
            // Cancel any pending debounced save
            saveTask?.cancel()

            // Schedule debounced save on main actor
            saveTask = Task { @MainActor [weak self] in
                guard let self = self else { return }

                do {
                    try await Task.sleep(nanoseconds: UInt64(self.saveDebounceInterval * 1_000_000_000))

                    // Check if task was cancelled during sleep
                    try Task.checkCancellation()

                    try context.save()
                } catch is CancellationError {
                    // Debounce cancelled by newer save request - this is expected
                } catch {
                    print("[AIService] Error saving context: \(error)")
                }
            }
        }
    }
}

// MARK: - License Errors

enum AILicenseError: LocalizedError {
    case requiresAuthentication
    case requiresEnterprise
    case dailyLimitReached(used: Int, limit: Int)
    case smartModeLimitReached(used: Int, limit: Int)

    var errorDescription: String? {
        switch self {
        case .requiresAuthentication:
            return String(localized: "error.license.requiresAuthentication")
        case .requiresEnterprise:
            return String(localized: "error.license.requiresEnterprise")
        case .dailyLimitReached:
            return String(localized: "error.license.dailyLimitReached")
        case .smartModeLimitReached:
            return String(localized: "error.license.smartModeLimitReached")
        }
    }
}

@MainActor
final class AIService: ObservableObject {
    // MARK: - Published Properties

    @Published var isProcessing = false
    @Published var currentResponse = ""
    @Published var lastProvider: AIProviderType?
    @Published var errorMessage: String?
    @Published var responses: [AIResponse] = []

    // SwiftData
    var modelContext: ModelContext?
    private let dbHelper = SwiftDataSaveHelper()

    // MARK: - Transcript Trimming (Phase 3 Optimization)
    // Reduces payload size for real-time requests while keeping full context for Recap
    static let defaultMaxTranscriptLength = 4000  // Characters for Assist/WhatToSay/FollowUp

    // MARK: - Memory Management
    // Limit responses in memory to prevent unbounded growth during long sessions
    private let maxResponsesInMemory = 50

    /// Add a response with memory limit enforcement
    /// Oldest responses are dropped from memory (still persisted in SwiftData)
    private func addResponse(_ response: AIResponse) {
        responses.insert(response, at: 0)

        // Enforce memory limit
        if responses.count > maxResponsesInMemory {
            let excess = responses.count - maxResponsesInMemory
            responses.removeLast(excess)
            print("[AIService] Trimmed \(excess) old responses from memory (limit: \(maxResponsesInMemory))")
        }
    }

    /// Trim transcript to specified length, keeping the most recent content
    /// Preserves word boundaries and adds truncation indicator
    static func trimTranscript(_ transcript: String, maxLength: Int) -> String {
        guard transcript.count > maxLength else {
            return transcript
        }

        // Find a good break point (word boundary)
        let startIndex = transcript.index(transcript.endIndex, offsetBy: -maxLength)
        var trimmedStart = startIndex

        // Try to find a space or newline near the start
        if let spaceIndex = transcript[startIndex...].firstIndex(where: { $0.isWhitespace }) {
            trimmedStart = transcript.index(after: spaceIndex)
        }

        let trimmed = String(transcript[trimmedStart...])

        // Add indicator that content was trimmed
        return "...[transcript trimmed to recent content]...\n\n" + trimmed
    }

    // MARK: - AI Refusal Detection
    // Detects when AI models refuse to help due to safety filters
    // Used to trigger retry without screenshot which often resolves the issue

    /// Common AI refusal patterns that indicate safety filter triggered
    private static let refusalPatterns: [String] = [
        "i'm sorry, i can't help",
        "i cannot help with that",
        "i can't assist with",
        "i'm not able to help",
        "i cannot assist",
        "i'm unable to help",
        "i can't provide help",
        "sorry, but i can't",
        "i apologize, but i cannot",
        "i'm afraid i can't"
    ]

    /// Checks if a response appears to be an AI safety filter refusal
    private static func isRefusalResponse(_ response: String) -> Bool {
        let lowercased = response.lowercased().trimmingCharacters(in: .whitespacesAndNewlines)

        // Short responses that start with refusal patterns are likely safety blocks
        if lowercased.count < 100 {
            for pattern in refusalPatterns {
                if lowercased.contains(pattern) {
                    return true
                }
            }
        }

        return false
    }

    // MARK: - Proxy Provider (single provider architecture)

    // Single proxy provider that routes ALL requests through the backend
    // The backend handles provider cascade (OpenAI → Grok → Anthropic) internally
    // Client no longer needs to iterate through providers - backend manages resilience
    private lazy var proxyProvider: ProxyAIProvider = {
        // Use OpenAI as the nominal provider type - actual provider is determined by backend cascade
        ProxyAIProvider(provider: .openai)
    }()

    private var isProxyConfigured: Bool {
        !ProxyConfigManager.shared.availableAIProviders.isEmpty
    }

    // MARK: - Initialization

    init() {}

    func loadHistory(from context: ModelContext) {
        self.modelContext = context

        // Load persisted responses
        let descriptor = FetchDescriptor<AIResponse>(
            sortBy: [SortDescriptor(\.timestamp, order: .reverse)]
        )

        do {
            responses = try context.fetch(descriptor)
            print("[AIService] Loaded \(responses.count) responses from history")
        } catch {
            print("[AIService] Failed to load history: \(error)")
        }
    }

    func clearHistory() {
        responses.removeAll()
        currentResponse = ""
        print("[AIService] Cleared in-memory response history")
    }

    // MARK: - Public Methods

    func hasConfiguredProviders() -> Bool {
        isProxyConfigured
    }

    func generateResponse(
        transcript: String,
        screenshot: Data? = nil,
        mode: Mode? = nil,
        type: AIResponse.ResponseType,
        customPrompt: String? = nil,
        smartMode: Bool? = nil
    ) async throws -> AIResponse {
        isProcessing = true
        currentResponse = ""
        errorMessage = nil

        defer { isProcessing = false }

        // License checks
        let licenseManager = LicenseManager.shared

        // Check authentication
        let authAccess = licenseManager.canUse(.aiRequest)
        if case .blocked = authAccess {
            throw AILicenseError.requiresAuthentication
        }

        // Check AI request limit
        if case .limitReached(let used, let limit) = authAccess {
            throw AILicenseError.dailyLimitReached(used: used, limit: limit)
        }

        // Check Smart Mode access if enabled
        let useSmartMode = smartMode ?? ConfigurationManager.shared.smartModeEnabled
        if useSmartMode {
            let smartModeAccess = licenseManager.canUse(.smartMode)
            switch smartModeAccess {
            case .requiresEnterprise:
                throw AILicenseError.requiresEnterprise
            case .limitReached(let used, let limit):
                throw AILicenseError.smartModeLimitReached(used: used, limit: limit)
            default:
                break
            }
        }

        let context = AIContext(
            transcript: transcript,
            screenshot: screenshot,
            mode: mode,
            responseType: type,
            customPrompt: customPrompt,
            smartMode: useSmartMode
        )

        // Single request to backend - backend handles provider cascade internally
        print("[AIService] Sending request to backend proxy (mode: \(useSmartMode ? "Smart" : "Standard"))")

        do {
            let response = try await proxyProvider.generateResponse(context: context)
            lastProvider = response.provider

            // Record successful usage
            licenseManager.recordUsage(.aiRequest, provider: response.provider.rawValue)
            if useSmartMode {
                licenseManager.recordUsage(.smartMode, provider: response.provider.rawValue)
            }

            addResponse(response)
            return response
        } catch {
            print("[AIService] Backend proxy failed: \(error)")

            // TRACKING: Report AI failure to Sentry and PostHog
            CrashReporter.shared.captureError(error, extras: [
                "response_type": type.rawValue,
                "smart_mode": useSmartMode,
                "has_screenshot": screenshot != nil,
                "transcript_length": transcript.count
            ])
            AnalyticsService.shared.trackError(
                error.localizedDescription,
                context: "ai_request_\(type.rawValue)"
            )

            throw error
        }
    }

    func generateStreamingResponse(
        transcript: String,
        screenshot: Data? = nil,
        mode: Mode? = nil,
        type: AIResponse.ResponseType,
        customPrompt: String? = nil,
        smartMode: Bool? = nil
    ) -> AsyncThrowingStream<String, Error> {
        AsyncThrowingStream { continuation in
            Task {
                // Perform license checks on main actor
                let (canProceed, licenseError, isSmartMode) = await MainActor.run { () -> (Bool, Error?, Bool) in
                    let licenseManager = LicenseManager.shared
                    let smartModeEnabled = smartMode ?? ConfigurationManager.shared.smartModeEnabled

                    // License checks
                    let authAccess = licenseManager.canUse(.aiRequest)
                    if case .blocked = authAccess {
                        return (false, AILicenseError.requiresAuthentication, smartModeEnabled)
                    }

                    if case .limitReached(let used, let limit) = authAccess {
                        return (false, AILicenseError.dailyLimitReached(used: used, limit: limit), smartModeEnabled)
                    }

                    // Check Smart Mode access if enabled
                    if smartModeEnabled {
                        let smartModeAccess = licenseManager.canUse(.smartMode)
                        switch smartModeAccess {
                        case .requiresEnterprise:
                            return (false, AILicenseError.requiresEnterprise, smartModeEnabled)
                        case .limitReached(let used, let limit):
                            return (false, AILicenseError.smartModeLimitReached(used: used, limit: limit), smartModeEnabled)
                        default:
                            break
                        }
                    }

                    return (true, nil, smartModeEnabled)
                }

                if !canProceed {
                    continuation.finish(throwing: licenseError ?? AILicenseError.requiresAuthentication)
                    return
                }

                print("[AIService] Starting streaming response for type: \(type.rawValue)")
                print("[AIService] Smart Mode: \(isSmartMode)")
                print("[AIService] Backend handles provider cascade internally")
                print("[AIService] Transcript length: \(transcript.count) chars")

                // Update UI state on main actor
                await MainActor.run {
                    self.isProcessing = true
                    self.currentResponse = ""
                    self.errorMessage = nil
                }

                // Track response time for health monitoring
                let responseStartTime = CFAbsoluteTimeGetCurrent()

                let context = AIContext(
                    transcript: transcript,
                    screenshot: screenshot,
                    mode: mode,
                    responseType: type,
                    customPrompt: customPrompt,
                    smartMode: isSmartMode
                )

                // Single request to backend - no client-side cascade needed
                // Backend handles provider fallback (OpenAI → Grok → Anthropic)

                // Accumulate chunks on background thread, batch UI updates
                // Declared outside `do` so timeout-retry catch clause can reuse them
                var accumulatedResponse = ""
                var chunkBuffer = ""
                var lastUIUpdate = Date()
                let uiUpdateInterval: TimeInterval = 0.016  // 16ms = 1 frame @60fps
                var isFirstChunk = true

                do {

                    for try await chunk in self.proxyProvider.generateStreamingResponse(context: context) {
                        accumulatedResponse += chunk
                        chunkBuffer += chunk
                        continuation.yield(chunk)

                        // Flush immediately on first chunk to minimize perceived TTFT,
                        // then batch subsequent updates at 60fps
                        let now = Date()
                        if isFirstChunk || now.timeIntervalSince(lastUIUpdate) >= uiUpdateInterval {
                            let bufferedContent = chunkBuffer
                            await MainActor.run {
                                self.currentResponse += bufferedContent
                            }
                            chunkBuffer = ""
                            lastUIUpdate = now
                            isFirstChunk = false
                        }
                    }

                    // Flush remaining buffer
                    if !chunkBuffer.isEmpty {
                        await MainActor.run {
                            self.currentResponse += chunkBuffer
                        }
                    }

                    // Use actual provider from backend stream metadata, fallback to nominal type
                    let providerType: AIProviderType = await MainActor.run {
                        if let backendProvider = ProxyAPIClient.shared.lastStreamProvider,
                           let mapped = ProxyAIProviderFactory.mapBackendNameToType(backendProvider) {
                            return mapped
                        }
                        return self.proxyProvider.providerType
                    }
                    print("[AIService] Successfully completed via backend proxy (provider: \(providerType.rawValue))")
                    print("[AIService] Response length: \(accumulatedResponse.count) chars")
                    print("[AIService] Response preview: \(accumulatedResponse.prefix(200))...")

                    // REFUSAL DETECTION: If AI refused, handle gracefully
                    if Self.isRefusalResponse(accumulatedResponse) {
                        print("[AIService] ⚠️ AI refusal detected")

                        // TRACKING: Log AI refusal event for monitoring
                        await MainActor.run {
                            AnalyticsService.shared.capture("ai_refusal_detected", properties: [
                                "response_type": type.rawValue,
                                "refusal_text": String(accumulatedResponse.prefix(100)),
                                "has_screenshot": screenshot != nil,
                                "will_retry": screenshot != nil
                            ])
                            CrashReporter.shared.addBreadcrumb(
                                category: "ai",
                                message: "AI refusal detected for \(type.rawValue), screenshot: \(screenshot != nil)"
                            )
                        }

                        if screenshot != nil {
                            // Screenshot likely triggered the safety filter — retry without it
                            // Show a brief explanation while retrying
                            print("[AIService] ⚠️ Retrying WITHOUT screenshot...")
                            await MainActor.run {
                                self.currentResponse = "🔒 *Privacy protection activated* — Your screen capture contains protected content (faces, sensitive data). Retrying analysis without the screenshot...\n\n"
                            }

                            // Create new context WITHOUT screenshot
                            let retryContext = AIContext(
                                transcript: transcript,
                                screenshot: nil,
                                mode: mode,
                                responseType: type,
                                customPrompt: customPrompt,
                                smartMode: isSmartMode
                            )

                            // Reset for retry (keep the explanation prefix in currentResponse)
                            accumulatedResponse = ""
                            chunkBuffer = ""
                            lastUIUpdate = Date()
                            isFirstChunk = true

                            // Retry streaming without screenshot
                            for try await chunk in self.proxyProvider.generateStreamingResponse(context: retryContext) {
                                accumulatedResponse += chunk
                                chunkBuffer += chunk
                                continuation.yield(chunk)

                                let now = Date()
                                if isFirstChunk || now.timeIntervalSince(lastUIUpdate) >= uiUpdateInterval {
                                    let bufferedContent = chunkBuffer
                                    await MainActor.run {
                                        self.currentResponse += bufferedContent
                                    }
                                    chunkBuffer = ""
                                    lastUIUpdate = now
                                    isFirstChunk = false
                                }
                            }

                            // Flush remaining buffer from retry
                            if !chunkBuffer.isEmpty {
                                await MainActor.run {
                                    self.currentResponse += chunkBuffer
                                }
                            }

                            print("[AIService] ✅ Retry without screenshot completed: \(accumulatedResponse.count) chars")

                            // TRACKING: Log retry result
                            let retrySucceeded = !Self.isRefusalResponse(accumulatedResponse)
                            await MainActor.run {
                                AnalyticsService.shared.capture("ai_retry_without_screenshot", properties: [
                                    "response_type": type.rawValue,
                                    "retry_succeeded": retrySucceeded,
                                    "response_length": accumulatedResponse.count
                                ])
                            }
                        } else {
                            // No screenshot to remove — show user-friendly explanation instead of raw refusal
                            await MainActor.run {
                                self.currentResponse = "🔒 **Privacy protection activated**\n\nThe conversation content triggered an AI safety protection. This can happen when:\n\n- The transcript contains sensitive information (medical, financial data)\n- The context is interpreted as potentially confidential\n\nThese protections exist to **safeguard your privacy**.\n\n💡 **Try again** — results may vary."
                            }
                        }
                    }

                    // Record AI response time for health monitoring
                    let responseTimeMs = Int((CFAbsoluteTimeGetCurrent() - responseStartTime) * 1000)
                    await MainActor.run {
                        HealthCheckService.shared.recordAIResponseTime(responseTimeMs)
                    }

                    // Final UI updates and persistence on main actor
                    await MainActor.run {
                        let licenseManager = LicenseManager.shared

                        self.lastProvider = providerType

                        // Record successful usage
                        licenseManager.recordUsage(.aiRequest, provider: providerType.rawValue)
                        if isSmartMode {
                            licenseManager.recordUsage(.smartMode, provider: providerType.rawValue)
                        }

                        // Save completed response (skip empty streams — surface error to caller)
                        guard !accumulatedResponse.isEmpty else {
                            print("[AIService] Empty stream response — backend returned no content")
                            self.isProcessing = false
                            continuation.finish(throwing: NSError(
                                domain: "AIService",
                                code: -2,
                                userInfo: [NSLocalizedDescriptionKey: String(localized: "error.emptyResponse")]
                            ))
                            return
                        }
                        let response = AIResponse(
                            type: type,
                            content: accumulatedResponse,
                            provider: providerType
                        )
                        self.addResponse(response)

                        // Persist to SwiftData (use debounced save)
                        if let ctx = self.modelContext {
                            ctx.insert(response)
                            self.dbHelper.save(context: ctx, immediate: false)
                        }

                        self.isProcessing = false
                    }

                    continuation.finish()
                } catch let urlError as URLError where urlError.code == .timedOut && screenshot != nil {
                    // Timeout with screenshot — retry with lighter payload (no screenshot)
                    print("[AIService] Timeout with screenshot — retrying without screenshot...")

                    await MainActor.run {
                        CrashReporter.shared.addBreadcrumb(
                            category: "ai",
                            message: "Timeout retry without screenshot for \(type.rawValue)"
                        )
                        self.currentResponse = String(localized: "error.timeout.retryingWithoutScreenshot") + "\n\n"
                    }

                    // Build lighter context without screenshot
                    let retryContext = AIContext(
                        transcript: transcript,
                        screenshot: nil,
                        mode: mode,
                        responseType: type,
                        customPrompt: customPrompt,
                        smartMode: isSmartMode
                    )

                    // Reset accumulators for retry
                    accumulatedResponse = ""
                    chunkBuffer = ""
                    lastUIUpdate = Date()
                    isFirstChunk = true

                    do {
                        for try await chunk in self.proxyProvider.generateStreamingResponse(context: retryContext) {
                            accumulatedResponse += chunk
                            chunkBuffer += chunk
                            continuation.yield(chunk)

                            let now = Date()
                            if isFirstChunk || now.timeIntervalSince(lastUIUpdate) >= uiUpdateInterval {
                                let bufferedContent = chunkBuffer
                                await MainActor.run {
                                    self.currentResponse += bufferedContent
                                }
                                chunkBuffer = ""
                                lastUIUpdate = now
                                isFirstChunk = false
                            }
                        }

                        // Flush remaining buffer
                        if !chunkBuffer.isEmpty {
                            await MainActor.run {
                                self.currentResponse += chunkBuffer
                            }
                        }

                        print("[AIService] Retry without screenshot completed: \(accumulatedResponse.count) chars")

                        // Record response time and persist
                        let responseTimeMs = Int((CFAbsoluteTimeGetCurrent() - responseStartTime) * 1000)
                        let retryProviderType = await MainActor.run { self.proxyProvider.providerType }
                        await MainActor.run {
                            HealthCheckService.shared.recordAIResponseTime(responseTimeMs)

                            let response = AIResponse(
                                type: type,
                                content: accumulatedResponse,
                                provider: retryProviderType
                            )
                            self.addResponse(response)
                            self.lastProvider = retryProviderType

                            let licenseManager = LicenseManager.shared
                            licenseManager.recordUsage(.aiRequest, provider: retryProviderType.rawValue)
                            if isSmartMode {
                                licenseManager.recordUsage(.smartMode, provider: retryProviderType.rawValue)
                            }

                            if let ctx = self.modelContext {
                                ctx.insert(response)
                                self.dbHelper.save(context: ctx, immediate: false)
                            }

                            self.isProcessing = false
                        }

                        continuation.finish()
                    } catch {
                        // Second attempt also failed — propagate as retryable error
                        print("[AIService] Retry without screenshot also failed: \(error)")
                        await MainActor.run {
                            CrashReporter.shared.captureError(error, extras: [
                                "response_type": type.rawValue,
                                "smart_mode": isSmartMode,
                                "timeout_retry": true,
                                "transcript_length": transcript.count,
                                "streaming": true
                            ])
                            AnalyticsService.shared.trackError(
                                error.localizedDescription,
                                context: "ai_streaming_timeout_retry_\(type.rawValue)"
                            )
                            self.currentResponse = ""
                            self.isProcessing = false
                        }
                        continuation.finish(throwing: error)
                    }
                } catch {
                    print("[AIService] Backend proxy streaming failed: \(error)")

                    // TRACKING: Report streaming failure to Sentry and PostHog
                    await MainActor.run {
                        CrashReporter.shared.captureError(error, extras: [
                            "response_type": type.rawValue,
                            "smart_mode": isSmartMode,
                            "has_screenshot": screenshot != nil,
                            "transcript_length": transcript.count,
                            "streaming": true
                        ])
                        AnalyticsService.shared.trackError(
                            error.localizedDescription,
                            context: "ai_streaming_\(type.rawValue)"
                        )
                        self.currentResponse = ""
                        self.isProcessing = false
                    }
                    continuation.finish(throwing: error)
                }
            }
        }
    }

    // MARK: - Convenience Methods

    func assist(transcript: String, screenshot: Data?, mode: Mode?) async throws -> AIResponse {
        try await generateResponse(
            transcript: transcript,
            screenshot: screenshot,
            mode: mode,
            type: .assist
        )
    }

    func whatToSay(transcript: String, screenshot: Data?, mode: Mode?) async throws -> AIResponse {
        try await generateResponse(
            transcript: transcript,
            screenshot: screenshot,
            mode: mode,
            type: .whatToSay
        )
    }

    func followUpQuestions(transcript: String, screenshot: Data?, mode: Mode?) async throws -> AIResponse {
        try await generateResponse(
            transcript: transcript,
            screenshot: screenshot,
            mode: mode,
            type: .followUp
        )
    }

    func recap(transcript: String, screenshot: Data?, mode: Mode?) async throws -> AIResponse {
        try await generateResponse(
            transcript: transcript,
            screenshot: screenshot,
            mode: mode,
            type: .recap
        )
    }

    func askCustomQuestion(
        question: String,
        transcript: String,
        screenshot: Data?,
        mode: Mode?
    ) async throws -> AIResponse {
        try await generateResponse(
            transcript: transcript,
            screenshot: screenshot,
            mode: mode,
            type: .custom,
            customPrompt: question
        )
    }

    // MARK: - Pre-Generation (Buffered)

    /// Generate an assist response for pre-generation buffer.
    /// Bypasses usage recording (dailyAiRequestLimit) — the pre-gen is "free".
    /// Does NOT modify isProcessing or currentResponse — caller manages state.
    func generatePreGenStreamingResponse(
        transcript: String,
        screenshot: Data?,
        mode: Mode?
    ) -> AsyncThrowingStream<String, Error> {
        AsyncThrowingStream { continuation in
            Task {
                // Only check authentication — skip usage limits
                let isAuthenticated = await MainActor.run {
                    AuthenticationManager.shared.isAuthenticated
                }
                guard isAuthenticated else {
                    continuation.finish()
                    return
                }

                // Early cancellation check before network call
                guard !Task.isCancelled else {
                    continuation.finish()
                    return
                }

                let context = AIContext(
                    transcript: transcript,
                    screenshot: screenshot,
                    mode: mode,
                    responseType: .assist,
                    customPrompt: nil,
                    smartMode: false  // Standard mode for speed
                )

                do {
                    for try await chunk in self.proxyProvider.generateStreamingResponse(context: context) {
                        try Task.checkCancellation()
                        continuation.yield(chunk)
                    }
                    continuation.finish()
                } catch {
                    continuation.finish(throwing: error)
                }
            }
        }
    }

    // MARK: - Streaming Convenience Methods

    func assistStreaming(transcript: String, screenshot: Data?, mode: Mode?) -> AsyncThrowingStream<String, Error> {
        generateStreamingResponse(
            transcript: transcript,
            screenshot: screenshot,
            mode: mode,
            type: .assist
        )
    }

    func whatToSayStreaming(transcript: String, screenshot: Data?, mode: Mode?) -> AsyncThrowingStream<String, Error> {
        generateStreamingResponse(
            transcript: transcript,
            screenshot: screenshot,
            mode: mode,
            type: .whatToSay
        )
    }

    // MARK: - Auto Response

    /// Generate an automatic response (triggered by AutoAnswerService)
    /// Returns a response marked as automatic with special styling
    func generateAutoResponse(transcript: String, mode: Mode?) async throws -> AIResponse {
        isProcessing = true
        currentResponse = ""
        errorMessage = nil

        defer { isProcessing = false }

        // License checks
        let licenseManager = LicenseManager.shared

        // Check enterprise license for auto-answer
        guard licenseManager.isFeatureAvailable(.autoAnswer) else {
            throw AILicenseError.requiresEnterprise
        }

        // Check AI request limit
        let authAccess = licenseManager.canUse(.aiRequest)
        if case .blocked = authAccess {
            throw AILicenseError.requiresAuthentication
        }
        if case .limitReached(let used, let limit) = authAccess {
            throw AILicenseError.dailyLimitReached(used: used, limit: limit)
        }

        let context = AIContext(
            transcript: transcript,
            screenshot: nil,  // No screenshot for auto responses
            mode: mode,
            responseType: .assist,  // Use assist type for auto responses
            customPrompt: """
            Based on the conversation, provide a brief, proactive suggestion or insight that could help the user.
            Keep it concise (1-2 sentences max) and immediately actionable.
            Focus on what the user might need to know or say next.
            """,
            smartMode: false  // Don't use smart mode for auto responses (faster)
        )

        // Single request to backend - backend handles provider cascade
        print("[AIService] Generating auto-response via backend proxy")

        do {
            let result = try await proxyProvider.generateResponse(context: context)
            lastProvider = result.provider

            // Record usage
            licenseManager.recordUsage(.aiRequest, provider: result.provider.rawValue)

            // Create response marked as automatic
            let response = AIResponse(
                automatic: .assist,
                content: result.content,
                provider: result.provider
            )

            // Insert at beginning of responses list
            addResponse(response)

            // Persist to SwiftData (use immediate save for auto-response)
            if let ctx = self.modelContext {
                ctx.insert(response)
                dbHelper.save(context: ctx, immediate: true)
            }

            print("[AIService] Auto-response generated successfully")
            return response
        } catch {
            print("[AIService] Auto-response failed: \(error)")
            throw error
        }
    }

    /// Remove a specific response from history (used for dismissing auto responses)
    func dismissResponse(_ response: AIResponse) {
        responses.removeAll { $0.id == response.id }

        // Remove from SwiftData (use immediate save for delete)
        if let context = modelContext {
            context.delete(response)
            dbHelper.save(context: context, immediate: true)
            print("[AIService] Dismissed response: \(response.id)")
        }
    }

    // MARK: - Proactive Response (Enterprise)

    /// Generate a proactive response based on a detected conversation moment
    /// Returns a streaming response with moment-specific context
    func generateProactiveResponse(
        transcript: String,
        moment: MomentDetectionService.DetectedMoment,
        mode: Mode?,
        screenshot: Data? = nil
    ) -> AsyncThrowingStream<String, Error> {
        AsyncThrowingStream { continuation in
            Task {
                // Perform license checks on main actor
                let (canProceed, licenseError) = await MainActor.run { () -> (Bool, Error?) in
                    let licenseManager = LicenseManager.shared

                    // License checks
                    guard licenseManager.isFeatureAvailable(.proactiveSuggestions) else {
                        return (false, AILicenseError.requiresEnterprise)
                    }

                    let authAccess = licenseManager.canUse(.aiRequest)
                    if case .blocked = authAccess {
                        return (false, AILicenseError.requiresAuthentication)
                    }
                    if case .limitReached(let used, let limit) = authAccess {
                        return (false, AILicenseError.dailyLimitReached(used: used, limit: limit))
                    }

                    return (true, nil)
                }

                if !canProceed {
                    continuation.finish(throwing: licenseError ?? AILicenseError.requiresAuthentication)
                    return
                }

                // Update UI state on main actor
                await MainActor.run {
                    self.isProcessing = true
                    self.currentResponse = ""
                    self.errorMessage = nil
                }

                // Build context with moment-specific prompt addition
                let momentPromptAddition = moment.type.promptAddition
                let triggerContext = await MainActor.run {
                    MomentDetectionService.shared.extractTriggerContext(
                        from: transcript,
                        trigger: moment.triggerPhrase
                    )
                }

                let customPrompt = """
                \(momentPromptAddition)

                TRIGGER DETECTED: "\(triggerContext)"
                Confidence: \(String(format: "%.0f%%", moment.confidence * 100))

                Based on this trigger and the conversation context, provide an appropriate response.
                Be concise (2-4 sentences) and immediately actionable.
                """

                let context = AIContext(
                    transcript: transcript,
                    screenshot: screenshot,
                    mode: mode,
                    responseType: moment.type.suggestedResponseType,
                    customPrompt: customPrompt,
                    smartMode: false  // Use standard mode for speed
                )

                // Single request to backend - backend handles provider cascade
                print("[AIService] Generating proactive response for moment: \(moment.type.label)")
                print("[AIService] Trigger phrase: \"\(moment.triggerPhrase)\"")
                print("[AIService] Backend handles provider cascade internally")

                do {
                    // Accumulate chunks on background thread, batch UI updates
                    var accumulatedResponse = ""
                    var chunkBuffer = ""
                    var lastUIUpdate = Date()
                    let uiUpdateInterval: TimeInterval = 0.016  // 16ms = 1 frame @60fps
                    var isFirstChunk = true

                    for try await chunk in self.proxyProvider.generateStreamingResponse(context: context) {
                        accumulatedResponse += chunk
                        chunkBuffer += chunk
                        continuation.yield(chunk)

                        // Flush immediately on first chunk to minimize perceived TTFT,
                        // then batch subsequent updates at 60fps
                        let now = Date()
                        if isFirstChunk || now.timeIntervalSince(lastUIUpdate) >= uiUpdateInterval {
                            let bufferedContent = chunkBuffer
                            await MainActor.run {
                                self.currentResponse += bufferedContent
                            }
                            chunkBuffer = ""
                            lastUIUpdate = now
                            isFirstChunk = false
                        }
                    }

                    // Flush remaining buffer
                    if !chunkBuffer.isEmpty {
                        await MainActor.run {
                            self.currentResponse += chunkBuffer
                        }
                    }

                    // Use actual provider from backend stream metadata, fallback to nominal type
                    let providerType: AIProviderType = await MainActor.run {
                        if let backendProvider = ProxyAPIClient.shared.lastStreamProvider,
                           let mapped = ProxyAIProviderFactory.mapBackendNameToType(backendProvider) {
                            return mapped
                        }
                        return self.proxyProvider.providerType
                    }
                    print("[AIService] Proactive response completed via backend proxy (provider: \(providerType.rawValue))")

                    // Final UI updates and persistence on main actor
                    await MainActor.run {
                        let licenseManager = LicenseManager.shared

                        self.lastProvider = providerType

                        // Record successful usage
                        licenseManager.recordUsage(.aiRequest, provider: providerType.rawValue)

                        // Save completed response (marked as automatic)
                        let response = AIResponse(
                            automatic: moment.type.suggestedResponseType,
                            content: accumulatedResponse,
                            provider: providerType
                        )
                        self.addResponse(response)

                        // Persist to SwiftData (use debounced save)
                        if let ctx = self.modelContext {
                            ctx.insert(response)
                            self.dbHelper.save(context: ctx, immediate: false)
                        }

                        self.isProcessing = false
                    }

                    continuation.finish()
                } catch {
                    print("[AIService] Proactive response failed: \(error)")
                    await MainActor.run {
                        self.currentResponse = ""
                        self.isProcessing = false
                    }
                    continuation.finish(throwing: error)
                }
            }
        }
    }

    // MARK: - History Management

    func clearResponses() {
        responses.removeAll()
        currentResponse = ""

        // Clear from SwiftData
        if let context = modelContext {
            do {
                try context.delete(model: AIResponse.self)
                // Use immediate save for bulk delete
                dbHelper.save(context: context, immediate: true)
                print("[AIService] Cleared all responses from history")
            } catch {
                print("[AIService] Failed to clear history: \(error)")
            }
        }
    }

    func getResponse(by id: UUID) -> AIResponse? {
        responses.first { $0.id == id }
    }

    // MARK: - Session Finalization Methods

    /// Generate a concise title for a session from its transcript
    func generateSessionTitle(transcript: String) async -> String {
        guard !transcript.isEmpty else {
            return "Session - \(Date().formatted(date: .abbreviated, time: .shortened))"
        }

        do {
            let response = try await generateResponse(
                transcript: String(transcript.prefix(3000)),
                screenshot: nil,
                mode: nil,
                type: .custom,
                customPrompt: """
                Generate a SHORT, CONCISE title (maximum 6-8 words) for this conversation.
                The title should capture the main topic or purpose discussed.
                Return ONLY the title, no quotes, no explanation, no punctuation at the end.
                CRITICAL: The title MUST be in the SAME language as the transcript. French transcript = French title. English transcript = English title.
                """,
                smartMode: false
            )

            let title = response.content
                .trimmingCharacters(in: .whitespacesAndNewlines)
                .trimmingCharacters(in: CharacterSet(charactersIn: "\"'"))

            return title.isEmpty ? "Untitled Session" : title
        } catch {
            print("[AIService] Title generation failed: \(error)")
            return "Session - \(Date().formatted(date: .abbreviated, time: .shortened))"
        }
    }

    /// Generate a summary for a session from its transcript
    func generateSessionSummary(transcript: String) async -> String? {
        guard transcript.count >= 100 else { return nil }

        do {
            let response = try await generateResponse(
                transcript: transcript,
                screenshot: nil,
                mode: nil,
                type: .recap,
                customPrompt: nil,
                smartMode: false
            )
            return response.content
        } catch {
            print("[AIService] Summary generation failed: \(error)")
            return nil
        }
    }

    // MARK: - Export

    func exportToMarkdown() -> String {
        var markdown = "# Queen Mama - AI Response History\n\n"
        markdown += "Exported on \(Date().formatted(date: .long, time: .shortened))\n\n"
        markdown += "---\n\n"

        for response in responses.reversed() {
            let formatter = DateFormatter()
            formatter.dateStyle = .medium
            formatter.timeStyle = .short

            markdown += "## \(response.type.rawValue)\n\n"
            markdown += "**Time:** \(formatter.string(from: response.timestamp))  \n"
            markdown += "**Provider:** \(response.provider.displayName)  \n"
            if let latency = response.latencyMs {
                markdown += "**Latency:** \(latency)ms  \n"
            }
            markdown += "\n"
            markdown += response.content
            markdown += "\n\n---\n\n"
        }

        return markdown
    }
}
