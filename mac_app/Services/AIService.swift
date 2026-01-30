import Foundation
import Combine
import SwiftData

// MARK: - SwiftData Save Helper (inline until SwiftDataHelper is added to Xcode project)
private actor SwiftDataSaveHelper {
    private var saveWorkItem: DispatchWorkItem?
    private let saveDebounceInterval: TimeInterval = 0.3

    func save(context: ModelContext?, immediate: Bool) {
        guard let context = context else { return }

        if immediate {
            saveWorkItem?.cancel()
            saveWorkItem = nil

            Task.detached(priority: .userInitiated) {
                try? context.save()
            }
        } else {
            saveWorkItem?.cancel()

            let workItem = DispatchWorkItem {
                Task.detached(priority: .utility) {
                    try? context.save()
                }
            }

            saveWorkItem = workItem
            DispatchQueue.main.asyncAfter(deadline: .now() + saveDebounceInterval, execute: workItem)
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
            return "Please sign in to use AI features"
        case .requiresEnterprise:
            return "This feature requires an Enterprise subscription"
        case .dailyLimitReached(let used, let limit):
            return "Daily AI request limit reached (\(used)/\(limit)). Upgrade to continue."
        case .smartModeLimitReached(let used, let limit):
            return "Smart Mode limit reached (\(used)/\(limit)). Upgrade to Enterprise for unlimited access."
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
        // Clear in-memory responses
        responses.removeAll()
        currentResponse = ""

        // Clear persisted responses
        if let context = modelContext {
            do {
                try context.delete(model: AIResponse.self)
                try context.save()
                print("[AIService] Cleared all response history")
            } catch {
                print("[AIService] Failed to clear history: \(error)")
            }
        }
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

            responses.insert(response, at: 0)
            return response
        } catch {
            print("[AIService] Backend proxy failed: \(error)")
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
                    continuation.finish(throwing: licenseError!)
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
                do {
                    // Accumulate chunks on background thread, batch UI updates
                    var accumulatedResponse = ""
                    var chunkBuffer = ""
                    var lastUIUpdate = Date()
                    let uiUpdateInterval: TimeInterval = 0.05  // Update UI every 50ms max

                    for try await chunk in self.proxyProvider.generateStreamingResponse(context: context) {
                        accumulatedResponse += chunk
                        chunkBuffer += chunk
                        continuation.yield(chunk)

                        // Batch UI updates to avoid main thread blocking
                        let now = Date()
                        if now.timeIntervalSince(lastUIUpdate) >= uiUpdateInterval {
                            let bufferedContent = chunkBuffer
                            await MainActor.run {
                                self.currentResponse += bufferedContent
                            }
                            chunkBuffer = ""
                            lastUIUpdate = now
                        }
                    }

                    // Flush remaining buffer
                    if !chunkBuffer.isEmpty {
                        await MainActor.run {
                            self.currentResponse += chunkBuffer
                        }
                    }

                    let providerType = await MainActor.run { self.proxyProvider.providerType }
                    print("[AIService] Successfully completed via backend proxy")
                    print("[AIService] Response length: \(accumulatedResponse.count) chars")
                    print("[AIService] Response preview: \(accumulatedResponse.prefix(200))...")

                    // Final UI updates and persistence on main actor
                    await MainActor.run {
                        let licenseManager = LicenseManager.shared

                        self.lastProvider = providerType

                        // Record successful usage
                        licenseManager.recordUsage(.aiRequest, provider: providerType.rawValue)
                        if isSmartMode {
                            licenseManager.recordUsage(.smartMode, provider: providerType.rawValue)
                        }

                        // Save completed response
                        let response = AIResponse(
                            type: type,
                            content: accumulatedResponse,
                            provider: providerType
                        )
                        self.responses.insert(response, at: 0)

                        // Persist to SwiftData (use debounced save)
                        if let ctx = self.modelContext {
                            ctx.insert(response)
                            Task { await self.dbHelper.save(context: ctx, immediate: false) }
                        }

                        self.isProcessing = false
                    }

                    continuation.finish()
                } catch {
                    print("[AIService] Backend proxy streaming failed: \(error)")
                    await MainActor.run {
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
            responses.insert(response, at: 0)

            // Persist to SwiftData (use immediate save for auto-response)
            if let ctx = self.modelContext {
                ctx.insert(response)
                Task { await dbHelper.save(context: ctx, immediate: true) }
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
            Task { await dbHelper.save(context: context, immediate: true) }
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
                    continuation.finish(throwing: licenseError!)
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
                    let uiUpdateInterval: TimeInterval = 0.05  // Update UI every 50ms max

                    for try await chunk in self.proxyProvider.generateStreamingResponse(context: context) {
                        accumulatedResponse += chunk
                        chunkBuffer += chunk
                        continuation.yield(chunk)

                        // Batch UI updates to avoid main thread blocking
                        let now = Date()
                        if now.timeIntervalSince(lastUIUpdate) >= uiUpdateInterval {
                            let bufferedContent = chunkBuffer
                            await MainActor.run {
                                self.currentResponse += bufferedContent
                            }
                            chunkBuffer = ""
                            lastUIUpdate = now
                        }
                    }

                    // Flush remaining buffer
                    if !chunkBuffer.isEmpty {
                        await MainActor.run {
                            self.currentResponse += chunkBuffer
                        }
                    }

                    let providerType = await MainActor.run { self.proxyProvider.providerType }
                    print("[AIService] Proactive response completed via backend proxy")

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
                        self.responses.insert(response, at: 0)

                        // Persist to SwiftData (use debounced save)
                        if let ctx = self.modelContext {
                            ctx.insert(response)
                            Task { await self.dbHelper.save(context: ctx, immediate: false) }
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
                Task { await dbHelper.save(context: context, immediate: true) }
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
                Match the language of the transcript (French or English).
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
