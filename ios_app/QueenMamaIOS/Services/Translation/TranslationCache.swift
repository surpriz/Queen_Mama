import Foundation
import CryptoKit

/// LRU cache for translation results to avoid re-translating identical chunks
/// (common in calls: "yes", "ok", "thank you", repeated questions).
/// Keys are sha256 over normalized source text + lang pair.
final class TranslationCache: @unchecked Sendable {
    private let capacity: Int
    private let lock = NSLock()
    private var storage: [String: String] = [:]
    private var order: [String] = []

    init(capacity: Int = 1000) {
        self.capacity = capacity
    }

    func lookup(text: String, sourceLang: String?, targetLang: String) -> String? {
        let key = Self.makeKey(text: text, sourceLang: sourceLang, targetLang: targetLang)
        lock.lock()
        defer { lock.unlock() }
        guard let value = storage[key] else { return nil }
        // Move key to end (most recently used)
        if let idx = order.firstIndex(of: key) {
            order.remove(at: idx)
            order.append(key)
        }
        return value
    }

    func store(text: String, sourceLang: String?, targetLang: String, translation: String) {
        let key = Self.makeKey(text: text, sourceLang: sourceLang, targetLang: targetLang)
        lock.lock()
        defer { lock.unlock() }
        if storage[key] != nil {
            // Already present — promote to MRU
            if let idx = order.firstIndex(of: key) {
                order.remove(at: idx)
            }
        } else if storage.count >= capacity {
            // Evict LRU
            if let oldest = order.first {
                order.removeFirst()
                storage.removeValue(forKey: oldest)
            }
        }
        storage[key] = translation
        order.append(key)
    }

    func clear() {
        lock.lock()
        defer { lock.unlock() }
        storage.removeAll()
        order.removeAll()
    }

    var count: Int {
        lock.lock()
        defer { lock.unlock() }
        return storage.count
    }

    static func makeKey(text: String, sourceLang: String?, targetLang: String) -> String {
        let normalized = text.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        let source = sourceLang?.uppercased() ?? "AUTO"
        let target = targetLang.uppercased()
        let composite = "\(source)→\(target)‖\(normalized)"
        let digest = SHA256.hash(data: Data(composite.utf8))
        return digest.compactMap { String(format: "%02x", $0) }.joined()
    }
}
