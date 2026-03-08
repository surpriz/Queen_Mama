//
//  SessionListView.swift
//  QueenMama
//
//  Modern session list with card-based layout
//

import SwiftUI
import SwiftData

struct SessionListView: View {
    @Binding var searchText: String
    @EnvironmentObject var sessionManager: SessionManager
    @Environment(\.modelContext) private var modelContext
    @StateObject private var syncManager = SyncManager.shared

    @Query(sort: \Session.startTime, order: .reverse)
    private var sessions: [Session]

    @State private var selectedSession: Session?
    @State private var sessionToDelete: Session?
    @State private var showingDeleteConfirmation = false
    @State private var isSelectionMode = false
    @State private var selectedSessionIds: Set<UUID> = []
    @State private var showingBulkDeleteConfirmation = false
    @State private var showingDeleteAllConfirmation = false

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
                // Modern Search Bar
                ModernSearchBar(searchText: $searchText)

                // Sync buttons (when sync is available)
                if syncManager.canSync {
                    HStack(spacing: QMDesign.Spacing.md) {
                        // Refresh button (pull remote sessions + reconcile deletions)
                        Button(action: {
                            Task {
                                // Get current local session IDs for deduplication
                                let localSessionIds = Set(sessions.map { $0.id.uuidString })

                                // Pull sessions from server (bidirectional sync)
                                let importedCount = await syncManager.pullRemoteSessions(localSessionIds: localSessionIds)
                                if importedCount > 0 {
                                    print("[SessionList] Pulled \(importedCount) new sessions")
                                }

                                // Also reconcile any remote deletions
                                await syncManager.reconcileRemoteDeletions()
                            }
                        }) {
                            HStack(spacing: 4) {
                                if syncManager.isSyncing {
                                    ProgressView()
                                        .scaleEffect(0.6)
                                        .frame(width: 12, height: 12)
                                } else {
                                    Image(systemName: "arrow.clockwise")
                                        .font(.system(size: 11))
                                }
                                Text(String(localized: "sessions.button.refresh"))
                                    .font(QMDesign.Typography.captionSmall)
                            }
                            .foregroundColor(QMDesign.Colors.textSecondary)
                        }
                        .buttonStyle(.plain)
                        .disabled(syncManager.isSyncing)
                        .help(String(localized: "sessions.help.pullSessions"))

                        Spacer()

                        // Sync All button (upload local sessions)
                        Button(action: {
                            syncManager.syncAllSessions(Array(filteredSessions))
                        }) {
                            HStack(spacing: 4) {
                                if syncManager.isSyncing {
                                    ProgressView()
                                        .scaleEffect(0.6)
                                        .frame(width: 12, height: 12)
                                } else {
                                    Image(systemName: "arrow.triangle.2.circlepath")
                                        .font(.system(size: 11))
                                }
                                Text(String(localized: "sessions.button.syncAll"))
                                    .font(QMDesign.Typography.captionSmall)
                            }
                            .foregroundColor(QMDesign.Colors.accent)
                        }
                        .buttonStyle(.plain)
                        .disabled(syncManager.isSyncing)
                        .help(String(localized: "sessions.help.uploadSessions"))
                    }
                    .padding(.horizontal, QMDesign.Spacing.sm)
                    .padding(.bottom, QMDesign.Spacing.xs)
                }

