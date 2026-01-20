import Foundation
import CryptoKit
import Security

/// Provides encryption for sensitive data at rest using AES-GCM
///
/// Uses CryptoKit for encryption and Keychain for secure key storage.
/// All data is encrypted before being stored in UserDefaults or files.
@MainActor
final class SecureStorage {

    // MARK: - Singleton
    static let shared = SecureStorage()

    // MARK: - Constants
    private let encryptionKeyTag = "com.queenmama.app.encryption.key"
    private let keychainService = "com.queenmama.app.secure"

    // MARK: - Initialization

    private init() {
        // Ensure encryption key exists
        if getOrCreateEncryptionKey() == nil {
            print("[SecureStorage] Warning: Failed to initialize encryption key")
        }
    }

    // MARK: - Public Methods

    /// Encrypt and store a string value
    func setSecureString(_ value: String, forKey key: String) -> Bool {
        guard let data = value.data(using: .utf8) else {
            print("[SecureStorage] Failed to convert string to data")
            return false
        }
        return setSecureData(data, forKey: key)
    }

    /// Retrieve and decrypt a string value
    func getSecureString(forKey key: String) -> String? {
        guard let data = getSecureData(forKey: key) else {
            return nil
        }
        return String(data: data, encoding: .utf8)
    }

    /// Encrypt and store binary data
    func setSecureData(_ data: Data, forKey key: String) -> Bool {
        guard let encryptedData = encrypt(data) else {
            print("[SecureStorage] Failed to encrypt data for key: \(key)")
            return false
        }

        UserDefaults.standard.set(encryptedData, forKey: "secure_\(key)")
        return true
    }

    /// Retrieve and decrypt binary data
    func getSecureData(forKey key: String) -> Data? {
        guard let encryptedData = UserDefaults.standard.data(forKey: "secure_\(key)") else {
            return nil
        }
        return decrypt(encryptedData)
    }

    /// Encrypt and store a Codable object
    func setSecureObject<T: Codable>(_ object: T, forKey key: String) -> Bool {
        do {
            let data = try JSONEncoder().encode(object)
            return setSecureData(data, forKey: key)
        } catch {
            print("[SecureStorage] Failed to encode object: \(error)")
            return false
        }
    }

    /// Retrieve and decrypt a Codable object
    func getSecureObject<T: Codable>(forKey key: String, type: T.Type) -> T? {
        guard let data = getSecureData(forKey: key) else {
            return nil
        }
        do {
            return try JSONDecoder().decode(type, from: data)
        } catch {
            print("[SecureStorage] Failed to decode object: \(error)")
            return nil
        }
    }

    /// Remove a secure value
    func removeSecureValue(forKey key: String) {
        UserDefaults.standard.removeObject(forKey: "secure_\(key)")
    }

    /// Encrypt a file at the given path
    func encryptFile(at sourceURL: URL, to destinationURL: URL) -> Bool {
        do {
            let data = try Data(contentsOf: sourceURL)
            guard let encryptedData = encrypt(data) else {
                return false
            }
            try encryptedData.write(to: destinationURL)
            return true
        } catch {
            print("[SecureStorage] Failed to encrypt file: \(error)")
            return false
        }
    }

    /// Decrypt a file at the given path
    func decryptFile(at sourceURL: URL, to destinationURL: URL) -> Bool {
        do {
            let encryptedData = try Data(contentsOf: sourceURL)
            guard let data = decrypt(encryptedData) else {
                return false
            }
            try data.write(to: destinationURL)
            return true
        } catch {
            print("[SecureStorage] Failed to decrypt file: \(error)")
            return false
        }
    }

    // MARK: - Key Management

    /// Get or create the encryption key from Keychain
    private func getOrCreateEncryptionKey() -> SymmetricKey? {
        // Try to retrieve existing key
        if let existingKey = retrieveKeyFromKeychain() {
            return existingKey
        }

        // Generate new key
        let newKey = SymmetricKey(size: .bits256)
        if storeKeyInKeychain(newKey) {
            return newKey
        }

        return nil
    }

