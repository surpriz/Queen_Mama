import Foundation

/// Filters microphone "bleed" — when the mic picks up remote participants' audio
/// from the speakers, causing the same speech to be transcribed on both streams.
///
/// Strategy: Keep a rolling window of recent system audio transcripts. When a mic
/// transcript arrives, compare it against the window. If word overlap exceeds the
/// threshold, it's bleed (the mic heard the speakers) → drop it.
@MainActor
final class TranscriptDeduplicator {
    // MARK: - Configuration

    /// How long to keep system transcripts for comparison (seconds)
    private let windowDuration: TimeInterval = 5.0

    /// Minimum word overlap ratio to consider a mic transcript as bleed
    private let similarityThreshold: Double = 0.4

    /// Minimum word count to attempt dedup (very short phrases are too ambiguous)
    private let minWordsForDedup = 3

    // MARK: - State

    private struct RecentEntry {
        let words: Set<String>
        let timestamp: Date
    }

    private var recentSystemTranscripts: [RecentEntry] = []

    // MARK: - Public API

    /// Record a system audio transcript for future bleed comparison.
    /// Call this EVERY time a system audio transcript is received.
    func addSystemTranscript(_ text: String) {
        let words = Self.normalizeWords(text)
        guard !words.isEmpty else { return }

        recentSystemTranscripts.append(RecentEntry(words: words, timestamp: Date()))
        pruneOldEntries()
    }

    /// Check if a mic transcript is likely bleed from the speakers.
    /// Returns `true` if the text matches a recent system audio transcript → should be dropped.
    func isMicTranscriptBleed(_ text: String) -> Bool {
        pruneOldEntries()

        let micWords = Self.normalizeWords(text)

        // Don't dedup very short phrases — too ambiguous
        guard micWords.count >= minWordsForDedup else { return false }

        for entry in recentSystemTranscripts {
            let commonWords = micWords.intersection(entry.words)
            let maxCount = max(micWords.count, entry.words.count)
            let similarity = Double(commonWords.count) / Double(maxCount)

            if similarity >= similarityThreshold {
                print("[Dedup] Bleed detected (\(Int(similarity * 100))% overlap): mic=\(micWords.count) words, sys=\(entry.words.count) words")
                return true
            }
        }

        return false
    }

    /// Reset all state (call on session end)
    func reset() {
        recentSystemTranscripts.removeAll()
    }

    // MARK: - Private

    private func pruneOldEntries() {
        let cutoff = Date().addingTimeInterval(-windowDuration)
        recentSystemTranscripts.removeAll { $0.timestamp < cutoff }
    }

    /// Normalize text into a set of lowercase words, stripping punctuation
    private static func normalizeWords(_ text: String) -> Set<String> {
        let cleaned = text.lowercased()
            .components(separatedBy: CharacterSet.alphanumerics.inverted)
            .filter { $0.count > 1 } // Drop single-char noise
        return Set(cleaned)
    }
}
