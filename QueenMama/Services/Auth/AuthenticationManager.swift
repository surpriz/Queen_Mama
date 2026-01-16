import Foundation
import Combine

/// Main authentication coordinator for the macOS app
/// Manages login flows, token refresh, and authentication state
@MainActor
final class AuthenticationManager: ObservableObject {
    static let shared = AuthenticationManager()

    // MARK: - Published State

    @Published private(set) var authState: AuthState = .unknown
    @Published private(set) var isAuthenticated: Bool = false
    @Published private(set) var currentUser: AuthUser?

    // MARK: - Dependencies

    private let api = AuthAPIClient.shared
    private let tokenStore = AuthTokenStore.shared
    private let deviceInfo = DeviceInfo.current()

    // MARK: - Device Code Polling

    private var pollingTask: Task<Void, Never>?
    private let pollingInterval: TimeInterval = 5

    private init() {}

    // MARK: - Initialization

    /// Check for existing authentication on app launch
    func checkExistingAuth() async {
        authState = .unknown

        // Check for stored credentials
        guard tokenStore.hasStoredCredentials,
              let storedUser = tokenStore.storedUser else {
            authState = .unauthenticated
            return
        }

        // Try to validate/refresh tokens
        do {
            if !tokenStore.isAccessTokenValid {
                // Need to refresh
                guard let refreshToken = tokenStore.refreshToken else {
                    throw AuthError.tokenExpired
                }

                let response = try await api.refreshTokens(refreshToken)
                tokenStore.accessToken = response.accessToken
                tokenStore.accessTokenExpiry = Date().addingTimeInterval(TimeInterval(response.expiresIn))
                tokenStore.refreshToken = response.refreshToken
            }

            // Successfully authenticated
            currentUser = storedUser
            isAuthenticated = true
            authState = .authenticated(user: storedUser)

        } catch {
            print("[Auth] Existing auth validation failed: \(error)")
            // Clear invalid credentials
            tokenStore.clearAll()
            authState = .unauthenticated
        }
    }

    // MARK: - Credentials Login

    /// Login with email and password
    func loginWithCredentials(email: String, password: String) async throws {
        authState = .authenticating

        do {
            let response = try await api.login(
                email: email,
                password: password,
                deviceInfo: deviceInfo
            )

            // Store tokens
            let tokens = AuthTokens(
                accessToken: response.accessToken,
                refreshToken: response.refreshToken,
                expiresIn: response.expiresIn
            )
            tokenStore.storeTokens(tokens, user: response.user)

            // Update state
            currentUser = response.user
            isAuthenticated = true
            authState = .authenticated(user: response.user)

        } catch {
            authState = .error(message: error.localizedDescription)
            throw error
        }
    }

    // MARK: - Device Code Flow

    /// Start the device code flow for OAuth users
    func startDeviceCodeFlow() async throws -> DeviceCodeResponse {
        authState = .authenticating

        do {
            let response = try await api.requestDeviceCode(deviceInfo: deviceInfo)

            let expiresAt = Date().addingTimeInterval(TimeInterval(response.expiresIn))
            authState = .deviceCodePending(
                userCode: response.userCode,
                deviceCode: response.deviceCode,
                expiresAt: expiresAt
            )

            // Start polling
            startPolling(deviceCode: response.deviceCode, expiresAt: expiresAt)

            return response

        } catch {
            authState = .error(message: error.localizedDescription)
            throw error
        }
    }

    /// Cancel the device code flow
    func cancelDeviceCodeFlow() {
        pollingTask?.cancel()
        pollingTask = nil
        authState = .unauthenticated
    }

    private func startPolling(deviceCode: String, expiresAt: Date) {
        pollingTask?.cancel()

        pollingTask = Task {
            while !Task.isCancelled && Date() < expiresAt {
                do {
                    try await Task.sleep(nanoseconds: UInt64(pollingInterval * 1_000_000_000))

                    if Task.isCancelled { break }

                    let response = try await api.pollDeviceCode(deviceCode)

                    // Check if authorized
                    if let accessToken = response.accessToken,
                       let refreshToken = response.refreshToken,
                       let expiresIn = response.expiresIn,
                       let user = response.user {

                        // Store tokens
                        let tokens = AuthTokens(
                            accessToken: accessToken,
                            refreshToken: refreshToken,
                            expiresIn: expiresIn
                        )

                        await MainActor.run {
                            tokenStore.storeTokens(tokens, user: user)
                            currentUser = user
                            isAuthenticated = true
                            authState = .authenticated(user: user)
                        }

                        return
                    }

                    // Still pending - continue polling
                    if response.error == "authorization_pending" {
                        continue
                    }

                    // Some other error
                    if let error = response.error, error != "authorization_pending" {
                        await MainActor.run {
                            authState = .error(message: response.message ?? error)
                        }
                        return
                    }

                } catch {
                    // Ignore network errors during polling, just continue
                    print("[Auth] Polling error: \(error)")
                }
            }

            // Expired without authorization
            if !Task.isCancelled {
                await MainActor.run {
                    authState = .error(message: "Device code expired. Please try again.")
                }
            }
        }
    }

    // MARK: - Logout

    /// Logout from current device
    func logout() async {
        pollingTask?.cancel()

        do {
            try await api.logout(
                refreshToken: tokenStore.refreshToken,
                allDevices: false
            )
        } catch {
            print("[Auth] Logout API call failed: \(error)")
            // Continue with local logout anyway
        }

        tokenStore.clearAll()
        currentUser = nil
        isAuthenticated = false
        authState = .unauthenticated
    }

    /// Logout from all devices
    func logoutAllDevices() async {
        pollingTask?.cancel()

        do {
            try await api.logout(
                refreshToken: tokenStore.refreshToken,
                allDevices: true
            )
        } catch {
            print("[Auth] Logout all devices API call failed: \(error)")
        }

        tokenStore.clearAll()
        currentUser = nil
        isAuthenticated = false
        authState = .unauthenticated
    }

    // MARK: - Token Access

    /// Get a valid access token, refreshing if needed
    func getAccessToken() async throws -> String {
        if tokenStore.isAccessTokenValid, let token = tokenStore.accessToken {
            return token
        }

        guard let refreshToken = tokenStore.refreshToken else {
            throw AuthError.notAuthenticated
        }

        let response = try await api.refreshTokens(refreshToken)
        tokenStore.accessToken = response.accessToken
        tokenStore.accessTokenExpiry = Date().addingTimeInterval(TimeInterval(response.expiresIn))
        tokenStore.refreshToken = response.refreshToken

        guard let token = tokenStore.accessToken else {
            throw AuthError.invalidToken
        }

        return token
    }
}
