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

    /// How long to keep system transcripts for word comparison (seconds).
    /// Must be long enough to cover the delay between system audio transcripts
    /// and mic diarized output (observed: 3-6 seconds).
    private let windowDuration: TimeInterval = 10.0

    /// If system audio produced a transcript within this window, suppress ALL mic transcripts.
    /// Mic diarized transcripts typically arrive 1-4s after system audio interims.
    private let temporalSuppressionWindow: TimeInterval = 3.5

    /// Minimum word overlap ratio to consider a mic transcript as bleed
    private let similarityThreshold: Double = 0.35

    /// Minimum word count to attempt word-based dedup (very short phrases are too ambiguous)
    private let minWordsForDedup = 2

    // MARK: - State

    private struct RecentEntry {
        let words: Set<String>
        let timestamp: Date
    }

    private var recentSystemTranscripts: [RecentEntry] = []

    /// Timestamp of the most recent system audio transcript (interim or final)
    private var lastSystemTranscriptTime: Date?

    /// All system audio words seen during this session (cumulative, never pruned).
    /// Used as a last-resort check for very delayed bleed.
    private var allSessionSystemWords: Set<String> = []

    // MARK: - Public API

    /// Record a system audio transcript for future bleed comparison.
    /// Call this EVERY time a system audio transcript (interim or final) is received.
    func addSystemTranscript(_ text: String) {
        let words = Self.normalizeWords(text)
        guard !words.isEmpty else { return }

        lastSystemTranscriptTime = Date()
        recentSystemTranscripts.append(RecentEntry(words: words, timestamp: Date()))
        allSessionSystemWords.formUnion(words)
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

        let micWords = Self.normalizeWords(text)
        guard micWords.count >= minWordsForDedup else { return false }

        // Layer 2: Word overlap against recent window (catches delayed bleed)
        for entry in recentSystemTranscripts {
            let commonWords = micWords.intersection(entry.words)
            let maxCount = max(micWords.count, entry.words.count)
            let similarity = Double(commonWords.count) / Double(maxCount)

            if similarity >= similarityThreshold {
                print("[Dedup] Word overlap (\(Int(similarity * 100))%): mic=\(micWords.count) words, sys=\(entry.words.count) words")
                return true
            }
        }

        // Layer 3: Session-wide word overlap (very delayed bleed)
        // If most of the mic words already appeared in system audio during this session,
        // it's almost certainly delayed bleed, not the user speaking.
        if !allSessionSystemWords.isEmpty {
            let commonWords = micWords.intersection(allSessionSystemWords)
            let ratio = Double(commonWords.count) / Double(micWords.count)
            if ratio >= 0.7 {
                print("[Dedup] Session-wide overlap (\(Int(ratio * 100))%): \(commonWords.count)/\(micWords.count) mic words seen in system audio")
                return true
            }
        }

        return false
    }

    /// Reset all state (call on session end)
    func reset() {
        recentSystemTranscripts.removeAll()
        lastSystemTranscriptTime = nil
        allSessionSystemWords.removeAll()
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
