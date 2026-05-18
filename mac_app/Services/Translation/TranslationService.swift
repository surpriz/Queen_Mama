import Foundation
import Combine

/// Orchestrator for real-time translation of interlocutor transcripts.
/// Selects a provider (proxy primary, BYO-key fallback later), caches results,
/// and writes translations back into the active `TranscriptEntry` via `SessionManager`.
///
/// Translation is always best-effort and fire-and-forget — never blocks the original
/// transcript flow or downstream AI services.
@MainActor
final class TranslationService: ObservableObject {
    @Published private(set) var lastError: TranslationError?

    private let cache = TranslationCache()
    private let proxyProvider: TranslationProvider
    private weak var sessionManager: SessionManager?

    init(proxyProvider: TranslationProvider = ProxyTranslationProvider()) {
        self.proxyProvider = proxyProvider
    }

    func attach(sessionManager: SessionManager) {
        self.sessionManager = sessionManager
    }

    /// Active provider used for requests. Currently proxy-only; BYO-key path is reserved
    /// in the protocol but not exposed in v1 settings.
    private var activeProvider: TranslationProvider {
        proxyProvider.isConfigured ? proxyProvider : NoOpTranslationProvider()
    }

    /// Translate one transcript entry. Fire-and-forget — caller does not await meaningful state;
    /// the result lands on the SwiftData entry via `SessionManager.updateTranscriptEntry`.
    func translate(entryID: UUID, text: String, sourceLang: String?, targetLang: String) async {
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }

        // Effective source: nil if "auto" (let provider auto-detect)
        let effectiveSource = (sourceLang?.lowercased() == "auto" || sourceLang?.isEmpty == true)
            ? nil
            : sourceLang

        if let cached = cache.lookup(text: trimmed, sourceLang: effectiveSource, targetLang: targetLang) {
            sessionManager?.updateTranscriptEntry(
                id: entryID,
                translation: cached,
                sourceLang: effectiveSource,
                targetLang: targetLang
            )
            return
        }

        do {
            let result = try await activeProvider.translate(
                text: trimmed,
                sourceLang: effectiveSource,
                targetLang: targetLang
            )
            cache.store(
                text: trimmed,
                sourceLang: effectiveSource,
                targetLang: targetLang,
                translation: result.translatedText
            )
            sessionManager?.updateTranscriptEntry(
                id: entryID,
                translation: result.translatedText,
                sourceLang: result.detectedSourceLang ?? effectiveSource,
                targetLang: targetLang
            )
            // Clear prior error on success
            if lastError != nil {
                lastError = nil
            }
        } catch let error as TranslationError {
            lastError = error
            print("[TranslationService] Error: \(error.localizedDescription)")
        } catch {
            lastError = .requestFailed(error.localizedDescription)
            print("[TranslationService] Error: \(error)")
        }
    }

    func clearError() {
        lastError = nil
    }

    var providerStatus: String {
        activeProvider.isConfigured ? activeProvider.providerName : "Not available"
    }
}
