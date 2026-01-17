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

    // MARK: - Providers

    // Primary providers (used in both modes with different models)
    private let anthropicProvider = AnthropicProvider()      // Sonnet 4.5 / Sonnet 4.5 Thinking
    private let grokProvider = GrokProvider()                // Grok 4.1 Fast
    private let openAIProvider = OpenAIProvider()            // GPT-4o mini / o3

    // Mode-specific fallback providers
    private let anthropicHaikuProvider = AnthropicHaikuProvider()  // Haiku 4.5 (Non-Smart only)
    private let openAIGPT5Provider = OpenAIGPT5Provider()          // GPT-5.2 (Smart only)
    private let geminiProvider = GeminiProvider()                   // Backup final

    // Fallback order for NON-Smart mode:
    // Order is dynamic based on user's preferred provider, then fallback to others
    private var standardProviders: [AIProvider] {
        let preferredProvider = ConfigurationManager.shared.selectedAIProvider
        var providers: [AIProvider] = []

        // Build provider list with preferred first
        switch preferredProvider {
        case .anthropic:
            providers = [anthropicProvider, grokProvider, openAIProvider, anthropicHaikuProvider, geminiProvider]
        case .grok:
            providers = [grokProvider, anthropicProvider, openAIProvider, anthropicHaikuProvider, geminiProvider]
        case .openai:
            providers = [openAIProvider, anthropicProvider, grokProvider, anthropicHaikuProvider, geminiProvider]
        case .gemini:
            providers = [geminiProvider, anthropicProvider, grokProvider, openAIProvider, anthropicHaikuProvider]
        }

        return providers.filter { $0.isConfigured }
    }

    // Fallback order for SMART mode:
    // Order is dynamic based on user's preferred provider, then fallback to others
    private var smartProviders: [AIProvider] {
        let preferredProvider = ConfigurationManager.shared.selectedAIProvider
        var providers: [AIProvider] = []

        // Build provider list with preferred first (Smart mode uses different models)
        switch preferredProvider {
        case .anthropic:
            providers = [anthropicProvider, grokProvider, openAIProvider, openAIGPT5Provider, geminiProvider]
        case .grok:
            providers = [grokProvider, anthropicProvider, openAIProvider, openAIGPT5Provider, geminiProvider]
        case .openai:
            providers = [openAIProvider, anthropicProvider, grokProvider, openAIGPT5Provider, geminiProvider]
        case .gemini:
            providers = [geminiProvider, anthropicProvider, grokProvider, openAIProvider, openAIGPT5Provider]
        }

        return providers.filter { $0.isConfigured }
    }

    // Dynamic provider selection based on mode
    private func getProviders(smartMode: Bool) -> [AIProvider] {
        smartMode ? smartProviders : standardProviders
    }

    private var configuredProviders: [AIProvider] {
        // Default to standard providers for backward compatibility
        standardProviders
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
