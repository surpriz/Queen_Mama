import Foundation
import SwiftData
import Combine

// MARK: - SwiftData Save Helper
// Uses @MainActor to ensure ModelContext.save() runs on the same thread where context was created
// This prevents "ModelContext unbinding from main queue" warnings
@MainActor
private final class SwiftDataSaveHelper {
    private var saveTask: Task<Void, Never>?
    private let saveDebounceInterval: TimeInterval = 0.3

    func save(context: ModelContext?, immediate: Bool) {
        guard let context = context else { return }

        if immediate {
            // Cancel any pending debounced save
            saveTask?.cancel()
            saveTask = nil

            // Save immediately on main actor (where context was created)
            do {
                try context.save()
            } catch {
                print("[SessionManager] Error saving context: \(error)")
                // TRACKING: Report SwiftData save failures
                CrashReporter.shared.captureError(error, extras: [
                    "save_type": "immediate",
                    "context": "session_manager"
                ])
            }
        } else {
            // Cancel any pending debounced save
            saveTask?.cancel()

            // Schedule debounced save on main actor
            saveTask = Task { @MainActor [weak self] in
                guard let self = self else { return }

                do {
                    try await Task.sleep(nanoseconds: UInt64(self.saveDebounceInterval * 1_000_000_000))

                    // Check if task was cancelled during sleep
                    try Task.checkCancellation()

                    try context.save()
                } catch is CancellationError {
                    // Debounce cancelled by newer save request - this is expected
                } catch {
                    print("[SessionManager] Error saving context: \(error)")
                    // TRACKING: Report SwiftData save failures
                    CrashReporter.shared.captureError(error, extras: [
                        "save_type": "debounced",
                        "context": "session_manager"
                    ])
                }
            }
        }
    }
}

@MainActor
final class SessionManager: ObservableObject {
    // MARK: - Published Properties

    @Published var currentSession: Session?
    @Published var isSessionActive = false
    @Published var sessionDuration: TimeInterval = 0

    // MARK: - Private Properties

    private var modelContext: ModelContext?
    private var durationTimer: Timer?
    private let dbHelper = SwiftDataSaveHelper()

    // MARK: - Initialization

    init() {}

    func setModelContext(_ context: ModelContext) {
        self.modelContext = context
    }

    // MARK: - Session Management

    func startSession(title: String = "New Session", modeId: UUID? = nil, contact: Contact? = nil) -> Session {
        let session = Session(
            title: title,
            modeId: modeId,
            contactId: contact?.id,
            contact: contact
        )

        currentSession = session
        isSessionActive = true
        sessionDuration = 0

        // Save to SwiftData (immediate save for session start)
        modelContext?.insert(session)
        dbHelper.save(context: modelContext, immediate: true)

        // Start duration timer
        startDurationTimer()

        return session
    }

    @discardableResult
    func endSession() -> Session? {
        guard let session = currentSession else { return nil }

        session.endTime = Date()
        isSessionActive = false

        // Save final state (immediate save for session end)
        dbHelper.save(context: modelContext, immediate: true)

        // Stop timer
        stopDurationTimer()

        // Keep reference before clearing
        let finishedSession = session
        currentSession = nil

        return finishedSession
    }

    func updateTranscript(_ text: String) {
        currentSession?.transcript = text
        // Use debounced save - transcripts update frequently
        dbHelper.save(context: modelContext, immediate: false)
    }

    func addTranscriptEntry(speaker: String, text: String, isFinal: Bool) {
        guard let session = currentSession else { return }

        let entry = TranscriptEntry(
            speaker: speaker,
            text: text,
            isFinal: isFinal
        )

        session.entries.append(entry)

        // Update main transcript (skip speaker prefix when empty/disabled)
        if isFinal {
            if speaker.isEmpty {
                session.transcript += "\(text)\n"
            } else {
                session.transcript += "\(speaker): \(text)\n"
            }
        }

        // Use debounced save - entries arrive rapidly
        dbHelper.save(context: modelContext, immediate: false)
    }

    /// Returns the id of the most recently appended entry, useful to update it asynchronously
    /// (e.g. write back a translation result once it arrives).
    func addTranscriptEntryReturningID(speaker: String, text: String, isFinal: Bool) -> UUID? {
        guard let session = currentSession else { return nil }

        let entry = TranscriptEntry(
            speaker: speaker,
            text: text,
            isFinal: isFinal
        )

        session.entries.append(entry)

        if isFinal {
            if speaker.isEmpty {
                session.transcript += "\(text)\n"
            } else {
                session.transcript += "\(speaker): \(text)\n"
            }
        }

        dbHelper.save(context: modelContext, immediate: false)
        return entry.id
    }

    /// Writes an async translation result back onto an existing TranscriptEntry.
    /// Silently no-ops if the session was closed or the entry no longer exists.
    func updateTranscriptEntry(id: UUID, translation: String, sourceLang: String?, targetLang: String) {
        guard let session = currentSession else { return }
        guard let entry = session.entries.first(where: { $0.id == id }) else { return }
        entry.translatedText = translation
        entry.translationSourceLang = sourceLang
        entry.translationTargetLang = targetLang
        dbHelper.save(context: modelContext, immediate: false)
    }

    func setTitle(_ title: String) {
        currentSession?.title = title
        // Use immediate save for title (happens once per session)
        dbHelper.save(context: modelContext, immediate: true)
    }

    func setSummary(_ summary: String) {
        currentSession?.summary = summary
        // Use immediate save for summary (happens once per session)
        dbHelper.save(context: modelContext, immediate: true)
    }

    func setActionItems(_ items: [String]) {
        currentSession?.actionItems = items
        // Use immediate save for action items (happens once per session)
        dbHelper.save(context: modelContext, immediate: true)
    }

    func setMeetingCost(participantCount: Int, hourlyRate: Double, currency: String) {
        currentSession?.meetingParticipantCount = participantCount
        currentSession?.meetingHourlyRate = hourlyRate
        currentSession?.meetingCurrency = currency
        dbHelper.save(context: modelContext, immediate: true)
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
        // Use immediate save for delete operations
        dbHelper.save(context: modelContext, immediate: true)
    }

    // MARK: - Private Methods

    private func startDurationTimer() {
        durationTimer = Timer.scheduledTimer(withTimeInterval: 1.0, repeats: true) { [weak self] _ in
            guard let self else { return }
            Task { @MainActor [self] in
                self.sessionDuration += 1
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
