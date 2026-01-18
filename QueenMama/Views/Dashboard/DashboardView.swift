//
//  DashboardView.swift
//  QueenMama
//
//  Modern dashboard with gradient sidebar and improved UX
//

import SwiftUI
import SwiftData

struct DashboardView: View {
    @EnvironmentObject var appState: AppState
    @EnvironmentObject var sessionManager: SessionManager
    @Environment(\.modelContext) private var modelContext

    @State private var selectedSection: DashboardSection = .sessions
    @State private var searchText = ""
    @State private var isHoveringStart = false
    @State private var columnVisibility: NavigationSplitViewVisibility = .all

    var body: some View {
        NavigationSplitView(columnVisibility: $columnVisibility) {
            // Modern Sidebar
            ModernSidebarView(
                selectedSection: $selectedSection,
                audioService: appState.audioService
            )
            .frame(minWidth: QMDesign.Dimensions.Dashboard.sidebarMinWidth)
        } detail: {
            // Main Content
            Group {
                switch selectedSection {
                case .sessions:
                    SessionListView(searchText: $searchText)
                case .liveSession:
                    LiveSessionView()
                case .modes:
                    ModesListView()
                case .settings:
                    SettingsView()
                }
            }
            .frame(minWidth: QMDesign.Dimensions.Dashboard.detailMinWidth)
        }
        .navigationTitle("")
        .toolbar {
            ToolbarItemGroup(placement: .navigation) {
                // App title with gradient
                HStack(spacing: QMDesign.Spacing.xs) {
                    ZStack {
                        Circle()
                            .fill(QMDesign.Colors.primaryGradient)
                            .frame(width: 24, height: 24)
                        Image(systemName: "waveform")
                            .font(.system(size: 12, weight: .bold))
                            .foregroundColor(.white)
                    }

                    Text("Queen Mama")
                        .font(QMDesign.Typography.headline)
                        .foregroundStyle(QMDesign.Colors.primaryGradient)
                }
            }

            ToolbarItemGroup(placement: .primaryAction) {
                // Start/Stop Session Button
                Button(action: {
                    Task {
                        if appState.isSessionActive {
                            await appState.stopSession()
                        } else {
                            await appState.startSession()
                            OverlayWindowController.shared.showOverlay(
                                appState: appState,
                                sessionManager: sessionManager
                            )
                        }
                    }
                }) {
                    HStack(spacing: QMDesign.Spacing.xs) {
                        Image(systemName: appState.isSessionActive ? QMDesign.Icons.stop : QMDesign.Icons.play)
                            .font(.system(size: 12, weight: .semibold))
                        Text(appState.isSessionActive ? "Stop" : "Start")
                            .font(QMDesign.Typography.labelSmall)
                    }
                    .padding(.horizontal, QMDesign.Spacing.sm)
                    .padding(.vertical, QMDesign.Spacing.xs)
                    .background(
                        Capsule()
                            .fill(appState.isSessionActive ? AnyShapeStyle(QMDesign.Colors.errorLight) : AnyShapeStyle(QMDesign.Colors.primaryGradient))
                    )
                    .foregroundColor(appState.isSessionActive ? QMDesign.Colors.error : .white)
                    .scaleEffect(isHoveringStart ? 1.05 : 1.0)
                }
                .buttonStyle(.plain)
                .onHover { isHoveringStart = $0 }
                .animation(QMDesign.Animation.quick, value: isHoveringStart)
                .keyboardShortcut("s", modifiers: [.command, .shift])
                .help("Start/Stop Session (Cmd+Shift+S)")

                // Show/Hide Overlay
                Button(action: {
                    OverlayWindowController.shared.toggleVisibility()
                }) {
                    Image(systemName: "pip.fill")
                        .font(.system(size: 14))
                        .foregroundColor(QMDesign.Colors.textSecondary)
                        .frame(width: 28, height: 28)
                        .background(
                            Circle()
                                .fill(QMDesign.Colors.surfaceLight)
                        )
                }
                .buttonStyle(.plain)
                .keyboardShortcut("\\", modifiers: .command)
                .help("Toggle Widget (Cmd+\\)")

                // Hide Dashboard (keep only widget)
                Button(action: {
                    // Close the main window, keep widget and menu bar
                    NSApp.keyWindow?.close()
                }) {
                    Image(systemName: "xmark.circle")
                        .font(.system(size: 14))
                        .foregroundColor(QMDesign.Colors.textTertiary)
                        .frame(width: 28, height: 28)
                        .background(
                            Circle()
                                .fill(QMDesign.Colors.surfaceLight)
                        )
                }
                .buttonStyle(.plain)
                .keyboardShortcut("w", modifiers: .command)
                .help("Hide Dashboard (Cmd+W)")
            }
        }
        .onAppear {
            sessionManager.setModelContext(modelContext)
            appState.aiService.loadHistory(from: modelContext)
        }
    }
}

