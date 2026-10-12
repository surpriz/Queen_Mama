//
//  HomeView.swift
//  QueenMama
//
//  Default dashboard screen: one Start button, the active mode and recent sessions.
//  While a session runs it hands over to LiveSessionView.
//

import SwiftUI
import SwiftData
import AVFoundation

struct HomeView: View {
    @EnvironmentObject var appState: AppState
    @EnvironmentObject var sessionManager: SessionManager
    @ObservedObject private var authManager = AuthenticationManager.shared

    @Query(sort: \Session.startTime, order: .reverse) private var sessions: [Session]
    @Query(sort: \Mode.createdAt) private var modes: [Mode]

    /// Open a past session in the Library.
    let onOpenSession: (Session) -> Void
    /// Open the Library on the Sessions tab.
    let onOpenLibrary: () -> Void

    @State private var showingContactPicker = false
    @State private var selectedContact: Contact?
    @State private var showingModePicker = false
    @State private var showPricingSheet = false
    @State private var isHoveringStart = false

    /// Signed in and not still writing up the previous session.
    private var canStart: Bool { authManager.isAuthenticated && !appState.isFinalizingSession }

    private var recentSessions: [Session] {
        var seen = Set<UUID>()
        return Array(sessions.filter { $0.endTime != nil && seen.insert($0.id).inserted }.prefix(5))
    }

    private var activeModeName: String {
        appState.selectedMode?.name
            ?? modes.first(where: { $0.isDefault })?.name
            ?? String(localized: "home.mode.default")
    }

    var body: some View {
        if appState.isSessionActive {
            LiveSessionView()
        } else {
            idleContent
        }
    }

    // MARK: - Idle

    private var idleContent: some View {
        ScrollView {
            VStack(spacing: QMDesign.Spacing.xxl) {
                hero
                recentSection
            }
            .frame(maxWidth: 620)
            .padding(.horizontal, QMDesign.Spacing.xl)
            .padding(.vertical, QMDesign.Spacing.xxxl)
            .frame(maxWidth: .infinity)
        }
        .background(QMDesign.Colors.backgroundPrimary)
        .sheet(isPresented: $showingContactPicker) {
            ContactPickerSheet(selectedContact: $selectedContact) { contact in
                start(with: contact)
            }
        }
        .sheet(isPresented: $showPricingSheet) {
            PricingView()
        }
    }

    private var hero: some View {
        VStack(spacing: QMDesign.Spacing.lg) {
            ZStack {
                Circle()
                    .fill(QMDesign.Colors.primaryGradient.opacity(0.12))
                    .frame(width: 112, height: 112)
                Image(systemName: "waveform")
                    .font(.system(size: 44, weight: .semibold))
                    .foregroundStyle(QMDesign.Colors.primaryGradient)
            }

            VStack(spacing: QMDesign.Spacing.xs) {
                Text(String(localized: "home.hero.title"))
                    .font(QMDesign.Typography.titleLarge)
                    .foregroundColor(QMDesign.Colors.textPrimary)
                Text(String(localized: "home.hero.subtitle"))
                    .font(QMDesign.Typography.bodyMedium)
                    .foregroundColor(QMDesign.Colors.textSecondary)
                    .multilineTextAlignment(.center)
            }

            Button(action: { start(with: nil) }) {
                HStack(spacing: QMDesign.Spacing.sm) {
                    Image(systemName: QMDesign.Icons.play)
                        .font(.system(size: 16, weight: .bold))
                    Text(String(localized: "home.button.start"))
                        .font(QMDesign.Typography.headline)
                }
                .padding(.horizontal, QMDesign.Spacing.xxl)
                .padding(.vertical, QMDesign.Spacing.md)
                .background(
                    Capsule()
                        .fill(canStart ? AnyShapeStyle(QMDesign.Colors.primaryGradient) : AnyShapeStyle(QMDesign.Colors.surfaceMedium))
                )
                .foregroundColor(canStart ? .white : QMDesign.Colors.textTertiary)
                .shadow(
                    color: QMDesign.Colors.accent.opacity(canStart ? (isHoveringStart ? 0.45 : 0.25) : 0),
                    radius: isHoveringStart ? 18 : 10,
                    y: 6
                )
                .scaleEffect(isHoveringStart && canStart ? 1.04 : 1.0)
            }
            .buttonStyle(.plain)
            .disabled(!canStart)
            .onHover { isHoveringStart = $0 }
            .animation(QMDesign.Animation.smooth, value: isHoveringStart)
            .help(canStart
                  ? String(localized: "dashboard.toolbar.help.startStop")
                  : String(localized: "dashboard.toolbar.help.signInRequired"))

            HStack(spacing: QMDesign.Spacing.md) {
                modeChip
                KeyboardShortcutBadge(shortcut: "Cmd+Shift+S", size: .small)
                Button(String(localized: "home.button.startWithContact")) {
                    showingContactPicker = true
                }
                .buttonStyle(.link)
                .font(QMDesign.Typography.bodySmall)
                .disabled(!canStart)
            }

            HomeStatusLine(onSeePlans: { showPricingSheet = true })
        }
        .frame(maxWidth: .infinity)
    }

