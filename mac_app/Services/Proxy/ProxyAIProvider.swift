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

    func generateResponse(context: AIContext) async throws -> AIResponse {
        guard AuthenticationManager.shared.isAuthenticated else {
            throw AIProviderError.notAuthenticated
        }

        guard isConfigured else {
            throw AIProviderError.notAuthenticated
        }

        let startTime = Date()

        let response = try await proxyClient.generateAIResponse(
            provider: providerName,
            smartMode: context.smartMode,
            systemPrompt: context.systemPrompt,
            userMessage: context.userMessage,
            screenshot: context.screenshot,
            maxTokens: configManager.maxTokens
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
            Task { @MainActor in
                guard AuthenticationManager.shared.isAuthenticated else {
                    continuation.finish(throwing: AIProviderError.notAuthenticated)
                    return
                }

                guard self.isConfigured else {
                    continuation.finish(throwing: AIProviderError.notAuthenticated)
                    return
                }

                do {
                    for try await chunk in self.proxyClient.streamAIResponse(
                        provider: self.providerName,
                        smartMode: context.smartMode,
                        systemPrompt: context.systemPrompt,
                        userMessage: context.userMessage,
                        screenshot: context.screenshot,
                        maxTokens: self.configManager.maxTokens
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
