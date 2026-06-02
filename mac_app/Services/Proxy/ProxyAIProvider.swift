import Foundation

/// AI Provider that routes all requests through the backend proxy
/// This replaces direct API calls to OpenAI, Anthropic, Gemini, and Grok
@MainActor
final class ProxyAIProvider: AIProvider {
    let providerType: AIProviderType

    private let proxyClient = ProxyAPIClient.shared
    private let configManager = ProxyConfigManager.shared
    private let providerName: String

    init(provider: AIProviderType) {
        self.providerType = provider
        // Map Swift enum to backend provider name
        self.providerName = Self.mapTypeToBackendName(provider)
    }

    /// Returns the user-selected model id to send to the backend, or nil to use the default cascade.
    /// Only applies to standard mode — Smart and Recap stay on their cascades.
    @MainActor
    private static func userSelectedModel(for context: AIContext) -> String? {
        guard !context.smartMode, context.responseType != .recap else { return nil }
        let raw = ConfigurationManager.shared.selectedAIModel
        return AIModelChoice(rawValue: raw)?.backendValue
    }

    // Map AIProviderType to backend provider names
    // Swift enum uses: "OpenAI", "Anthropic", "Google Gemini", "xAI Grok"
    // Backend expects: "openai", "anthropic", "gemini", "grok"
    private static func mapTypeToBackendName(_ type: AIProviderType) -> String {
        switch type {
        case .openai:
            return "openai"
        case .anthropic:
            return "anthropic"
        case .gemini:
            return "gemini"
        case .grok:
            return "grok"
        }
    }

    var isConfigured: Bool {
        // Check if this provider is available via proxy
        configManager.isAIProviderAvailable(providerName)
    }

    /// Ensures proxy config is loaded, retrying once if needed.
    /// If config cannot load because the token is invalid, forces re-authentication
    /// to clear the "zombie" degraded mode state where UI shows Connected but nothing works.
    private func ensureConfigLoaded() async throws {
        if isConfigured { return }

        // Config not loaded — attempt to reload with retry for transient errors
        print("[ProxyAIProvider] Config not loaded, attempting reload...")
        var lastError: Error?
        for attempt in 1...2 {
            do {
                try await configManager.refreshConfig()
                lastError = nil
                break
            } catch {
                lastError = error
                print("[ProxyAIProvider] Config reload attempt \(attempt)/2 failed: \(error)")
                if attempt < 2 {
                    try? await Task.sleep(nanoseconds: 1_000_000_000) // 1s before retry
                }
            }
        }

        if let error = lastError {
            let isAuthError = (error as? ProxyError).map {
                if case .notAuthenticated = $0 { return true }
                return false
            } ?? false

            if isAuthError && AuthenticationManager.shared.isAuthenticated {
                print("[ProxyAIProvider] Clearing zombie authenticated state — forcing re-authentication")
                await AuthenticationManager.shared.logout()
                throw AIProviderError.notAuthenticated
            }
            throw AIProviderError.serviceNotConfigured
        }

        guard isConfigured else {
            print("[ProxyAIProvider] Config loaded but provider not available")
            throw AIProviderError.serviceNotConfigured
        }
        print("[ProxyAIProvider] Config reloaded successfully")
    }

    func generateResponse(context: AIContext) async throws -> AIResponse {
        guard AuthenticationManager.shared.isAuthenticated else {
            throw AIProviderError.notAuthenticated
        }

        try await ensureConfigLoaded()

        let startTime = Date()

        // Recap needs more tokens for comprehensive meeting summaries
        // Smart mode needs full budget — thinking tokens count against max_tokens
        // Default mode capped at 450 — room for the factual takeaway + the value-add layer
        // Other modes capped at 600 for concise responses
        let isDefaultMode = context.mode?.name == "Default" || context.mode == nil
        let effectiveMaxTokens: Int
        if context.responseType == .recap {
            effectiveMaxTokens = max(configManager.maxTokens, 3000)
        } else if context.smartMode {
            effectiveMaxTokens = configManager.maxTokens
        } else if isDefaultMode {
            effectiveMaxTokens = min(configManager.maxTokens, 450)
        } else {
            effectiveMaxTokens = min(configManager.maxTokens, 600)
        }

        // User-selected model is only honored in standard mode (not Smart, not Recap).
        let userModel = Self.userSelectedModel(for: context)

        let response = try await proxyClient.generateAIResponse(
            provider: providerName,
            smartMode: context.smartMode,
            systemPrompt: context.systemPrompt,
            userMessage: context.userMessage,
            screenshot: context.screenshot,
            maxTokens: effectiveMaxTokens,
            model: userModel
        )

        let latencyMs = Int(Date().timeIntervalSince(startTime) * 1000)

        // Use actual provider from backend response instead of hardcoded nominal type
        let actualProvider = ProxyAIProviderFactory.mapBackendNameToType(response.provider) ?? providerType

        return AIResponse(
            type: context.responseType,
            content: response.content,
            provider: actualProvider,
            latencyMs: latencyMs
        )
    }

