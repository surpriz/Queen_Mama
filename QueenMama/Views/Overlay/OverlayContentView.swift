//
//  OverlayContentView.swift
//  QueenMama
//
//  Modern redesigned overlay widget with gradient accents and improved UX
//

import SwiftUI

// MARK: - Main Overlay Content View

struct OverlayContentView: View {
    @ObservedObject var appState: AppState
    @ObservedObject var sessionManager: SessionManager
    @ObservedObject var overlayController: OverlayWindowController
    @ObservedObject private var config = ConfigurationManager.shared

    @State private var inputText = ""
    @State private var selectedTab: TabItem = .assist
    @State private var lastScreenshotTime: Date?
    @State private var hasScreenshot = false
    @State private var showPopupMenu = false
    @State private var isAutoAnswerEnabled = false
    @AppStorage("enableScreenCapture") private var enableScreenCapture = true

    // Computed binding to sync Smart Mode with ConfigurationManager
    private var isSmartModeEnabled: Binding<Bool> {
        Binding(
            get: { config.smartModeEnabled },
            set: { config.smartModeEnabled = $0 }
        )
    }

    var body: some View {
        VStack(spacing: 0) {
            // Modern Pill Header
            ModernPillHeaderView(
                isExpanded: overlayController.isExpanded,
                isSessionActive: appState.isSessionActive,
                enableScreenCapture: $enableScreenCapture,
                isAutoAnswerEnabled: $isAutoAnswerEnabled,
                isSmartModeEnabled: isSmartModeEnabled,
                showPopupMenu: $showPopupMenu,
                onToggleExpand: { overlayController.toggleExpanded() },
                onStop: { Task { await appState.stopSession() } }
            )

            // Expanded Content
            if overlayController.isExpanded {
                ModernExpandedContentView(
                    appState: appState,
                    aiService: appState.aiService,
                    selectedTab: $selectedTab,
                    inputText: $inputText,
                    isSmartModeEnabled: isSmartModeEnabled,
                    hasScreenshot: hasScreenshot,
                    lastScreenshotTime: lastScreenshotTime,
                    enableScreenCapture: enableScreenCapture,
                    onSubmit: handleSubmit
                )
                .transition(.asymmetric(
                    insertion: .opacity.combined(with: .move(edge: .top)),
                    removal: .opacity
                ))
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(ModernOverlayBackground())
        .clipShape(RoundedRectangle(cornerRadius: QMDesign.Radius.xl))
        .overlay(
            RoundedRectangle(cornerRadius: QMDesign.Radius.xl)
                .stroke(QMDesign.Colors.borderSubtle, lineWidth: 1)
        )
        .animation(QMDesign.Animation.smooth, value: overlayController.isExpanded)
        .overlay(alignment: .top) {
            // Popup Menu
            if showPopupMenu {
                OverlayPopupMenu(
                    isAutoAnswerEnabled: $isAutoAnswerEnabled,
                    isSmartModeEnabled: isSmartModeEnabled,
                    enableScreenCapture: $enableScreenCapture,
                    selectedMode: $appState.selectedMode,
                    isVisible: $showPopupMenu,
                    onClearContext: { appState.clearContext() },
                    onMovePosition: { position in overlayController.moveToPosition(position) }
                )
                .offset(y: 56)
                .transition(.opacity.combined(with: .scale(scale: 0.95, anchor: .top)))
            }
        }
        .animation(QMDesign.Animation.quick, value: showPopupMenu)
    }

    private func handleSubmit() {
        print("[Overlay] Submitting request for tab: \(selectedTab.rawValue)")

        Task {
            do {
                // Only capture screenshot if enabled
                let screenshot: Data? = if enableScreenCapture {
                    try? await appState.screenService.captureScreenshot()
                } else {
                    nil
                }

                hasScreenshot = screenshot != nil
                if hasScreenshot {
                    lastScreenshotTime = Date()
                }

                print("[Overlay] Screen capture \(enableScreenCapture ? "enabled" : "disabled") - Screenshot: \(hasScreenshot ? "captured" : "not captured")")

                switch selectedTab {
                case .assist:
                    for try await chunk in appState.aiService.assistStreaming(
                        transcript: appState.currentTranscript,
                        screenshot: screenshot,
                        mode: appState.selectedMode
                    ) {
                        _ = chunk
                    }
                case .whatToSay:
                    let response = try await appState.aiService.whatToSay(
                        transcript: appState.currentTranscript,
                        screenshot: screenshot,
                        mode: appState.selectedMode
                    )
                    appState.aiService.currentResponse = response.content
                case .followUp:
                    let response = try await appState.aiService.followUpQuestions(
                        transcript: appState.currentTranscript,
                        screenshot: screenshot,
                        mode: appState.selectedMode
                    )
                    appState.aiService.currentResponse = response.content
                case .recap:
                    let response = try await appState.aiService.recap(
                        transcript: appState.currentTranscript,
                        screenshot: screenshot,
                        mode: appState.selectedMode
                    )
                    appState.aiService.currentResponse = response.content
                }

                inputText = ""
                print("[Overlay] Request completed successfully")
            } catch {
                print("[Overlay] Error: \(error)")
                appState.errorMessage = error.localizedDescription
            }
        }
    }
}

// MARK: - Tab Item

enum TabItem: String, CaseIterable {
    case assist = "Assist"
    case whatToSay = "What to say"
    case followUp = "Follow-up"
    case recap = "Recap"

    var icon: String {
        switch self {
        case .assist: return QMDesign.Icons.assist
        case .whatToSay: return QMDesign.Icons.whatToSay
        case .followUp: return QMDesign.Icons.followUp
        case .recap: return QMDesign.Icons.recap
        }
    }

    var shortLabel: String {
        switch self {
        case .assist: return "Assist"
        case .whatToSay: return "Say"
        case .followUp: return "Ask"
        case .recap: return "Recap"
        }
    }
}

// MARK: - Status Badge

struct StatusBadge: View {
    let icon: String
    let label: String
    let color: Color
    let isActive: Bool

    var body: some View {
        HStack(spacing: 3) {
            Image(systemName: icon)
                .font(.system(size: 9, weight: .semibold))
            Text(label)
                .font(.system(size: 9, weight: .medium))
        }
        .padding(.horizontal, 6)
        .padding(.vertical, 3)
        .background(
            Capsule()
                .fill(color.opacity(0.2))
        )
        .foregroundColor(color)
    }
}

// MARK: - Modern Pill Header View

struct ModernPillHeaderView: View {
    let isExpanded: Bool
    let isSessionActive: Bool
    @Binding var enableScreenCapture: Bool
    @Binding var isAutoAnswerEnabled: Bool
    @Binding var isSmartModeEnabled: Bool
    @Binding var showPopupMenu: Bool
    let onToggleExpand: () -> Void
    let onStop: () -> Void

    @State private var isHoveringExpand = false
    @State private var isHoveringMore = false
    @State private var isHoveringDashboard = false
    @Environment(\.openWindow) private var openWindow

    // Observe ConfigurationManager for undetectability
    @ObservedObject private var config = ConfigurationManager.shared

    var body: some View {
        HStack(spacing: QMDesign.Spacing.xs) {
            // Logo with gradient - also opens Dashboard
            Button(action: toggleDashboard) {
                ZStack {
                    Circle()
                        .fill(QMDesign.Colors.primaryGradient)
                        .frame(width: 28, height: 28)

                    Image(systemName: "waveform")
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundColor(.white)
                }
                .scaleEffect(isHoveringDashboard ? 1.1 : 1.0)
            }
            .buttonStyle(.plain)
            .onHover { isHoveringDashboard = $0 }
            .animation(QMDesign.Animation.quick, value: isHoveringDashboard)
            .help("Open Dashboard (Cmd+D)")

            // Expand/Collapse Button
            Button(action: onToggleExpand) {
                HStack(spacing: 4) {
                    Image(systemName: isExpanded ? "chevron.up" : "chevron.down")
                        .font(.system(size: 10, weight: .bold))
                    Text(isExpanded ? "Hide" : "Ask")
                        .font(QMDesign.Typography.labelSmall)
                }
                .padding(.horizontal, QMDesign.Spacing.sm)
                .padding(.vertical, 6)
                .background(
                    Group {
                        if isExpanded {
                            QMDesign.Colors.surfaceMedium
                        } else {
                            QMDesign.Colors.primaryGradient
                        }
                    }
                )
                .foregroundColor(isExpanded ? QMDesign.Colors.textPrimary : .white)
                .clipShape(Capsule())
                .scaleEffect(isHoveringExpand ? 1.05 : 1.0)
            }
            .buttonStyle(.plain)
            .onHover { isHoveringExpand = $0 }
            .animation(QMDesign.Animation.quick, value: isHoveringExpand)

            Spacer()

            // Status Indicators
            HStack(spacing: 4) {
                // Undetectability Mode Indicator
                if config.isUndetectabilityEnabled {
                    StatusBadge(
                        icon: "eye.slash.fill",
                        label: "Hidden",
                        color: QMDesign.Colors.success,
                        isActive: true
                    )
                    .help("Undetectable Mode: Widget hidden from screen capture")
                }

                // Smart Mode Indicator
                if isSmartModeEnabled {
                    StatusBadge(
                        icon: "brain.head.profile",
                        label: "Smart",
                        color: QMDesign.Colors.accent,
                        isActive: true
                    )
                    .help("Smart Mode: Using enhanced AI reasoning")
                }
            }

            // Auto-Answer Toggle
            Button(action: { isAutoAnswerEnabled.toggle() }) {
                HStack(spacing: 4) {
                    Image(systemName: isAutoAnswerEnabled ? QMDesign.Icons.autoAnswer : QMDesign.Icons.autoAnswerOff)
                        .font(.system(size: 11))
                    Text("Auto")
                        .font(QMDesign.Typography.caption)
                }
                .padding(.horizontal, QMDesign.Spacing.xs)
                .padding(.vertical, 4)
                .background(
                    Capsule()
                        .fill(isAutoAnswerEnabled ? QMDesign.Colors.autoAnswerLight : QMDesign.Colors.surfaceLight)
                )
                .foregroundColor(isAutoAnswerEnabled ? QMDesign.Colors.autoAnswer : QMDesign.Colors.textTertiary)
            }
            .buttonStyle(.plain)
            .help(isAutoAnswerEnabled ? "Auto-Answer enabled" : "Auto-Answer disabled")

            // Screen Capture Toggle
            Button(action: { enableScreenCapture.toggle() }) {
                Image(systemName: enableScreenCapture ? QMDesign.Icons.camera : QMDesign.Icons.cameraOff)
                    .font(.system(size: 12))
                    .foregroundColor(enableScreenCapture ? QMDesign.Colors.success : QMDesign.Colors.textTertiary)
                    .frame(width: 26, height: 26)
                    .background(
                        Circle()
                            .fill(enableScreenCapture ? QMDesign.Colors.successLight : QMDesign.Colors.surfaceLight)
                    )
            }
            .buttonStyle(.plain)
            .help(enableScreenCapture ? "Screen capture ON" : "Screen capture OFF")

            // More Button (Popup Menu)
            Button(action: { showPopupMenu.toggle() }) {
                Image(systemName: QMDesign.Icons.more)
                    .font(.system(size: 14))
                    .foregroundColor(showPopupMenu ? QMDesign.Colors.accent : QMDesign.Colors.textSecondary)
                    .frame(width: 26, height: 26)
                    .background(
                        Circle()
                            .fill(showPopupMenu ? QMDesign.Colors.accent.opacity(0.15) : QMDesign.Colors.surfaceLight)
                    )
                    .scaleEffect(isHoveringMore ? 1.1 : 1.0)
            }
            .buttonStyle(.plain)
            .onHover { isHoveringMore = $0 }
            .animation(QMDesign.Animation.quick, value: isHoveringMore)

            // Stop Button (when session active)
            if isSessionActive {
                Button(action: onStop) {
                    Image(systemName: QMDesign.Icons.stop)
                        .font(.system(size: 10))
                        .foregroundColor(QMDesign.Colors.error)
                        .frame(width: 26, height: 26)
                        .background(
                            Circle()
                                .fill(QMDesign.Colors.errorLight)
                        )
                }
                .buttonStyle(.plain)
                .help("Stop session")
            }
        }
        .padding(.horizontal, QMDesign.Spacing.sm)
        .padding(.vertical, QMDesign.Spacing.xs)
        .frame(maxWidth: .infinity)
        .frame(height: QMDesign.Dimensions.Overlay.headerHeight)
    }

    private func toggleDashboard() {
        // Find existing dashboard window (not overlay, not settings)
        let dashboardWindow = NSApp.windows.first { window in
            let isOverlay = window is NSPanel
            let isSettings = window.title.lowercased().contains("settings")
            let isMainWindow = window.contentView?.subviews.first != nil &&
                               !isOverlay &&
                               !isSettings &&
                               window.styleMask.contains(.closable)
            return isMainWindow
        }

        if let existingWindow = dashboardWindow, existingWindow.isVisible {
            // Window exists and is visible - close it
            existingWindow.close()
        } else if let existingWindow = dashboardWindow {
            // Window exists but not visible - show it
            NSApp.activate(ignoringOtherApps: true)
            existingWindow.makeKeyAndOrderFront(nil)
        } else {
            // No window - open new one
            NSApp.activate(ignoringOtherApps: true)
            openWindow(id: "dashboard")
        }
    }
}

// MARK: - Modern Expanded Content View

struct ModernExpandedContentView: View {
    @ObservedObject var appState: AppState
    @ObservedObject var aiService: AIService
    @Binding var selectedTab: TabItem
    @Binding var inputText: String
    @Binding var isSmartModeEnabled: Bool
    let hasScreenshot: Bool
    let lastScreenshotTime: Date?
    let enableScreenCapture: Bool
    let onSubmit: () -> Void

    var body: some View {
        VStack(spacing: QMDesign.Spacing.sm) {
            // Modern Tab Bar
            ModernTabBarView(selectedTab: $selectedTab) { tab in
                onSubmit()
            }

            // Response Area
            ModernResponseHistoryView(
                responses: aiService.responses,
                currentResponse: aiService.currentResponse,
                isProcessing: aiService.isProcessing,
                hasScreenshot: hasScreenshot,
                lastScreenshotTime: lastScreenshotTime
            )

            // Status Section
            StatusSection(
                isSessionActive: appState.isSessionActive,
                enableScreenCapture: enableScreenCapture,
                responseCount: aiService.responses.count,
                onExport: {
                    let markdown = aiService.exportToMarkdown()
                    NSPasteboard.general.clearContents()
                    NSPasteboard.general.setString(markdown, forType: .string)
                },
                onClear: {
                    aiService.clearResponses()
                }
            )

            // Modern Input Area
            ModernInputAreaView(
                inputText: $inputText,
                isSmartModeEnabled: $isSmartModeEnabled,
                onSubmit: onSubmit
            )
        }
        .padding(.horizontal, QMDesign.Spacing.sm)
        .padding(.bottom, QMDesign.Spacing.sm)
    }
}

// MARK: - Modern Tab Bar View

struct ModernTabBarView: View {
    @Binding var selectedTab: TabItem
    let onTabSelected: (TabItem) -> Void

    @Namespace private var tabAnimation

    var body: some View {
        HStack(spacing: 2) {
            ForEach(TabItem.allCases, id: \.self) { tab in
                ModernTabButton(
                    tab: tab,
                    isSelected: selectedTab == tab,
                    namespace: tabAnimation
                ) {
                    withAnimation(QMDesign.Animation.smooth) {
                        selectedTab = tab
                    }
                    onTabSelected(tab)
                }
            }
        }
        .padding(3)
        .background(
            RoundedRectangle(cornerRadius: QMDesign.Radius.md)
                .fill(QMDesign.Colors.surfaceLight)
        )
        .frame(height: QMDesign.Dimensions.Overlay.tabBarHeight)
    }
}

struct ModernTabButton: View {
    let tab: TabItem
    let isSelected: Bool
    let namespace: Namespace.ID
    let action: () -> Void

    @State private var isHovered = false

    var body: some View {
        Button(action: action) {
            HStack(spacing: 4) {
                Image(systemName: tab.icon)
                    .font(.system(size: 10, weight: isSelected ? .semibold : .regular))
                Text(tab.shortLabel)
                    .font(.system(size: 10, weight: isSelected ? .semibold : .regular))
            }
            .padding(.horizontal, QMDesign.Spacing.xs)
            .padding(.vertical, 5)
            .frame(maxWidth: .infinity)
            .background(
                ZStack {
                    if isSelected {
                        RoundedRectangle(cornerRadius: QMDesign.Radius.sm)
                            .fill(QMDesign.Colors.primaryGradient.opacity(0.2))
                            .matchedGeometryEffect(id: "tabBackground", in: namespace)
                    } else if isHovered {
                        RoundedRectangle(cornerRadius: QMDesign.Radius.sm)
                            .fill(QMDesign.Colors.surfaceHover)
                    }
                }
            )
            .foregroundColor(isSelected ? QMDesign.Colors.accent : QMDesign.Colors.textSecondary)
        }
        .buttonStyle(.plain)
        .onHover { isHovered = $0 }
    }
}

// MARK: - Modern Response History View

struct ModernResponseHistoryView: View {
    let responses: [AIResponse]
    let currentResponse: String
    let isProcessing: Bool
    let hasScreenshot: Bool
    let lastScreenshotTime: Date?

    var body: some View {
        VStack(spacing: 0) {
            // Screenshot indicator with gradient border
            if hasScreenshot, let time = lastScreenshotTime {
                HStack(spacing: QMDesign.Spacing.xs) {
                    Image(systemName: QMDesign.Icons.camera)
                        .font(.system(size: 11, weight: .medium))
                        .foregroundColor(QMDesign.Colors.success)
                    Text("Screen captured")
                        .font(QMDesign.Typography.caption)
                        .foregroundColor(QMDesign.Colors.success)
                    Spacer()
                    Text(timeAgoString(from: time))
                        .font(QMDesign.Typography.captionSmall)
                        .foregroundColor(QMDesign.Colors.textTertiary)
                }
                .padding(.horizontal, QMDesign.Spacing.sm)
                .padding(.vertical, QMDesign.Spacing.xs)
                .background(
                    RoundedRectangle(cornerRadius: QMDesign.Radius.sm)
                        .fill(QMDesign.Colors.successLight)
                        .overlay(
                            RoundedRectangle(cornerRadius: QMDesign.Radius.sm)
                                .stroke(QMDesign.Colors.success.opacity(0.3), lineWidth: 1)
                        )
                )
                .padding(.bottom, QMDesign.Spacing.xs)
            }

            ScrollViewReader { proxy in
                ScrollView {
                    LazyVStack(alignment: .leading, spacing: QMDesign.Spacing.sm) {
                        // Processing state
                        if isProcessing && currentResponse.isEmpty {
                            ProcessingIndicator()
                                .id("processing")
                        }

                        // Current streaming response
                        if !currentResponse.isEmpty && isProcessing {
                            ModernResponseItemView(
                                type: responses.first?.type ?? .assist,
                                content: currentResponse,
                                timestamp: Date(),
                                provider: responses.first?.provider ?? .openai,
                                isStreaming: true
                            )
                            .id("current")
                        }

                        // History
                        ForEach(responses) { response in
                            ModernResponseItemView(
                                type: response.type,
                                content: response.content,
                                timestamp: response.timestamp,
                                provider: response.provider,
                                isStreaming: false
                            )
                            .id(response.id)
                        }

                        // Empty state
                        if responses.isEmpty && !isProcessing {
                            EmptyResponseState()
                        }
                    }
                    .padding(QMDesign.Spacing.sm)
                }
                .onChange(of: responses.count) { _ in
                    if let firstResponse = responses.first {
                        withAnimation {
                            proxy.scrollTo(firstResponse.id, anchor: .top)
                        }
                    }
                }
                .onChange(of: currentResponse) { _ in
                    if isProcessing {
                        withAnimation {
                            proxy.scrollTo("current", anchor: .top)
                        }
                    }
                }
            }
        }
        .frame(maxWidth: .infinity, minHeight: 140, maxHeight: 220)
        .background(
            RoundedRectangle(cornerRadius: QMDesign.Radius.md)
                .fill(QMDesign.Colors.surfaceLight)
        )
    }

    private func timeAgoString(from date: Date) -> String {
        let seconds = Int(Date().timeIntervalSince(date))
        if seconds < 5 { return "now" }
        else if seconds < 60 { return "\(seconds)s" }
        else { return "\(seconds / 60)m" }
    }
}

// MARK: - Processing Indicator

struct ProcessingIndicator: View {
    @State private var isAnimating = false

    var body: some View {
        HStack(spacing: QMDesign.Spacing.xs) {
            // Animated dots
            HStack(spacing: 4) {
                ForEach(0..<3) { index in
                    Circle()
                        .fill(QMDesign.Colors.accent)
                        .frame(width: 6, height: 6)
                        .scaleEffect(isAnimating ? 1.0 : 0.5)
                        .animation(
                            .easeInOut(duration: 0.6)
                                .repeatForever()
                                .delay(Double(index) * 0.2),
                            value: isAnimating
                        )
                }
            }

            Text("Analyzing...")
                .font(QMDesign.Typography.bodySmall)
                .foregroundColor(QMDesign.Colors.textSecondary)
        }
        .padding(QMDesign.Spacing.sm)
        .frame(maxWidth: .infinity, alignment: .leading)
        .onAppear { isAnimating = true }
    }
}

// MARK: - Empty Response State

struct EmptyResponseState: View {
    var body: some View {
        VStack(spacing: QMDesign.Spacing.xs) {
            Image(systemName: QMDesign.Icons.assist)
                .font(.system(size: 24))
                .foregroundStyle(QMDesign.Colors.primaryGradient)

            Text("Ready to assist")
                .font(QMDesign.Typography.bodySmall)
                .foregroundColor(QMDesign.Colors.textSecondary)

            HStack(spacing: 4) {
                Text("Press")
                    .font(QMDesign.Typography.caption)
                    .foregroundColor(QMDesign.Colors.textTertiary)
                KeyboardShortcutBadge(shortcut: "Cmd+Enter", size: .small)
                Text("or click a tab")
                    .font(QMDesign.Typography.caption)
                    .foregroundColor(QMDesign.Colors.textTertiary)
            }
        }
        .frame(maxWidth: .infinity)
        .padding(QMDesign.Spacing.lg)
    }
}

// MARK: - Modern Response Item View

struct ModernResponseItemView: View {
    let type: AIResponse.ResponseType
    let content: String
    let timestamp: Date
    let provider: AIProviderType
    let isStreaming: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: QMDesign.Spacing.xs) {
            // Header
            HStack(spacing: QMDesign.Spacing.xs) {
                // Type badge with gradient
                HStack(spacing: 4) {
                    Image(systemName: type.icon)
                        .font(.system(size: 10, weight: .semibold))
                    Text(type.rawValue)
                        .font(QMDesign.Typography.caption)
                }
                .foregroundStyle(QMDesign.Colors.primaryGradient)

                Spacer()

                // Provider icon
                Image(systemName: provider.icon)
                    .font(.system(size: 9))
                    .foregroundColor(QMDesign.Colors.textTertiary)

                // Timestamp
                Text(formatTimestamp(timestamp))
                    .font(QMDesign.Typography.captionSmall)
                    .foregroundColor(QMDesign.Colors.textTertiary)

                // Streaming indicator
                if isStreaming {
                    ProgressView()
                        .scaleEffect(0.5)
                        .frame(width: 12, height: 12)
                }
            }

            // Content
            Text(content)
                .font(QMDesign.Typography.bodySmall)
                .foregroundColor(QMDesign.Colors.textPrimary)
                .textSelection(.enabled)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding(QMDesign.Spacing.sm)
        .background(
            RoundedRectangle(cornerRadius: QMDesign.Radius.sm)
                .fill(QMDesign.Colors.surfaceMedium)
                .overlay(
                    RoundedRectangle(cornerRadius: QMDesign.Radius.sm)
                        .stroke(
                            isStreaming ? QMDesign.Colors.accent.opacity(0.3) : Color.clear,
                            lineWidth: 1
                        )
                )
        )
    }

    private func formatTimestamp(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "HH:mm"
        return formatter.string(from: date)
    }
}

// MARK: - Status Section

struct StatusSection: View {
    let isSessionActive: Bool
    let enableScreenCapture: Bool
    let responseCount: Int
    let onExport: () -> Void
    let onClear: () -> Void