// MARK: - Dashboard Section

enum DashboardSection: String, CaseIterable {
    case sessions = "Sessions"
    case liveSession = "Live Session"
    case modes = "Modes"
    case settings = "Settings"

    var icon: String {
        switch self {
        case .sessions: return QMDesign.Icons.sessions
        case .liveSession: return QMDesign.Icons.liveSession
        case .modes: return QMDesign.Icons.modes
        case .settings: return QMDesign.Icons.settings
        }
    }

    var description: String {
        switch self {
        case .sessions: return "Past recordings"
        case .liveSession: return "Active session"
        case .modes: return "AI personalities"
        case .settings: return "Configuration"
        }
    }
}

// MARK: - Modern Sidebar View

struct ModernSidebarView: View {
    @Binding var selectedSection: DashboardSection
    @EnvironmentObject var appState: AppState
    @EnvironmentObject var sessionManager: SessionManager
    @ObservedObject var audioService: AudioCaptureService
    @StateObject private var licenseManager = LicenseManager.shared
    @StateObject private var authManager = AuthenticationManager.shared

    var body: some View {
        VStack(spacing: 0) {
            // Navigation Items
            VStack(spacing: QMDesign.Spacing.xxs) {
                ForEach(DashboardSection.allCases, id: \.self) { section in
                    SidebarNavigationItem(
                        section: section,
                        isSelected: selectedSection == section,
                        isLive: section == .liveSession && appState.isSessionActive
                    ) {
                        selectedSection = section
                    }
                }
            }
            .padding(QMDesign.Spacing.sm)

            Divider()
                .padding(.horizontal, QMDesign.Spacing.md)

            // Status Section
            VStack(alignment: .leading, spacing: QMDesign.Spacing.sm) {
                Text("STATUS")
                    .qmSectionHeader()

                // Session Status
                HStack(spacing: QMDesign.Spacing.sm) {
                    StatusIndicator(
                        status: appState.isSessionActive ? .active : .idle,
                        size: 10
                    )

                    VStack(alignment: .leading, spacing: 2) {
                        Text(appState.isSessionActive ? "Recording" : "Idle")
                            .font(QMDesign.Typography.bodySmall)
                            .foregroundColor(QMDesign.Colors.textPrimary)

                        if appState.isSessionActive, let session = sessionManager.currentSession {
                            Text(formatDuration(from: session.startTime))
                                .font(QMDesign.Typography.captionSmall)
                                .foregroundColor(QMDesign.Colors.textTertiary)
                        }
                    }

                    Spacer()
                }
                .padding(QMDesign.Spacing.sm)
                .background(
                    RoundedRectangle(cornerRadius: QMDesign.Radius.md)
                        .fill(appState.isSessionActive ? QMDesign.Colors.successLight : QMDesign.Colors.surfaceLight)
                )

                // Audio Level
                if appState.isSessionActive {
                    VStack(alignment: .leading, spacing: QMDesign.Spacing.xs) {
                        HStack {
                            Image(systemName: QMDesign.Icons.microphone)
                                .font(.system(size: 11))
                                .foregroundColor(QMDesign.Colors.accent)
                            Text("Audio Level")
                                .font(QMDesign.Typography.caption)
                                .foregroundColor(QMDesign.Colors.textSecondary)
                        }

                        ModernAudioLevelIndicator(level: audioService.microphoneLevel)
                    }
                    .padding(QMDesign.Spacing.sm)
                    .background(
                        RoundedRectangle(cornerRadius: QMDesign.Radius.md)
                            .fill(QMDesign.Colors.surfaceLight)
                    )
                }
            }
            .padding(QMDesign.Spacing.sm)

            Spacer()

            // Footer
            VStack(spacing: QMDesign.Spacing.xs) {
                Divider()

                // License Status Badge
                LicenseStatusBadge(
                    licenseManager: licenseManager,
                    authManager: authManager,
                    onTap: { selectedSection = .settings }
                )
                .padding(.horizontal, QMDesign.Spacing.sm)
                .padding(.top, QMDesign.Spacing.xs)

                HStack {
                    Text("v1.0")
                        .font(QMDesign.Typography.captionSmall)
                        .foregroundColor(QMDesign.Colors.textTertiary)

                    Spacer()

                    // Keyboard shortcut hint
                    KeyboardShortcutBadge(shortcut: "Cmd+Shift+S", size: .small)
                }
                .padding(.horizontal, QMDesign.Spacing.sm)
                .padding(.bottom, QMDesign.Spacing.sm)
            }
        }
        .background(QMDesign.Colors.backgroundSecondary)
    }

