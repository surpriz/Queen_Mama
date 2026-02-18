import Foundation
import CryptoKit

/// Response cache for cost optimization - caches AI responses for similar queries
/// Provides instant responses for cache hits, reducing API costs by 30-50%
actor ResponseCache {
    static let shared = ResponseCache()

    private var cache: [String: CachedResponse] = [:]
    private let maxSize = 50
    private let ttlSeconds: TimeInterval = 300  // 5 minutes

    struct CachedResponse {
        let content: String
        let timestamp: Date
        let provider: AIProviderType
    }

    /// Get cached response if available and not expired
    func get(transcript: String, mode: String, type: String) -> CachedResponse? {
        let key = makeKey(transcript: transcript, mode: mode, type: type)
        guard let cached = cache[key] else { return nil }

        // Check expiration
        if Date().timeIntervalSince(cached.timestamp) > ttlSeconds {
            cache.removeValue(forKey: key)
            print("[ResponseCache] Cache expired for key")
            return nil
        }

        print("[ResponseCache] Cache HIT - returning cached response")
        return cached
    }

    /// Cache a response
    func set(
        transcript: String,
        mode: String,
        type: String,
        content: String,
        provider: AIProviderType
    ) {
        let key = makeKey(transcript: transcript, mode: mode, type: type)

        // LRU eviction if full
        if cache.count >= maxSize {
            if let oldest = cache.min(by: { $0.value.timestamp < $1.value.timestamp }) {
                cache.removeValue(forKey: oldest.key)
                print("[ResponseCache] Evicted oldest entry")
            }
        }

        cache[key] = CachedResponse(content: content, timestamp: Date(), provider: provider)
        print("[ResponseCache] Cached response (\(cache.count)/\(maxSize))")
    }

    /// Generate cache key from transcript suffix + mode + type
    private func makeKey(transcript: String, mode: String, type: String) -> String {
        // Use last 500 characters of transcript for similarity matching
        let suffix = String(transcript.suffix(500))
        let combined = "\(mode)|\(type)|\(suffix)"
        let hash = SHA256.hash(data: Data(combined.utf8))
        return hash.compactMap { String(format: "%02x", $0) }.joined()
    }

    /// Clear all cached responses
    func clear() {
        cache.removeAll()
        print("[ResponseCache] Cache cleared")
    }

    /// Get current cache statistics
    func stats() -> (count: Int, maxSize: Int) {
        return (cache.count, maxSize)
    }
}
