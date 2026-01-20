import Foundation
import Security

/// Manages a persistent device identifier stored in Keychain
final class DeviceIdentifier {
    static let shared = DeviceIdentifier()

    private let service = "com.queenmama.app"
    private let account = "device_identifier"

    private init() {}

    /// Gets the existing device ID or creates a new one
    func getOrCreateDeviceId() -> String {
        if let existingId = getDeviceId() {
            return existingId
        }

        let newId = UUID().uuidString
        saveDeviceId(newId)
        return newId
    }

    /// Gets the stored device ID
    func getDeviceId() -> String? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne
        ]

        var result: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &result)

        guard status == errSecSuccess,
              let data = result as? Data,
              let deviceId = String(data: data, encoding: .utf8) else {
            return nil
        }

        return deviceId
    }

    /// Saves a device ID to Keychain
    private func saveDeviceId(_ deviceId: String) {
        let data = Data(deviceId.utf8)

        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecValueData as String: data
        ]

        // Delete any existing item first
        SecItemDelete(query as CFDictionary)

        // Add the new item
        let status = SecItemAdd(query as CFDictionary, nil)

        if status != errSecSuccess {
            print("[DeviceIdentifier] Failed to save device ID: \(status)")
        }
    }
}