    /// Store encryption key in Keychain
    private func storeKeyInKeychain(_ key: SymmetricKey) -> Bool {
        let keyData = key.withUnsafeBytes { Data($0) }

        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: keychainService,
            kSecAttrAccount as String: encryptionKeyTag,
            kSecValueData as String: keyData,
            kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlock,
        ]

        // Delete any existing key first
        SecItemDelete(query as CFDictionary)

        let status = SecItemAdd(query as CFDictionary, nil)

        if status == errSecSuccess {
            print("[SecureStorage] Encryption key stored in Keychain")
            return true
        } else {
            print("[SecureStorage] Failed to store key: \(status)")
            return false
        }
    }

    /// Retrieve encryption key from Keychain
    private func retrieveKeyFromKeychain() -> SymmetricKey? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: keychainService,
            kSecAttrAccount as String: encryptionKeyTag,
            kSecReturnData as String: true,
        ]

        var result: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &result)

        guard status == errSecSuccess,
              let keyData = result as? Data else {
            return nil
        }

        return SymmetricKey(data: keyData)
    }

    // MARK: - Encryption/Decryption

    /// Encrypt data using AES-GCM
    private func encrypt(_ data: Data) -> Data? {
        guard let key = getOrCreateEncryptionKey() else {
            print("[SecureStorage] No encryption key available")
            return nil
        }

        do {
            // Generate random nonce
            let nonce = AES.GCM.Nonce()

            // Encrypt
            let sealedBox = try AES.GCM.seal(data, using: key, nonce: nonce)

            // Combine nonce + ciphertext + tag
            guard let combined = sealedBox.combined else {
                print("[SecureStorage] Failed to get combined sealed box data")
                return nil
            }

            return combined
        } catch {
            print("[SecureStorage] Encryption error: \(error)")
            return nil
        }
    }

    /// Decrypt data using AES-GCM
    private func decrypt(_ data: Data) -> Data? {
        guard let key = getOrCreateEncryptionKey() else {
            print("[SecureStorage] No encryption key available")
            return nil
        }

        do {
            // Create sealed box from combined data
            let sealedBox = try AES.GCM.SealedBox(combined: data)

            // Decrypt
            let decryptedData = try AES.GCM.open(sealedBox, using: key)

            return decryptedData
        } catch {
            print("[SecureStorage] Decryption error: \(error)")
            return nil
        }
    }
}

// MARK: - Convenience Extensions

extension SecureStorage {

    /// Store license cache securely
    func storeLicenseCache(_ cache: LicenseCache) {
        _ = setSecureObject(cache, forKey: "license_cache")
    }

    /// Retrieve license cache
    func getLicenseCache() -> LicenseCache? {
        return getSecureObject(forKey: "license_cache", type: LicenseCache.self)
    }

    /// Store sync queue securely
    func storeSyncQueue(_ queue: [SyncQueueItem]) {
        _ = setSecureObject(queue, forKey: "sync_queue")
    }

    /// Retrieve sync queue
    func getSyncQueue() -> [SyncQueueItem]? {
        return getSecureObject(forKey: "sync_queue", type: [SyncQueueItem].self)
    }
}

// MARK: - Supporting Types

/// Represents a cached license for offline use
struct LicenseCache: Codable {
    let userId: String
    let plan: String
    let features: LicenseFeatures
    let expiresAt: Date
    let cachedAt: Date

    var isExpired: Bool {
        Date() > expiresAt
    }

    var isStale: Bool {
        // Consider stale after 1 hour
        Date().timeIntervalSince(cachedAt) > 3600
    }
}

/// Features available in a license
struct LicenseFeatures: Codable {
    let smartModeLimit: Int?
    let sessionSync: Bool
    let undetectable: Bool
    let autoAnswer: Bool
}

/// Item in the sync queue
struct SyncQueueItem: Codable, Identifiable {
    let id: String
    let sessionId: String
    let deviceId: String
    let createdAt: Date
    let retryCount: Int
    let lastError: String?
}
