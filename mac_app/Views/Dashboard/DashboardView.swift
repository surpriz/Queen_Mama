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
    @ObservedObject private var authManager = AuthenticationManager.shared

    @State private var selectedSection: DashboardSection = .home
    @State private var libraryTab: LibraryTab = .sessions
    @State private var requestedSession: Session?
    @State private var isHoveringStart = false
    @State private var columnVisibility: NavigationSplitViewVisibility = .all
    @State private var showTourSheet = false

    // Memory Palace: Contact extraction state
    @State private var showingContactExtraction = false
    @State private var extractedContact: ContactExtractionService.ExtractedContact?
    @State private var extractionSession: Session?

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
            VStack(spacing: 0) {
                // Authentication warning banner
                if !authManager.isAuthenticated {
                    AuthWarningBanner(onSignIn: { selectedSection = .settings })
                }

                Group {
                    switch selectedSection {
                    case .home:
                        HomeView(
                            onOpenSession: { session in
                                requestedSession = session
                                libraryTab = .sessions
                                selectedSection = .library
                            },
                            onOpenLibrary: {
                                libraryTab = .sessions
                                selectedSection = .library
                            }
                        )
                    case .library:
                        LibraryView(selectedTab: $libraryTab, requestedSession: $requestedSession)
                    case .settings:
                        SettingsView()
                    }
                }
                // Disable NavigationSplitView's implicit MoveTransition when switching sections.
                // On macOS 26 beta, the transition's layout pass overlaps @Query observation
                // registration, causing infinite recursion in the SwiftData layout engine.
                // (Sentry: QUEEN-MAMA-MACOS-19)
                .animation(.none, value: selectedSection)
                .frame(minWidth: QMDesign.Dimensions.Dashboard.detailMinWidth)
            }
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
                // Finalization indicator
                if appState.isFinalizingSession {
                    HStack(spacing: QMDesign.Spacing.xs) {
                        ProgressView()
                            .scaleEffect(0.7)
                        Text(String(localized: "dashboard.toolbar.generatingSummary"))
                            .font(QMDesign.Typography.labelSmall)
                    }
                    .padding(.horizontal, QMDesign.Spacing.sm)
                    .padding(.vertical, QMDesign.Spacing.xs)
                    .background(
                        Capsule()
                            .fill(QMDesign.Colors.accent.opacity(0.15))
                    )
                    .foregroundColor(QMDesign.Colors.accent)
                }

                // Start/Stop Session Button (hidden during finalization)
                if !appState.isFinalizingSession {
                    let canStart = authManager.isAuthenticated || appState.isSessionActive

                    Button(action: {
                        if appState.isSessionActive {
                            Task {
                                await appState.stopSession()
                            }
                        } else {
                            startSoloSession()
                        }
                    }) {
                        HStack(spacing: QMDesign.Spacing.xs) {
                            Image(systemName: appState.isSessionActive ? QMDesign.Icons.stop : QMDesign.Icons.play)
                                .font(.system(size: 12, weight: .semibold))
                            Text(appState.isSessionActive ? String(localized: "dashboard.toolbar.stop") : String(localized: "dashboard.toolbar.start"))
                                .font(QMDesign.Typography.labelSmall)
                        }
                        .padding(.horizontal, QMDesign.Spacing.sm)
                        .padding(.vertical, QMDesign.Spacing.xs)
                        .background(
                            Capsule()
                                .fill(
                                    appState.isSessionActive
                                        ? AnyShapeStyle(QMDesign.Colors.errorLight)
                                        : (canStart ? AnyShapeStyle(QMDesign.Colors.primaryGradient) : AnyShapeStyle(QMDesign.Colors.surfaceMedium))
                                )
                        )
                        .foregroundColor(
                            appState.isSessionActive
                                ? QMDesign.Colors.error
                                : (canStart ? .white : QMDesign.Colors.textTertiary)
                        )
                        .scaleEffect(isHoveringStart && canStart ? 1.05 : 1.0)
                    }
                    .buttonStyle(.plain)
                    .disabled(!canStart)
                    .onHover { isHoveringStart = $0 }
                    .animation(QMDesign.Animation.quick, value: isHoveringStart)
                    .keyboardShortcut("s", modifiers: [.command, .shift])
                    .help(canStart ? String(localized: "dashboard.toolbar.help.startStop") : String(localized: "dashboard.toolbar.help.signInRequired"))
                }

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
                .help(String(localized: "dashboard.toolbar.help.toggleWidget"))

            }
        }
        .onAppear {
            sessionManager.setModelContext(modelContext)
            appState.aiService.loadHistory(from: modelContext)

            // Pre-fetch transcription token for faster session start
            if authManager.isAuthenticated {
                ProxyAPIClient.shared.prefetchTranscriptionToken()
            }
        }
        .sheet(isPresented: $showTourSheet) {
            FeatureTourSheet()
        }
        .onReceive(NotificationCenter.default.publisher(for: .showFeatureTour)) { _ in
            showTourSheet = true
        }
        .sheet(isPresented: $showingContactExtraction) {
            if let extracted = extractedContact {
                ContactExtractionSheet(
                    extractedContact: extracted,
                    session: extractionSession
                ) { contact in
                    // Contact saved - queue for sync if PRO
                    if LicenseManager.shared.isFeatureAvailable(.sessionSync) {
                        ContactSyncManager.shared.queueContact(contact)
                    }
                }
            }
        }
        .onReceive(NotificationCenter.default.publisher(for: .contactExtractionAvailable)) { notification in
            if let data = notification.object as? (ContactExtractionService.ExtractedContact, Session) {
                extractedContact = data.0
                extractionSession = data.1
                showingContactExtraction = true
            }
        }
    }

    private func startSoloSession() {
        Task {
            await appState.startSession(contact: nil)
            OverlayWindowController.shared.showOverlay(
                appState: appState,
                sessionManager: sessionManager,
                modelContainer: QueenMamaApp.sharedModelContainer
            )
        }
    }
}

