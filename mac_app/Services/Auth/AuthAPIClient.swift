import Foundation

/// HTTP client for authentication API endpoints
final class AuthAPIClient {
    static let shared = AuthAPIClient()

    private let baseURL: URL
    private let session: URLSession
    private let tokenStore = AuthTokenStore.shared

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
        config.timeoutIntervalForRequest = 30
        config.timeoutIntervalForResource = 60
        self.session = URLSession(configuration: config)
    }

    // MARK: - Device Code Flow

    func requestDeviceCode(deviceInfo: DeviceInfo) async throws -> DeviceCodeResponse {
        let body: [String: Any] = [
            "deviceId": deviceInfo.deviceId,
            "deviceName": deviceInfo.name,
            "platform": deviceInfo.platform
        ]

        return try await post(
            endpoint: "/api/auth/device/code",
            body: body,
            requiresAuth: false
        )
    }

    func pollDeviceCode(_ deviceCode: String) async throws -> DevicePollResponse {
        return try await get(
            endpoint: "/api/auth/device/poll",
            queryItems: [URLQueryItem(name: "deviceCode", value: deviceCode)],
            requiresAuth: false
        )
    }

    // MARK: - Credentials Login

    func login(email: String, password: String, deviceInfo: DeviceInfo) async throws -> LoginResponse {
        let body: [String: Any] = [
            "email": email,
            "password": password,
            "deviceId": deviceInfo.deviceId,
            "deviceName": deviceInfo.name,
            "platform": deviceInfo.platform,
            "osVersion": deviceInfo.osVersion ?? "",
            "appVersion": deviceInfo.appVersion ?? ""
        ]

        return try await post(
            endpoint: "/api/auth/macos/login",
            body: body,
            requiresAuth: false
        )
    }

    // MARK: - Token Refresh

    func refreshTokens(_ refreshToken: String) async throws -> RefreshResponse {
        let body: [String: String] = [
            "refreshToken": refreshToken
        ]

        return try await post(
            endpoint: "/api/auth/macos/refresh",
            body: body,
            requiresAuth: false
        )
    }

    // MARK: - Logout

    func logout(refreshToken: String?, allDevices: Bool = false) async throws {
        let body: [String: Any] = [
            "refreshToken": refreshToken ?? "",
            "allDevices": allDevices
        ]

        let _: EmptyResponse = try await post(
            endpoint: "/api/auth/macos/logout",
            body: body,
            requiresAuth: true
        )
    }

    // MARK: - License Validation

    func validateLicense(deviceId: String) async throws -> License {
        let body: [String: String] = [
            "deviceId": deviceId
        ]

        return try await post(
            endpoint: "/api/license/validate",
            body: body,
            requiresAuth: true
        )
    }

    // MARK: - Usage Recording

    /// Records feature usage to server for server-side tracking
    func recordUsage(action: String, provider: String? = nil, tokensUsed: Int? = nil) async throws {
        var body: [String: Any] = [
            "deviceId": DeviceInfo.current().deviceId,
            "action": action
        ]

        if let provider = provider {
            body["provider"] = provider
        }
        if let tokens = tokensUsed {
            body["tokensUsed"] = tokens
        }

        let _: UsageRecordResponse = try await post(
            endpoint: "/api/usage/record",
            body: body,
            requiresAuth: true
        )
    }

    // MARK: - HTTP Helpers

    private func get<T: Decodable>(
        endpoint: String,
        queryItems: [URLQueryItem] = [],
        requiresAuth: Bool
    ) async throws -> T {
        var components = URLComponents(url: baseURL.appendingPathComponent(endpoint), resolvingAgainstBaseURL: true)!
        if !queryItems.isEmpty {
            components.queryItems = queryItems
        }

        var request = URLRequest(url: components.url!)
        request.httpMethod = "GET"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        if requiresAuth {
            guard let token = await getValidAccessToken() else {
                throw AuthError.notAuthenticated
            }
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        return try await perform(request)
    }

    private func post<T: Decodable>(
        endpoint: String,
        body: [String: Any],
        requiresAuth: Bool
    ) async throws -> T {
        let url = baseURL.appendingPathComponent(endpoint)
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: body)

        if requiresAuth {
            guard let token = await getValidAccessToken() else {
                throw AuthError.notAuthenticated
            }
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        return try await perform(request)
    }

    private func perform<T: Decodable>(_ request: URLRequest) async throws -> T {
        let (data, response) = try await session.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse else {
            throw AuthError.serverError("Invalid response")
        }

        // Handle specific error codes
        switch httpResponse.statusCode {
        case 200...299:
            return try JSONDecoder().decode(T.self, from: data)

        case 401:
            let errorResponse = try? JSONDecoder().decode(ErrorResponse.self, from: data)
            if errorResponse?.error == "oauth_user" {
                throw AuthError.oauthUserNeedsDeviceCode
            }
            throw AuthError.invalidToken

        case 403:
            let errorResponse = try? JSONDecoder().decode(ErrorResponse.self, from: data)
            if errorResponse?.error == "account_blocked" {
                throw AuthError.accountBlocked
            }
            if errorResponse?.error == "device_limit" {
                throw AuthError.deviceLimitReached
            }
            throw AuthError.serverError(errorResponse?.message ?? "Access denied")

        default:
            let errorResponse = try? JSONDecoder().decode(ErrorResponse.self, from: data)
            throw AuthError.serverError(errorResponse?.message ?? "Request failed")
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
            let response = try await refreshTokens(refreshToken)
            tokenStore.accessToken = response.accessToken
            tokenStore.accessTokenExpiry = Date().addingTimeInterval(TimeInterval(response.expiresIn))
            tokenStore.refreshToken = response.refreshToken
            return response.accessToken
        } catch {
            print("[AuthAPI] Token refresh failed: \(error)")
            return nil
        }
    }
}

// MARK: - Helper Types

private struct ErrorResponse: Decodable {
    let error: String
    let message: String?
}

private struct EmptyResponse: Decodable {}

struct UsageRecordResponse: Decodable {
    let success: Bool
    let recorded: Int
    let usage: UsageStats?
}
