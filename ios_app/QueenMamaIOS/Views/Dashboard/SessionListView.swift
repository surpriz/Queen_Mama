import SwiftUI
import SwiftData

struct SessionListView: View {
    @EnvironmentObject var appState: AppState
    @EnvironmentObject var sessionManager: SessionManager
    @Environment(\.modelContext) private var modelContext

    @Query(sort: \Session.startTime, order: .reverse) private var sessions: [Session]

    @State private var searchText = ""
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
        List {
            if filteredSessions.isEmpty {
                ContentUnavailableView(
                    searchText.isEmpty ? "No Sessions" : "No Results",
                    systemImage: searchText.isEmpty ? "waveform.circle" : "magnifyingglass",
                    description: Text(searchText.isEmpty ? "Start a session to begin recording" : "Try a different search term")
                )
            } else {
                ForEach(filteredSessions) { session in
                    NavigationLink(value: session) {
                        SessionRowView(session: session)
                    }
                    .swipeActions(edge: .trailing) {
                        Button(role: .destructive) {
                            deleteSession(session)
                        } label: {
                            Label("Delete", systemImage: "trash")
                        }
                    }
                    .swipeActions(edge: .leading) {
                        ShareLink(item: session.transcript) {
                            Label("Share", systemImage: "square.and.arrow.up")
                        }
                        .tint(QMDesign.Colors.accent)
                    }
                }
            }
        }
        .navigationTitle("Sessions")
        .navigationDestination(for: Session.self) { session in
            SessionDetailView(session: session)
        }
        .searchable(text: $searchText, prompt: "Search sessions...")
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button {
                    appState.shouldShowContactPicker = true
                } label: {
                    Image(systemName: "plus.circle.fill")
                        .foregroundStyle(QMDesign.Colors.primaryGradient)
                }
            }
        }
        .sheet(isPresented: $appState.shouldShowContactPicker) {
            ContactPickerSheet(selectedContact: .constant(nil)) { contact in
                Task {
                    await appState.startSession(contact: contact)
                }
            }
        }
    }

    private func deleteSession(_ session: Session) {
        modelContext.delete(session)
        try? modelContext.save()
    }
}

// MARK: - Session Row View

struct SessionRowView: View {
    let session: Session

    var body: some View {
        VStack(alignment: .leading, spacing: QMDesign.Spacing.xs) {
            HStack {
                Text(session.title)
                    .font(QMDesign.Typography.headline)
                    .foregroundColor(QMDesign.Colors.textPrimary)
                    .lineLimit(1)

                Spacer()

                if session.endTime == nil {
                    StatusIndicator(status: .active, size: 8)
                }
            }

            HStack(spacing: QMDesign.Spacing.sm) {
                // Date
                Text(session.formattedDate)
                    .font(QMDesign.Typography.caption)
                    .foregroundColor(QMDesign.Colors.textTertiary)

                // Duration
                Text(session.formattedDuration)
                    .font(QMDesign.Typography.caption)
                    .foregroundColor(QMDesign.Colors.textSecondary)

                Spacer()

                // Contact badge
                if let contact = session.contact {
                    HStack(spacing: 4) {
                        Image(systemName: "person.fill")
                            .font(.system(size: 9))
                        Text(contact.fullName)
                            .font(QMDesign.Typography.captionSmall)
                    }
                    .foregroundColor(QMDesign.Colors.accent)
                    .padding(.horizontal, 6)
                    .padding(.vertical, 2)
                    .background(
                        Capsule()
                            .fill(QMDesign.Colors.accent.opacity(0.15))
                    )
                }
            }

            // Summary preview
            if let summary = session.summary, !summary.isEmpty {
                Text(summary)
                    .font(QMDesign.Typography.bodySmall)
                    .foregroundColor(QMDesign.Colors.textSecondary)
                    .lineLimit(2)
            }
        }
        .padding(.vertical, QMDesign.Spacing.xs)
    }
}