                // Bulk actions toolbar
                HStack(spacing: QMDesign.Spacing.sm) {
                    if isSelectionMode {
                        // Select All / Deselect All
                        Button(action: {
                            if selectedSessionIds.count == filteredSessions.count {
                                selectedSessionIds.removeAll()
                            } else {
                                selectedSessionIds = Set(filteredSessions.map { $0.id })
                            }
                        }) {
                            Text(selectedSessionIds.count == filteredSessions.count ? String(localized: "sessions.button.deselectAll") : String(localized: "sessions.button.selectAll"))
                                .font(QMDesign.Typography.captionSmall)
                                .foregroundColor(QMDesign.Colors.accent)
                        }
                        .buttonStyle(.plain)

                        Spacer()

                        // Delete selected
                        if !selectedSessionIds.isEmpty {
                            Button(action: {
                                showingBulkDeleteConfirmation = true
                            }) {
                                HStack(spacing: 4) {
                                    Image(systemName: "trash")
                                        .font(.system(size: 11))
                                    Text(String(localized: "sessions.button.deleteCount \(selectedSessionIds.count)"))
                                        .font(QMDesign.Typography.captionSmall)
                                }
                                .foregroundColor(QMDesign.Colors.error)
                            }
                            .buttonStyle(.plain)
                        }

                        // Cancel
                        Button(action: {
                            isSelectionMode = false
                            selectedSessionIds.removeAll()
                        }) {
                            Text(String(localized: "sessions.button.cancel"))
                                .font(QMDesign.Typography.captionSmall)
                                .foregroundColor(QMDesign.Colors.textSecondary)
                        }
                        .buttonStyle(.plain)
                    } else {
                        // Enter selection mode
                        Button(action: {
                            isSelectionMode = true
                            selectedSessionIds.removeAll()
                        }) {
                            HStack(spacing: 4) {
                                Image(systemName: "checkmark.circle")
                                    .font(.system(size: 11))
                                Text(String(localized: "sessions.button.select"))
                                    .font(QMDesign.Typography.captionSmall)
                            }
                            .foregroundColor(QMDesign.Colors.textSecondary)
                        }
                        .buttonStyle(.plain)

                        Spacer()

                        // Delete All
                        Button(action: {
                            showingDeleteAllConfirmation = true
                        }) {
                            HStack(spacing: 4) {
                                Image(systemName: "trash")
                                    .font(.system(size: 11))
                                Text(String(localized: "sessions.button.deleteAll"))
                                    .font(QMDesign.Typography.captionSmall)
                            }
                            .foregroundColor(QMDesign.Colors.error)
                        }
                        .buttonStyle(.plain)
                        .disabled(filteredSessions.isEmpty)
                    }
                }
                .padding(.horizontal, QMDesign.Spacing.sm)
                .padding(.bottom, QMDesign.Spacing.xs)

                // Session List
                ScrollView {
                    LazyVStack(spacing: QMDesign.Spacing.xs) {
                        ForEach(filteredSessions) { session in
                            HStack(spacing: QMDesign.Spacing.xs) {
                                if isSelectionMode {
                                    Button(action: {
                                        toggleSelection(session)
                                    }) {
                                        Image(systemName: selectedSessionIds.contains(session.id) ? "checkmark.circle.fill" : "circle")
                                            .font(.system(size: 18))
                                            .foregroundColor(selectedSessionIds.contains(session.id) ? QMDesign.Colors.accent : QMDesign.Colors.textTertiary)
                                    }
                                    .buttonStyle(.plain)
                                }

                                ModernSessionCard(
                                    session: session,
                                    isSelected: !isSelectionMode && selectedSession == session,
                                    syncStatus: syncManager.getSyncStatus(for: session.id),
                                    canSync: syncManager.canSync,
                                    action: {
                                        if isSelectionMode {
                                            toggleSelection(session)
                                        } else {
                                            selectedSession = session
                                        }
                                    },
                                    onDelete: {
                                        sessionToDelete = session
                                        showingDeleteConfirmation = true
                                    },
                                    onSync: session.endTime != nil ? {
                                        syncManager.queueExistingSession(session)
                                    } : nil
                                )
                            .contextMenu {
                                Button {
                                    exportSession(session, format: .markdown)
                                } label: {
                                    Label(String(localized: "sessions.export.markdown"), systemImage: "doc.text")
                                }

                                Button {
                                    exportSession(session, format: .plainText)
                                } label: {
                                    Label(String(localized: "sessions.export.text"), systemImage: "doc.plaintext")
                                }

                                Divider()

                                Button(role: .destructive) {
                                    deleteSession(session)
                                } label: {
                                    Label(String(localized: "sessions.button.delete"), systemImage: "trash")
                                }
                            }
                            } // HStack
                        }
                    }
                    .padding(QMDesign.Spacing.sm)
                }