    nonisolated func generateStreamingResponse(context: AIContext) -> AsyncThrowingStream<String, Error> {
        AsyncThrowingStream { continuation in
            Task {
                // Check auth on main actor, then stream on background
                let isAuthenticated = await MainActor.run { AuthenticationManager.shared.isAuthenticated }
                guard isAuthenticated else {
                    continuation.finish(throwing: AIProviderError.notAuthenticated)
                    return
                }

                // Ensure config is loaded, retry once if needed
                let configReady: Bool = await MainActor.run { self.isConfigured }
                if !configReady {
                    print("[ProxyAIProvider] Config not loaded, attempting reload...")
                    var configLoadError: Error?
                    for attempt in 1...2 {
                        do {
                            try await ProxyConfigManager.shared.refreshConfig()
                            configLoadError = nil
                            break
                        } catch {
                            configLoadError = error
                            print("[ProxyAIProvider] Config reload attempt \(attempt)/2 failed: \(error)")
                            if attempt < 2 {
                                try? await Task.sleep(nanoseconds: 1_000_000_000)
                            }
                        }
                    }
                    if let error = configLoadError {
                        let isAuthError = (error as? ProxyError).map {
                            if case .notAuthenticated = $0 { return true }
                            return false
                        } ?? false

                        if isAuthError {
                            let wasAuthenticated = await MainActor.run { AuthenticationManager.shared.isAuthenticated }
                            if wasAuthenticated {
                                print("[ProxyAIProvider] Clearing zombie authenticated state — forcing re-authentication")
                                await AuthenticationManager.shared.logout()
                            }
                            continuation.finish(throwing: AIProviderError.notAuthenticated)
                        } else {
                            continuation.finish(throwing: AIProviderError.serviceNotConfigured)
                        }
                        return
                    }
                    let readyAfterRetry = await MainActor.run { self.isConfigured }
                    if !readyAfterRetry {
                        continuation.finish(throwing: AIProviderError.serviceNotConfigured)
                        return
                    }
                    print("[ProxyAIProvider] Config reloaded successfully")
                }

                // Get values needed for streaming (on main actor)
                let providerName = await MainActor.run { self.providerName }
                let baseMaxTokens = await MainActor.run { self.configManager.maxTokens }
                // User-selected model is only honored in standard mode (not Smart, not Recap).
                let userModel: String? = await MainActor.run { Self.userSelectedModel(for: context) }
                // Recap needs more tokens for comprehensive meeting summaries
                // Smart mode needs full budget — thinking tokens count against max_tokens
                // Other modes capped at 600 for concise, faster responses
                let maxTokens: Int
                if context.responseType == .recap {
                    maxTokens = max(baseMaxTokens, 3000)
                } else if context.smartMode {
                    maxTokens = baseMaxTokens
                } else {
                    maxTokens = min(baseMaxTokens, 600)
                }

                do {
                    // Debug logging for system prompt
                    print("[ProxyAIProvider] Mode name: \(context.mode?.name ?? "nil")")
                    print("[ProxyAIProvider] System prompt (first 500 chars): \(String(context.systemPrompt.prefix(500)))")

                    // Stream processing happens on background thread
                    for try await chunk in self.proxyClient.streamAIResponse(
                        provider: providerName,
                        smartMode: context.smartMode,
                        systemPrompt: context.systemPrompt,
                        userMessage: context.userMessage,
                        screenshot: context.screenshot,
                        maxTokens: maxTokens,
                        model: userModel
                    ) {
                        continuation.yield(chunk)
                    }
                    continuation.finish()
                } catch {
                    continuation.finish(throwing: error)
                }
            }
        }
    }
}

// MARK: - Factory for creating proxy providers

enum ProxyAIProviderFactory {
    /// Creates a proxy provider for the given type
    @MainActor
    static func create(for type: AIProviderType) -> ProxyAIProvider {
        ProxyAIProvider(provider: type)
    }

    /// Creates all configured proxy providers
    @MainActor
    static func createAllConfigured() -> [AIProvider] {
        let configManager = ProxyConfigManager.shared
        return configManager.availableAIProviders.compactMap { providerName -> AIProvider? in
            guard let type = mapBackendNameToType(providerName) else {
                print("[ProxyAIProviderFactory] Unknown provider from backend: \(providerName)")
                return nil
            }
            return ProxyAIProvider(provider: type)
        }
    }

    /// Map backend provider names to AIProviderType
    /// Backend uses: "openai", "anthropic", "gemini", "grok"
    /// Swift enum uses: "OpenAI", "Anthropic", "Google Gemini", "xAI Grok"
    static func mapBackendNameToType(_ name: String) -> AIProviderType? {
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
}
