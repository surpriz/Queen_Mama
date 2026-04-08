import Foundation

/// Filters microphone "bleed" — when the mic picks up remote participants' audio
/// from the speakers, causing the same speech to be transcribed on both streams.
///
/// Two-layer strategy:
/// 1. **Temporal suppression**: If system audio produced ANY transcript within a
///    recent window, ALL mic transcripts are considered bleed. When the interlocutor
///    is speaking, the mic only hears bleed (unless the user talks over them).
/// 2. **Word overlap**: For transcripts outside the suppression window, compare
///    words — if overlap > threshold, it's delayed bleed.
@MainActor
final class TranscriptDeduplicator {
    // MARK: - Configuration

    /// How long to keep system transcripts for word comparison (seconds)
    private let windowDuration: TimeInterval = 5.0

    /// If system audio produced a transcript within this window, suppress ALL mic transcripts.
    /// Covers the typical delay between system audio interim and mic diarized output.
    private let temporalSuppressionWindow: TimeInterval = 2.0

    /// Minimum word overlap ratio to consider a mic transcript as bleed
    private let similarityThreshold: Double = 0.4

    /// Minimum word count to attempt word-based dedup (very short phrases are too ambiguous)
    private let minWordsForDedup = 3

    // MARK: - State

    private struct RecentEntry {
        let words: Set<String>
        let timestamp: Date
    }

    private var recentSystemTranscripts: [RecentEntry] = []

    /// Timestamp of the most recent system audio transcript (interim or final)
    private var lastSystemTranscriptTime: Date?

    // MARK: - Public API

    /// Record a system audio transcript for future bleed comparison.
    /// Call this EVERY time a system audio transcript (interim or final) is received.
    func addSystemTranscript(_ text: String) {
        let words = Self.normalizeWords(text)
        guard !words.isEmpty else { return }

        lastSystemTranscriptTime = Date()
        recentSystemTranscripts.append(RecentEntry(words: words, timestamp: Date()))
        pruneOldEntries()
    }

    /// Check if a mic transcript is likely bleed from the speakers.
    /// Returns `true` if the text should be dropped.
    func isMicTranscriptBleed(_ text: String) -> Bool {
        pruneOldEntries()

        // Layer 1: Temporal suppression
        // If system audio was active recently, the mic is almost certainly hearing bleed
        if let lastTime = lastSystemTranscriptTime,
           Date().timeIntervalSince(lastTime) < temporalSuppressionWindow {
            let preview = text.prefix(60)
            print("[Dedup] Temporal suppression (system audio active \(String(format: "%.1f", Date().timeIntervalSince(lastTime)))s ago): \"\(preview)\"")
            return true
        }

        // Layer 2: Word overlap (catches delayed bleed outside the suppression window)
        let micWords = Self.normalizeWords(text)
        guard micWords.count >= minWordsForDedup else { return false }

        for entry in recentSystemTranscripts {
            let commonWords = micWords.intersection(entry.words)
            let maxCount = max(micWords.count, entry.words.count)
            let similarity = Double(commonWords.count) / Double(maxCount)

            if similarity >= similarityThreshold {
                print("[Dedup] Word overlap (\(Int(similarity * 100))%): mic=\(micWords.count) words, sys=\(entry.words.count) words")
                return true
            }
        }

        return false
    }

    /// Reset all state (call on session end)
    func reset() {
        recentSystemTranscripts.removeAll()
        lastSystemTranscriptTime = nil
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
