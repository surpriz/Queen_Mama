import Foundation
import Combine
import SwiftData

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

    // MARK: - Proxy Providers (new architecture)

    // Proxy providers route through backend - created dynamically based on config
    private var proxyProviders: [AIProvider] {
        let configManager = ProxyConfigManager.shared

        // Create proxy providers for each available backend provider
        let availableProviders = configManager.availableAIProviders
        let preferredProvider = ConfigurationManager.shared.selectedAIProvider

        // Sort with preferred first
        let sortedProviders = availableProviders.sorted { first, _ in
            first.lowercased() == preferredProvider.rawValue.lowercased()
        }

        return sortedProviders.compactMap { providerName -> AIProvider? in
            // Map backend provider names (lowercase) to Swift enum
            guard let type = Self.mapBackendProviderToType(providerName) else {
                print("[AIService] Unknown provider from backend: \(providerName)")
                return nil
            }
            return ProxyAIProvider(provider: type)
        }
    }

    // Map backend provider names to AIProviderType
    // Backend uses: "openai", "anthropic", "gemini", "grok"
    // Swift enum uses: "OpenAI", "Anthropic", "Google Gemini", "xAI Grok"
    private static func mapBackendProviderToType(_ name: String) -> AIProviderType? {
        switch name.lowercased() {
        case "openai":
            return .openai
        case "anthropic":
            return .anthropic
        case "gemini":
            return .gemini
        case "grok", "xai":
            return .grok
        default:
            return nil
        }
    }

    // Dynamic provider selection based on mode (proxy-based)
    private func getProviders(smartMode: Bool) -> [AIProvider] {
        // With proxy architecture, all providers are accessed through the backend
        // Smart mode is handled by the backend based on the request
        return proxyProviders
    }

    private var configuredProviders: [AIProvider] {
        proxyProviders
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
        !configuredProviders.isEmpty
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

        // Try each configured provider in order based on mode
        var lastError: Error?
        let providers = getProviders(smartMode: useSmartMode)

        print("[AIService] Using \(useSmartMode ? "Smart" : "Standard") mode providers: \(providers.map { $0.providerType.displayName })")

        for provider in providers {
            do {
                print("[AIService] Trying provider: \(provider.providerType.displayName)")
                let response = try await provider.generateResponse(context: context)
                lastProvider = provider.providerType

                // Record successful usage
                licenseManager.recordUsage(.aiRequest, provider: provider.providerType.rawValue)
                if useSmartMode {
                    licenseManager.recordUsage(.smartMode, provider: provider.providerType.rawValue)
                }

                responses.insert(response, at: 0)
                return response
            } catch {
                lastError = error
                print("[AIService] Provider \(provider.providerType.displayName) failed: \(error)")
                continue
            }
        }

        throw lastError ?? AIProviderError.allProvidersFailed
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
            Task { @MainActor in
                let licenseManager = LicenseManager.shared
                let isSmartMode = smartMode ?? ConfigurationManager.shared.smartModeEnabled

                // License checks
                let authAccess = licenseManager.canUse(.aiRequest)
                if case .blocked = authAccess {
                    continuation.finish(throwing: AILicenseError.requiresAuthentication)
                    return
                }

                if case .limitReached(let used, let limit) = authAccess {
                    continuation.finish(throwing: AILicenseError.dailyLimitReached(used: used, limit: limit))
                    return
                }

                // Check Smart Mode access if enabled
                if isSmartMode {
                    let smartModeAccess = licenseManager.canUse(.smartMode)
                    switch smartModeAccess {
                    case .requiresEnterprise:
                        continuation.finish(throwing: AILicenseError.requiresEnterprise)
                        return
                    case .limitReached(let used, let limit):
                        continuation.finish(throwing: AILicenseError.smartModeLimitReached(used: used, limit: limit))
                        return
                    default:
                        break
                    }
                }

                let providers = self.getProviders(smartMode: isSmartMode)

                print("[AIService] Starting streaming response for type: \(type.rawValue)")
                print("[AIService] Smart Mode: \(isSmartMode)")
                print("[AIService] Using providers: \(providers.map { $0.providerType.displayName })")
                print("[AIService] Transcript length: \(transcript.count) chars")

                self.isProcessing = true
                self.currentResponse = ""
                self.errorMessage = nil

                let context = AIContext(
                    transcript: transcript,
                    screenshot: screenshot,
                    mode: mode,
                    responseType: type,
                    customPrompt: customPrompt,
                    smartMode: isSmartMode
                )

                var succeeded = false

                for provider in providers {
                    print("[AIService] Trying provider: \(provider.providerType.displayName)")
                    do {
                        for try await chunk in provider.generateStreamingResponse(context: context) {
                            self.currentResponse += chunk
                            continuation.yield(chunk)
                        }
                        self.lastProvider = provider.providerType
                        succeeded = true
                        print("[AIService] Successfully completed with \(provider.providerType.displayName)")
                        print("[AIService] Response length: \(self.currentResponse.count) chars")
                        print("[AIService] Response preview: \(self.currentResponse.prefix(200))...")

                        // Record successful usage
                        licenseManager.recordUsage(.aiRequest, provider: provider.providerType.rawValue)
                        if isSmartMode {
                            licenseManager.recordUsage(.smartMode, provider: provider.providerType.rawValue)
                        }

                        // Save completed response
                        let response = AIResponse(
                            type: type,
                            content: self.currentResponse,
                            provider: provider.providerType
                        )
                        self.responses.insert(response, at: 0)

                        // Persist to SwiftData
                        if let context = self.modelContext {
                            context.insert(response)
                            try? context.save()
                        }
                        break
                    } catch {
                        print("[AIService] Streaming provider \(provider.providerType.displayName) failed: \(error)")
                        self.currentResponse = ""
                        continue
                    }
                }

                self.isProcessing = false

                if succeeded {
                    continuation.finish()
                } else {
                    continuation.finish(throwing: AIProviderError.allProvidersFailed)
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

        // Try each configured provider in order
        var lastError: Error?
        let providers = getProviders(smartMode: false)

        print("[AIService] Generating auto-response with providers: \(providers.map { $0.providerType.displayName })")

        for provider in providers {
            do {
                print("[AIService] Auto-response: trying \(provider.providerType.displayName)")
                let result = try await provider.generateResponse(context: context)
                lastProvider = provider.providerType

                // Record usage
                licenseManager.recordUsage(.aiRequest, provider: provider.providerType.rawValue)

                // Create response marked as automatic
                let response = AIResponse(
                    automatic: .assist,
                    content: result.content,
                    provider: provider.providerType
                )

                // Insert at beginning of responses list
                responses.insert(response, at: 0)

                // Persist to SwiftData
                if let context = self.modelContext {
                    context.insert(response)
                    try? context.save()
                }

                print("[AIService] Auto-response generated successfully")
                return response
            } catch {
                lastError = error
                print("[AIService] Auto-response provider \(provider.providerType.displayName) failed: \(error)")
                continue
            }
        }

        throw lastError ?? AIProviderError.allProvidersFailed
    }

    /// Remove a specific response from history (used for dismissing auto responses)
    func dismissResponse(_ response: AIResponse) {
        responses.removeAll { $0.id == response.id }

        // Remove from SwiftData
        if let context = modelContext {
            context.delete(response)
            try? context.save()
            print("[AIService] Dismissed response: \(response.id)")
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
                try context.save()
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
