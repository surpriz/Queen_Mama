import Foundation

/// HTTP client for proxy API endpoints
/// Handles AI requests and transcription token generation through the backend
final class ProxyAPIClient: @unchecked Sendable {
    nonisolated(unsafe) static let shared = ProxyAPIClient()

    private let baseURL: URL
    private let session: URLSession
    private let streamingSession: URLSession  // Separate session with longer timeout for AI streaming
    private let tokenStore = AuthTokenStore.shared
    private let keychain = KeychainManager.shared

    // Cache for proxy configuration
    private var cachedConfig: ProxyConfig?
    private var configCachedAt: Date?

    // Cache for transcription tokens (in-memory + Keychain persistence)
    private var cachedTranscriptionToken: TranscriptionToken?

    // Keychain keys for token persistence
    private enum KeychainKeys {
        static let transcriptionToken = "transcription_token"
        static let transcriptionTokenExpiry = "transcription_token_expiry"
        static let transcriptionTokenType = "transcription_token_type"
        static let transcriptionProvider = "transcription_provider"
        static let transcriptionTTL = "transcription_ttl"
    }

    private init() {
        // Configure base URL from environment or default
        #if DEBUG
        let defaultURL = "http://localhost:3000"
        #else
        let defaultURL = "https://www.queenmama.co"
        #endif

        let urlString = ProcessInfo.processInfo.environment["API_BASE_URL"] ?? defaultURL
        self.baseURL = URL(string: urlString)!

        // Standard session for quick API calls (config, tokens, etc.)
        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest = 30  // 30s timeout for regular API calls
        config.timeoutIntervalForResource = 120
        self.session = URLSession(configuration: config)

        // Streaming session with longer timeout for AI responses
        // GPT-5-mini with large screenshots can take 40-60 seconds
        let streamingConfig = URLSessionConfiguration.default
        streamingConfig.timeoutIntervalForRequest = 90  // 90s timeout for streaming
        streamingConfig.timeoutIntervalForResource = 180
        self.streamingSession = URLSession(configuration: streamingConfig)
    }

    // MARK: - Configuration

    /// Fetches proxy configuration including available providers and limits
    func fetchConfig() async throws -> ProxyConfig {
        // Check cache
        if let config = cachedConfig,
           let cachedAt = configCachedAt,
           Date().timeIntervalSince(cachedAt) < TimeInterval(config.cacheTTL) {
            return config
        }

        let config: ProxyConfig = try await get(endpoint: "/api/proxy/config")
        cachedConfig = config
        configCachedAt = Date()
        return config
    }

    /// Clears the configuration cache
    func clearConfigCache() {
        cachedConfig = nil
        configCachedAt = nil
    }

    // MARK: - Transcription Token

    /// Gets a temporary transcription token for direct WebSocket connection
    /// Checks in-memory cache first, then Keychain, then fetches from network
    func getTranscriptionToken(provider: String = "deepgram") async throws -> TranscriptionToken {
        // 1. Check in-memory cache
        if let token = cachedTranscriptionToken,
           Date() < token.expiresAt.addingTimeInterval(-60) { // 1 minute buffer
            return token
        }

        // 2. Check Keychain for persisted token
        if let persistedToken = loadPersistedTranscriptionToken(),
           persistedToken.provider == provider,
           Date() < persistedToken.expiresAt.addingTimeInterval(-60) {
            print("[ProxyAPI] Using persisted token from Keychain (expires: \(persistedToken.expiresAt))")
            cachedTranscriptionToken = persistedToken
            return persistedToken
        }

        // 3. Fetch from network
        let body: [String: String] = ["provider": provider]
        let response: TranscriptionTokenResponse = try await post(
            endpoint: "/api/proxy/transcription/token",
            body: body
        )

        let token = TranscriptionToken(
            provider: response.provider,
            token: response.token,
            tokenType: response.tokenType ?? "token", // Default to legacy "token" for backward compatibility
            expiresAt: ISO8601DateFormatter().date(from: response.expiresAt) ?? Date().addingTimeInterval(TimeInterval(response.ttlSeconds)),
            ttlSeconds: response.ttlSeconds
        )

        // Cache in memory and persist to Keychain
        cachedTranscriptionToken = token
        persistTranscriptionToken(token)

        return token
    }