    private func formatDuration(from date: Date) -> String {
        let duration = Int(Date().timeIntervalSince(date))
        let minutes = duration / 60
        let seconds = duration % 60
        return String(format: "%02d:%02d", minutes, seconds)
    }
}

// MARK: - Sidebar Navigation Item

struct SidebarNavigationItem: View {
    let section: DashboardSection
    let isSelected: Bool
    let isLive: Bool
    let action: () -> Void

    @State private var isHovered = false

    var body: some View {
        Button(action: action) {
            HStack(spacing: QMDesign.Spacing.sm) {
                // Icon with gradient when selected
                ZStack {
                    if isSelected {
                        Circle()
                            .fill(QMDesign.Colors.primaryGradient)
                            .frame(width: 28, height: 28)
                    }

                    Image(systemName: section.icon)
                        .font(.system(size: 13, weight: isSelected ? .semibold : .regular))
                        .foregroundColor(isSelected ? .white : QMDesign.Colors.textSecondary)
                }
                .frame(width: 28, height: 28)

                // Labels
                VStack(alignment: .leading, spacing: 1) {
                    HStack {
                        Text(section.rawValue)
                            .font(QMDesign.Typography.bodySmall)
                            .fontWeight(isSelected ? .semibold : .regular)
                            .foregroundColor(isSelected ? QMDesign.Colors.textPrimary : QMDesign.Colors.textSecondary)

                        // Live indicator
                        if isLive {
                            Circle()
                                .fill(QMDesign.Colors.error)
                                .frame(width: 6, height: 6)
                        }
                    }

                    Text(section.description)
                        .font(QMDesign.Typography.captionSmall)
                        .foregroundColor(QMDesign.Colors.textTertiary)
                }

                Spacer()

                // Chevron
                if isSelected {
                    Image(systemName: "chevron.right")
                        .font(.system(size: 10, weight: .semibold))
                        .foregroundColor(QMDesign.Colors.accent)
                }
            }
            .padding(.horizontal, QMDesign.Spacing.sm)
            .padding(.vertical, QMDesign.Spacing.xs)
            .background(
                RoundedRectangle(cornerRadius: QMDesign.Radius.md)
                    .fill(
                        isSelected
                            ? AnyShapeStyle(QMDesign.Colors.accent.opacity(0.1))
                            : AnyShapeStyle(isHovered ? QMDesign.Colors.surfaceHover : Color.clear)
                    )
            )
            .overlay(
                RoundedRectangle(cornerRadius: QMDesign.Radius.md)
                    .stroke(
                        isSelected ? QMDesign.Colors.accent.opacity(0.3) : Color.clear,
                        lineWidth: 1
                    )
            )
        }
        .buttonStyle(.plain)
        .onHover { isHovered = $0 }
        .animation(QMDesign.Animation.quick, value: isHovered)
        .animation(QMDesign.Animation.quick, value: isSelected)
    }
}

// MARK: - Modern Audio Level Indicator

struct ModernAudioLevelIndicator: View {
    let level: Float