                // Empty state
                if filteredSessions.isEmpty {
                    EmptySessionsView(isFiltered: !searchText.isEmpty)
                }
            }
            .frame(minWidth: 300, maxWidth: 380)
            .background(QMDesign.Colors.backgroundSecondary)

            // Session Detail
            if let session = selectedSession {
                ModernSessionDetailView(session: session)
            } else {
                EmptySessionDetailView()
            }
        }
        .confirmationDialog(
            String(localized: "sessions.dialog.deleteTitle"),
            isPresented: $showingDeleteConfirmation,
            presenting: sessionToDelete
        ) { session in
            Button(String(localized: "sessions.button.delete"), role: .destructive) {
                deleteSession(session)
            }
            Button(String(localized: "sessions.button.cancel"), role: .cancel) {}
        } message: { session in
            Text(String(localized: "sessions.dialog.deleteMessage \(session.title)"))
        }
        .confirmationDialog(
            String(localized: "sessions.dialog.deleteSelectedTitle"),
            isPresented: $showingBulkDeleteConfirmation
        ) {
            Button(String(localized: "sessions.dialog.deleteSelectedButton \(selectedSessionIds.count)"), role: .destructive) {
                bulkDeleteSelectedSessions()
            }
            Button(String(localized: "sessions.button.cancel"), role: .cancel) {}
        } message: {
            Text(String(localized: "sessions.dialog.deleteSelectedMessage \(selectedSessionIds.count)"))
        }
        .confirmationDialog(
            String(localized: "sessions.dialog.deleteAllTitle"),
            isPresented: $showingDeleteAllConfirmation
        ) {
            Button(String(localized: "sessions.dialog.deleteAllButton \(filteredSessions.count)"), role: .destructive) {
                bulkDeleteAllSessions()
            }
            Button(String(localized: "sessions.button.cancel"), role: .cancel) {}
        } message: {
            Text(String(localized: "sessions.dialog.deleteAllMessage \(filteredSessions.count)"))
        }
        .onAppear {
            // Set up callback to insert imported sessions into SwiftData
            syncManager.onSessionsImported = { importedSessions in
                for session in importedSessions {
                    modelContext.insert(session)
                }
                try? modelContext.save()
                print("[SessionList] Inserted \(importedSessions.count) imported sessions")
            }

            // Trigger auto-sync of unsynced sessions on view load
            if syncManager.canSync {
                Task {
                    await syncManager.performInitialSync(Array(sessions))
                }
            }
        }
        .onChange(of: syncManager.sessionIdsToDeleteRemotely) { _, idsToDelete in
            // Handle remote deletions
            if !idsToDelete.isEmpty {
                processRemoteDeletions(idsToDelete)
            }
        }
    }

    /// Process sessions that were deleted on the web dashboard
    private func processRemoteDeletions(_ idsToDelete: Set<String>) {
        for session in sessions {
            if idsToDelete.contains(session.id.uuidString) {
                print("[SessionList] Deleting locally: \(session.title) (deleted remotely)")
                if selectedSession == session {
                    selectedSession = nil
                }
                sessionManager.deleteSession(session)
            }
        }
        syncManager.clearRemoteDeletions()
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

        // Delete from remote server first (if synced)
        let sessionId = session.id
        Task {
            await syncManager.deleteRemoteSession(sessionId)
        }

        // Delete locally
        sessionManager.deleteSession(session)
    }

    private func toggleSelection(_ session: Session) {
        if selectedSessionIds.contains(session.id) {
            selectedSessionIds.remove(session.id)
        } else {
            selectedSessionIds.insert(session.id)
        }
    }

    private func bulkDeleteSelectedSessions() {
        let sessionsToDelete = sessions.filter { selectedSessionIds.contains($0.id) }
        for session in sessionsToDelete {
            deleteSession(session)
        }
        selectedSessionIds.removeAll()
        isSelectionMode = false
    }

    private func bulkDeleteAllSessions() {
        let sessionsToDelete = Array(filteredSessions)
        for session in sessionsToDelete {
            deleteSession(session)
        }
    }
}

// MARK: - Modern Search Bar

struct ModernSearchBar: View {
    @Binding var searchText: String
    @FocusState private var isFocused: Bool

    var body: some View {
        HStack(spacing: QMDesign.Spacing.xs) {
            Image(systemName: "magnifyingglass")
                .font(.system(size: 13))
                .foregroundColor(isFocused ? QMDesign.Colors.accent : QMDesign.Colors.textTertiary)

            TextField(String(localized: "sessions.search.placeholder"), text: $searchText)
                .textFieldStyle(.plain)
                .font(QMDesign.Typography.bodySmall)
                .focused($isFocused)

            if !searchText.isEmpty {
                Button(action: { searchText = "" }) {
                    Image(systemName: "xmark.circle.fill")
                        .font(.system(size: 12))
                        .foregroundColor(QMDesign.Colors.textTertiary)
                }
                .buttonStyle(.plain)
            }
        }
        .padding(QMDesign.Spacing.sm)
        .background(
            RoundedRectangle(cornerRadius: QMDesign.Radius.md)
                .fill(QMDesign.Colors.surfaceLight)
                .overlay(
                    RoundedRectangle(cornerRadius: QMDesign.Radius.md)
                        .stroke(isFocused ? QMDesign.Colors.accent.opacity(0.5) : Color.clear, lineWidth: 1)
                )
        )
        .padding(QMDesign.Spacing.sm)
    }
}

