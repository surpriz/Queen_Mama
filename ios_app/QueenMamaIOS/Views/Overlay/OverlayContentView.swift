//
//  OverlayContentView.swift
//  QueenMamaIOS
//
//  iOS adaptation of overlay content - displayed inside OverlayBottomSheet.
//  Removed: NSPanel, OverlayWindowController, WindowDragHandle, VisualEffectView,
//  NSPasteboard, ScreenCaptureService, DisplaySelectionToast, OverlayPosition
//

import SwiftUI

// MARK: - Main Overlay Content View

struct OverlayContentView: View {
    @ObservedObject var appState: AppState
    @ObservedObject var sessionManager: SessionManager
    @ObservedObject private var config = ConfigurationManager.shared

    @State private var inputText = ""
    @State private var selectedTab: TabItem = .assist
    @State private var showPopupMenu = false
    @State private var showSmartModeToast = false
    @AppStorage("hasSeenSmartModeHint") private var hasSeenSmartModeHint = false

    // Memory Palace: Contact picker state
    @State private var showingContactPicker = false
    @State private var selectedContact: Contact?

    // Binding to AutoAnswerService.isEnabled
    private var isAutoAnswerEnabled: Binding<Bool> {
        Binding(
            get: { appState.autoAnswerService.isEnabled },
            set: { appState.autoAnswerService.isEnabled = $0 }
        )
    }

    // Computed binding to sync Smart Mode with ConfigurationManager
    private var isSmartModeEnabled: Binding<Bool> {
        Binding(
            get: { config.smartModeEnabled },
            set: { config.smartModeEnabled = $0 }
        )
    }

    var body: some View {
        VStack(spacing: 0) {
            // Compact Header Bar (iOS simplified - no drag handle, no position, no screen capture)
            IOSOverlayHeaderView(
                isSessionActive: appState.isSessionActive,
                isFinalizingSession: appState.isFinalizingSession,
                detectedMoment: appState.autoAnswerService.lastDetectedMoment,
                transcriptionService: appState.transcriptionService,
                isAutoAnswerEnabled: isAutoAnswerEnabled,
                isSmartModeEnabled: isSmartModeEnabled,
                showPopupMenu: $showPopupMenu,
                selectedMode: $appState.selectedMode,
                onStart: { showingContactPicker = true },
                onStop: { Task { await appState.stopSession() } },
                onClearContext: { appState.clearContext() }
            )

            // Expanded Content (always shown in bottom sheet)
            IOSExpandedContentView(
                appState: appState,
                aiService: appState.aiService,
                sessionManager: sessionManager,
                selectedTab: $selectedTab,
                inputText: $inputText,
                isSmartModeEnabled: isSmartModeEnabled,
                onSubmit: handleSubmit
            )
        }
        .background(QMDesign.Colors.backgroundPrimary)
        .overlay(alignment: .bottom) {
            // Smart Mode Toast
            if showSmartModeToast {
                SmartModeToast()
                    .transition(.move(edge: .bottom).combined(with: .opacity))
                    .padding(.bottom, QMDesign.Spacing.md)
            }
        }
        .onChange(of: config.smartModeEnabled) { isEnabled in
            // Show toast only on first activation
            if isEnabled && !hasSeenSmartModeHint {
                withAnimation(QMDesign.Animation.smooth) {
                    showSmartModeToast = true
                }
                hasSeenSmartModeHint = true

                // Auto-dismiss after 4 seconds
                DispatchQueue.main.asyncAfter(deadline: .now() + 4) {
                    withAnimation(QMDesign.Animation.smooth) {
                        showSmartModeToast = false
                    }
                }
            }
        }
        .sheet(isPresented: $showingContactPicker) {
            ContactPickerSheet(selectedContact: $selectedContact) { contact in
                Task {
                    await appState.startSession(contact: contact)
                }
            }
        }
    }

