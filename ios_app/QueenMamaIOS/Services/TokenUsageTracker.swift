import Foundation

/// Tracks token usage across AI providers for cost awareness
/// Enables users to see estimated costs and optimize their usage
@MainActor
final class TokenUsageTracker: ObservableObject {
    static let shared = TokenUsageTracker()

    @Published var sessionUsage = Usage()
    @Published var lifetimeUsage: LifetimeUsage

    struct Usage {
        var inputTokens: Int = 0
        var outputTokens: Int = 0
        var cachedTokens: Int = 0
        var requestCount: Int = 0

        /// Estimated cost in USD based on Claude Sonnet 4.5 pricing
        /// Input: $3/M tokens, Output: $15/M tokens, Cached: $0.30/M tokens (90% discount)
        var estimatedCostUSD: Double {
            let uncachedInputTokens = inputTokens - cachedTokens
            let inputCost = Double(uncachedInputTokens) * 0.000003    // $3/M
            let cachedCost = Double(cachedTokens) * 0.0000003        // $0.30/M (90% off)
            let outputCost = Double(outputTokens) * 0.000015          // $15/M
            return inputCost + cachedCost + outputCost
        }

        var formattedCost: String {
            String(format: "$%.4f", estimatedCostUSD)
        }

        var cacheHitRate: Double {
            guard inputTokens > 0 else { return 0 }
            return Double(cachedTokens) / Double(inputTokens) * 100
        }
    }

    struct LifetimeUsage: Codable {
        var totalInputTokens: Int = 0
        var totalOutputTokens: Int = 0
        var totalCachedTokens: Int = 0
        var totalRequests: Int = 0
        var totalCostUSD: Double = 0
    }

    private let lifetimeKey = "lifetime_token_usage"

    private init() {
        // Load lifetime stats from UserDefaults
        if let data = UserDefaults.standard.data(forKey: lifetimeKey),
           let usage = try? JSONDecoder().decode(LifetimeUsage.self, from: data) {
            lifetimeUsage = usage
        } else {
            lifetimeUsage = LifetimeUsage()
        }
    }

    /// Record token usage from an AI response
    func record(input: Int, output: Int, cached: Int = 0, provider: AIProviderType? = nil) {
        sessionUsage.inputTokens += input
        sessionUsage.outputTokens += output
        sessionUsage.cachedTokens += cached
        sessionUsage.requestCount += 1

        // Update lifetime stats
        lifetimeUsage.totalInputTokens += input
        lifetimeUsage.totalOutputTokens += output
        lifetimeUsage.totalCachedTokens += cached
        lifetimeUsage.totalRequests += 1
        lifetimeUsage.totalCostUSD += sessionUsage.estimatedCostUSD

        saveLifetimeUsage()

        print("[TokenTracker] Request #\(sessionUsage.requestCount): in=\(input) out=\(output) cached=\(cached) cost=\(sessionUsage.formattedCost)")
    }

    /// Reset session usage (call when starting a new session)
    func resetSession() {
        sessionUsage = Usage()
        print("[TokenTracker] Session reset")
    }

    /// Get formatted lifetime cost
    var formattedLifetimeCost: String {
        String(format: "$%.2f", lifetimeUsage.totalCostUSD)
    }

    private func saveLifetimeUsage() {
        if let data = try? JSONEncoder().encode(lifetimeUsage) {
            UserDefaults.standard.set(data, forKey: lifetimeKey)
        }
    }
}
