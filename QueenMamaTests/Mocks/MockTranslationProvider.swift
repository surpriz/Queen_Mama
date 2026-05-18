import Foundation
@testable import QueenMama

/// Configurable test double for the TranslationProvider protocol.
final class MockTranslationProvider: TranslationProvider, @unchecked Sendable {
    let providerName = "Mock"
    var isConfigured: Bool = true

    /// Either return this fixed translation or transform input.
    var stubResult: TranslationResult?
    var transform: (@Sendable (String) -> String)?
    var injectedError: TranslationError?
    var artificialLatencyMs: Int = 0

    private(set) var callCount: Int = 0
    private(set) var lastText: String?
    private(set) var lastSourceLang: String?
    private(set) var lastTargetLang: String?

    func translate(text: String, sourceLang: String?, targetLang: String) async throws -> TranslationResult {
        callCount += 1
        lastText = text
        lastSourceLang = sourceLang
        lastTargetLang = targetLang

        if artificialLatencyMs > 0 {
            try await Task.sleep(nanoseconds: UInt64(artificialLatencyMs) * 1_000_000)
        }
        if let err = injectedError {
            throw err
        }
        if let r = stubResult {
            return r
        }
        let translated = transform?(text) ?? "[\(targetLang)] \(text)"
        return TranslationResult(
            translatedText: translated,
            detectedSourceLang: sourceLang,
            targetLang: targetLang,
            provider: providerName,
            latencyMs: artificialLatencyMs,
            cached: false
        )
    }
}