    var body: some View {
        HStack(spacing: QMDesign.Spacing.xs) {
            // Warning if no session
            if !isSessionActive {
                HStack(spacing: 4) {
                    Image(systemName: "display")
                        .font(.system(size: 10))
                    Text("Screen only")
                        .font(QMDesign.Typography.captionSmall)
                }
                .foregroundColor(QMDesign.Colors.warning)
                .padding(.horizontal, QMDesign.Spacing.xs)
                .padding(.vertical, 3)
                .background(
                    Capsule()
                        .fill(QMDesign.Colors.warningLight)
                )
            }

            Spacer()

            // History controls
            if responseCount > 0 {
                Button(action: onExport) {
                    HStack(spacing: 3) {
                        Image(systemName: QMDesign.Icons.export)
                            .font(.system(size: 9))
                        Text("Export")
                            .font(QMDesign.Typography.captionSmall)
                    }
                }
                .buttonStyle(.qmGhost)

                Button(action: onClear) {
                    HStack(spacing: 3) {
                        Image(systemName: QMDesign.Icons.delete)
                            .font(.system(size: 9))
                        Text("Clear")
                            .font(QMDesign.Typography.captionSmall)
                    }
                }
                .buttonStyle(.qmDanger)

                Text("\(responseCount)")
                    .font(QMDesign.Typography.captionSmall)
                    .foregroundColor(QMDesign.Colors.textTertiary)
            }
        }
    }
}

// MARK: - Modern Input Area View

struct ModernInputAreaView: View {
    @Binding var inputText: String
    @Binding var isSmartModeEnabled: Bool
    let onSubmit: () -> Void

