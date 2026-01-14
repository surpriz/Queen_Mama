import SwiftUI
import SwiftData

struct SessionListView: View {
    @Binding var searchText: String
    @EnvironmentObject var sessionManager: SessionManager
    @Environment(\.modelContext) private var modelContext

    @Query(sort: \Session.startTime, order: .reverse)
    private var sessions: [Session]

    @State private var selectedSession: Session?

    private var filteredSessions: [Session] {
        if searchText.isEmpty {
            return sessions
        }
        return sessions.filter { session in
            session.title.localizedCaseInsensitiveContains(searchText) ||
            session.transcript.localizedCaseInsensitiveContains(searchText)
        }
    }

    var body: some View {
        HSplitView {
            // Session List
            VStack(spacing: 0) {
                // Search Bar
                HStack {
                    Image(systemName: "magnifyingglass")
                        .foregroundColor(.secondary)
                    TextField("Search sessions...", text: $searchText)
                        .textFieldStyle(.plain)
                }
                .padding(10)
                .background(Color.gray.opacity(0.1))

                // Session List
                List(selection: $selectedSession) {
                    ForEach(filteredSessions) { session in
                        SessionRowView(session: session)
                            .tag(session)
                            .contextMenu {
                                Button("Export as Markdown") {
                                    exportSession(session, format: .markdown)
                                }
                                Button("Export as Text") {
                                    exportSession(session, format: .plainText)
                                }
                                Divider()
                                Button("Delete", role: .destructive) {
                                    deleteSession(session)
                                }
                            }
                    }
                }
                .listStyle(.inset)
            }
            .frame(minWidth: 280, maxWidth: 350)

            // Session Detail
            if let session = selectedSession {
                SessionDetailView(session: session)
            } else {
                ContentUnavailableView(
                    "No Session Selected",
                    systemImage: "doc.text",
                    description: Text("Select a session to view its details")
                )
            }
        }
    }

    private func exportSession(_ session: Session, format: SessionManager.ExportFormat) {
        let content = sessionManager.exportSession(session, format: format)

        let savePanel = NSSavePanel()
        savePanel.allowedContentTypes = format == .markdown ? [.text] : [.plainText]
        savePanel.nameFieldStringValue = "\(session.title).\(format == .markdown ? "md" : "txt")"

        if savePanel.runModal() == .OK, let url = savePanel.url {
            try? content.write(to: url, atomically: true, encoding: .utf8)
        }
    }

    private func deleteSession(_ session: Session) {
        if selectedSession == session {
            selectedSession = nil
        }
        sessionManager.deleteSession(session)
    }
}

// MARK: - Session Row View

struct SessionRowView: View {
    let session: Session

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack {
                Text(session.title)
                    .font(.headline)
                    .lineLimit(1)

                Spacer()

                if session.endTime == nil {
                    Circle()
                        .fill(Color.green)
                        .frame(width: 8, height: 8)
                }
            }

            HStack {
                Text(session.formattedDate)
                    .font(.caption)
                    .foregroundColor(.secondary)

                Text("•")
                    .foregroundColor(.secondary)

                Text(session.formattedDuration)
                    .font(.caption)
                    .foregroundColor(.secondary)
            }

            if !session.transcript.isEmpty {
                Text(session.transcript.prefix(100) + "...")
                    .font(.caption)
                    .foregroundColor(.secondary)
                    .lineLimit(2)
            }
        }
        .padding(.vertical, 4)
    }
}

// MARK: - Session Detail View

struct SessionDetailView: View {
    let session: Session

    @State private var showingTranscript = true

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                // Header
                VStack(alignment: .leading, spacing: 8) {
                    Text(session.title)
                        .font(.title)
                        .fontWeight(.bold)

                    HStack(spacing: 16) {
                        Label(session.formattedDate, systemImage: "calendar")
                        Label(session.formattedDuration, systemImage: "clock")
                    }
                    .font(.subheadline)
                    .foregroundColor(.secondary)
                }

                Divider()

                // Summary
                if let summary = session.summary {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Summary")
                            .font(.headline)

                        Text(summary)
                            .font(.body)
                    }
                }

                // Action Items
                if !session.actionItems.isEmpty {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Action Items")
                            .font(.headline)

                        ForEach(session.actionItems, id: \.self) { item in
                            HStack(alignment: .top, spacing: 8) {
                                Image(systemName: "circle")
                                    .font(.caption)
                                    .foregroundColor(.blue)
                                Text(item)
                            }
                        }
                    }
                }

                // Transcript
                VStack(alignment: .leading, spacing: 8) {
                    HStack {
                        Text("Transcript")
                            .font(.headline)

                        Spacer()

                        Button(action: { showingTranscript.toggle() }) {
                            Image(systemName: showingTranscript ? "chevron.up" : "chevron.down")
                        }
                        .buttonStyle(.plain)
                    }

                    if showingTranscript {
                        Text(session.transcript)
                            .font(.body)
                            .textSelection(.enabled)
                            .padding()
                            .background(Color.gray.opacity(0.1))
                            .clipShape(RoundedRectangle(cornerRadius: 8))
                    }
                }
            }
            .padding()
        }
    }
}
