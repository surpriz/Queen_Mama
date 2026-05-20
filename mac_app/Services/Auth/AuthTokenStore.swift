import Foundation
import Security

/// Securely stores authentication tokens
/// - Access token: stored in memory (short-lived)
/// - Refresh token: stored in Keychain (long-lived)
/// - User info: stored in Keychain (persistent)
@MainActor
final class AuthTokenStore {
    static let shared = AuthTokenStore()

    // Use a consistent service name that works across all build configurations
    // Note: We use a fixed service name rather than Bundle.main.bundleIdentifier
    // to ensure tokens persist across different builds (debug, release, Xcode, production)
    private let service = "com.queenmama.app.auth"
    private let legacyService = "com.queenmama.app"  // For migration
    private let refreshTokenAccount = "refresh_token"
    private let userInfoAccount = "user_info"
    private let tokenExpiryAccount = "token_expiry"

    // In-memory storage for access token
    private var _accessToken: String?
    private var _accessTokenExpiry: Date?

    // In-memory cache for Keychain-backed properties
    // Eliminates repeated SecItemCopyMatching calls on main thread (Sentry: App Hanging)
    private var _cachedRefreshToken: String?
    private var _cachedStoredUser: AuthUser?
    private var _cachedStoredTokenExpiry: Date?
    private(set) var isCacheLoaded = false

    private init() {}

    // MARK: - Keychain Cache (Background Preload)

    /// Preloads all Keychain values into memory on a background thread.
    /// Call this before accessing Keychain-backed properties to avoid blocking main thread
    /// with SecItemCopyMatching calls (~8 calls during checkExistingAuth).
    func preloadCache() async {
        let svc = self.service
        let legSvc = self.legacyService
        let rtAcct = self.refreshTokenAccount
        let uiAcct = self.userInfoAccount
        let teAcct = self.tokenExpiryAccount

        typealias CacheResult = (String?, AuthUser?, Date?)

        let result: CacheResult = await withCheckedContinuation { continuation in
            DispatchQueue.global(qos: .userInitiated).async {
                // Helper: read raw data from Keychain (no actor isolation needed)
                func readData(account: String, service: String) -> Data? {
                    let query: [String: Any] = [
                        kSecClass as String: kSecClassGenericPassword,
                        kSecAttrService as String: service,
                        kSecAttrAccount as String: account,
                        kSecReturnData as String: true,
                        kSecMatchLimit as String: kSecMatchLimitOne
                    ]
                    var result: AnyObject?
                    let status = SecItemCopyMatching(query as CFDictionary, &result)
                    guard status == errSecSuccess else { return nil }
                    return result as? Data
                }

                // Read refresh token (try new service, then legacy)
                let refreshToken: String? = {
                    if let data = readData(account: rtAcct, service: svc),
                       let str = String(data: data, encoding: .utf8) {
                        return str
                    }
                    if let data = readData(account: rtAcct, service: legSvc),
                       let str = String(data: data, encoding: .utf8) {
                        return str
                    }
                    return nil
                }()

                // Read stored user
                let storedUser: AuthUser? = {
                    if let data = readData(account: uiAcct, service: svc),
                       let user = try? JSONDecoder().decode(AuthUser.self, from: data) {
                        return user
                    }
                    if let data = readData(account: uiAcct, service: legSvc),
                       let user = try? JSONDecoder().decode(AuthUser.self, from: data) {
                        return user
                    }
                    return nil
                }()

                // Read token expiry
                let tokenExpiry: Date? = {
                    let formatter = ISO8601DateFormatter()
                    if let data = readData(account: teAcct, service: svc),
                       let str = String(data: data, encoding: .utf8) {
                        return formatter.date(from: str)
                    }
                    if let data = readData(account: teAcct, service: legSvc),
                       let str = String(data: data, encoding: .utf8) {
                        return formatter.date(from: str)
                    }
                    return nil
                }()

                continuation.resume(returning: (refreshToken, storedUser, tokenExpiry))
            }
        }

        _cachedRefreshToken = result.0
        _cachedStoredUser = result.1
        _cachedStoredTokenExpiry = result.2
        isCacheLoaded = true

        print("[TokenStore] Cache preloaded on background thread - refreshToken: \(result.0 != nil), user: \(result.1 != nil), expiry: \(result.2 != nil)")
    }

    // MARK: - Access Token (Memory)

    var accessToken: String? {
        get {
            guard let token = _accessToken,
                  let expiry = _accessTokenExpiry,
                  expiry > Date() else {
                return nil
            }
            return token
        }
        set {
            _accessToken = newValue
        }
    }

