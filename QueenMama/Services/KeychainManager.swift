import Foundation
import Security

enum KeychainError: LocalizedError {
    case duplicateItem
    case itemNotFound
    case unexpectedStatus(OSStatus)
    case invalidData

    var errorDescription: String? {
        switch self {
        case .duplicateItem:
            return "Item already exists in keychain"
        case .itemNotFound:
            return "Item not found in keychain"
        case .unexpectedStatus(let status):
            return "Keychain error: \(status)"
        case .invalidData:
            return "Invalid data format"
        }
    }
}

final class KeychainManager {
    static let shared = KeychainManager()

    private let service = "com.queenmama.app"

    private init() {}

    // MARK: - API Keys

    enum APIKeyType: String, CaseIterable {
        case deepgram = "deepgram_api_key"
        case assemblyai = "assemblyai_api_key"
        case openai = "openai_api_key"
        case anthropic = "anthropic_api_key"
        case gemini = "gemini_api_key"

        var displayName: String {
            switch self {
            case .deepgram: return "Deepgram"
            case .assemblyai: return "AssemblyAI"
            case .openai: return "OpenAI"
            case .anthropic: return "Anthropic"
            case .gemini: return "Google Gemini"
            }
        }
    }

    func saveAPIKey(_ key: String, for type: APIKeyType) throws {
        let trimmedKey = key.trimmingCharacters(in: .whitespacesAndNewlines)
        print("[Keychain] Saving \(type.displayName) key: \(trimmedKey.prefix(15))... (length: \(trimmedKey.count))")
        let data = Data(trimmedKey.utf8)
        try save(data: data, account: type.rawValue)
        print("[Keychain] \(type.displayName) key saved successfully")
    }

    func getAPIKey(for type: APIKeyType) -> String? {
        guard let data = try? retrieve(account: type.rawValue) else {
            print("[Keychain] No key found for \(type.displayName)")
            return nil
        }
        let key = String(data: data, encoding: .utf8)?.trimmingCharacters(in: .whitespacesAndNewlines)
        print("[Keychain] Retrieved \(type.displayName) key: \(key?.prefix(15) ?? "nil")...")
        return key
    }

    func deleteAPIKey(for type: APIKeyType) throws {
        try delete(account: type.rawValue)
    }

    func hasAPIKey(for type: APIKeyType) -> Bool {
        return getAPIKey(for: type) != nil
    }

    // MARK: - Generic Keychain Operations

    private func save(data: Data, account: String) throws {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecValueData as String: data
        ]

        // Try to delete existing item first
        SecItemDelete(query as CFDictionary)

        let status = SecItemAdd(query as CFDictionary, nil)

        guard status == errSecSuccess else {
            if status == errSecDuplicateItem {
                throw KeychainError.duplicateItem
            }
            throw KeychainError.unexpectedStatus(status)
        }
    }

    private func retrieve(account: String) throws -> Data {
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