    private func handleSubmit() {
        print("[Overlay] Submitting request for tab: \(selectedTab.rawValue)")

        // Capture user's custom prompt before clearing
        let customPrompt = inputText.trimmingCharacters(in: .whitespacesAndNewlines)
        let hasCustomPrompt = !customPrompt.isEmpty

        if hasCustomPrompt {
            print("[Overlay] Custom prompt provided: '\(customPrompt.prefix(50))...'")
        }

        // Check license before submitting AI request
        let licenseManager = LicenseManager.shared
        let aiAccess = licenseManager.canUse(.aiRequest)

        guard aiAccess.isAllowed else {
            appState.errorMessage = aiAccess.errorMessage
            return
        }

        // Check Smart Mode access if enabled
        if config.smartModeEnabled {
            let smartModeAccess = licenseManager.canUse(.smartMode)
            if !smartModeAccess.isAllowed {
                appState.errorMessage = smartModeAccess.errorMessage
                return
            }
        }

        // Immediately show processing indicator for better UX
        appState.aiService.isProcessing = true
        appState.aiService.currentResponse = ""

        Task {
            do {
                // iOS: No screenshot capture (no ScreenCaptureKit)
                let screenshot: Data? = nil

                // Trim transcript for real-time tabs to reduce latency
                // Recap uses full transcript for comprehensive summary
                let transcriptForRequest: String
                switch selectedTab {
                case .recap:
                    transcriptForRequest = appState.currentTranscript
                default:
                    transcriptForRequest = AIService.trimTranscript(
                        appState.currentTranscript,
                        maxLength: AIService.defaultMaxTranscriptLength
                    )
                }

                let originalLength = appState.currentTranscript.count
                let trimmedLength = transcriptForRequest.count
                if originalLength != trimmedLength {
                    print("[Overlay] Transcript trimmed: \(originalLength) -> \(trimmedLength) chars")
                }

                // Use custom prompt if provided, otherwise use tab-specific methods
                if hasCustomPrompt {
                    print("[Overlay] Using custom prompt mode")
                    let response = try await appState.aiService.askCustomQuestion(
                        question: customPrompt,
                        transcript: transcriptForRequest,
                        screenshot: screenshot,
                        mode: appState.selectedMode
                    )
                    appState.aiService.currentResponse = response.content
                } else {
                    // Standard tab-based requests
                    switch selectedTab {
                    case .assist:
                        for try await chunk in appState.aiService.assistStreaming(
                            transcript: transcriptForRequest,
                            screenshot: screenshot,
                            mode: appState.selectedMode
                        ) {
                            _ = chunk
                        }
                    case .whatToSay:
                        let response = try await appState.aiService.whatToSay(
                            transcript: transcriptForRequest,
                            screenshot: screenshot,
                            mode: appState.selectedMode
                        )
                        appState.aiService.currentResponse = response.content
                    case .followUp:
                        let response = try await appState.aiService.followUpQuestions(
                            transcript: transcriptForRequest,
                            screenshot: screenshot,
                            mode: appState.selectedMode
                        )
                        appState.aiService.currentResponse = response.content
                    case .recap:
                        let response = try await appState.aiService.recap(
                            transcript: transcriptForRequest,
                            screenshot: screenshot,
                            mode: appState.selectedMode
                        )
                        appState.aiService.currentResponse = response.content
                    case .briefing:
                        // Briefing tab doesn't trigger AI requests
                        break
                    }
                }

                inputText = ""
                print("[Overlay] Request completed successfully")
            } catch {
                print("[Overlay] Error: \(error)")
                appState.errorMessage = error.localizedDescription
                appState.aiService.isProcessing = false
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
    case briefing = "Briefing"

    var icon: String {
        switch self {
        case .assist: return QMDesign.Icons.assist
        case .whatToSay: return QMDesign.Icons.whatToSay
        case .followUp: return QMDesign.Icons.followUp
        case .recap: return QMDesign.Icons.recap
        case .briefing: return "person.text.rectangle"
        }
    }

    var shortLabel: String {
        switch self {
        case .assist: return String(localized: "overlay.tab.assist")
        case .whatToSay: return String(localized: "overlay.tab.whatToSay")
        case .followUp: return String(localized: "overlay.tab.followUp")
        case .recap: return String(localized: "overlay.tab.recap")
        case .briefing: return String(localized: "overlay.tab.briefing")
        }
    }

    static var alwaysVisible: [TabItem] {
        [.assist, .whatToSay, .followUp, .recap]
    }
}

// MARK: - iOS Overlay Header View

struct IOSOverlayHeaderView: View {
    let isSessionActive: Bool
    let isFinalizingSession: Bool
    let detectedMoment: MomentDetectionService.DetectedMoment?
    @ObservedObject var transcriptionService: TranscriptionService
    @Binding var isAutoAnswerEnabled: Bool
    @Binding var isSmartModeEnabled: Bool
    @Binding var showPopupMenu: Bool
    @Binding var selectedMode: Mode?
    let onStart: () -> Void
    let onStop: () -> Void
    let onClearContext: () -> Void

    @ObservedObject private var config = ConfigurationManager.shared

    var body: some View {
        HStack(spacing: QMDesign.Spacing.xs) {
            // Logo
            ZStack {
                Circle()
                    .fill(QMDesign.Colors.primaryGradient)
                    .frame(width: 28, height: 28)

                Image(systemName: "waveform")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundColor(.white)
            }

            // Connection Status Banner (shown during reconnection or failure)
            if isSessionActive {
                TranscriptionConnectionBanner(
                    transcriptionService: transcriptionService,
                    onRetry: {
                        transcriptionService.resetReconnectionBudget()
                        Task { try? await transcriptionService.connect() }
                    }
                )
            }

            Spacer()

            // Status Indicators
            HStack(spacing: 4) {
                // Proactive Moment Badge (Enterprise)
                if let moment = detectedMoment {
                    StatusBadge(
                        icon: moment.type.icon,
                        label: moment.type.label,
                        color: Color(
                            red: moment.type.color.red,
                            green: moment.type.color.green,
                            blue: moment.type.color.blue
                        ),
                        isActive: true
                    )
                }

                // Smart Mode Indicator
                if isSmartModeEnabled {
                    StatusBadge(
                        icon: "brain.head.profile",
                        label: String(localized: "Smart"),
                        color: QMDesign.Colors.accent,
                        isActive: true
                    )
                }
            }

            // Auto-Answer Toggle (Enterprise only)
            let autoAnswerAvailable = LicenseManager.shared.isFeatureAvailable(.autoAnswer)
            Button(action: {
                if autoAnswerAvailable {
                    isAutoAnswerEnabled.toggle()
                }
            }) {
                HStack(spacing: 4) {
                    Image(systemName: isAutoAnswerEnabled ? QMDesign.Icons.autoAnswer : QMDesign.Icons.autoAnswerOff)
                        .font(.system(size: 11))
                    Text("Auto")
                        .font(QMDesign.Typography.caption)
                    if !autoAnswerAvailable {
                        Image(systemName: "lock.fill")
                            .font(.system(size: 8))
                    }
                }
                .padding(.horizontal, QMDesign.Spacing.xs)
                .padding(.vertical, 4)
                .background(
                    Capsule()
                        .fill(isAutoAnswerEnabled && autoAnswerAvailable ? QMDesign.Colors.autoAnswerLight : QMDesign.Colors.surfaceLight)
                )
                .foregroundColor(isAutoAnswerEnabled && autoAnswerAvailable ? QMDesign.Colors.autoAnswer : QMDesign.Colors.textTertiary)
                .opacity(autoAnswerAvailable ? 1 : 0.6)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Auto-Answer")
            .accessibilityValue(isAutoAnswerEnabled ? "On" : "Off")

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
            }
            .buttonStyle(.plain)
            .accessibilityLabel("More options")
            .popover(isPresented: $showPopupMenu, arrowEdge: .bottom) {
                OverlayPopupMenu(
                    isAutoAnswerEnabled: $isAutoAnswerEnabled,
                    isSmartModeEnabled: $isSmartModeEnabled,
                    selectedMode: $selectedMode,
                    isVisible: $showPopupMenu,
                    onClearContext: onClearContext
                )
            }

            // Finalization indicator
            if isFinalizingSession {
                HStack(spacing: 6) {
                    ProgressView()
                        .scaleEffect(0.7)
                        .frame(width: 14, height: 14)
                    Text("Resume...")
                        .font(QMDesign.Typography.captionSmall)
                        .foregroundColor(QMDesign.Colors.accent)
                }
                .padding(.horizontal, QMDesign.Spacing.xs)
                .padding(.vertical, 4)
                .background(
                    Capsule()
                        .fill(QMDesign.Colors.accent.opacity(0.15))
                )
            }

            // Start Button (when session inactive)
            if !isSessionActive && !isFinalizingSession {
                Button(action: onStart) {
                    ZStack {
                        Circle()
                            .fill(QMDesign.Colors.primaryGradient)
                            .frame(width: 32, height: 32)
                            .shadow(color: QMDesign.Colors.accent.opacity(0.5), radius: 8, x: 0, y: 2)

                        Image(systemName: "play.fill")
                            .font(.system(size: 12, weight: .bold))
                            .foregroundColor(.white)
                    }
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Start session")
            }

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
                .accessibilityLabel("Stop session")
            }
        }
        .padding(.horizontal, QMDesign.Spacing.sm)
        .padding(.vertical, QMDesign.Spacing.xs)
        .frame(maxWidth: .infinity)
        .background(QMDesign.Colors.surfaceLight)
    }
}

// MARK: - iOS Expanded Content View

struct IOSExpandedContentView: View {
    @ObservedObject var appState: AppState
    @ObservedObject var aiService: AIService
    @ObservedObject var sessionManager: SessionManager
    @Binding var selectedTab: TabItem
    @Binding var inputText: String
    @Binding var isSmartModeEnabled: Bool
    let onSubmit: () -> Void

    /// Tabs to display - includes Briefing only if contact is associated
    private var visibleTabs: [TabItem] {
        if appState.currentSessionContact != nil {
            return TabItem.allCases
        } else {
            return TabItem.alwaysVisible
        }
    }

    @State private var aiErrorDismissTask: Task<Void, Never>?

    var body: some View {
        VStack(spacing: QMDesign.Spacing.sm) {
            // AI Error Toast
            if let errorMessage = appState.errorMessage, !errorMessage.isEmpty {
                AIErrorToast(message: errorMessage) {
                    appState.errorMessage = nil
                }
                .transition(.move(edge: .top).combined(with: .opacity))
                .onAppear {
                    aiErrorDismissTask?.cancel()
                    aiErrorDismissTask = Task {
                        try? await Task.sleep(nanoseconds: 5_000_000_000)
                        guard !Task.isCancelled else { return }
                        withAnimation(QMDesign.Animation.smooth) {
                            appState.errorMessage = nil
                        }
                    }
                }
                .animation(QMDesign.Animation.smooth, value: appState.errorMessage)
            }

            // Tab Bar
            IOSTabBarView(selectedTab: $selectedTab, visibleTabs: visibleTabs) { tab in
                if tab != .briefing {
                    onSubmit()
                }
            }

            // Content Area
            if selectedTab == .briefing {
                if let contact = appState.currentSessionContact {
                    ContactBriefingView(contact: contact)
                } else {
                    EmptyBriefingView()
                }
            } else {
                // Response Area
                IOSResponseHistoryView(
                    responses: aiService.responses,
                    currentResponse: aiService.currentResponse,
                    isProcessing: aiService.isProcessing,
                    onDismissResponse: { response in
                        aiService.dismissResponse(response)
                    }
                )

                // Status Section
                IOSStatusSection(
                    isSessionActive: appState.isSessionActive,
                    responseCount: aiService.responses.count,
                    onExport: {
                        let markdown = aiService.exportToMarkdown()
                        UIPasteboard.general.string = markdown
                    },
                    onClear: {
                        aiService.clearResponses()
                    }
                )

                // Input Area
                IOSInputAreaView(
                    inputText: $inputText,
                    isSmartModeEnabled: $isSmartModeEnabled,
                    dictationService: appState.dictationService,
                    isSessionActive: appState.isSessionActive,
                    onSubmit: onSubmit
                )
            }
        }
        .padding(.horizontal, QMDesign.Spacing.sm)
        .padding(.bottom, QMDesign.Spacing.sm)
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

// MARK: - iOS Tab Bar View

struct IOSTabBarView: View {
    @Binding var selectedTab: TabItem
    var visibleTabs: [TabItem] = TabItem.alwaysVisible
    let onTabSelected: (TabItem) -> Void

    @Namespace private var tabAnimation

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 2) {
                ForEach(visibleTabs, id: \.self) { tab in
                    IOSTabButton(
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
        }
        .background(
            RoundedRectangle(cornerRadius: QMDesign.Radius.md)
                .fill(QMDesign.Colors.surfaceLight)
        )
    }
}

struct IOSTabButton: View {
    let tab: TabItem
    let isSelected: Bool
    let namespace: Namespace.ID
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 4) {
                Image(systemName: tab.icon)
                    .font(.system(size: 11, weight: isSelected ? .semibold : .regular))
                Text(tab.shortLabel)
                    .font(.system(size: 11, weight: isSelected ? .semibold : .regular))
            }
            .padding(.horizontal, QMDesign.Spacing.sm)
            .padding(.vertical, 8)
            .background(
                ZStack {
                    if isSelected {
                        RoundedRectangle(cornerRadius: QMDesign.Radius.sm)
                            .fill(QMDesign.Colors.primaryGradient.opacity(0.2))
                            .matchedGeometryEffect(id: "tabBackground", in: namespace)
                    }
                }
            )
            .foregroundColor(isSelected ? QMDesign.Colors.accent : QMDesign.Colors.textSecondary)
        }
        .buttonStyle(.plain)
    }
}

// MARK: - iOS Response History View

struct IOSResponseHistoryView: View {
    let responses: [AIResponse]
    let currentResponse: String
    let isProcessing: Bool
    var onDismissResponse: ((AIResponse) -> Void)?

    @State private var isUserScrolling = false
    @State private var lastResponseContent = ""

    var body: some View {
        ScrollViewReader { proxy in
            ScrollView {
                LazyVStack(alignment: .leading, spacing: QMDesign.Spacing.md) {
                    // Empty state
                    if responses.isEmpty && !isProcessing {
                        IOSEmptyResponseState()
                    }

                    // History (reversed - oldest first, newest at bottom)
                    ForEach(responses.reversed()) { response in
                        IOSResponseItemView(
                            type: response.type,
                            content: response.content,
                            timestamp: response.timestamp,
                            provider: response.provider,
                            isStreaming: false,
                            isAutomatic: response.isAutomatic,
                            onDismiss: response.isAutomatic ? {
                                onDismissResponse?(response)
                            } : nil
                        )
                        .id(response.id)
                    }

                    // Current streaming response
                    if !currentResponse.isEmpty && isProcessing {
                        IOSResponseItemView(
                            type: responses.first?.type ?? .assist,
                            content: currentResponse,
                            timestamp: Date(),
                            provider: responses.first?.provider ?? .openai,
                            isStreaming: true
                        )
                        .id("current")
                    }

                    // Processing state
                    if isProcessing && currentResponse.isEmpty {
                        ProcessingIndicator()
                            .id("processing")
                    }

                    Color.clear
                        .frame(height: 1)
                        .id("bottom")
                }
                .padding(QMDesign.Spacing.sm)
            }
            .onChange(of: responses.count) { _ in
                isUserScrolling = false
                withAnimation {
                    proxy.scrollTo("bottom", anchor: .bottom)
                }
            }
            .onChange(of: currentResponse) { newContent in
                if lastResponseContent.isEmpty && !newContent.isEmpty {
                    isUserScrolling = false
                }
                lastResponseContent = newContent

                if isProcessing && !isUserScrolling {
                    withAnimation {
                        proxy.scrollTo("bottom", anchor: .bottom)
                    }
                }
            }
            .onAppear {
                if !responses.isEmpty {
                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
                        proxy.scrollTo("bottom", anchor: .bottom)
                    }
                }
            }
            .onChange(of: isProcessing) { processing in
                if processing {
                    isUserScrolling = false
                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.05) {
                        withAnimation {
                            proxy.scrollTo("bottom", anchor: .bottom)
                        }
                    }
                }
            }
        }
        .frame(maxWidth: .infinity, minHeight: 140)
        .background(
            RoundedRectangle(cornerRadius: QMDesign.Radius.md)
                .fill(QMDesign.Colors.surfaceLight)
        )
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

// MARK: - iOS Empty Response State

struct IOSEmptyResponseState: View {
    var body: some View {
        VStack(spacing: QMDesign.Spacing.xs) {
            Image(systemName: QMDesign.Icons.assist)
                .font(.system(size: 24))
                .foregroundStyle(QMDesign.Colors.primaryGradient)

            Text("Ready to assist")
                .font(QMDesign.Typography.bodySmall)
                .foregroundColor(QMDesign.Colors.textSecondary)

            Text("Tap a tab or type a question")
                .font(QMDesign.Typography.caption)
                .foregroundColor(QMDesign.Colors.textTertiary)
        }
        .frame(maxWidth: .infinity)
        .padding(QMDesign.Spacing.lg)
    }
}

// MARK: - iOS Response Item View

struct IOSResponseItemView: View {
    let type: AIResponse.ResponseType
    let content: String
    let timestamp: Date
    let provider: AIProviderType
    let isStreaming: Bool
    var isAutomatic: Bool = false
    var onDismiss: (() -> Void)?
    var responseId: String? = nil
    var onFeedback: ((Bool) -> Void)? = nil

    @State private var feedbackState: FeedbackState = .none
    @State private var showCopied: Bool = false

    enum FeedbackState {
        case none
        case helpful
        case notHelpful
    }

    private var feedbackAvailable: Bool {
        LicenseManager.shared.isFeatureAvailable(.knowledgeBase)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: QMDesign.Spacing.xs) {
            // Header
            HStack(spacing: QMDesign.Spacing.xs) {
                if isAutomatic {
                    HStack(spacing: 4) {
                        Image(systemName: QMDesign.Icons.autoAnswer)
                            .font(.system(size: 10, weight: .semibold))
                        Text("AUTO")
                            .font(QMDesign.Typography.caption)
                    }
                    .foregroundColor(QMDesign.Colors.autoAnswer)
                } else {
                    HStack(spacing: 4) {
                        Image(systemName: type.icon)
                            .font(.system(size: 10, weight: .semibold))
                        Text(type.localizedName)
                            .font(QMDesign.Typography.caption)
                    }
                    .foregroundStyle(QMDesign.Colors.primaryGradient)
                }

                Spacer()

                if !isAutomatic {
                    Image(systemName: provider.icon)
                        .font(.system(size: 9))
                        .foregroundColor(QMDesign.Colors.textTertiary)
                }

                // Copy button - uses UIPasteboard on iOS
                Button(action: {
                    UIPasteboard.general.string = content
                    showCopied = true
                    DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) {
                        showCopied = false
                    }
                }) {
                    Image(systemName: showCopied ? "checkmark" : "doc.on.doc")
                        .font(.system(size: 9))
                        .foregroundColor(showCopied ? QMDesign.Colors.success : QMDesign.Colors.textTertiary)
                }
                .buttonStyle(.plain)

                Text(formatTimestamp(timestamp))
                    .font(QMDesign.Typography.captionSmall)
                    .foregroundColor(QMDesign.Colors.textTertiary)

                if isStreaming {
                    ProgressView()
                        .scaleEffect(0.5)
                        .frame(width: 12, height: 12)
                }

                if isAutomatic, let onDismiss {
                    Button(action: onDismiss) {
                        Image(systemName: "xmark")
                            .font(.system(size: 10, weight: .medium))
                            .foregroundColor(QMDesign.Colors.textTertiary)
                            .frame(width: 18, height: 18)
                            .background(Circle().fill(QMDesign.Colors.surfaceMedium))
                    }
                    .buttonStyle(.plain)
                }
            }

            // Content
            MarkdownText(content: content)
                .frame(maxWidth: .infinity, alignment: .leading)

            // Feedback buttons (Enterprise only)
            if feedbackAvailable && !isStreaming && !content.isEmpty {
                HStack(spacing: QMDesign.Spacing.xs) {
                    Spacer()

                    if feedbackState == .none {
                        Button(action: {
                            feedbackState = .helpful
                            onFeedback?(true)
                        }) {
                            HStack(spacing: 3) {
                                Image(systemName: "hand.thumbsup")
                                    .font(.system(size: 10))
                                Text("Helpful")
                                    .font(QMDesign.Typography.captionSmall)
                            }
                            .foregroundColor(QMDesign.Colors.textTertiary)
                            .padding(.horizontal, 8)
                            .padding(.vertical, 4)
                            .background(Capsule().fill(QMDesign.Colors.surfaceMedium))
                        }
                        .buttonStyle(.plain)

                        Button(action: {
                            feedbackState = .notHelpful
                            onFeedback?(false)
                        }) {
                            HStack(spacing: 3) {
                                Image(systemName: "hand.thumbsdown")
                                    .font(.system(size: 10))
                            }
                            .foregroundColor(QMDesign.Colors.textTertiary)
                            .padding(.horizontal, 8)
                            .padding(.vertical, 4)
                            .background(Capsule().fill(QMDesign.Colors.surfaceMedium))
                        }
                        .buttonStyle(.plain)
                    } else {
                        HStack(spacing: 4) {
                            Image(systemName: feedbackState == .helpful ? "hand.thumbsup.fill" : "hand.thumbsdown.fill")
                                .font(.system(size: 10))
                            Text(feedbackState == .helpful ? "Thanks!" : "Got it")
                                .font(QMDesign.Typography.captionSmall)
                        }
                        .foregroundColor(feedbackState == .helpful ? QMDesign.Colors.success : QMDesign.Colors.textTertiary)
                    }
                }
                .padding(.top, QMDesign.Spacing.xs)
            }
        }
        .padding(QMDesign.Spacing.sm)
        .background(
            RoundedRectangle(cornerRadius: QMDesign.Radius.sm)
                .fill(QMDesign.Colors.surfaceMedium)
                .overlay(
                    HStack {
                        if isAutomatic {
                            Rectangle()
                                .fill(QMDesign.Colors.autoAnswer)
                                .frame(width: 3)
                        }
                        Spacer()
                    }
                )
                .overlay(
                    RoundedRectangle(cornerRadius: QMDesign.Radius.sm)
                        .stroke(
                            isStreaming ? QMDesign.Colors.accent.opacity(0.3) :
                            isAutomatic ? QMDesign.Colors.autoAnswer.opacity(0.3) : Color.clear,
                            lineWidth: 1
                        )
                )
        )
        .clipShape(RoundedRectangle(cornerRadius: QMDesign.Radius.sm))
    }