// MARK: - Modern Session Card

struct ModernSessionCard: View {
    let session: Session
    let isSelected: Bool
    var syncStatus: SyncDisplayStatus = .notSynced
    var canSync: Bool = false
    let action: () -> Void
    let onDelete: () -> Void
    var onSync: (() -> Void)?

    @State private var isHovered = false
    @State private var isDeleteHovered = false
    @State private var isSyncHovered = false

    var body: some View {
        Button(action: action) {
            VStack(alignment: .leading, spacing: QMDesign.Spacing.xs) {
                // Header
                HStack {
                    Text(session.title)
                        .font(QMDesign.Typography.bodyMedium)
                        .fontWeight(.semibold)
                        .foregroundColor(QMDesign.Colors.textPrimary)
                        .lineLimit(1)

                    Spacer()

                    // Live indicator
                    if session.endTime == nil {
                        HStack(spacing: 4) {
                            Circle()
                                .fill(QMDesign.Colors.error)
                                .frame(width: 6, height: 6)
                            Text(String(localized: "sessions.badge.live"))
                                .font(QMDesign.Typography.captionSmall)
                                .foregroundColor(QMDesign.Colors.error)
                        }
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(
                            Capsule()
                                .fill(QMDesign.Colors.errorLight)
                        )
                    }

                    // Delete button
                    Button(action: onDelete) {
                        Image(systemName: "trash")
                            .font(.system(size: 12))
                            .foregroundColor(isDeleteHovered ? QMDesign.Colors.error : QMDesign.Colors.textTertiary)
                    }
                    .buttonStyle(.plain)
                    .onHover { isDeleteHovered = $0 }
                    .help(String(localized: "sessions.help.deleteSession"))
                }

                // Metadata
                HStack(spacing: QMDesign.Spacing.sm) {
                    // Date
                    HStack(spacing: 4) {
                        Image(systemName: "calendar")
                            .font(.system(size: 10))
                        Text(session.formattedDate)
                            .font(QMDesign.Typography.captionSmall)
                    }
                    .foregroundColor(QMDesign.Colors.textTertiary)

                    // Duration badge
                    Text(session.formattedDuration)
                        .font(QMDesign.Typography.captionSmall)
                        .foregroundColor(QMDesign.Colors.accent)
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(
                            Capsule()
                                .fill(QMDesign.Colors.accent.opacity(0.1))
                        )

                    Spacer()

                    // Sync status badge (for completed sessions when sync is available)
                    if canSync && session.endTime != nil {
                        SyncStatusBadge(status: syncStatus, onSync: onSync)
                            .onHover { isSyncHovered = $0 }
                    }
                }

                // Transcript preview
                if !session.transcript.isEmpty {
                    Text(session.transcript.prefix(80) + (session.transcript.count > 80 ? "..." : ""))
                        .font(QMDesign.Typography.captionSmall)
                        .foregroundColor(QMDesign.Colors.textSecondary)
                        .lineLimit(2)
                        .padding(.top, QMDesign.Spacing.xxs)
                }
            }
            .padding(QMDesign.Spacing.sm)
            .background(
                RoundedRectangle(cornerRadius: QMDesign.Radius.md)
                    .fill(isSelected ? AnyShapeStyle(QMDesign.Colors.accent.opacity(0.1)) : AnyShapeStyle(QMDesign.Colors.surfaceLight))
                    .overlay(
                        RoundedRectangle(cornerRadius: QMDesign.Radius.md)
                            .stroke(
                                isSelected ? QMDesign.Colors.accent.opacity(0.4) : (isHovered ? QMDesign.Colors.borderMedium : QMDesign.Colors.borderSubtle),
                                lineWidth: 1
                            )
                    )
            )
            .scaleEffect(isHovered && !isSelected ? 1.01 : 1.0)
        }
        .buttonStyle(.plain)
        .onHover { isHovered = $0 }
        .animation(QMDesign.Animation.quick, value: isHovered)
        .animation(QMDesign.Animation.quick, value: isSelected)
    }
}