    private var modeChip: some View {
        Button(action: { showingModePicker.toggle() }) {
            HStack(spacing: QMDesign.Spacing.xs) {
                Image(systemName: QMDesign.Icons.modes)
                    .font(.system(size: 11))
                Text(activeModeName)
                    .font(QMDesign.Typography.labelSmall)
                    .lineLimit(1)
                Image(systemName: "chevron.down")
                    .font(.system(size: 9, weight: .semibold))
            }
            .qmPillButton()
        }
        .buttonStyle(.plain)
        .help(String(localized: "home.mode.change"))
        .popover(isPresented: $showingModePicker, arrowEdge: .bottom) {
            ModeQuickPicker(modes: modes, activeMode: appState.selectedMode) { mode in
                appState.selectedMode = mode
                showingModePicker = false
            }
        }
    }

    private var recentSection: some View {
        VStack(alignment: .leading, spacing: QMDesign.Spacing.sm) {
            HStack {
                Text(String(localized: "home.recent.title"))
                    .qmSectionHeader()
                Spacer()
                if !recentSessions.isEmpty {
                    Button(String(localized: "home.recent.viewAll"), action: onOpenLibrary)
                        .buttonStyle(.link)
                        .font(QMDesign.Typography.caption)
                }
            }

            if recentSessions.isEmpty {
                Text(String(localized: "home.recent.empty"))
                    .font(QMDesign.Typography.bodySmall)
                    .foregroundColor(QMDesign.Colors.textTertiary)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .qmCard()
            } else {
                VStack(spacing: QMDesign.Spacing.xs) {
                    ForEach(recentSessions) { session in
                        RecentSessionRow(session: session) { onOpenSession(session) }
                    }
                }
            }
        }
    }

    // MARK: - Actions

    private func start(with contact: Contact?) {
        Task {
            await appState.startSession(contact: contact)
            OverlayWindowController.shared.showOverlay(
                appState: appState,
                sessionManager: sessionManager,
                modelContainer: QueenMamaApp.sharedModelContainer
            )
        }
    }
}

// MARK: - Mode Quick Picker

private struct ModeQuickPicker: View {
    let modes: [Mode]
    let activeMode: Mode?
    let onSelect: (Mode) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(String(localized: "home.mode.label"))
                .qmSectionHeader()
                .padding(.horizontal, QMDesign.Spacing.sm)
                .padding(.top, QMDesign.Spacing.xs)

            ForEach(modes) { mode in
                Button(action: { onSelect(mode) }) {
                    HStack {
                        Text(mode.name)
                            .font(QMDesign.Typography.bodySmall)
                            .foregroundColor(QMDesign.Colors.textPrimary)
                        Spacer()
                        if activeMode?.id == mode.id {
                            Image(systemName: "checkmark")
                                .font(.system(size: 10, weight: .semibold))
                                .foregroundColor(QMDesign.Colors.accent)
                        }
                    }
                    .padding(.horizontal, QMDesign.Spacing.sm)
                    .padding(.vertical, QMDesign.Spacing.xs)
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
            }
        }
        .padding(QMDesign.Spacing.xs)
        .frame(minWidth: 220)
    }
}

// MARK: - Recent Session Row

private struct RecentSessionRow: View {
    let session: Session
    let action: () -> Void

    @State private var isHovered = false

    private var subtitle: String {
        if let summary = session.summary?.trimmingCharacters(in: .whitespacesAndNewlines), !summary.isEmpty {
            return summary.components(separatedBy: .newlines).first ?? summary
        }
        if session.transcript.isEmpty {
            return String(localized: "home.recent.noSummary")
        }
        return String(session.transcript.prefix(120))
    }

    private var duration: String? {
        guard let end = session.endTime else { return nil }
        let minutes = max(1, Int(end.timeIntervalSince(session.startTime) / 60))
        return String(localized: "home.recent.duration \(minutes)")
    }