    private func formatTimestamp(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "HH:mm"
        return formatter.string(from: date)
    }
}

// MARK: - iOS Status Section

struct IOSStatusSection: View {
    let isSessionActive: Bool
    let responseCount: Int
    let onExport: () -> Void
    let onClear: () -> Void

    @State private var exportFeedback: Bool = false

    var body: some View {
        HStack(spacing: QMDesign.Spacing.xs) {
            // Warning if no session
            if !isSessionActive {
                HStack(spacing: 4) {
                    Image(systemName: "mic.slash")
                        .font(.system(size: 10))
                    Text("No active session")
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
                Button(action: {
                    onExport()
                    exportFeedback = true
                    DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) {
                        exportFeedback = false
                    }
                }) {
                    HStack(spacing: 3) {
                        Image(systemName: exportFeedback ? "checkmark" : QMDesign.Icons.export)
                            .font(.system(size: 9))
                        Text(exportFeedback ? "Copied!" : "Export")
                            .font(QMDesign.Typography.captionSmall)
                    }
                }
                .buttonStyle(.qmGhost)
                .foregroundColor(exportFeedback ? QMDesign.Colors.success : nil)

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

// MARK: - iOS Input Area View

@MainActor
struct IOSInputAreaView: View {
    @Binding var inputText: String
    @Binding var isSmartModeEnabled: Bool
    @ObservedObject var dictationService: DictationService
    let isSessionActive: Bool
    let onSubmit: () -> Void

    @State private var dictationPulse = false

    // Check if Smart Mode is available (Enterprise only)
    private var smartModeAvailable: Bool {
        LicenseManager.shared.isFeatureAvailable(.smartMode)
    }

    var body: some View {
        HStack(spacing: QMDesign.Spacing.xs) {
            // Smart Mode Toggle (Enterprise only)
            Button(action: {
                if smartModeAvailable {
                    isSmartModeEnabled.toggle()
                }
            }) {
                HStack(spacing: 4) {
                    Image(systemName: QMDesign.Icons.smart)
                        .font(.system(size: 10))
                    Text("Smart")
                        .font(QMDesign.Typography.caption)
                    if !smartModeAvailable {
                        Image(systemName: "lock.fill")
                            .font(.system(size: 8))
                    }
                }
                .padding(.horizontal, QMDesign.Spacing.xs)
                .padding(.vertical, 5)
                .background(
                    Capsule()
                        .fill(isSmartModeEnabled && smartModeAvailable ? QMDesign.Colors.accent.opacity(0.15) : QMDesign.Colors.surfaceLight)
                )
                .foregroundColor(isSmartModeEnabled && smartModeAvailable ? QMDesign.Colors.accent : QMDesign.Colors.textTertiary)
                .opacity(smartModeAvailable ? 1 : 0.6)
            }
            .buttonStyle(.plain)

            // Dictation Button
            Button(action: {
                Task {
                    if dictationService.isRecording {
                        dictationService.stopRecording()
                    } else {
                        do {
                            try await dictationService.startRecording(useSharedAudio: isSessionActive)
                        } catch {
                            print("[Dictation] Failed to start: \(error.localizedDescription)")
                        }
                    }
                }
            }) {
                ZStack {
                    if dictationService.isRecording {
                        Circle()
                            .stroke(QMDesign.Colors.error.opacity(0.4), lineWidth: 2)
                            .frame(width: 32, height: 32)
                            .scaleEffect(dictationPulse ? 1.4 : 1.0)
                            .opacity(dictationPulse ? 0 : 0.6)
                    }

                    Circle()
                        .fill(dictationService.isRecording
                            ? QMDesign.Colors.error.opacity(0.2)
                            : Color.clear)
                        .frame(width: 28, height: 28)

                    Image(systemName: dictationService.isRecording ? QMDesign.Icons.microphone : "mic")
                        .font(.system(size: 12, weight: dictationService.isRecording ? .bold : .regular))
                        .foregroundColor(dictationService.isRecording
                            ? QMDesign.Colors.error
                            : QMDesign.Colors.textTertiary)
                }
            }
            .buttonStyle(.plain)
            .onChange(of: dictationService.isRecording) { recording in
                if recording {
                    withAnimation(.easeInOut(duration: 1.0).repeatForever(autoreverses: false)) {
                        dictationPulse = true
                    }
                } else {
                    withAnimation(.easeOut(duration: 0.2)) {
                        dictationPulse = false
                    }
                }
            }

            // Text Field
            TextField(
                dictationService.isRecording ? "Listening..." : "Ask about your conversation...",
                text: $inputText
            )
            .textFieldStyle(.plain)
            .font(QMDesign.Typography.bodySmall)
            .onSubmit(onSubmit)

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
            }
            .buttonStyle(.plain)
        }
        .padding(.horizontal, QMDesign.Spacing.sm)
        .padding(.vertical, QMDesign.Spacing.xs)
        .background(
            RoundedRectangle(cornerRadius: QMDesign.Radius.lg)
                .fill(QMDesign.Colors.surfaceLight)
                .overlay(
                    RoundedRectangle(cornerRadius: QMDesign.Radius.lg)
                        .stroke(dictationService.isRecording
                            ? QMDesign.Colors.error.opacity(0.3)
                            : QMDesign.Colors.borderSubtle, lineWidth: 1)
                )
        )
        .onChange(of: dictationService.interimText) { newText in
            if !newText.isEmpty {
                inputText = newText
            }
        }
    }
}

// MARK: - Smart Mode Toast

struct SmartModeToast: View {
    var body: some View {
        HStack(spacing: QMDesign.Spacing.xs) {
            Image(systemName: QMDesign.Icons.smart)
                .font(.system(size: 14, weight: .medium))
                .foregroundStyle(QMDesign.Colors.primaryGradient)

            VStack(alignment: .leading, spacing: 2) {
                Text("Smart Mode enabled")
                    .font(QMDesign.Typography.labelSmall)
                    .foregroundColor(QMDesign.Colors.textPrimary)

                Text("Responses may take longer but will be more thoughtful")
                    .font(QMDesign.Typography.captionSmall)
                    .foregroundColor(QMDesign.Colors.textSecondary)
            }
        }
        .padding(.horizontal, QMDesign.Spacing.md)
        .padding(.vertical, QMDesign.Spacing.sm)
        .background(
            RoundedRectangle(cornerRadius: QMDesign.Radius.lg)
                .fill(QMDesign.Colors.backgroundSecondary)
                .shadow(
                    color: QMDesign.Shadows.medium.color,
                    radius: QMDesign.Shadows.medium.radius,
                    x: QMDesign.Shadows.medium.x,
                    y: QMDesign.Shadows.medium.y
                )
        )
        .overlay(
            RoundedRectangle(cornerRadius: QMDesign.Radius.lg)
                .stroke(QMDesign.Colors.accent.opacity(0.3), lineWidth: 1)
        )
    }
}

// MARK: - Transcription Connection Banner

struct TranscriptionConnectionBanner: View {
    @ObservedObject var transcriptionService: TranscriptionService
    let onRetry: () -> Void

    var body: some View {
        switch transcriptionService.connectionState {
        case .reconnecting(let attempt, let maxAttempts):
            HStack(spacing: QMDesign.Spacing.xs) {
                ProgressView()
                    .scaleEffect(0.6)
                    .frame(width: 14, height: 14)
                Text("Reconnecting (\(attempt)/\(maxAttempts))...")
                    .font(QMDesign.Typography.captionSmall)
            }
            .foregroundColor(QMDesign.Colors.warning)
            .padding(.horizontal, QMDesign.Spacing.sm)
            .padding(.vertical, 4)
            .background(
                Capsule()
                    .fill(QMDesign.Colors.warningLight)
            )

        case .failed:
            VStack(alignment: .leading, spacing: 3) {
                HStack(spacing: QMDesign.Spacing.xs) {
                    Image(systemName: "pause.circle.fill")
                        .font(.system(size: 10))
                    Text("Transcription paused")
                        .font(QMDesign.Typography.captionSmall)
                        .fontWeight(.medium)

                    if transcriptionService.autoRecoveryCountdown > 0 {
                        Text("- Retry in \(transcriptionService.autoRecoveryCountdown)s")
                            .font(QMDesign.Typography.captionSmall)
                            .foregroundColor(QMDesign.Colors.textTertiary)
                    }

                    Button(action: onRetry) {
                        Text("Retry now")
                            .font(QMDesign.Typography.captionSmall)
                            .fontWeight(.semibold)
                            .padding(.horizontal, 6)
                            .padding(.vertical, 2)
                            .background(
                                Capsule()
                                    .fill(QMDesign.Colors.error.opacity(0.3))
                            )
                    }
                    .buttonStyle(.plain)
                }

                HStack(spacing: 4) {
                    Image(systemName: "checkmark.circle.fill")
                        .font(.system(size: 8))
                        .foregroundColor(QMDesign.Colors.success)
                    Text("AI Assist still works with existing transcript")
                        .font(.system(size: 9))
                        .foregroundColor(QMDesign.Colors.success)
                }
            }
            .foregroundColor(QMDesign.Colors.error)
            .padding(.horizontal, QMDesign.Spacing.sm)
            .padding(.vertical, 5)
            .background(
                RoundedRectangle(cornerRadius: QMDesign.Radius.sm)
                    .fill(QMDesign.Colors.errorLight)
            )

        default:
            EmptyView()
        }
    }
}

// MARK: - AI Error Toast

struct AIErrorToast: View {
    let message: String
    let onDismiss: () -> Void

    var body: some View {
        HStack(spacing: QMDesign.Spacing.xs) {
            Image(systemName: "exclamationmark.circle.fill")
                .font(.system(size: 12, weight: .semibold))

            Text(message)
                .font(QMDesign.Typography.captionSmall)
                .lineLimit(2)

            Spacer()

            Button(action: onDismiss) {
                Image(systemName: "xmark")
                    .font(.system(size: 9, weight: .bold))
                    .frame(width: 16, height: 16)
                    .background(
                        Circle()
                            .fill(QMDesign.Colors.error.opacity(0.3))
                    )
            }
            .buttonStyle(.plain)
        }
        .foregroundColor(QMDesign.Colors.error)
        .padding(.horizontal, QMDesign.Spacing.sm)
        .padding(.vertical, QMDesign.Spacing.xs)
        .background(
            RoundedRectangle(cornerRadius: QMDesign.Radius.sm)
                .fill(QMDesign.Colors.errorLight)
                .overlay(
                    RoundedRectangle(cornerRadius: QMDesign.Radius.sm)
                        .stroke(QMDesign.Colors.error.opacity(0.3), lineWidth: 1)
                )
        )
    }
}