// MARK: - Modern Session Detail View

struct ModernSessionDetailView: View {
    let session: Session

    @State private var showingTranscript = true

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: QMDesign.Spacing.lg) {
                // Hero Header
                VStack(alignment: .leading, spacing: QMDesign.Spacing.sm) {
                    // Title
                    Text(session.title)
                        .font(QMDesign.Typography.titleMedium)
                        .foregroundStyle(QMDesign.Colors.primaryGradient)

                    // Metadata row
                    HStack(spacing: QMDesign.Spacing.md) {
                        MetadataBadge(icon: "calendar", text: session.formattedDate)
                        MetadataBadge(icon: "clock", text: session.formattedDuration)

                        if session.endTime == nil {
                            MetadataBadge(icon: "circle.fill", text: String(localized: "sessions.detail.recording"), color: QMDesign.Colors.error)
                        }
                    }
                }
                .padding(QMDesign.Spacing.lg)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(
                    RoundedRectangle(cornerRadius: QMDesign.Radius.lg)
                        .fill(QMDesign.Colors.primaryGradient.opacity(0.05))
                        .overlay(
                            RoundedRectangle(cornerRadius: QMDesign.Radius.lg)
                                .stroke(QMDesign.Colors.accent.opacity(0.2), lineWidth: 1)
                        )
                )

                // Summary Section
                if let summary = session.summary {
                    DetailSection(title: String(localized: "sessions.detail.summary"), icon: "doc.text") {
                        MarkdownText(content: summary)
                    }
                }

                // Action Items Section
                if !session.actionItems.isEmpty {
                    DetailSection(title: String(localized: "sessions.detail.actionItems"), icon: "checklist") {
                        VStack(alignment: .leading, spacing: QMDesign.Spacing.sm) {
                            ForEach(session.actionItems, id: \.self) { item in
                                HStack(alignment: .top, spacing: QMDesign.Spacing.sm) {
                                    Image(systemName: "circle.fill")
                                        .font(.system(size: 6))
                                        .foregroundStyle(QMDesign.Colors.primaryGradient)
                                        .padding(.top, 6)
                                    Text(item)
                                        .font(QMDesign.Typography.bodySmall)
                                        .foregroundColor(QMDesign.Colors.textPrimary)
                                }
                            }
                        }
                    }
                }

                // Transcript Section
                DetailSection(
                    title: String(localized: "sessions.detail.transcript"),
                    icon: "text.alignleft",
                    isCollapsible: true,
                    isExpanded: $showingTranscript
                ) {
                    if showingTranscript {
                        Text(session.transcript.isEmpty ? String(localized: "sessions.detail.noTranscript") : session.transcript)
                            .font(QMDesign.Typography.bodySmall)
                            .foregroundColor(session.transcript.isEmpty ? QMDesign.Colors.textTertiary : QMDesign.Colors.textPrimary)
                            .textSelection(.enabled)
                            .padding(QMDesign.Spacing.md)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .background(
                                RoundedRectangle(cornerRadius: QMDesign.Radius.md)
                                    .fill(QMDesign.Colors.surfaceLight)
                            )
                    }
                }
            }
            .padding(QMDesign.Spacing.lg)
        }
        .background(QMDesign.Colors.backgroundPrimary)
    }
}

// MARK: - Detail Section

struct DetailSection<Content: View>: View {
    let title: String
    let icon: String
    var isCollapsible: Bool = false
    @Binding var isExpanded: Bool
    @ViewBuilder let content: () -> Content

    init(
        title: String,
        icon: String,
        isCollapsible: Bool = false,
        isExpanded: Binding<Bool> = .constant(true),
        @ViewBuilder content: @escaping () -> Content
    ) {
        self.title = title
        self.icon = icon
        self.isCollapsible = isCollapsible
        self._isExpanded = isExpanded
        self.content = content
    }

    var body: some View {
        VStack(alignment: .leading, spacing: QMDesign.Spacing.sm) {
            // Header
            HStack {
                Image(systemName: icon)
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(QMDesign.Colors.primaryGradient)

                Text(title)
                    .font(QMDesign.Typography.headline)
                    .foregroundColor(QMDesign.Colors.textPrimary)

                Spacer()

                if isCollapsible {
                    Button(action: { withAnimation(QMDesign.Animation.quick) { isExpanded.toggle() } }) {
                        Image(systemName: isExpanded ? "chevron.up" : "chevron.down")
                            .font(.system(size: 11, weight: .semibold))
                            .foregroundColor(QMDesign.Colors.textTertiary)
                    }
                    .buttonStyle(.plain)
                }
            }

            // Content
            content()
        }
    }
}

