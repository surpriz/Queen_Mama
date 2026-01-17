import Foundation

/// HTTP client for proxy API endpoints
/// Handles AI requests and transcription token generation through the backend
final class ProxyAPIClient {
    static let shared = ProxyAPIClient()

    private let baseURL: URL
    private let session: URLSession
    private let tokenStore = AuthTokenStore.shared

    // Cache for proxy configuration
    private var cachedConfig: ProxyConfig?
    private var configCachedAt: Date?

    // Cache for transcription tokens
    private var cachedTranscriptionToken: TranscriptionToken?

    private init() {
        // Configure base URL from environment or default
        #if DEBUG
        let defaultURL = "http://localhost:3000"
        #else
        let defaultURL = "https://queenmama.app"
        #endif

        let urlString = ProcessInfo.processInfo.environment["API_BASE_URL"] ?? defaultURL
        self.baseURL = URL(string: urlString)!

        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest = 60
        config.timeoutIntervalForResource = 120
        self.session = URLSession(configuration: config)
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
    func getTranscriptionToken(provider: String = "deepgram") async throws -> TranscriptionToken {
        // Check if we have a valid cached token
        if let token = cachedTranscriptionToken,
           Date() < token.expiresAt.addingTimeInterval(-60) { // 1 minute buffer
            return token
        }

        let body: [String: String] = ["provider": provider]
        let response: TranscriptionTokenResponse = try await post(
            endpoint: "/api/proxy/transcription/token",
            body: body
        )

        let token = TranscriptionToken(
            provider: response.provider,
            token: response.token,
            expiresAt: ISO8601DateFormatter().date(from: response.expiresAt) ?? Date().addingTimeInterval(TimeInterval(response.ttlSeconds)),
            ttlSeconds: response.ttlSeconds
        )

        cachedTranscriptionToken = token
        return token
    }

    /// Clears the transcription token cache
    func clearTranscriptionTokenCache() {
        cachedTranscriptionToken = nil
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

                    let (asyncBytes, response) = try await session.bytes(for: request)

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

    private func perform<T: Decodable>(_ request: URLRequest) async throws -> T {
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

        case 503:
            let errorResponse = try? JSONDecoder().decode(ErrorResponse.self, from: data)
            throw ProxyError.providerNotConfigured(errorResponse?.message ?? "Provider not configured")

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
    let expiresAt: String
    let ttlSeconds: Int
}

struct TranscriptionToken {
    let provider: String
    let token: String
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
