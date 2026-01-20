import Foundation
import Combine

/// Manages proxy configuration and provides access to available services
/// Automatically fetches configuration on startup when authenticated
@MainActor
final class ProxyConfigManager: ObservableObject {
    static let shared = ProxyConfigManager()

    // MARK: - Published Properties

    @Published private(set) var config: ProxyConfig?
    @Published private(set) var isLoading = false
    @Published private(set) var lastError: Error?

    // MARK: - Computed Properties

    /// Whether AI service is available and configured
    var isAIEnabled: Bool {
        config?.services.ai.enabled ?? false
    }

    /// Whether transcription service is available and configured
    var isTranscriptionEnabled: Bool {
        config?.services.transcription.enabled ?? false
    }

    /// Available AI providers based on user's plan
    var availableAIProviders: [String] {
        config?.services.ai.providers ?? []
    }

    /// Available transcription providers based on user's plan
    var availableTranscriptionProviders: [String] {
        config?.services.transcription.providers ?? []
    }

    /// Whether Smart Mode is available for the user
    var isSmartModeEnabled: Bool {
        config?.services.ai.smartModeEnabled ?? false
    }

    /// Maximum tokens allowed per request
    var maxTokens: Int {
        config?.services.ai.maxTokens ?? 1000
    }

    /// Daily AI request limit (nil = unlimited)
    var dailyLimit: Int? {
        config?.services.ai.dailyLimit
    }

    /// Number of AI requests used today
    var usedToday: Int {
        config?.services.ai.usedToday ?? 0
    }

    /// Remaining AI requests for today (nil = unlimited)
    var remaining: Int? {
        config?.services.ai.remaining
    }

    /// User's current plan
    var currentPlan: String {
        config?.plan ?? "FREE"
    }

    // MARK: - Private

    private var cancellables = Set<AnyCancellable>()
    private let proxyClient = ProxyAPIClient.shared

    private init() {
        // Listen for authentication changes
        NotificationCenter.default.publisher(for: .userDidAuthenticate)
            .sink { [weak self] _ in
                Task { @MainActor in
                    try? await self?.refreshConfig()
                }
            }
            .store(in: &cancellables)

        NotificationCenter.default.publisher(for: .userDidLogout)
            .sink { [weak self] _ in
                self?.clearConfig()
            }
            .store(in: &cancellables)
    }

    // MARK: - Public Methods

    /// Fetches the proxy configuration from the server
    func refreshConfig() async throws {
        guard AuthenticationManager.shared.isAuthenticated else {
            print("[ProxyConfig] Not authenticated, skipping config fetch")
            return
        }

        isLoading = true
        lastError = nil

        do {
            config = try await proxyClient.fetchConfig()
            print("[ProxyConfig] Configuration loaded: \(config?.plan ?? "unknown") plan")
            print("[ProxyConfig] AI providers: \(availableAIProviders)")
            print("[ProxyConfig] Transcription providers: \(availableTranscriptionProviders)")
        } catch {
            lastError = error
            print("[ProxyConfig] Failed to load configuration: \(error)")
            throw error
        }

        isLoading = false
    }

    /// Clears the cached configuration
    func clearConfig() {
        config = nil
        lastError = nil
        proxyClient.clearConfigCache()
        proxyClient.clearTranscriptionTokenCache()
        print("[ProxyConfig] Configuration cleared")
    }

    /// Checks if a specific AI provider is available
    func isAIProviderAvailable(_ provider: String) -> Bool {
        availableAIProviders.contains(provider.lowercased())
    }

    /// Checks if a specific transcription provider is available
    func isTranscriptionProviderAvailable(_ provider: String) -> Bool {
        availableTranscriptionProviders.contains(provider.lowercased())
    }

    /// Gets the preferred AI provider (first available)
    func getPreferredAIProvider() -> String? {
        availableAIProviders.first
    }

    /// Gets the preferred transcription provider (first available)
    func getPreferredTranscriptionProvider() -> String? {
        availableTranscriptionProviders.first
    }

    /// Checks if the user has remaining AI requests
    func hasRemainingRequests() -> Bool {
        guard let remaining = remaining else {
            return true // Unlimited
        }
        return remaining > 0
    }
}

// MARK: - Notifications

extension Notification.Name {
    static let userDidAuthenticate = Notification.Name("userDidAuthenticate")
    static let userDidLogout = Notification.Name("userDidLogout")
    static let proxyConfigDidUpdate = Notification.Name("proxyConfigDidUpdate")
}
