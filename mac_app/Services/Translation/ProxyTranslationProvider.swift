import Foundation

/// Routes translation requests through the QueenMama backend (`/api/proxy/translate`).
/// Mirrors the philosophy of `ProxyAIProvider`: no user-managed API key, billing centralized,
/// auth via existing bearer token.
final class ProxyTranslationProvider: TranslationProvider {
    let providerName = "DeepL (Proxy)"

    init() {}

    var isConfigured: Bool {
        MainActor.assumeIsolated {
            ProxyConfigManager.shared.isTranslationEnabled
        }
    }

    func translate(text: String, sourceLang: String?, targetLang: String) async throws -> TranslationResult {
        let start = Date()
        do {
            let response = try await ProxyAPIClient.shared.translate(
                text: text,
                sourceLang: sourceLang,
                targetLang: targetLang
            )
            let latency = Int(Date().timeIntervalSince(start) * 1000)
            return TranslationResult(
                translatedText: response.translatedText,
                detectedSourceLang: response.detectedSourceLang,
                targetLang: response.targetLang ?? targetLang,
                provider: providerName,
                latencyMs: latency,
                cached: false
            )
        } catch let error as ProxyError {
            switch error {
            case .notAuthenticated:
                throw TranslationError.notConfigured
            case .requestFailed(let code, _) where code == 429:
                throw TranslationError.rateLimited
            case .requestFailed(let code, let msg) where code == 402:
                throw TranslationError.quotaExceeded
            default:
                throw TranslationError.requestFailed(error.localizedDescription)
            }
        } catch {
            throw TranslationError.requestFailed(error.localizedDescription)
        }
    }
}