    var accessTokenExpiry: Date? {
        get { _accessTokenExpiry }
        set { _accessTokenExpiry = newValue }
    }

    var isAccessTokenValid: Bool {
        guard let expiry = _accessTokenExpiry else { return false }
        // Consider token expired 60 seconds early to avoid edge cases
        return expiry.addingTimeInterval(-60) > Date()
    }

    // MARK: - Refresh Token (Keychain, cached)

    var refreshToken: String? {
        get {
            // Return from cache if preloaded (avoids main-thread SecItemCopyMatching)
            if isCacheLoaded {
                return _cachedRefreshToken
            }
            // Fallback: direct Keychain read (before preloadCache is called)
            do {
                return try getString(account: refreshTokenAccount, service: service)
            } catch KeychainError.itemNotFound {
                // expected on first launch or after logout
            } catch {
                CrashReporter.shared.captureError(error, extras: [
                    "service": "keychain",
                    "operation": "get_refresh_token"
                ])
            }
            do {
                let legacyToken = try getString(account: refreshTokenAccount, service: legacyService)
                print("[TokenStore] Found token in legacy keychain, migrating...")
                try? saveString(legacyToken, account: refreshTokenAccount, service: service)
                return legacyToken
            } catch KeychainError.itemNotFound {
                // no legacy token — normal
            } catch {
                CrashReporter.shared.captureError(error, extras: [
                    "service": "keychain",
                    "operation": "get_refresh_token_legacy"
                ])
            }
            return nil
        }
        set {
            _cachedRefreshToken = newValue
            if let token = newValue {
                do {
                    try saveString(token, account: refreshTokenAccount, service: service)
                } catch {
                    print("[TokenStore] ⚠️ CRITICAL: Failed to save refresh token to Keychain: \(error)")
                    CrashReporter.shared.captureError(error, extras: [
                        "service": "keychain",
                        "operation": "save_refresh_token"
                    ])
                }
            } else {
                try? delete(account: refreshTokenAccount, service: service)
                try? delete(account: refreshTokenAccount, service: legacyService)
            }
        }
    }

    // MARK: - User Info (Keychain, cached)

    var storedUser: AuthUser? {
        get {
            // Return from cache if preloaded (avoids main-thread SecItemCopyMatching)
            if isCacheLoaded {
                return _cachedStoredUser
            }
            // Fallback: direct Keychain read (before preloadCache is called)
            if let data = try? getData(account: userInfoAccount, service: service),
               let user = try? JSONDecoder().decode(AuthUser.self, from: data) {
                return user
            }
            if let legacyData = try? getData(account: userInfoAccount, service: legacyService),
               let user = try? JSONDecoder().decode(AuthUser.self, from: legacyData) {
                print("[TokenStore] Found user in legacy keychain, migrating...")
                try? saveData(legacyData, account: userInfoAccount, service: service)
                return user
            }
            return nil
        }
        set {
            _cachedStoredUser = newValue
            if let user = newValue,
               let data = try? JSONEncoder().encode(user) {
                do {
                    try saveData(data, account: userInfoAccount, service: service)
                } catch {
                    print("[TokenStore] ⚠️ CRITICAL: Failed to save user info to Keychain: \(error)")
                    CrashReporter.shared.captureError(error, extras: [
                        "service": "keychain",
                        "operation": "save_user_info"
                    ])
                }
            } else {
                try? delete(account: userInfoAccount, service: service)
                try? delete(account: userInfoAccount, service: legacyService)
            }
        }
    }

    // MARK: - Token Expiry Persistence (cached)

    var storedTokenExpiry: Date? {
        get {
            // Return from cache if preloaded (avoids main-thread SecItemCopyMatching)
            if isCacheLoaded {
                return _cachedStoredTokenExpiry
            }
            // Fallback: direct Keychain read (before preloadCache is called)
            if let string = try? getString(account: tokenExpiryAccount, service: service) {
                return ISO8601DateFormatter().date(from: string)
            }
            if let legacyString = try? getString(account: tokenExpiryAccount, service: legacyService) {
                return ISO8601DateFormatter().date(from: legacyString)
            }
            return nil
        }
        set {
            _cachedStoredTokenExpiry = newValue
            if let expiry = newValue {
                let string = ISO8601DateFormatter().string(from: expiry)
                do {
                    try saveString(string, account: tokenExpiryAccount, service: service)
                } catch {
                    print("[TokenStore] ⚠️ Failed to save token expiry to Keychain: \(error)")
                    CrashReporter.shared.captureError(error, extras: [
                        "service": "keychain",
                        "operation": "save_token_expiry"
                    ])
                }
            } else {
                try? delete(account: tokenExpiryAccount, service: service)
                try? delete(account: tokenExpiryAccount, service: legacyService)
            }
        }
    }

