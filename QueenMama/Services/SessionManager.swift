import Foundation
import SwiftData
import Combine

@MainActor
final class SessionManager: ObservableObject {
    // MARK: - Published Properties

    @Published var currentSession: Session?
    @Published var isSessionActive = false
    @Published var sessionDuration: TimeInterval = 0

    // MARK: - Private Properties

    private var modelContext: ModelContext?
    private var durationTimer: Timer?

    // MARK: - Initialization

    init() {}

    func setModelContext(_ context: ModelContext) {
        self.modelContext = context
    }

    // MARK: - Session Management

    func startSession(title: String = "New Session", modeId: UUID? = nil) -> Session {
        let session = Session(
            title: title,
            modeId: modeId
        )

        currentSession = session
        isSessionActive = true
        sessionDuration = 0

        // Save to SwiftData
        modelContext?.insert(session)
        try? modelContext?.save()

        // Start duration timer
        startDurationTimer()

        return session
    }

    func endSession() {
        guard let session = currentSession else { return }

        session.endTime = Date()
        isSessionActive = false

        // Save final state
        try? modelContext?.save()

        // Stop timer
        stopDurationTimer()

        currentSession = nil
    }

    func updateTranscript(_ text: String) {
        currentSession?.transcript = text
        try? modelContext?.save()
    }

    func addTranscriptEntry(speaker: String, text: String, isFinal: Bool) {
        guard let session = currentSession else { return }

        let entry = TranscriptEntry(
            speaker: speaker,
            text: text,
            isFinal: isFinal
        )

        session.entries.append(entry)

        // Update main transcript
        if isFinal {
            session.transcript += "\(speaker): \(text)\n"
        }

        try? modelContext?.save()
    }

    func setSummary(_ summary: String) {
        currentSession?.summary = summary
        try? modelContext?.save()
    }

    func setActionItems(_ items: [String]) {
        currentSession?.actionItems = items
        try? modelContext?.save()
    }

    // MARK: - Session Queries

    func fetchAllSessions() -> [Session] {
        let descriptor = FetchDescriptor<Session>(
            sortBy: [SortDescriptor(\.startTime, order: .reverse)]
        )

        do {
            return try modelContext?.fetch(descriptor) ?? []
        } catch {
            print("Failed to fetch sessions: \(error)")
            return []
        }
    }

    func fetchRecentSessions(limit: Int = 10) -> [Session] {
        var descriptor = FetchDescriptor<Session>(
            sortBy: [SortDescriptor(\.startTime, order: .reverse)]
        )
        descriptor.fetchLimit = limit

        do {
            return try modelContext?.fetch(descriptor) ?? []
        } catch {
            print("Failed to fetch recent sessions: \(error)")
            return []
        }
    }

    func searchSessions(query: String) -> [Session] {
        let predicate = #Predicate<Session> { session in
            session.title.localizedStandardContains(query) ||
            session.transcript.localizedStandardContains(query)
        }

        let descriptor = FetchDescriptor<Session>(
            predicate: predicate,
            sortBy: [SortDescriptor(\.startTime, order: .reverse)]
        )

        do {
            return try modelContext?.fetch(descriptor) ?? []
        } catch {
            print("Failed to search sessions: \(error)")
            return []
        }
    }

    func deleteSession(_ session: Session) {
        modelContext?.delete(session)
        try? modelContext?.save()
    }

    // MARK: - Private Methods

    private func startDurationTimer() {
        durationTimer = Timer.scheduledTimer(withTimeInterval: 1.0, repeats: true) { [weak self] _ in
            Task { @MainActor in
                self?.sessionDuration += 1
            }
        }
    }

    private func stopDurationTimer() {
        durationTimer?.invalidate()
        durationTimer = nil
    }

    // MARK: - Formatting Helpers

    var formattedDuration: String {
        let minutes = Int(sessionDuration) / 60
        let seconds = Int(sessionDuration) % 60
        return String(format: "%02d:%02d", minutes, seconds)
    }
}

// MARK: - Export Functionality

extension SessionManager {
    func exportSession(_ session: Session, format: ExportFormat) -> String {
        switch format {
        case .markdown:
            return exportAsMarkdown(session)
        case .plainText:
            return exportAsPlainText(session)
        case .json:
            return exportAsJSON(session)
        }
    }

    private func exportAsMarkdown(_ session: Session) -> String {
        var output = "# \(session.title)\n\n"
        output += "**Date:** \(session.formattedDate)\n"
        output += "**Duration:** \(session.formattedDuration)\n\n"

        if let summary = session.summary {
            output += "## Summary\n\n\(summary)\n\n"
        }

        if !session.actionItems.isEmpty {
            output += "## Action Items\n\n"
            for item in session.actionItems {
                output += "- [ ] \(item)\n"
            }
            output += "\n"
        }

        output += "## Transcript\n\n"
        output += session.transcript

        return output
    }

    private func exportAsPlainText(_ session: Session) -> String {
        var output = "\(session.title)\n"
        output += "Date: \(session.formattedDate)\n"
        output += "Duration: \(session.formattedDuration)\n\n"

        if let summary = session.summary {
            output += "Summary:\n\(summary)\n\n"
        }

        if !session.actionItems.isEmpty {
            output += "Action Items:\n"
            for item in session.actionItems {
                output += "- \(item)\n"
            }
            output += "\n"
        }

        output += "Transcript:\n"
        output += session.transcript

        return output
    }

    private func exportAsJSON(_ session: Session) -> String {
        let dict: [String: Any] = [
            "id": session.id.uuidString,
            "title": session.title,
            "startTime": ISO8601DateFormatter().string(from: session.startTime),
            "endTime": session.endTime.map { ISO8601DateFormatter().string(from: $0) } as Any,
            "transcript": session.transcript,
            "summary": session.summary as Any,
            "actionItems": session.actionItems
        ]

        if let data = try? JSONSerialization.data(withJSONObject: dict, options: .prettyPrinted),
           let string = String(data: data, encoding: .utf8) {
            return string
        }

        return "{}"
    }

    enum ExportFormat {
        case markdown
        case plainText
        case json
    }
}
