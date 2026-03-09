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

        // Config not loaded — attempt to reload before failing
        print("[ProxyAIProvider] Config not loaded, attempting reload...")
        do {
            try await configManager.refreshConfig()
        } catch {
            print("[ProxyAIProvider] Config reload failed: \(error)")
            let isAuthError = (error as? ProxyError).map {
                if case .notAuthenticated = $0 { return true }
                return false
            } ?? false

            if isAuthError && AuthenticationManager.shared.isAuthenticated {
                // Token is truly invalid — force logout to clear zombie state
                print("[ProxyAIProvider] Clearing zombie authenticated state — forcing re-authentication")
                await AuthenticationManager.shared.logout()
                throw AIProviderError.notAuthenticated
            }
            // Network/server error — don't force logout, it might be transient
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
        let effectiveMaxTokens = context.responseType == .recap
            ? max(configManager.maxTokens, 3000)
            : configManager.maxTokens

        let response = try await proxyClient.generateAIResponse(
            provider: providerName,
            smartMode: context.smartMode,
            systemPrompt: context.systemPrompt,
            userMessage: context.userMessage,
            screenshot: context.screenshot,
            maxTokens: effectiveMaxTokens
        )

        let latencyMs = Int(Date().timeIntervalSince(startTime) * 1000)

        return AIResponse(
            type: context.responseType,
            content: response.content,
            provider: providerType,
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
                    do {
                        try await ProxyConfigManager.shared.refreshConfig()
                    } catch {
                        print("[ProxyAIProvider] Config reload failed: \(error)")
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
                // Recap needs more tokens for comprehensive meeting summaries
                let maxTokens = context.responseType == .recap
                    ? max(baseMaxTokens, 3000)
                    : baseMaxTokens

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
                        maxTokens: maxTokens
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
            guard let type = mapBackendProviderToType(providerName) else {
                print("[ProxyAIProviderFactory] Unknown provider from backend: \(providerName)")
                return nil
            }
            return ProxyAIProvider(provider: type)
        }
    }

    /// Map backend provider names to AIProviderType
    /// Backend uses: "openai", "anthropic", "gemini", "grok"
    /// Swift enum uses: "OpenAI", "Anthropic", "Google Gemini", "xAI Grok"
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
}
