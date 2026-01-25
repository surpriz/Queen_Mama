import Foundation

/// HTTP client for authentication API endpoints
final class AuthAPIClient {
    static let shared = AuthAPIClient()

    private let baseURL: URL
    private let session: URLSession
    private let tokenStore = AuthTokenStore.shared

    private init() {
        // Configure base URL based on environment
        let urlString = AppEnvironment.current.apiBaseURL
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

    // MARK: - Registration

    func register(name: String, email: String, password: String, deviceInfo: DeviceInfo) async throws -> RegistrationResponse {
        let body: [String: Any] = [
            "name": name,
            "email": email,
            "password": password,
            "deviceId": deviceInfo.deviceId,
            "deviceName": deviceInfo.name,
            "platform": deviceInfo.platform,
            "osVersion": deviceInfo.osVersion ?? "",
            "appVersion": deviceInfo.appVersion ?? ""
        ]

        return try await postForRegistration(
            endpoint: "/api/auth/macos/register",
            body: body
        )
    }

    private func postForRegistration(endpoint: String, body: [String: Any]) async throws -> RegistrationResponse {
        let url = baseURL.appendingPathComponent(endpoint)
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: body)

        let (data, response) = try await session.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse else {
            throw AuthError.serverError("Invalid response")
        }

        // Handle specific registration error codes
        switch httpResponse.statusCode {
        case 200, 201:
            return try JSONDecoder().decode(RegistrationResponse.self, from: data)

        case 400:
            let errorResponse = try? JSONDecoder().decode(RegistrationErrorResponse.self, from: data)
            switch errorResponse?.error {
            case "email_exists":
                throw AuthError.emailAlreadyExists
            case "oauth_account_exists":
                throw AuthError.oauthAccountExists
            case "weak_password":
                throw AuthError.weakPassword(errorResponse?.message ?? "Password does not meet requirements")
            default:
                throw AuthError.serverError(errorResponse?.message ?? "Registration failed")
            }

        default:
            let errorResponse = try? JSONDecoder().decode(RegistrationErrorResponse.self, from: data)
            throw AuthError.serverError(errorResponse?.message ?? "Registration failed")
        }
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

private struct RegistrationErrorResponse: Decodable {
    let error: String
    let message: String?
    let field: String?
    let requiresDeviceCode: Bool?
}

private struct EmptyResponse: Decodable {}

struct UsageRecordResponse: Decodable {
    let success: Bool
    let recorded: Int
    let usage: UsageStats?
}

struct MagicLinkResponse: Decodable {
    let url: String
    let expiresIn: Int
}

// MARK: - Magic Link

extension AuthAPIClient {
    /// Generate a magic link for auto-login on the web
    func generateMagicLink(redirect: String) async throws -> MagicLinkResponse {
        print("[AuthAPI] Generating magic link for redirect: \(redirect)")
        let body: [String: Any] = ["redirect": redirect]
        do {
            let response: MagicLinkResponse = try await post(
                endpoint: "/api/auth/magic-link/generate",
                body: body,
                requiresAuth: true
            )
            print("[AuthAPI] Magic link generated successfully: \(response.url)")
            return response
        } catch {
            print("[AuthAPI] Magic link generation failed: \(error)")
            throw error
        }
    }
}

// MARK: - Email Check

extension AuthAPIClient {
    /// Check if an email exists and what authentication method it uses
    func checkEmail(_ email: String) async throws -> EmailCheckResponse {
        print("[AuthAPI] Checking email: \(email)")
        let body: [String: Any] = ["email": email]

        return try await postPublic(
            endpoint: "/api/auth/check-email",
            body: body
        )
    }

    /// Post without authentication (for public endpoints)
    private func postPublic<T: Decodable>(
        endpoint: String,
        body: [String: Any]
    ) async throws -> T {
        let url = baseURL.appendingPathComponent(endpoint)
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: body)

        return try await perform(request)
    }
}

// MARK: - Google OAuth

extension AuthAPIClient {
    /// Exchange Google authorization code for tokens
    func exchangeGoogleAuth(
        code: String,
        codeVerifier: String,
        redirectUri: String,
        deviceInfo: DeviceInfo
    ) async throws -> GoogleCallbackResponse {
        print("[AuthAPI] Exchanging Google auth code for tokens")

        let body: [String: Any] = [
            "authorizationCode": code,
            "codeVerifier": codeVerifier,
            "redirectUri": redirectUri,
            "deviceId": deviceInfo.deviceId,
            "deviceName": deviceInfo.name,
            "platform": deviceInfo.platform,
            "osVersion": deviceInfo.osVersion ?? "",
            "appVersion": deviceInfo.appVersion ?? ""
        ]

        return try await postGoogleCallback(
            endpoint: "/api/auth/macos/google-callback",
            body: body
        )
    }

    private func postGoogleCallback(
        endpoint: String,
        body: [String: Any]
    ) async throws -> GoogleCallbackResponse {
        let url = baseURL.appendingPathComponent(endpoint)
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: body)

        let (data, response) = try await session.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse else {
            throw AuthError.serverError("Invalid response")
        }

        switch httpResponse.statusCode {
        case 200, 201:
            let decoded = try JSONDecoder().decode(GoogleCallbackResponse.self, from: data)
            return decoded

        case 400:
            let errorResponse = try? JSONDecoder().decode(GoogleErrorResponse.self, from: data)
            if errorResponse?.error == "credentials_account_exists" {
                throw AuthError.credentialsAccountExists
            }
            throw AuthError.serverError(errorResponse?.message ?? "Google authentication failed")

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
            throw AuthError.serverError(errorResponse?.message ?? "Google authentication failed")
        }
    }
}

// MARK: - Response Types

struct EmailCheckResponse: Decodable {
    let exists: Bool
    let authMethod: String? // "credentials", "google", or null
}

struct GoogleCallbackResponse: Decodable {
    let accessToken: String
    let refreshToken: String
    let expiresIn: Int
    let user: AuthUser
    let isNewUser: Bool
}

private struct GoogleErrorResponse: Decodable {
    let error: String
    let authMethod: String?
    let message: String?
}