    // MARK: - Store/Clear All

    func storeTokens(_ tokens: AuthTokens, user: AuthUser) {
        print("[TokenStore] Storing tokens for user: \(user.email.prefix(3))***")

        _accessToken = tokens.accessToken
        _accessTokenExpiry = tokens.expiresAt

        refreshToken = tokens.refreshToken
        storedUser = user
        storedTokenExpiry = tokens.expiresAt

        // Verify storage
        let hasRefresh = self.refreshToken != nil
        let hasUser = self.storedUser != nil
        print("[TokenStore] Storage verification - refreshToken: \(hasRefresh), user: \(hasUser)")
    }

    func clearAll() {
        print("[TokenStore] Clearing all stored credentials")
        _accessToken = nil
        _accessTokenExpiry = nil
        refreshToken = nil  // This will clear both services
        storedUser = nil    // This will clear both services
        storedTokenExpiry = nil  // This will clear both services
    }

    var hasStoredCredentials: Bool {
        let hasRefresh = refreshToken != nil
        let hasUser = storedUser != nil
        print("[TokenStore] ========== CREDENTIALS CHECK ==========")
        print("[TokenStore] Keychain service: \(service)")
        print("[TokenStore] Bundle ID: \(Bundle.main.bundleIdentifier ?? "unknown")")
        print("[TokenStore] Has refresh token: \(hasRefresh)")
        print("[TokenStore] Has stored user: \(hasUser)")
        if let user = storedUser {
            print("[TokenStore] Stored user email: \(user.email.prefix(3))***")
        }
        print("[TokenStore] ========================================")
        return hasRefresh && hasUser
    }

    // MARK: - Keychain Operations

    private func saveString(_ string: String, account: String, service svc: String? = nil) throws {
        let data = Data(string.utf8)
        try saveData(data, account: account, service: svc)
    }

    private func getString(account: String, service svc: String? = nil) throws -> String {
        let data = try getData(account: account, service: svc)
        guard let string = String(data: data, encoding: .utf8) else {
            throw KeychainError.invalidData
        }
        return string
    }

    private func saveData(_ data: Data, account: String, service svc: String? = nil) throws {
        let serviceToUse = svc ?? service

        // Use update-or-add pattern to avoid losing data if add fails after delete
        let searchQuery: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: serviceToUse,
            kSecAttrAccount as String: account,
        ]

        let updateAttributes: [String: Any] = [
            kSecValueData as String: data
        ]

        let updateStatus = SecItemUpdate(searchQuery as CFDictionary, updateAttributes as CFDictionary)

        if updateStatus == errSecSuccess {
            print("[TokenStore] Keychain update SUCCESS for \(account) in \(serviceToUse)")
            return
        }

        if updateStatus == errSecItemNotFound {
            // Item doesn't exist yet, add it
            var addQuery = searchQuery
            addQuery[kSecValueData as String] = data

            let addStatus = SecItemAdd(addQuery as CFDictionary, nil)
            guard addStatus == errSecSuccess else {
                print("[TokenStore] Keychain add FAILED for \(account) in \(serviceToUse): OSStatus \(addStatus)")
                throw KeychainError.unexpectedStatus(addStatus)
            }
            print("[TokenStore] Keychain add SUCCESS for \(account) in \(serviceToUse)")
            return
        }

        // Update failed for unexpected reason
        print("[TokenStore] Keychain update FAILED for \(account) in \(serviceToUse): OSStatus \(updateStatus)")
        throw KeychainError.unexpectedStatus(updateStatus)
    }

    private func getData(account: String, service svc: String? = nil) throws -> Data {
        let serviceToUse = svc ?? service
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: serviceToUse,
            kSecAttrAccount as String: account,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne
        ]

        var result: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &result)

        guard status == errSecSuccess else {
            if status == errSecItemNotFound {
                throw KeychainError.itemNotFound
            }
            throw KeychainError.unexpectedStatus(status)
        }

        guard let data = result as? Data else {
            throw KeychainError.invalidData
        }

        return data
    }

    private func delete(account: String, service svc: String? = nil) throws {
        let serviceToUse = svc ?? service
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: serviceToUse,
            kSecAttrAccount as String: account
        ]

        let status = SecItemDelete(query as CFDictionary)
        guard status == errSecSuccess || status == errSecItemNotFound else {
            throw KeychainError.unexpectedStatus(status)
        }
    }
}