    var body: some View {
        GeometryReader { geometry in
            ZStack(alignment: .leading) {
                // Background
                RoundedRectangle(cornerRadius: QMDesign.Radius.xs)
                    .fill(QMDesign.Colors.surfaceMedium)

                // Level bar with gradient
                RoundedRectangle(cornerRadius: QMDesign.Radius.xs)
                    .fill(QMDesign.Colors.primaryGradient)
                    .frame(width: max(0, geometry.size.width * CGFloat(min(level, 1.0))))
                    .animation(QMDesign.Animation.quick, value: level)
            }
        }
        .frame(height: 6)
    }
}

// MARK: - License Status Badge

struct LicenseStatusBadge: View {
    @ObservedObject var licenseManager: LicenseManager
    @ObservedObject var authManager: AuthenticationManager
    let onTap: () -> Void

    @State private var isHovered = false

    var body: some View {
        Button(action: onTap) {
            HStack(spacing: QMDesign.Spacing.sm) {
                // Icon
                Image(systemName: iconName)
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundColor(iconColor)

                // Status text
                VStack(alignment: .leading, spacing: 1) {
                    Text(statusTitle)
                        .font(QMDesign.Typography.captionSmall)
                        .fontWeight(.semibold)
                        .foregroundColor(QMDesign.Colors.textPrimary)

                    Text(statusSubtitle)
                        .font(.system(size: 9))
                        .foregroundColor(QMDesign.Colors.textTertiary)
                }

                Spacer()

                // Chevron
                Image(systemName: "chevron.right")
                    .font(.system(size: 10, weight: .semibold))
                    .foregroundColor(QMDesign.Colors.textTertiary)
            }
            .padding(.horizontal, QMDesign.Spacing.sm)
            .padding(.vertical, QMDesign.Spacing.xs)
            .background(
                RoundedRectangle(cornerRadius: QMDesign.Radius.md)
                    .fill(backgroundColor)
            )
            .overlay(
                RoundedRectangle(cornerRadius: QMDesign.Radius.md)
                    .stroke(borderColor, lineWidth: 1)
            )
            .scaleEffect(isHovered ? 1.02 : 1.0)
        }
        .buttonStyle(.plain)
        .onHover { isHovered = $0 }
        .animation(QMDesign.Animation.quick, value: isHovered)
    }

    // MARK: - Computed Properties

    private var iconName: String {
        if !authManager.isAuthenticated {
            return "person.crop.circle.badge.xmark"
        } else if licenseManager.isPro {
            return "crown.fill"
        } else {
            return "person.crop.circle"
        }
    }

    private var iconColor: Color {
        if !authManager.isAuthenticated {
            return QMDesign.Colors.textTertiary
        } else if licenseManager.isPro {
            return QMDesign.Colors.warning
        } else {
            return QMDesign.Colors.accent
        }
    }

    private var statusTitle: String {
        if !authManager.isAuthenticated {
            return "Not Connected"
        } else if licenseManager.isPro {
            if licenseManager.isTrialing, let days = licenseManager.trialDaysRemaining {
                return "\(licenseManager.currentLicense.plan.rawValue) Trial"
            }
            return licenseManager.currentLicense.plan.rawValue
        } else {
            return "FREE"
        }
    }

    private var statusSubtitle: String {
        if !authManager.isAuthenticated {
            return "Tap to sign in"
        } else if licenseManager.isPro {
            if licenseManager.isTrialing, let days = licenseManager.trialDaysRemaining {
                return "\(days) days remaining"
            }
            return "All features unlocked"
        } else {
            return "Upgrade for more"
        }
    }

    private var backgroundColor: Color {
        if !authManager.isAuthenticated {
            return QMDesign.Colors.surfaceLight
        } else if licenseManager.isPro {
            return QMDesign.Colors.warning.opacity(0.1)
        } else {
            return QMDesign.Colors.surfaceLight
        }
    }

    private var borderColor: Color {
        if !authManager.isAuthenticated {
            return QMDesign.Colors.borderSubtle
        } else if licenseManager.isPro {
            return QMDesign.Colors.warning.opacity(0.3)
        } else {
            return QMDesign.Colors.borderSubtle
        }
    }
}

// MARK: - Legacy Support

typealias SidebarView = ModernSidebarView
typealias AudioLevelIndicator = ModernAudioLevelIndicator
