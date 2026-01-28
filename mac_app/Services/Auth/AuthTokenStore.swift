import Foundation
import Security

/// Securely stores authentication tokens
/// - Access token: stored in memory (short-lived)
/// - Refresh token: stored in Keychain (long-lived)
/// - User info: stored in Keychain (persistent)
final class AuthTokenStore {
    static let shared = AuthTokenStore()

    private let service = "com.queenmama.app"
    private let refreshTokenAccount = "refresh_token"
    private let userInfoAccount = "user_info"
    private let tokenExpiryAccount = "token_expiry"

    // In-memory storage for access token
    private var _accessToken: String?
    private var _accessTokenExpiry: Date?

    private init() {}

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

    // MARK: - Refresh Token (Keychain)

    var refreshToken: String? {
        get {
            try? getString(account: refreshTokenAccount)
        }
        set {
            if let token = newValue {
                try? saveString(token, account: refreshTokenAccount)
            } else {
                try? delete(account: refreshTokenAccount)
            }
        }
    }

    // MARK: - User Info (Keychain)

    var storedUser: AuthUser? {
        get {
            guard let data = try? getData(account: userInfoAccount) else { return nil }
            return try? JSONDecoder().decode(AuthUser.self, from: data)
        }
        set {
            if let user = newValue,
               let data = try? JSONEncoder().encode(user) {
                try? saveData(data, account: userInfoAccount)
            } else {
                try? delete(account: userInfoAccount)
            }
        }
    }

    // MARK: - Token Expiry Persistence

    var storedTokenExpiry: Date? {
        get {
            guard let string = try? getString(account: tokenExpiryAccount) else { return nil }
            return ISO8601DateFormatter().date(from: string)
        }
        set {
            if let expiry = newValue {
                let string = ISO8601DateFormatter().string(from: expiry)
                try? saveString(string, account: tokenExpiryAccount)
            } else {
                try? delete(account: tokenExpiryAccount)
            }
        }
    }

    // MARK: - Store/Clear All

    func storeTokens(_ tokens: AuthTokens, user: AuthUser) {
        print("[TokenStore] Storing tokens for user: \(user.email)")

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
        _accessToken = nil
        _accessTokenExpiry = nil
        refreshToken = nil
        storedUser = nil
        storedTokenExpiry = nil
    }

    var hasStoredCredentials: Bool {
        let hasRefresh = refreshToken != nil
        let hasUser = storedUser != nil
        print("[TokenStore] hasStoredCredentials check - refreshToken: \(hasRefresh), user: \(hasUser)")
        return hasRefresh && hasUser
    }

    // MARK: - Keychain Operations

    private func saveString(_ string: String, account: String) throws {
        let data = Data(string.utf8)
        try saveData(data, account: account)
    }

    private func getString(account: String) throws -> String {
        let data = try getData(account: account)
        guard let string = String(data: data, encoding: .utf8) else {
            throw KeychainError.invalidData
        }
        return string
    }

    private func saveData(_ data: Data, account: String) throws {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecValueData as String: data
        ]

        // Delete existing item first
        SecItemDelete(query as CFDictionary)

        let status = SecItemAdd(query as CFDictionary, nil)
        guard status == errSecSuccess else {
            print("[TokenStore] Keychain save FAILED for \(account): OSStatus \(status)")
            throw KeychainError.unexpectedStatus(status)
        }
        print("[TokenStore] Keychain save SUCCESS for \(account)")
    }

    private func getData(account: String) throws -> Data {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne
        ]

        var result: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &result)

        guard status == errSecSuccess else {
            throw KeychainError.itemNotFound
        }

        guard let data = result as? Data else {
            throw KeychainError.invalidData
        }

        return data
    }

    private func delete(account: String) throws {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account
        ]

        let status = SecItemDelete(query as CFDictionary)
        guard status == errSecSuccess || status == errSecItemNotFound else {
            throw KeychainError.unexpectedStatus(status)
        }
    }
}
