import Foundation

// MARK: - Translation Provider Protocol

protocol TranslationProvider: Sendable {
    var providerName: String { get }
    var isConfigured: Bool { get }

    func translate(text: String, sourceLang: String?, targetLang: String) async throws -> TranslationResult
}

// MARK: - Result

struct TranslationResult: Sendable {
    let translatedText: String
    let detectedSourceLang: String?
    let targetLang: String
    let provider: String
    let latencyMs: Int
    let cached: Bool

    init(
        translatedText: String,
        detectedSourceLang: String? = nil,
        targetLang: String,
        provider: String,
        latencyMs: Int,
        cached: Bool = false
    ) {
        self.translatedText = translatedText
        self.detectedSourceLang = detectedSourceLang
        self.targetLang = targetLang
        self.provider = provider
        self.latencyMs = latencyMs
        self.cached = cached
    }
}

// MARK: - Errors

enum TranslationError: LocalizedError, Sendable {
    case notConfigured
    case rateLimited
    case quotaExceeded
    case unsupportedLanguage(String)
    case requestFailed(String)
    case invalidResponse
    case timeout

    var errorDescription: String? {
        switch self {
        case .notConfigured:
            return String(localized: "settings.translation.provider.notConfigured")
        case .rateLimited:
            return String(localized: "settings.translation.error.rateLimited")
        case .quotaExceeded:
            return String(localized: "settings.translation.error.quotaExceeded")
        case .unsupportedLanguage(let lang):
            return "Unsupported language: \(lang)"
        case .requestFailed(let message):
            return "Translation failed: \(message)"
        case .invalidResponse:
            return "Invalid translation response"
        case .timeout:
            return "Translation timed out"
        }
    }
}

// MARK: - No-op Provider (fallback when nothing configured)

struct NoOpTranslationProvider: TranslationProvider {
    let providerName = "None"
    let isConfigured = false

    func translate(text: String, sourceLang: String?, targetLang: String) async throws -> TranslationResult {
        throw TranslationError.notConfigured
    }
}