// MARK: - Dashboard Section

enum DashboardSection: String, CaseIterable {
    case home = "Home"
    case library = "Library"
    case settings = "Settings"

    var icon: String {
        switch self {
        case .home: return QMDesign.Icons.home
        case .library: return QMDesign.Icons.library
        case .settings: return QMDesign.Icons.settings
        }
    }

    var localizedName: String {
        switch self {
        case .home: return String(localized: "dashboard.section.home")
        case .library: return String(localized: "dashboard.section.library")
        case .settings: return String(localized: "dashboard.section.settings")
        }
    }

    var localizedDescription: String {
        switch self {
        case .home: return String(localized: "dashboard.section.home.desc")
        case .library: return String(localized: "dashboard.section.library.desc")
        case .settings: return String(localized: "dashboard.section.settings.desc")
        }
    }
}

// MARK: - Modern Sidebar View

struct ModernSidebarView: View {
    @Binding var selectedSection: DashboardSection
    @EnvironmentObject var appState: AppState
    @EnvironmentObject var sessionManager: SessionManager
    @ObservedObject var audioService: AudioCaptureService
    @ObservedObject private var licenseManager = LicenseManager.shared
    @ObservedObject private var authManager = AuthenticationManager.shared

    var body: some View {
        VStack(spacing: 0) {
            // Navigation Items
            VStack(spacing: QMDesign.Spacing.xxs) {
                ForEach(DashboardSection.allCases, id: \.self) { section in
                    SidebarNavigationItem(
                        section: section,
                        isSelected: selectedSection == section,
                        isLive: section == .home && appState.isSessionActive
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
                Text(String(localized: "dashboard.sidebar.status"))
                    .qmSectionHeader()

                // Session Status
                HStack(spacing: QMDesign.Spacing.sm) {
                    StatusIndicator(
                        status: appState.isSessionActive ? .active : .idle,
                        size: 10
                    )

                    VStack(alignment: .leading, spacing: 2) {
                        Text(appState.isSessionActive ? String(localized: "dashboard.status.recording") : String(localized: "dashboard.status.idle"))
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
                            Text(String(localized: "dashboard.status.audioLevel"))
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

                Text(String(localized: "dashboard.sidebar.version \(appVersion)"))
                    .font(QMDesign.Typography.captionSmall)
                    .foregroundColor(QMDesign.Colors.textTertiary)
                    .padding(.bottom, QMDesign.Spacing.sm)
            }
        }
        .background(QMDesign.Colors.backgroundSecondary)
    }

    private var appVersion: String {
        Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? ""
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
                        Text(section.localizedName)
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

                    Text(section.localizedDescription)
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
    @State private var showPricingSheet = false

    var body: some View {
        Button(action: {
            if authManager.isAuthenticated && !licenseManager.isPro {
                showPricingSheet = true
            } else {
                onTap()
            }
        }) {
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
        .sheet(isPresented: $showPricingSheet) {
            PricingView()
        }
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
            return String(localized: "dashboard.license.notConnected")
        } else if licenseManager.isPro {
            if licenseManager.isTrialing, let days = licenseManager.trialDaysRemaining {
                return "\(licenseManager.currentLicense.plan.rawValue) \(String(localized: "dashboard.license.trial"))"
            }
            return licenseManager.currentLicense.plan.rawValue
        } else {
            return "FREE"
        }
    }

    private var statusSubtitle: String {
        if !authManager.isAuthenticated {
            return String(localized: "dashboard.license.tapToSignIn")
        } else if licenseManager.isPro {
            if licenseManager.isTrialing, let days = licenseManager.trialDaysRemaining {
                return String(localized: "dashboard.license.daysRemaining \(days)")
            }
            return String(localized: "dashboard.license.allFeaturesUnlocked")
        } else {
            let remaining = licenseManager.remainingUses(for: .aiRequest) ?? 0
            let limit = licenseManager.currentLicense.features.dailyAiRequestLimit ?? 1
            return String(localized: "dashboard.license.freeStatus \(remaining) \(limit)")
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

// MARK: - Authentication Warning Banner

struct AuthWarningBanner: View {
    let onSignIn: () -> Void

    @State private var isHovered = false

    var body: some View {
        HStack(spacing: QMDesign.Spacing.md) {
            // Warning icon
            Image(systemName: "exclamationmark.triangle.fill")
                .font(.system(size: 16, weight: .semibold))
                .foregroundColor(QMDesign.Colors.warning)

            // Message
            VStack(alignment: .leading, spacing: 2) {
                Text(String(localized: "dashboard.auth.notSignedIn"))
                    .font(QMDesign.Typography.bodySmall)
                    .fontWeight(.semibold)
                    .foregroundColor(QMDesign.Colors.textPrimary)

                Text(String(localized: "dashboard.auth.signInPrompt"))
                    .font(QMDesign.Typography.captionSmall)
                    .foregroundColor(QMDesign.Colors.textSecondary)
            }

            Spacer()

            // Sign in button
            Button(action: onSignIn) {
                HStack(spacing: QMDesign.Spacing.xs) {
                    Image(systemName: "arrow.right.circle.fill")
                        .font(.system(size: 12))
                    Text(String(localized: "dashboard.auth.signIn"))
                        .font(QMDesign.Typography.labelSmall)
                }
                .padding(.horizontal, QMDesign.Spacing.md)
                .padding(.vertical, QMDesign.Spacing.xs)
                .background(
                    Capsule()
                        .fill(QMDesign.Colors.warning)
                )
                .foregroundColor(.white)
                .scaleEffect(isHovered ? 1.05 : 1.0)
            }
            .buttonStyle(.plain)
            .onHover { isHovered = $0 }
            .animation(QMDesign.Animation.quick, value: isHovered)
        }
        .padding(.horizontal, QMDesign.Spacing.lg)
        .padding(.vertical, QMDesign.Spacing.md)
        .background(
            Rectangle()
                .fill(QMDesign.Colors.warning.opacity(0.1))
        )
        .overlay(
            Rectangle()
                .frame(height: 1)
                .foregroundColor(QMDesign.Colors.warning.opacity(0.3)),
            alignment: .bottom
        )
    }
}

// MARK: - Web Dashboard

/// Opens the web dashboard through a magic link, falling back to the plain URL.
enum WebDashboardLauncher {
    @MainActor
    static func open() async {
        do {
            let response = try await AuthAPIClient.shared.generateMagicLink(redirect: "/dashboard")
            if let url = URL(string: response.url) {
                NSWorkspace.shared.open(url)
                return
            }
        } catch {
            print("[WebDashboard] Magic link failed: \(error), using fallback")
        }
        #if DEBUG
        let fallbackUrl = "http://localhost:3000/dashboard"
        #else
        let fallbackUrl = "https://queenmama.co/dashboard"
        #endif
        if let url = URL(string: fallbackUrl) {
            NSWorkspace.shared.open(url)
        }
    }
}

// MARK: - Legacy Support

typealias SidebarView = ModernSidebarView
typealias AudioLevelIndicator = ModernAudioLevelIndicator