// MARK: - Metadata Badge

struct MetadataBadge: View {
    let icon: String
    let text: String
    var color: Color = QMDesign.Colors.textSecondary

    var body: some View {
        HStack(spacing: 4) {
            Image(systemName: icon)
                .font(.system(size: 11))
            Text(text)
                .font(QMDesign.Typography.caption)
        }
        .foregroundColor(color)
    }
}

// MARK: - Empty States

struct EmptySessionsView: View {
    let isFiltered: Bool

    var body: some View {
        VStack(spacing: QMDesign.Spacing.md) {
            Image(systemName: isFiltered ? "magnifyingglass" : "waveform.slash")
                .font(.system(size: 32))
                .foregroundStyle(QMDesign.Colors.primaryGradient)

            Text(isFiltered ? String(localized: "sessions.empty.noResults") : String(localized: "sessions.empty.noSessions"))
                .font(QMDesign.Typography.bodyMedium)
                .foregroundColor(QMDesign.Colors.textPrimary)

            Text(isFiltered ? String(localized: "sessions.empty.tryDifferentSearch") : String(localized: "sessions.empty.startSession"))
                .font(QMDesign.Typography.caption)
                .foregroundColor(QMDesign.Colors.textTertiary)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .padding(QMDesign.Spacing.xl)
    }
}

struct EmptySessionDetailView: View {
    var body: some View {
        VStack(spacing: QMDesign.Spacing.md) {
            Image(systemName: "doc.text")
                .font(.system(size: 40))
                .foregroundStyle(QMDesign.Colors.primaryGradient.opacity(0.5))

            Text(String(localized: "sessions.empty.noSessionSelected"))
                .font(QMDesign.Typography.titleSmall)
                .foregroundColor(QMDesign.Colors.textPrimary)

            Text(String(localized: "sessions.empty.selectSession"))
                .font(QMDesign.Typography.bodySmall)
                .foregroundColor(QMDesign.Colors.textTertiary)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(QMDesign.Colors.backgroundPrimary)
    }
}

// MARK: - Sync Status Badge

struct SyncStatusBadge: View {
    let status: SyncDisplayStatus
    var onSync: (() -> Void)?

    @State private var isHovered = false

    var body: some View {
        Group {
            if status == .notSynced || status == .failed, let onSync = onSync {
                // Clickable sync button for unsynced/failed sessions
                Button(action: onSync) {
                    badgeContent
                }
                .buttonStyle(.plain)
                .onHover { isHovered = $0 }
                .help(status == .failed ? String(localized: "sessions.help.retrySync") : String(localized: "sessions.help.syncToDashboard"))
            } else {
                // Static badge for other states
                badgeContent
            }
        }
    }

    private var badgeContent: some View {
        HStack(spacing: 4) {
            if status == .syncing {
                ProgressView()
                    .scaleEffect(0.5)
                    .frame(width: 10, height: 10)
            } else {
                Image(systemName: iconName)
                    .font(.system(size: 10))
            }
        }
        .foregroundColor(isHovered && (status == .notSynced || status == .failed) ? color.opacity(0.8) : color)
        .padding(.horizontal, 6)
        .padding(.vertical, 2)
        .background(
            Capsule()
                .fill(color.opacity(0.1))
        )
    }

    private var iconName: String {
        switch status {
        case .notSynced:
            return "icloud.slash"
        case .pending:
            return "clock.arrow.circlepath"
        case .syncing:
            return "arrow.triangle.2.circlepath"
        case .synced:
            return "checkmark.icloud"
        case .failed:
            return "exclamationmark.icloud"
        }
    }

    private var color: Color {
        switch status {
        case .notSynced:
            return QMDesign.Colors.textTertiary
        case .pending, .syncing:
            return QMDesign.Colors.accent
        case .synced:
            return QMDesign.Colors.success
        case .failed:
            return QMDesign.Colors.error
        }
    }
}

// MARK: - Legacy Support

typealias SessionRowView = ModernSessionCard
typealias SessionDetailView = ModernSessionDetailView