    /// Pre-fetches a transcription token in background for faster session start
    /// Call this after authentication or when dashboard appears
    func prefetchTranscriptionToken(provider: String = "deepgram") {
        Task {
            do {
                let token = try await getTranscriptionToken(provider: provider)
                print("[ProxyAPI] Token prefetched successfully (expires: \(token.expiresAt))")
            } catch {
                print("[ProxyAPI] Token prefetch failed: \(error.localizedDescription)")
            }
        }
    }

    /// Clears the transcription token cache (memory and Keychain)
    func clearTranscriptionTokenCache() {
        cachedTranscriptionToken = nil
        clearPersistedTranscriptionToken()
    }

    // MARK: - Token Persistence (Keychain)

    /// Persists transcription token to Keychain for app restart survival
    private func persistTranscriptionToken(_ token: TranscriptionToken) {
        do {
            try keychain.saveString(token.token, forKey: KeychainKeys.transcriptionToken)
            try keychain.saveString(token.provider, forKey: KeychainKeys.transcriptionProvider)
            try keychain.saveString(token.tokenType, forKey: KeychainKeys.transcriptionTokenType)
            try keychain.saveString(String(token.ttlSeconds), forKey: KeychainKeys.transcriptionTTL)

            // Store expiry as ISO8601 string
            let formatter = ISO8601DateFormatter()
            try keychain.saveString(formatter.string(from: token.expiresAt), forKey: KeychainKeys.transcriptionTokenExpiry)

            print("[ProxyAPI] Token persisted to Keychain")
        } catch {
            print("[ProxyAPI] Failed to persist token: \(error)")
        }
    }

    /// Loads persisted transcription token from Keychain
    private func loadPersistedTranscriptionToken() -> TranscriptionToken? {
        guard let tokenValue = keychain.getString(forKey: KeychainKeys.transcriptionToken),
              let provider = keychain.getString(forKey: KeychainKeys.transcriptionProvider),
              let tokenType = keychain.getString(forKey: KeychainKeys.transcriptionTokenType),
              let expiryString = keychain.getString(forKey: KeychainKeys.transcriptionTokenExpiry),
              let ttlString = keychain.getString(forKey: KeychainKeys.transcriptionTTL),
              let ttl = Int(ttlString) else {
            return nil
        }

        let formatter = ISO8601DateFormatter()
        guard let expiresAt = formatter.date(from: expiryString) else {
            return nil
        }

        return TranscriptionToken(
            provider: provider,
            token: tokenValue,
            tokenType: tokenType,
            expiresAt: expiresAt,
            ttlSeconds: ttl
        )
    }

    /// Clears persisted transcription token from Keychain
    private func clearPersistedTranscriptionToken() {
        do {
            try keychain.deleteString(forKey: KeychainKeys.transcriptionToken)
            try keychain.deleteString(forKey: KeychainKeys.transcriptionProvider)
            try keychain.deleteString(forKey: KeychainKeys.transcriptionTokenType)
            try keychain.deleteString(forKey: KeychainKeys.transcriptionTokenExpiry)
            try keychain.deleteString(forKey: KeychainKeys.transcriptionTTL)
            print("[ProxyAPI] Persisted token cleared from Keychain")
        } catch {
            // Ignore errors during cleanup
        }
    }

    // MARK: - AI Proxy

    /// Sends a non-streaming AI request through the proxy
    func generateAIResponse(
        provider: String,
        smartMode: Bool,
        systemPrompt: String,
        userMessage: String,
        screenshot: Data? = nil,
        maxTokens: Int? = nil
    ) async throws -> AIProxyResponse {
        var body: [String: Any] = [
            "provider": provider,
            "smartMode": smartMode,
            "systemPrompt": systemPrompt,
            "userMessage": userMessage
        ]

        if let screenshot = screenshot {
            body["screenshot"] = screenshot.base64EncodedString()
        }

        if let maxTokens = maxTokens {
            body["maxTokens"] = maxTokens
        }

        return try await post(endpoint: "/api/proxy/ai/generate", body: body)
    }