    var body: some View {
        Button(action: action) {
            HStack(spacing: QMDesign.Spacing.md) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(session.title)
                        .font(QMDesign.Typography.bodyMedium)
                        .fontWeight(.semibold)
                        .foregroundColor(QMDesign.Colors.textPrimary)
                        .lineLimit(1)
                    Text(subtitle)
                        .font(QMDesign.Typography.caption)
                        .foregroundColor(QMDesign.Colors.textSecondary)
                        .lineLimit(1)
                }

                Spacer()

                VStack(alignment: .trailing, spacing: 2) {
                    Text(session.startTime.formatted(.relative(presentation: .named)))
                        .font(QMDesign.Typography.caption)
                        .foregroundColor(QMDesign.Colors.textTertiary)
                    if let duration {
                        Text(duration)
                            .font(QMDesign.Typography.captionSmall)
                            .foregroundColor(QMDesign.Colors.textTertiary)
                    }
                }

                Image(systemName: "chevron.right")
                    .font(.system(size: 10, weight: .semibold))
                    .foregroundColor(QMDesign.Colors.textTertiary)
            }
            .padding(.horizontal, QMDesign.Spacing.md)
            .padding(.vertical, QMDesign.Spacing.sm)
            .background(
                RoundedRectangle(cornerRadius: QMDesign.Radius.lg)
                    .fill(isHovered ? QMDesign.Colors.surfaceHover : QMDesign.Colors.surfaceLight)
            )
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .onHover { isHovered = $0 }
        .animation(QMDesign.Animation.quick, value: isHovered)
    }
}

// MARK: - Status Line

/// One line under the Start button: the single most useful thing to fix or know right now.
private struct HomeStatusLine: View {
    @ObservedObject private var authManager = AuthenticationManager.shared
    @ObservedObject private var licenseManager = LicenseManager.shared
    let onSeePlans: () -> Void

    @State private var micAuthorized = true
    @State private var screenAuthorized = true

    var body: some View {
        Group {
            if !micAuthorized {
                statusRow(
                    icon: QMDesign.Icons.microphoneOff,
                    color: QMDesign.Colors.error,
                    text: String(localized: "home.status.micDenied"),
                    actionTitle: String(localized: "home.status.openSettings"),
                    action: { openPrivacySettings(pane: "Privacy_Microphone") }
                )
            } else if !screenAuthorized {
                statusRow(
                    icon: "rectangle.dashed.badge.record",
                    color: QMDesign.Colors.warning,
                    text: String(localized: "home.status.screenOff"),
                    actionTitle: String(localized: "home.status.openSettings"),
                    action: { openPrivacySettings(pane: "Privacy_ScreenCapture") }
                )
            } else if authManager.isAuthenticated && !licenseManager.isPro && !licenseManager.isValidating {
                let remaining = licenseManager.remainingUses(for: .aiRequest) ?? 0
                let limit = licenseManager.currentLicense.features.dailyAiRequestLimit ?? 1
                statusRow(
                    icon: "sparkles",
                    color: QMDesign.Colors.accent,
                    text: String(localized: "home.status.freeRequests \(remaining) \(limit)"),
                    actionTitle: String(localized: "home.status.seePlans"),
                    action: onSeePlans
                )
            }
        }
        .onAppear(perform: refreshPermissions)
        .onReceive(NotificationCenter.default.publisher(for: NSApplication.didBecomeActiveNotification)) { _ in
            refreshPermissions()
        }
    }

    private func statusRow(icon: String, color: Color, text: String, actionTitle: String, action: @escaping () -> Void) -> some View {
        HStack(spacing: QMDesign.Spacing.xs) {
            Image(systemName: icon)
                .font(.system(size: 11))
                .foregroundColor(color)
            Text(text)
                .font(QMDesign.Typography.caption)
                .foregroundColor(QMDesign.Colors.textSecondary)
            Button(actionTitle, action: action)
                .buttonStyle(.link)
                .font(QMDesign.Typography.caption)
        }
    }

    private func refreshPermissions() {
        switch AVCaptureDevice.authorizationStatus(for: .audio) {
        case .denied, .restricted: micAuthorized = false
        default: micAuthorized = true
        }
        screenAuthorized = CGPreflightScreenCaptureAccess()
    }

    private func openPrivacySettings(pane: String) {
        if let url = URL(string: "x-apple.systempreferences:com.apple.preference.security?\(pane)") {
            NSWorkspace.shared.open(url)
        }
    }
}