    @State private var isHoveringSend = false

    var body: some View {
        HStack(spacing: QMDesign.Spacing.xs) {
            // Smart Mode Toggle
            Button(action: { isSmartModeEnabled.toggle() }) {
                HStack(spacing: 4) {
                    Image(systemName: QMDesign.Icons.smart)
                        .font(.system(size: 10))
                    Text("Smart")
                        .font(QMDesign.Typography.caption)
                }
                .padding(.horizontal, QMDesign.Spacing.xs)
                .padding(.vertical, 5)
                .background(
                    Capsule()
                        .fill(isSmartModeEnabled ? QMDesign.Colors.accent.opacity(0.15) : QMDesign.Colors.surfaceLight)
                )
                .foregroundColor(isSmartModeEnabled ? QMDesign.Colors.accent : QMDesign.Colors.textTertiary)
            }
            .buttonStyle(.plain)

            // Text Field
            TextField("Ask about your screen or conversation...", text: $inputText)
                .textFieldStyle(.plain)
                .font(QMDesign.Typography.bodySmall)
                .onSubmit(onSubmit)

            // Keyboard shortcut hint
            KeyboardShortcutBadge(shortcut: "Cmd+Enter", size: .small)
                .opacity(inputText.isEmpty ? 1 : 0)

            // Submit Button with gradient
            Button(action: onSubmit) {
                ZStack {
                    Circle()
                        .fill(QMDesign.Colors.primaryGradient)
                        .frame(width: 28, height: 28)

                    Image(systemName: "arrow.up")
                        .font(.system(size: 12, weight: .bold))
                        .foregroundColor(.white)
                }
                .scaleEffect(isHoveringSend ? 1.1 : 1.0)
                .shadow(
                    color: QMDesign.Colors.accent.opacity(isHoveringSend ? 0.4 : 0),
                    radius: isHoveringSend ? 8 : 0
                )
            }
            .buttonStyle(.plain)
            .onHover { isHoveringSend = $0 }
            .animation(QMDesign.Animation.quick, value: isHoveringSend)
            .keyboardShortcut(.return, modifiers: .command)
        }
        .padding(.horizontal, QMDesign.Spacing.sm)
        .padding(.vertical, QMDesign.Spacing.xs)
        .background(
            RoundedRectangle(cornerRadius: QMDesign.Radius.lg)
                .fill(QMDesign.Colors.surfaceLight)
                .overlay(
                    RoundedRectangle(cornerRadius: QMDesign.Radius.lg)
                        .stroke(QMDesign.Colors.borderSubtle, lineWidth: 1)
                )
        )
        .frame(height: QMDesign.Dimensions.Overlay.inputHeight)
    }
}

// MARK: - Modern Overlay Background

struct ModernOverlayBackground: View {
    var body: some View {
        ZStack {
            // Glass effect
            VisualEffectView(material: .hudWindow, blendingMode: .behindWindow)

            // Gradient tint
            LinearGradient(
                colors: [
                    QMDesign.Colors.gradientStart.opacity(0.05),
                    QMDesign.Colors.gradientEnd.opacity(0.02)
                ],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )

            // Dark overlay
            Color.black.opacity(0.35)
        }
    }
}

// MARK: - Visual Effect View

struct VisualEffectView: NSViewRepresentable {
    let material: NSVisualEffectView.Material
    let blendingMode: NSVisualEffectView.BlendingMode

    func makeNSView(context: Context) -> NSVisualEffectView {
        let view = NSVisualEffectView()
        view.material = material
        view.blendingMode = blendingMode
        view.state = .active
        return view
    }

    func updateNSView(_ nsView: NSVisualEffectView, context: Context) {
        nsView.material = material
        nsView.blendingMode = blendingMode
    }
}

// MARK: - Legacy Support

// Keep old names for compatibility
typealias PillHeaderView = ModernPillHeaderView
typealias ExpandedContentView = ModernExpandedContentView
typealias TabBarView = ModernTabBarView
typealias ResponseHistoryView = ModernResponseHistoryView
typealias ResponseItemView = ModernResponseItemView
typealias InputAreaView = ModernInputAreaView
typealias OverlayBackground = ModernOverlayBackground