    /// Creates a streaming AI request through the proxy
    func streamAIResponse(
        provider: String,
        smartMode: Bool,
        systemPrompt: String,
        userMessage: String,
        screenshot: Data? = nil,
        maxTokens: Int? = nil
    ) -> AsyncThrowingStream<String, Error> {
        AsyncThrowingStream { continuation in
            Task {
                do {
                    var body: [String: Any] = [
                        "provider": provider,
                        "smartMode": smartMode,
                        "systemPrompt": systemPrompt,
                        "userMessage": userMessage
                    ]

                    if let screenshot = screenshot {
                        body["screenshot"] = screenshot.base64EncodedString()
                    }

                    if let maxTokens = maxTokens {
                        body["maxTokens"] = maxTokens
                    }

                    let url = baseURL.appendingPathComponent("/api/proxy/ai/stream")
                    var request = URLRequest(url: url)
                    request.httpMethod = "POST"
                    request.setValue("application/json", forHTTPHeaderField: "Content-Type")
                    request.setValue("text/event-stream", forHTTPHeaderField: "Accept")
                    request.httpBody = try JSONSerialization.data(withJSONObject: body)

                    // Add auth header
                    guard let token = await getValidAccessToken() else {
                        continuation.finish(throwing: ProxyError.notAuthenticated)
                        return
                    }
                    request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")

                    let (asyncBytes, response) = try await streamingSession.bytes(for: request)

                    guard let httpResponse = response as? HTTPURLResponse else {
                        continuation.finish(throwing: ProxyError.invalidResponse)
                        return
                    }

                    if httpResponse.statusCode != 200 {
                        var errorBody = ""
                        for try await line in asyncBytes.lines {
                            errorBody += line
                        }
                        continuation.finish(throwing: ProxyError.requestFailed(httpResponse.statusCode, errorBody))
                        return
                    }

                    // Process SSE stream
                    for try await line in asyncBytes.lines {
                        if line.hasPrefix("data: ") {
                            let jsonString = String(line.dropFirst(6))

                            if jsonString == "[DONE]" {
                                break
                            }

                            if let data = jsonString.data(using: .utf8),
                               let chunk = try? JSONDecoder().decode(StreamChunk.self, from: data) {
                                if let content = chunk.content {
                                    continuation.yield(content)
                                }
                                if let error = chunk.error {
                                    continuation.finish(throwing: ProxyError.serverError(error))
                                    return
                                }
                            }
                        }
                    }

                    continuation.finish()
                } catch {
                    continuation.finish(throwing: error)
                }
            }
        }
    }

    // MARK: - HTTP Helpers

    private func get<T: Decodable>(endpoint: String) async throws -> T {
        let url = baseURL.appendingPathComponent(endpoint)
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        guard let token = await getValidAccessToken() else {
            throw ProxyError.notAuthenticated
        }
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")

        return try await perform(request)
    }

    private func post<T: Decodable>(
        endpoint: String,
        body: [String: Any]
    ) async throws -> T {
        let url = baseURL.appendingPathComponent(endpoint)
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: body)

        guard let token = await getValidAccessToken() else {
            throw ProxyError.notAuthenticated
        }
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")

