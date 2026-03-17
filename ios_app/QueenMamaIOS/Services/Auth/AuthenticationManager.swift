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
        print("[Auth] ========== AUTH CHECK STARTED ==========")
        authState = .unknown

        // Check for stored credentials
        guard tokenStore.hasStoredCredentials,
              let storedUser = tokenStore.storedUser else {
            print("[Auth] No stored credentials found - user needs to login")
            print("[Auth] ==========================================")
            authState = .unauthenticated
            return
        }

        print("[Auth] Found stored credentials for user: \(storedUser.email.prefix(3))***")
        print("[Auth] Has refresh token: \(tokenStore.refreshToken != nil)")
        print("[Auth] Access token valid: \(tokenStore.isAccessTokenValid)")

        // Try to validate/refresh tokens
        do {
            if !tokenStore.isAccessTokenValid {
                // Need to refresh
                guard let refreshToken = tokenStore.refreshToken else {
                    print("[Auth] No refresh token available")
                    throw AuthError.tokenExpired
                }

                print("[Auth] Access token expired, refreshing...")
                let response = try await api.refreshTokens(refreshToken)
                tokenStore.accessToken = response.accessToken
                tokenStore.accessTokenExpiry = Date().addingTimeInterval(TimeInterval(response.expiresIn))
                tokenStore.refreshToken = response.refreshToken
                print("[Auth] Token refresh successful")
            }

            // Successfully authenticated
            currentUser = storedUser
            isAuthenticated = true
            authState = .authenticated(user: storedUser)
            print("[Auth] Authentication restored for: \(storedUser.email.prefix(3))***")

            // Notify other services
            NotificationCenter.default.post(name: .userDidAuthenticate, object: nil)

        } catch {
            print("[Auth] Token refresh failed during startup: \(error)")
            print("[Auth] Error type: \(type(of: error)), description: \(error.localizedDescription)")

            if isPermanentAuthError(error) {
                // Permanent error (account blocked, device limit) - force re-login
                print("[Auth] Permanent auth error - user must re-authenticate")
                currentUser = nil
                isAuthenticated = false
                authState = .unauthenticated
            } else {
                // All other errors (network, invalid token, server, decoding, etc.)
                // → Degraded mode: keep user authenticated with cached data.
                // getAccessToken() will retry refresh transparently on next action.
                print("[Auth] Non-permanent error - entering degraded mode with cached user")
                currentUser = storedUser
                isAuthenticated = true
                authState = .authenticated(user: storedUser)
                NotificationCenter.default.post(name: .userDidAuthenticate, object: nil)
            }
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

            // Notify other services
            NotificationCenter.default.post(name: .userDidAuthenticate, object: nil)

        } catch {
            authState = .error(message: error.localizedDescription)
            throw error
        }
    }

    // MARK: - Registration

    /// Register a new account with email and password
    func registerWithCredentials(name: String, email: String, password: String) async throws {
        authState = .authenticating

        do {
            let response = try await api.register(
                name: name,
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

            // Notify other services
            NotificationCenter.default.post(name: .userDidAuthenticate, object: nil)

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

                            // Notify other services
                            NotificationCenter.default.post(name: .userDidAuthenticate, object: nil)
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

        // Notify other services
        NotificationCenter.default.post(name: .userDidLogout, object: nil)
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

        // Notify other services
        NotificationCenter.default.post(name: .userDidLogout, object: nil)
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

    // MARK: - Google Sign-In

    /// Login with Google using ASWebAuthenticationSession
    func loginWithGoogle() async throws {
        authState = .authenticating

        do {
            // Start Google OAuth flow
            let googleResult = try await GoogleAuthService.shared.startGoogleSignIn()

            // Exchange authorization code for tokens with our backend
            let response = try await api.exchangeGoogleAuth(
                code: googleResult.authorizationCode,
                codeVerifier: googleResult.codeVerifier,
                redirectUri: googleResult.redirectUri,
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

            // Notify other services
            NotificationCenter.default.post(name: .userDidAuthenticate, object: nil)

            print("[Auth] Google login successful, isNewUser: \(response.isNewUser)")

        } catch let error as GoogleAuthError where error == .userCancelled {
            // User cancelled - just return to unauthenticated
            authState = .unauthenticated
            throw error

        } catch {
            authState = .error(message: error.localizedDescription)
            throw error
        }
    }

    // MARK: - Email Check

    /// Check if an email exists and what authentication method it uses
    func checkEmailAuthMethod(_ email: String) async throws -> EmailCheckResponse {
        return try await api.checkEmail(email)
    }

    // MARK: - Error Classification

    /// Errors that indicate the session is gone and the user MUST re-authenticate.
    /// Transient errors (network, server) → degraded mode with transparent retry.
    private func isPermanentAuthError(_ error: Error) -> Bool {
        if let authError = error as? AuthError {
            switch authError {
            case .accountBlocked, .deviceLimitReached:
                // Account-level blocks that won't resolve by retrying
                return true
            case .invalidToken, .tokenExpired:
                // Server explicitly rejected the refresh token (401).
                // The session is gone — retrying will keep failing.
                return true
            default:
                // Network errors, server errors, decoding errors → transient
                // Allow degraded mode with transparent retry via getAccessToken()
                return false
            }
        }

        // All non-AuthError errors (URLError, DecodingError, etc.) → transient
        return false
    }
}
