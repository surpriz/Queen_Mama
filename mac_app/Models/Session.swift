import Foundation
import SwiftData

@Model
final class Session {
    var id: UUID
    var title: String
    var startTime: Date
    var endTime: Date?
    var transcript: String
    var summary: String?
    var actionItems: [String]
    var modeId: UUID?

    @Relationship(deleteRule: .cascade)
    var entries: [TranscriptEntry]

    init(
        id: UUID = UUID(),
        title: String = "New Session",
        startTime: Date = Date(),
        endTime: Date? = nil,
        transcript: String = "",
        summary: String? = nil,
        actionItems: [String] = [],
        modeId: UUID? = nil,
        entries: [TranscriptEntry] = []
    ) {
        self.id = id
        self.title = title
        self.startTime = startTime
        self.endTime = endTime
        self.transcript = transcript
        self.summary = summary
        self.actionItems = actionItems
        self.modeId = modeId
        self.entries = entries
    }

    var duration: TimeInterval? {
        guard let endTime else { return nil }
        return endTime.timeIntervalSince(startTime)
    }

    var formattedDuration: String {
        guard let duration else { return "In progress" }
        let minutes = Int(duration) / 60
        let seconds = Int(duration) % 60
        return String(format: "%d:%02d", minutes, seconds)
    }

    var formattedDate: String {
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        formatter.timeStyle = .short
        return formatter.string(from: startTime)
    }
}

@Model
final class TranscriptEntry {
    var id: UUID
    var timestamp: Date
    var speaker: String
    var text: String
    var isFinal: Bool

    init(
        id: UUID = UUID(),
        timestamp: Date = Date(),
        speaker: String = "Unknown",
        text: String = "",
        isFinal: Bool = false
    ) {
        self.id = id
        self.timestamp = timestamp
        self.speaker = speaker
        self.text = text
        self.isFinal = isFinal
    }

    var formattedTimestamp: String {
        let formatter = DateFormatter()
        formatter.timeStyle = .medium
        return formatter.string(from: timestamp)
    }
}

// MARK: - Talk Time Analysis

extension Session {
    /// Talk time statistics for the session
    struct TalkTimeStats {
        let myCharCount: Int
        let theirCharCount: Int
        let totalCharCount: Int

        var myPercentage: Double {
            guard totalCharCount > 0 else { return 0.0 }
            return Double(myCharCount) / Double(totalCharCount)
        }

        var theirPercentage: Double {
            guard totalCharCount > 0 else { return 0.0 }
            return Double(theirCharCount) / Double(totalCharCount)
        }

        var balanceState: BalanceState {
            guard totalCharCount > 0 else { return .noData }

            let myPct = myPercentage
            if myPct >= 0.4 && myPct <= 0.6 {
                return .balanced
            } else if myPct >= 0.3 && myPct <= 0.7 {
                return .slightImbalance
            } else {
                return .strongImbalance
            }
        }
    }

    enum BalanceState {
        case noData
        case balanced        // 40-60%: Green - Good listening balance
        case slightImbalance // 30-70%: Orange - Could listen more
        case strongImbalance // <30% or >70%: Red - Talking too much or too little
    }

    /// Computes talk time statistics from transcript entries
    var talkTimeStats: TalkTimeStats {
        var myChars = 0
        var theirChars = 0

        // Count characters by speaker (only final transcripts)
        for entry in entries where entry.isFinal {
            let charCount = entry.text.count

            if entry.speaker == "Moi" {
                myChars += charCount
            } else if entry.speaker == "Interlocuteur" {
                theirChars += charCount
            }
        }

        return TalkTimeStats(
            myCharCount: myChars,
            theirCharCount: theirChars,
            totalCharCount: myChars + theirChars
        )
    }
}