        return try await perform(request)
    }

    private func perform<T: Decodable>(_ request: URLRequest, retryCount: Int = 0) async throws -> T {
        let maxRetries = 3
        let retryDelay: [TimeInterval] = [1.0, 2.0, 4.0] // Exponential backoff: 1s, 2s, 4s

        let (data, response) = try await session.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse else {
            throw ProxyError.invalidResponse
        }

        switch httpResponse.statusCode {
        case 200...299:
            return try JSONDecoder().decode(T.self, from: data)

        case 401:
            throw ProxyError.notAuthenticated

        case 403:
            let errorResponse = try? JSONDecoder().decode(ErrorResponse.self, from: data)
            throw ProxyError.accessDenied(errorResponse?.message ?? "Access denied")

        case 502, 503, 504:
            // Gateway/service errors - retry with exponential backoff
            if retryCount < maxRetries {
                let delay = retryDelay[retryCount]
                print("[ProxyAPI] HTTP \(httpResponse.statusCode) error. Retrying in \(delay)s... (attempt \(retryCount + 1)/\(maxRetries))")

                // Log retry attempt to Sentry (breadcrumb only)
                await MainActor.run {
                    CrashReporter.shared.addBreadcrumb(
                        category: "proxy_api",
                        message: "HTTP \(httpResponse.statusCode) - Retry \(retryCount + 1)/\(maxRetries)"
                    )
                }

                try await Task.sleep(nanoseconds: UInt64(delay * 1_000_000_000))
                return try await perform(request, retryCount: retryCount + 1)
            }

            // Max retries reached - report to Sentry
            let errorResponse = try? JSONDecoder().decode(ErrorResponse.self, from: data)
            let errorMessage = errorResponse?.message ?? "Service unavailable"
            print("[ProxyAPI] HTTP \(httpResponse.statusCode) error. Max retries reached. Error: \(errorMessage)")

            let error = ProxyError.requestFailed(httpResponse.statusCode, errorMessage)
            await MainActor.run {
                CrashReporter.shared.captureError(error, extras: [
                    "status_code": httpResponse.statusCode,
                    "retry_count": retryCount,
                    "endpoint": request.url?.path ?? "unknown"
                ])
            }

            throw error

        default:
            let errorResponse = try? JSONDecoder().decode(ErrorResponse.self, from: data)
            throw ProxyError.requestFailed(httpResponse.statusCode, errorResponse?.message ?? "Request failed")
        }
    }

    private func getValidAccessToken() async -> String? {
        // Check if we have a valid access token
        if tokenStore.isAccessTokenValid, let token = tokenStore.accessToken {
            return token
        }

        // Try to refresh
        guard let refreshToken = tokenStore.refreshToken else {
            return nil
        }

        do {
            let response = try await AuthAPIClient.shared.refreshTokens(refreshToken)
            tokenStore.accessToken = response.accessToken
            tokenStore.accessTokenExpiry = Date().addingTimeInterval(TimeInterval(response.expiresIn))
            tokenStore.refreshToken = response.refreshToken
            return response.accessToken
        } catch {
            print("[ProxyAPI] Token refresh failed: \(error)")
            return nil
        }
    }
}

// MARK: - Response Types

struct ProxyConfig: Codable {
    let plan: String
    let services: ProxyServices
    let cacheTTL: Int
    let configuredAt: String
}

struct ProxyServices: Codable {
    let ai: AIServiceConfig
    let transcription: TranscriptionServiceConfig
}

struct AIServiceConfig: Codable {
    let enabled: Bool
    let providers: [String]
    let maxTokens: Int
    let smartModeEnabled: Bool
    let dailyLimit: Int?
    let usedToday: Int
    let remaining: Int?
}

struct TranscriptionServiceConfig: Codable {
    let enabled: Bool
    let providers: [String]
    let tokenTTLSeconds: Int
}

struct TranscriptionTokenResponse: Codable {
    let provider: String
    let token: String
    let tokenType: String? // "bearer" for JWT tokens, "token" for legacy API keys
    let expiresAt: String
    let ttlSeconds: Int
}

struct TranscriptionToken {
    let provider: String
    let token: String
    let tokenType: String // "bearer" or "token" - determines Authorization header scheme
    let expiresAt: Date
    let ttlSeconds: Int
}

struct AIProxyResponse: Codable {
    let content: String
    let provider: String
    let model: String
    let latencyMs: Int
    let tokensUsed: Int?
}

private struct StreamChunk: Codable {
    let content: String?
    let error: String?
}

private struct ErrorResponse: Codable {
    let error: String
    let message: String?
}

// MARK: - Errors

enum ProxyError: LocalizedError {
    case notAuthenticated
    case invalidResponse
    case accessDenied(String)
    case providerNotConfigured(String)
    case requestFailed(Int, String)
    case serverError(String)

    var errorDescription: String? {
        switch self {
        case .notAuthenticated:
            return "Not authenticated. Please sign in."
        case .invalidResponse:
            return "Invalid response from server."
        case .accessDenied(let message):
            return message
        case .providerNotConfigured(let message):
            return message
        case .requestFailed(let code, let message):
            return "Request failed (\(code)): \(message)"
        case .serverError(let message):
            return "Server error: \(message)"
        }
    }
}
