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
    @State private var showSmartModeToast = false
    @State private var showDisplayToast = false
    @State private var currentDisplayName = String(localized: "overlay.display.primary")
    @AppStorage("enableScreenCapture") private var enableScreenCapture = true
    @AppStorage("hasSeenSmartModeHint") private var hasSeenSmartModeHint = false
    @State private var showLimitPricingSheet = false

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
            // Modern Pill Header
            ModernPillHeaderView(
                isExpanded: overlayController.isExpanded,
                isSessionActive: appState.isSessionActive,
                isFinalizingSession: appState.isFinalizingSession,
                detectedMoment: appState.autoAnswerService.lastDetectedMoment,
                preGenerationService: appState.preGenerationService,
                transcriptionService: appState.transcriptionService,
                enableScreenCapture: $enableScreenCapture,
                isAutoAnswerEnabled: isAutoAnswerEnabled,
                isSmartModeEnabled: isSmartModeEnabled,
                showPopupMenu: $showPopupMenu,
                onToggleExpand: { overlayController.toggleExpanded() },
                onStart: {
                    // Show contact picker directly in widget
                    showingContactPicker = true
                },
                onStop: { Task { await appState.stopSession() } },
                onCopyResponse: {
                    let content: String? = if !appState.aiService.currentResponse.isEmpty {
                        appState.aiService.currentResponse
                    } else {
                        appState.aiService.responses.first?.content
                    }
                    guard let content, !content.isEmpty else { return }
                    // Extract last code block, or fall back to full response
                    let blocks = MarkdownParser.parse(content)
                    let codeContent = blocks.reversed().compactMap { block -> String? in
                        if case .codeBlock(let code, _) = block, !code.isEmpty { return code }
                        return nil
                    }.first
                    NSPasteboard.general.clearContents()
                    NSPasteboard.general.setString(codeContent ?? content, forType: .string)
                },
                onClearContext: { appState.clearContext() },
                onMovePosition: { position in overlayController.moveToPosition(position) }
            )

            // Expanded Content
            if overlayController.isExpanded {
                ModernExpandedContentView(
                    appState: appState,
                    aiService: appState.aiService,
                    sessionManager: sessionManager,
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
        .overlay(alignment: .bottom) {
            VStack(spacing: QMDesign.Spacing.xs) {
                // Display Selection Toast
                if showDisplayToast {
                    DisplaySelectionToast(displayName: currentDisplayName)
                        .transition(.move(edge: .bottom).combined(with: .opacity))
                }

                // Smart Mode Toast
                if showSmartModeToast {
                    SmartModeToast()
                        .transition(.move(edge: .bottom).combined(with: .opacity))
                }
            }
            .padding(.bottom, QMDesign.Spacing.md)
        }
        .onChange(of: appState.isSessionActive) { wasActive, isActive in
            // Show toast when session starts
            if !wasActive && isActive {
                Task {
                    await updateDisplayName()
                    withAnimation(QMDesign.Animation.smooth) {
                        showDisplayToast = true
                    }

                    // Auto-dismiss after 3 seconds
                    try? await Task.sleep(nanoseconds: 3_000_000_000)
                    withAnimation(QMDesign.Animation.smooth) {
                        showDisplayToast = false
                    }
                }
            }
        }
        .onChange(of: config.smartModeEnabled) { isEnabled in
            if isEnabled {
                withAnimation(QMDesign.Animation.smooth) {
                    showSmartModeToast = true
                }

                // Auto-dismiss after 4 seconds
                DispatchQueue.main.asyncAfter(deadline: .now() + 4) {
                    withAnimation(QMDesign.Animation.smooth) {
                        showSmartModeToast = false
                    }
                }
            } else {
                withAnimation(QMDesign.Animation.smooth) {
                    showSmartModeToast = false
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
        .sheet(isPresented: $showLimitPricingSheet) {
            PricingView(contextMessage: String(localized: "pricing.trigger.limitReached"))
        }
    }

    private func updateDisplayName() async {
        let screenService = ScreenCaptureService()
        let displays = await screenService.getAvailableDisplays()

        if displays.isEmpty {
            currentDisplayName = String(localized: "overlay.display.primary")
            return
        }

        if config.selectedDisplayID == 0 {
            if let first = displays.first {
                currentDisplayName = "\(first.name) • \(first.resolution)"
            } else {
                currentDisplayName = String(localized: "overlay.display.primary")
            }
        } else if let selected = displays.first(where: { $0.id == config.selectedDisplayID }) {
            currentDisplayName = "\(selected.name) • \(selected.resolution)"
        } else {
            // Fallback - selected display not found
            if let first = displays.first {
                currentDisplayName = "\(first.name) • \(first.resolution)"
            } else {
                currentDisplayName = String(localized: "overlay.display.primary")
            }
        }
    }

    private func handleSubmit() {
        // Guard against double-fire (TabBar + InputBar both calling onSubmit)
        guard !appState.aiService.isProcessing else {
            print("[Overlay] Skipping submit — already processing")
            return
        }

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
            if case .limitReached = aiAccess {
                showLimitPricingSheet = true
            } else {
                appState.errorMessage = aiAccess.errorMessage
                appState.isErrorRetryable = false
            }
            return
        }

        // Check Smart Mode access if enabled
        if config.smartModeEnabled {
            let smartModeAccess = licenseManager.canUse(.smartMode)
            if !smartModeAccess.isAllowed {
                appState.errorMessage = smartModeAccess.errorMessage
                appState.isErrorRetryable = false
                return
            }
        }

        // Immediately show processing indicator for better UX
        appState.aiService.isProcessing = true
        appState.aiService.currentResponse = ""

        Task {
            do {
                // Only capture screenshot for modes that benefit from visual context
                // WhatToSay, FollowUp, and Recap use text-only context — skip capture entirely
                // Saves ~200-500ms (capture + base64 encoding + vision token processing)
                let screenshotNeeded = selectedTab == .assist || hasCustomPrompt
                let screenshot: Data? = if enableScreenCapture && screenshotNeeded {
                    try? await appState.screenService.getScreenshotForAI()
                } else {
                    nil
                }

                hasScreenshot = screenshot != nil
                if hasScreenshot {
                    lastScreenshotTime = Date()
                }

                let screenshotSize = screenshot?.count ?? 0
                let cacheStatus = screenshot != nil ? "(may be cached)" : ""
                print("[Overlay] Screen capture \(enableScreenCapture ? "enabled" : "disabled") - Screenshot: \(hasScreenshot ? "captured (\(screenshotSize / 1024)KB) \(cacheStatus)" : "skipped (low value or disabled)")")

                // Phase 3 Optimization: Trim transcript for real-time tabs to reduce latency
                // Recap uses full transcript for comprehensive summary
                let transcriptForRequest: String
                switch selectedTab {
                case .recap:
                    // Recap needs full transcript for comprehensive summary
                    transcriptForRequest = appState.currentTranscript
                default:
                    // Assist, WhatToSay, FollowUp use trimmed transcript (last 4000 chars)
                    transcriptForRequest = AIService.trimTranscript(
                        appState.currentTranscript,
                        maxLength: AIService.defaultMaxTranscriptLength
                    )
                }

                let originalLength = appState.currentTranscript.count
                let trimmedLength = transcriptForRequest.count
                if originalLength != trimmedLength {
                    print("[Overlay] Transcript trimmed: \(originalLength) → \(trimmedLength) chars")
                }

                // Use custom prompt if provided, otherwise use tab-specific methods
                if hasCustomPrompt {
                    // Custom question with user's prompt
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
                        // Check for pre-generated response (instant path)
                        if let preGenText = appState.preGenerationService.consumeBuffer() {
                            // Display the pre-generated response
                            appState.aiService.currentResponse = preGenText

                            // Commit as a real AIResponse (same as normal streaming completion)
                            let response = AIResponse(
                                type: .assist,
                                content: preGenText,
                                provider: appState.aiService.lastProvider ?? .openai
                            )
                            appState.aiService.responses.insert(response, at: 0)

                            // Persist to SwiftData
                            if let ctx = appState.aiService.modelContext {
                                ctx.insert(response)
                                try? ctx.save()
                            }

                            appState.aiService.isProcessing = false
                            print("[Overlay] Instant response from pre-gen buffer (\(preGenText.count) chars)")
                        } else {
                            // Cancel any in-flight pre-gen before normal request
                            appState.preGenerationService.cancelAndReset()
                            for try await chunk in appState.aiService.assistStreaming(
                                transcript: transcriptForRequest,
                                screenshot: screenshot,
                                mode: appState.selectedMode
                            ) {
                                _ = chunk
                            }
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
                        // Recap uses transcript only — no screenshot needed for meeting summaries
                        // Also avoids AI safety filter refusals triggered by faces in video calls
                        let response = try await appState.aiService.recap(
                            transcript: transcriptForRequest,
                            screenshot: nil,
                            mode: appState.selectedMode
                        )
                        appState.aiService.currentResponse = response.content
                    case .briefing:
                        // Briefing tab doesn't trigger AI requests - it shows contact info
                        break
                    }
                }

                inputText = ""
                print("[Overlay] Request completed successfully")
            } catch {
                print("[Overlay] Error: \(error)")
                appState.errorMessage = localizedErrorMessage(for: error)
                appState.isErrorRetryable = isRetryableError(error)
                // Ensure processing state is reset on error
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

    /// Tabs that are always visible vs context-dependent
    static var alwaysVisible: [TabItem] {
        [.assist, .whatToSay, .followUp, .recap]
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

// MARK: - Free Request Counter

private struct FreeRequestCounter: View {
    @ObservedObject private var licenseManager = LicenseManager.shared
    @State private var showPricingSheet = false

    private var remaining: Int {
        licenseManager.remainingUses(for: .aiRequest) ?? 0
    }

    private var limit: Int {
        licenseManager.currentLicense.features.dailyAiRequestLimit ?? 1
    }

    private var isExhausted: Bool { remaining == 0 }

    var body: some View {
        Button(action: { showPricingSheet = true }) {
            Text("\(remaining)/\(limit)")
                .font(.system(size: 10, weight: .bold, design: .monospaced))
                .padding(.horizontal, 6)
                .padding(.vertical, 3)
                .background(
                    Capsule()
                        .fill(isExhausted ? QMDesign.Colors.warning.opacity(0.25) : QMDesign.Colors.surfaceLight)
                )
                .foregroundColor(isExhausted ? QMDesign.Colors.warning : QMDesign.Colors.textTertiary)
        }
        .buttonStyle(.plain)
        .help(String(localized: "overlay.counter.tooltip"))
        .sheet(isPresented: $showPricingSheet) {
            PricingView(contextMessage: isExhausted ? String(localized: "pricing.trigger.limitReached") : nil)
        }
    }
}

// MARK: - Modern Pill Header View

struct ModernPillHeaderView: View {
    let isExpanded: Bool
    let isSessionActive: Bool
    let isFinalizingSession: Bool
    let detectedMoment: MomentDetectionService.DetectedMoment?
    @ObservedObject var preGenerationService: PreGenerationService
    @ObservedObject var transcriptionService: TranscriptionService
    @Binding var enableScreenCapture: Bool
    @Binding var isAutoAnswerEnabled: Bool
    @Binding var isSmartModeEnabled: Bool
    @Binding var showPopupMenu: Bool
    let onToggleExpand: () -> Void
    let onStart: () -> Void
    let onStop: () -> Void
    let onCopyResponse: () -> Void
    let onClearContext: () -> Void
    let onMovePosition: (OverlayPosition) -> Void

    @State private var isHoveringExpand = false
    @State private var isHoveringMore = false
    @State private var isHoveringDashboard = false
    @State private var isHoveringPlay = false  // Hover state for play button
    @State private var isHoveringHidden = false  // Hover state for hidden mode button
    @State private var isAutoPulsing = false  // Pulsing animation for auto mode
    @State private var isChevronPulsing = false  // Pulsing animation for expand hint
    @State private var isPlayPulsing = false  // Pulsing animation for play button
    @State private var showExpandPreview = false  // Hover preview state
    @State private var isMomentPulsing = false  // Pulsing animation for moment detection
    @State private var isPreGenPulsing = false  // Pulsing animation for pre-gen ready
    @Environment(\.openWindow) private var openWindow

    // Observe ConfigurationManager for undetectability
    @ObservedObject private var config = ConfigurationManager.shared

    var body: some View {
        HStack(spacing: QMDesign.Spacing.xs) {
            // Logo (drag handle to move widget)
            ZStack {
                Circle()
                    .fill(QMDesign.Colors.primaryGradient)
                    .frame(width: 28, height: 28)

                Image(systemName: "waveform")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundColor(.white)
            }
            .overlay(WindowDragHandle())
            .help(String(localized: "overlay.tooltip.dragToMove"))

            // Dashboard Button (explicit action)
            Button(action: toggleDashboard) {
                Image(systemName: "house.fill")
                    .font(.system(size: 12, weight: .medium))
                    .foregroundColor(isHoveringDashboard ? QMDesign.Colors.accent : QMDesign.Colors.textSecondary)
                    .frame(width: 26, height: 26)
                    .background(
                        Circle()
                            .fill(isHoveringDashboard ? QMDesign.Colors.accent.opacity(0.15) : QMDesign.Colors.surfaceLight)
                    )
                    .scaleEffect(isHoveringDashboard ? 1.1 : 1.0)
            }
            .buttonStyle(.plain)
            .onHover { isHoveringDashboard = $0 }
            .animation(QMDesign.Animation.quick, value: isHoveringDashboard)
            .help(String(localized: "overlay.tooltip.openDashboard"))

            // Expand/Collapse Button with animated chevron
            Button(action: onToggleExpand) {
                ZStack {
                    // Pulsing ring when collapsed (indicates hidden content)
                    if !isExpanded {
                        Circle()
                            .stroke(QMDesign.Colors.accent.opacity(0.4), lineWidth: 2)
                            .frame(width: 32, height: 32)
                            .scaleEffect(isChevronPulsing ? 1.3 : 1.0)
                            .opacity(isChevronPulsing ? 0 : 0.6)
                    }

                    // Main button
                    Group {
                        if isExpanded {
                            Circle()
                                .fill(QMDesign.Colors.surfaceMedium)
                        } else {
                            Circle()
                                .fill(QMDesign.Colors.primaryGradient)
                        }
                    }
                    .frame(width: 28, height: 28)

                    // Animated chevron
                    Image(systemName: "chevron.down")
                        .font(.system(size: 12, weight: .bold))
                        .foregroundColor(isExpanded ? QMDesign.Colors.textPrimary : .white)
                        .rotationEffect(.degrees(isExpanded ? 180 : 0))
                }
                .scaleEffect(isHoveringExpand ? 1.1 : 1.0)
            }
            .buttonStyle(.plain)
            .onHover { hovering in
                isHoveringExpand = hovering
                // Show preview only when collapsed and hovering
                if !isExpanded {
                    showExpandPreview = hovering
                }
            }
            .animation(QMDesign.Animation.quick, value: isHoveringExpand)
            .animation(QMDesign.Animation.smooth, value: isExpanded)
            .onAppear {
                if !isExpanded {
                    startChevronPulse()
                }
            }
            .onChange(of: isExpanded) { expanded in
                if expanded {
                    isChevronPulsing = false
                    showExpandPreview = false
                } else {
                    startChevronPulse()
                }
            }
            .help(isExpanded ? String(localized: "overlay.tooltip.collapsePanel") : String(localized: "overlay.tooltip.expandAssistant"))
            .popover(isPresented: $showExpandPreview, arrowEdge: .bottom) {
                ExpandPreviewView()
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

            // FREE plan request counter
            if !LicenseManager.shared.isPro {
                FreeRequestCounter()
            }

            Spacer()

            // Status Indicators
            HStack(spacing: 4) {
                // Proactive Moment Badge (Enterprise)
                if let moment = detectedMoment {
                    HStack(spacing: 3) {
                        Circle()
                            .fill(Color(
                                red: moment.type.color.red,
                                green: moment.type.color.green,
                                blue: moment.type.color.blue
                            ))
                            .frame(width: 6, height: 6)
                            .scaleEffect(isMomentPulsing ? 1.4 : 1.0)
                            .opacity(isMomentPulsing ? 0.6 : 1.0)
                            .animation(.easeInOut(duration: 0.8).repeatForever(autoreverses: true), value: isMomentPulsing)
                            .onAppear { isMomentPulsing = true }

                        Image(systemName: moment.type.icon)
                            .font(.system(size: 9, weight: .semibold))
                        Text(moment.type.label)
                            .font(.system(size: 9, weight: .medium))
                    }
                    .padding(.horizontal, 6)
                    .padding(.vertical, 3)
                    .background(
                        Capsule()
                            .fill(Color(
                                red: moment.type.color.red,
                                green: moment.type.color.green,
                                blue: moment.type.color.blue
                            ).opacity(0.2))
                    )
                    .foregroundColor(Color(
                        red: moment.type.color.red,
                        green: moment.type.color.green,
                        blue: moment.type.color.blue
                    ))
                    .help(String(localized: "overlay.tooltip.proactiveDetected \(moment.type.label)"))
                }

                // Undetectability Mode Indicator
                if config.isUndetectabilityEnabled {
                    StatusBadge(
                        icon: "eye.slash.fill",
                        label: String(localized: "overlay.status.hidden"),
                        color: QMDesign.Colors.success,
                        isActive: true
                    )
                    .help(String(localized: "overlay.tooltip.undetectableMode"))
                }

                // Smart Mode Indicator
                if isSmartModeEnabled {
                    StatusBadge(
                        icon: "brain.head.profile",
                        label: String(localized: "overlay.status.smart"),
                        color: QMDesign.Colors.accent,
                        isActive: true
                    )
                    .help(String(localized: "overlay.tooltip.smartModeActive"))
                }

                // Pre-Generation Ready Indicator
                if case .ready = preGenerationService.state {
                    StatusBadge(
                        icon: "bolt.fill",
                        label: String(localized: "overlay.status.ready"),
                        color: QMDesign.Colors.success,
                        isActive: true
                    )
                    .help(String(localized: "overlay.tooltip.preGenReady"))
                } else if case .generating = preGenerationService.state {
                    // Subtle pulsing dot while generating
                    Circle()
                        .fill(QMDesign.Colors.accent)
                        .frame(width: 5, height: 5)
                        .opacity(isPreGenPulsing ? 0.3 : 0.9)
                        .animation(.easeInOut(duration: 0.8).repeatForever(autoreverses: true), value: isPreGenPulsing)
                        .onAppear { isPreGenPulsing = true }
                        .onDisappear { isPreGenPulsing = false }
                }
            }

            // Hidden Mode Toggle (Enterprise only) - Quick access to Undetectability
            let hiddenModeAvailable = LicenseManager.shared.isFeatureAvailable(.undetectable)
            Button(action: {
                if hiddenModeAvailable {
                    config.isUndetectabilityEnabled.toggle()
                }
            }) {
                HStack(spacing: 4) {
                    Image(systemName: config.isUndetectabilityEnabled ? "eye.slash.fill" : "eye.slash")
                        .font(.system(size: 11))
                    Text(String(localized: "overlay.status.hidden"))
                        .font(QMDesign.Typography.caption)
                    if !hiddenModeAvailable {
                        Image(systemName: "lock.fill")
                            .font(.system(size: 8))
                    }
                }
                .padding(.horizontal, QMDesign.Spacing.xs)
                .padding(.vertical, 4)
                .background(
                    Capsule()
                        .fill(config.isUndetectabilityEnabled && hiddenModeAvailable ? QMDesign.Colors.success.opacity(0.2) : QMDesign.Colors.surfaceLight)
                )
                .foregroundColor(config.isUndetectabilityEnabled && hiddenModeAvailable ? QMDesign.Colors.success : QMDesign.Colors.textTertiary)
                .opacity(hiddenModeAvailable ? 1 : 0.6)
                .scaleEffect(isHoveringHidden ? 1.05 : 1.0)
            }
            .buttonStyle(.plain)
            .onHover { isHoveringHidden = $0 }
            .animation(QMDesign.Animation.quick, value: isHoveringHidden)
            .help(hiddenModeAvailable
                ? (config.isUndetectabilityEnabled ? String(localized: "overlay.tooltip.hiddenModeOn") : String(localized: "overlay.tooltip.hiddenModeOff"))
                : String(localized: "overlay.tooltip.hiddenModeRequiresEnterprise"))

            // Auto-Answer Toggle (Enterprise only) with pulsing indicator
            let autoAnswerAvailable = LicenseManager.shared.isFeatureAvailable(.autoAnswer)
            Button(action: {
                if autoAnswerAvailable {
                    isAutoAnswerEnabled.toggle()
                }
            }) {
                HStack(spacing: 4) {
                    // Pulsing indicator when Auto is active
                    if isAutoAnswerEnabled && autoAnswerAvailable {
                        Circle()
                            .fill(QMDesign.Colors.autoAnswer)
                            .frame(width: 6, height: 6)
                            .scaleEffect(isAutoPulsing ? 1.4 : 1.0)
                            .opacity(isAutoPulsing ? 0.6 : 1.0)
                            .animation(.easeInOut(duration: 1.0).repeatForever(autoreverses: true), value: isAutoPulsing)
                            .onAppear { isAutoPulsing = true }
                            .onDisappear { isAutoPulsing = false }
                    }

                    Image(systemName: isAutoAnswerEnabled ? QMDesign.Icons.autoAnswer : QMDesign.Icons.autoAnswerOff)
                        .font(.system(size: 11))
                    Text(String(localized: "overlay.status.auto"))
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
            .help(autoAnswerAvailable
                ? (isAutoAnswerEnabled ? String(localized: "overlay.tooltip.autoAnswerOn") : String(localized: "overlay.tooltip.autoAnswerOff"))
                : String(localized: "overlay.tooltip.autoAnswerRequiresEnterprise"))

            // Screen Capture Toggle - Enhanced visibility when disabled
            Button(action: { enableScreenCapture.toggle() }) {
                ZStack {
                    // Background circle
                    Circle()
                        .fill(enableScreenCapture ? QMDesign.Colors.successLight : QMDesign.Colors.errorLight)
                        .frame(width: 26, height: 26)

                    // Icon with clearer disabled state
                    Image(systemName: enableScreenCapture ? QMDesign.Icons.camera : "video.slash")
                        .font(.system(size: 12, weight: enableScreenCapture ? .regular : .semibold))
                        .foregroundColor(enableScreenCapture ? QMDesign.Colors.success : QMDesign.Colors.error)
                }
            }
            .buttonStyle(.plain)
            .help(enableScreenCapture ? String(localized: "overlay.tooltip.screenCaptureOn") : String(localized: "overlay.tooltip.screenCaptureOff"))

            // More Button (Popup Menu) - works in both collapsed and expanded states
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
            .help(String(localized: "overlay.tooltip.settingsMenu"))
            .popover(isPresented: $showPopupMenu, arrowEdge: .bottom) {
                OverlayPopupMenu(
                    isAutoAnswerEnabled: $isAutoAnswerEnabled,
                    isSmartModeEnabled: $isSmartModeEnabled,
                    enableScreenCapture: $enableScreenCapture,
                    isVisible: $showPopupMenu,
                    selectedDisplayID: $config.selectedDisplayID,
                    onCopyResponse: onCopyResponse,
                    onClearContext: onClearContext,
                    onMovePosition: onMovePosition
                )
            }

            // Finalization indicator (when generating summary)
            if isFinalizingSession {
                HStack(spacing: 6) {
                    ProgressView()
                        .scaleEffect(0.7)
                        .frame(width: 14, height: 14)
                    Text(String(localized: "overlay.summarizing"))
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

            // Start Button (when session inactive and not finalizing) - PROMINENT
            if !isSessionActive && !isFinalizingSession {
                Button(action: onStart) {
                    ZStack {
                        // Pulsing glow ring
                        Circle()
                            .fill(QMDesign.Colors.primaryGradient.opacity(0.3))
                            .frame(width: 38, height: 38)
                            .scaleEffect(isPlayPulsing ? 1.2 : 1.0)
                            .opacity(isPlayPulsing ? 0 : 0.6)

                        // Main button
                        Circle()
                            .fill(QMDesign.Colors.primaryGradient)
                            .frame(width: 32, height: 32)
                            .shadow(color: QMDesign.Colors.accent.opacity(0.5), radius: 8, x: 0, y: 2)

                        Image(systemName: "play.fill")
                            .font(.system(size: 12, weight: .bold))
                            .foregroundColor(.white)
                    }
                    .scaleEffect(isHoveringPlay ? 1.15 : 1.0)
                }
                .buttonStyle(.plain)
                .onHover { isHoveringPlay = $0 }
                .animation(QMDesign.Animation.quick, value: isHoveringPlay)
                .onAppear {
                    startPlayPulse()
                }
                .help(String(localized: "overlay.tooltip.startSession"))
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
                .help(String(localized: "overlay.tooltip.stopSession"))
            }
        }
        .padding(.horizontal, QMDesign.Spacing.sm)
        .padding(.vertical, QMDesign.Spacing.xs)
        .frame(maxWidth: .infinity)
        .frame(height: QMDesign.Dimensions.Overlay.headerHeight)
    }

    /// Pulse chevron for 3 seconds then stop to save energy
    private func startChevronPulse() {
        withAnimation(.easeInOut(duration: 1.5).repeatForever(autoreverses: true)) {
            isChevronPulsing = true
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + 3) {
            withAnimation(.easeOut(duration: 0.3)) {
                isChevronPulsing = false
            }
        }
    }

    /// Pulse play button for 3 seconds then stop to save energy
    private func startPlayPulse() {
        withAnimation(.easeInOut(duration: 1.2).repeatForever(autoreverses: true)) {
            isPlayPulsing = true
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + 3) {
            withAnimation(.easeOut(duration: 0.3)) {
                isPlayPulsing = false
            }
        }
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
    @ObservedObject var sessionManager: SessionManager
    @Binding var selectedTab: TabItem
    @Binding var inputText: String
    @Binding var isSmartModeEnabled: Bool
    let hasScreenshot: Bool
    let lastScreenshotTime: Date?
    let enableScreenCapture: Bool
    let onSubmit: () -> Void

    @ObservedObject private var config = ConfigurationManager.shared

    /// Tabs to display - includes Briefing only if contact is associated
    private var visibleTabs: [TabItem] {
        if appState.currentSessionContact != nil {
            return TabItem.allCases
        } else {
            return TabItem.alwaysVisible
        }
    }

    @State private var aiErrorDismissTask: Task<Void, Never>?
    @State private var showCopiedToast = false

    /// Extracts the last code block from a markdown response
    private func lastCodeBlock(from content: String) -> String? {
        let blocks = MarkdownParser.parse(content)
        // Find the last code block
        for block in blocks.reversed() {
            if case .codeBlock(let code, _) = block, !code.isEmpty {
                return code
            }
        }
        return nil
    }

    private func copyLatestResponse() {
        // Get latest response content
        let content: String? = if !aiService.currentResponse.isEmpty {
            aiService.currentResponse
        } else {
            aiService.responses.first?.content
        }
        guard let content, !content.isEmpty else { return }

        // Extract last code block, or fall back to full response
        let textToCopy = lastCodeBlock(from: content) ?? content
        NSPasteboard.general.clearContents()
        NSPasteboard.general.setString(textToCopy, forType: .string)
        showCopiedToast = true
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) {
            showCopiedToast = false
        }
    }

    var body: some View {
        VStack(spacing: QMDesign.Spacing.sm) {
            // AI Error Toast (shown when appState.errorMessage is set)
            if let errorMessage = appState.errorMessage, !errorMessage.isEmpty {
                AIErrorToast(
                    message: errorMessage,
                    isRetryable: appState.isErrorRetryable,
                    onDismiss: {
                        appState.clearError()
                    },
                    onRetry: {
                        appState.clearError()
                        onSubmit()
                    }
                )
                .transition(.move(edge: .top).combined(with: .opacity))
                .onAppear {
                    aiErrorDismissTask?.cancel()
                    // Only auto-dismiss non-retryable errors — retryable ones stay until user acts
                    guard !appState.isErrorRetryable else { return }
                    aiErrorDismissTask = Task {
                        try? await Task.sleep(nanoseconds: 5_000_000_000)
                        guard !Task.isCancelled else { return }
                        withAnimation(QMDesign.Animation.smooth) {
                            appState.clearError()
                        }
                    }
                }
                .animation(QMDesign.Animation.smooth, value: appState.errorMessage)
            }

            // Live Transcript Strip
            if appState.isSessionActive && config.showTranscriptInOverlay {
                OverlayTranscriptStripView(transcriptionService: appState.transcriptionService)
                    .transition(.opacity.combined(with: .move(edge: .top)))
            }

            // Content Area - switches based on selected tab
            if selectedTab == .briefing {
                // Memory Palace Briefing View
                if let contact = appState.currentSessionContact {
                    ContactBriefingView(contact: contact)
                } else {
                    EmptyBriefingView()
                }
            } else {
                // Response Area (for AI tabs)
                ModernResponseHistoryView(
                    responses: aiService.responses,
                    currentResponse: aiService.currentResponse,
                    isProcessing: aiService.isProcessing,
                    hasScreenshot: hasScreenshot,
                    lastScreenshotTime: lastScreenshotTime,
                    onDismissResponse: { response in
                        aiService.dismissResponse(response)
                    }
                )
            }

            // Action Buttons (always visible at bottom, above status/input)
            ModernTabBarView(selectedTab: $selectedTab, visibleTabs: visibleTabs) { tab in
                if tab != .briefing {
                    onSubmit()
                }
            }

            // Status & Input (non-briefing only)
            if selectedTab != .briefing {
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
                    dictationService: appState.dictationService,
                    isSessionActive: appState.isSessionActive,
                    onSubmit: onSubmit
                )
            }
        }
        .padding(.horizontal, QMDesign.Spacing.sm)
        .padding(.bottom, QMDesign.Spacing.sm)
        .overlay(alignment: .top) {
            // Copy confirmation toast
            if showCopiedToast {
                HStack(spacing: QMDesign.Spacing.xs) {
                    Image(systemName: "checkmark.circle.fill")
                        .font(.system(size: 12))
                        .foregroundColor(QMDesign.Colors.success)
                    Text(String(localized: "overlay.toast.copied"))
                        .font(QMDesign.Typography.caption)
                        .foregroundColor(QMDesign.Colors.textPrimary)
                }
                .padding(.horizontal, QMDesign.Spacing.md)
                .padding(.vertical, QMDesign.Spacing.xs)
                .background(
                    Capsule()
                        .fill(QMDesign.Colors.backgroundSecondary)
                        .shadow(color: QMDesign.Shadows.medium.color, radius: QMDesign.Shadows.medium.radius)
                )
                .transition(.move(edge: .top).combined(with: .opacity))
                .padding(.top, QMDesign.Spacing.sm)
            }
        }
        .animation(QMDesign.Animation.smooth, value: showCopiedToast)
        .background {
            // Hidden button for Cmd+Shift+C keyboard shortcut
            Button(action: copyLatestResponse) {
                EmptyView()
            }
            .keyboardShortcut("c", modifiers: [.command, .shift])
            .opacity(0)
            .frame(width: 0, height: 0)
        }
    }
}

// MARK: - Action Button Bar View

struct ModernTabBarView: View {
    @Binding var selectedTab: TabItem
    var visibleTabs: [TabItem] = TabItem.alwaysVisible
    let onTabSelected: (TabItem) -> Void

    @Namespace private var tabAnimation

    var body: some View {
        HStack(spacing: 6) {
            ForEach(visibleTabs, id: \.self) { tab in
                ActionButton(
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
        .frame(height: QMDesign.Dimensions.Overlay.tabBarHeight)
    }
}

// MARK: - Action Button

struct ActionButtonStyle: ButtonStyle {
    let isSelected: Bool
    let isHovered: Bool

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .shadow(
                color: isSelected
                    ? QMDesign.Colors.accent.opacity(configuration.isPressed ? 0.1 : 0.25)
                    : Color.black.opacity(configuration.isPressed ? 0.0 : 0.12),
                radius: configuration.isPressed ? 1 : 4,
                x: 0,
                y: configuration.isPressed ? 1 : 3
            )
            .scaleEffect(configuration.isPressed ? 0.93 : 1.0)
            .animation(QMDesign.Animation.quick, value: configuration.isPressed)
    }
}

struct ActionButton: View {
    let tab: TabItem
    let isSelected: Bool
    let namespace: Namespace.ID
    let action: () -> Void

    @State private var isHovered = false

    private var borderGradient: LinearGradient {
        if isSelected {
            return LinearGradient(
                colors: [QMDesign.Colors.gradientStart.opacity(0.7),
                         QMDesign.Colors.gradientEnd.opacity(0.7)],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
        } else {
            return LinearGradient(
                colors: [QMDesign.Colors.borderMedium, QMDesign.Colors.borderMedium],
                startPoint: .top,
                endPoint: .bottom
            )
        }
    }

    var body: some View {
        Button(action: action) {
            VStack(spacing: 3) {
                Image(systemName: tab.icon)
                    .font(.system(size: 11, weight: isSelected ? .semibold : .medium))
                Text(tab.shortLabel)
                    .font(.system(size: 9, weight: isSelected ? .semibold : .medium))
                    .lineLimit(1)
                    .minimumScaleFactor(0.8)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, QMDesign.Spacing.xs)
            .background(
                ZStack {
                    if isSelected {
                        Capsule()
                            .fill(QMDesign.Colors.primaryGradient.opacity(0.2))
                        Capsule()
                            .fill(QMDesign.Colors.primaryGradient.opacity(0.1))
                            .matchedGeometryEffect(id: "actionSelection", in: namespace)
                    } else {
                        Capsule()
                            .fill(isHovered ? QMDesign.Colors.surfaceHover : QMDesign.Colors.surfaceLight)
                    }
                }
            )
            .overlay(
                Capsule()
                    .stroke(borderGradient, lineWidth: isSelected ? 1.0 : 0.75)
            )
            .foregroundColor(
                isSelected ? QMDesign.Colors.accent : QMDesign.Colors.textSecondary
            )
        }
        .buttonStyle(ActionButtonStyle(isSelected: isSelected, isHovered: isHovered))
        .onHover { isHovered = $0 }
        .animation(QMDesign.Animation.smooth, value: isSelected)
        .animation(QMDesign.Animation.quick, value: isHovered)
    }
}

// MARK: - Modern Response History View

struct ModernResponseHistoryView: View {
    let responses: [AIResponse]
    let currentResponse: String
    let isProcessing: Bool
    let hasScreenshot: Bool
    let lastScreenshotTime: Date?
    var onDismissResponse: ((AIResponse) -> Void)?

    @State private var isUserScrolling = false
    @State private var lastResponseContent = ""
    @State private var scrollDisableTimer: Timer?

    var body: some View {
        VStack(spacing: 0) {
            // Screenshot indicator with gradient border
            if hasScreenshot, let time = lastScreenshotTime {
                HStack(spacing: QMDesign.Spacing.xs) {
                    Image(systemName: QMDesign.Icons.camera)
                        .font(.system(size: 11, weight: .medium))
                        .foregroundColor(QMDesign.Colors.success)
                    Text(String(localized: "overlay.screenCaptured"))
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
                    LazyVStack(alignment: .leading, spacing: QMDesign.Spacing.md) {
                        // Empty state
                        if responses.isEmpty && !isProcessing {
                            EmptyResponseState()
                        }

                        // History (reversed - oldest first, newest at bottom)
                        ForEach(responses.filter { !$0.content.isEmpty }.reversed()) { response in
                            ModernResponseItemView(
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

                        // Current streaming response (at the bottom)
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

                        // Processing state (at the bottom)
                        if isProcessing && currentResponse.isEmpty {
                            ProcessingIndicator()
                                .id("processing")
                        }

                        // Bottom anchor for auto-scroll
                        Color.clear
                            .frame(height: 1)
                            .id("bottom")
                    }
                    .padding(QMDesign.Spacing.sm)
                }
                .simultaneousGesture(
                    DragGesture(minimumDistance: 0)
                        .onChanged { _ in
                            // User is interacting with scroll view - disable auto-scroll
                            if isProcessing {
                                isUserScrolling = true
                                scrollDisableTimer?.invalidate()
                            }
                        }
                )
                .onChange(of: responses.count) { _ in
                    // New response added - reset user scrolling flag and scroll to bottom
                    isUserScrolling = false
                    scrollDisableTimer?.invalidate()

                    withAnimation {
                        proxy.scrollTo("bottom", anchor: .bottom)
                    }
                }
                .onChange(of: currentResponse) { newContent in
                    // Detect if this is a new response starting
                    if lastResponseContent.isEmpty && !newContent.isEmpty {
                        // New response starting - enable auto-scroll
                        isUserScrolling = false
                        scrollDisableTimer?.invalidate()
                    }
                    lastResponseContent = newContent

                    // Only auto-scroll if user hasn't manually scrolled
                    if isProcessing && !isUserScrolling {
                        withAnimation {
                            proxy.scrollTo("bottom", anchor: .bottom)
                        }
                    }
                }
                .onAppear {
                    // Scroll to bottom on appear if there are responses
                    if !responses.isEmpty {
                        DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
                            proxy.scrollTo("bottom", anchor: .bottom)
                        }
                    }
                }
                .onChange(of: isProcessing) { processing in
                    // Scroll to bottom when processing starts to show "Analyzing..." indicator
                    if processing {
                        isUserScrolling = false
                        scrollDisableTimer?.invalidate()
                        // Small delay to ensure ProcessingIndicator is rendered
                        DispatchQueue.main.asyncAfter(deadline: .now() + 0.05) {
                            withAnimation {
                                proxy.scrollTo("bottom", anchor: .bottom)
                            }
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

            Text(String(localized: "overlay.analyzing"))
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

            Text(String(localized: "overlay.readyToAssist"))
                .font(QMDesign.Typography.bodySmall)
                .foregroundColor(QMDesign.Colors.textSecondary)

            HStack(spacing: 4) {
                Text(String(localized: "overlay.hint.press"))
                    .font(QMDesign.Typography.caption)
                    .foregroundColor(QMDesign.Colors.textTertiary)
                KeyboardShortcutBadge(shortcut: "Cmd+Enter", size: .small)
                Text(String(localized: "overlay.hint.orClickTab"))
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

    // Check if Knowledge Base feedback is available (Enterprise only)
    private var feedbackAvailable: Bool {
        LicenseManager.shared.isFeatureAvailable(.knowledgeBase)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: QMDesign.Spacing.xs) {
            // Header
            HStack(spacing: QMDesign.Spacing.xs) {
                // Auto badge OR Type badge
                if isAutomatic {
                    // Automatic response badge (orange)
                    HStack(spacing: 4) {
                        Image(systemName: QMDesign.Icons.autoAnswer)
                            .font(.system(size: 10, weight: .semibold))
                        Text(String(localized: "overlay.response.auto"))
                            .font(QMDesign.Typography.caption)
                    }
                    .foregroundColor(QMDesign.Colors.autoAnswer)
                } else {
                    // Normal type badge with gradient
                    HStack(spacing: 4) {
                        Image(systemName: type.icon)
                            .font(.system(size: 10, weight: .semibold))
                        Text(type.rawValue)
                            .font(QMDesign.Typography.caption)
                    }
                    .foregroundStyle(QMDesign.Colors.primaryGradient)
                }

                Spacer()

                // Provider icon (only for non-auto responses)
                if !isAutomatic {
                    Image(systemName: provider.icon)
                        .font(.system(size: 9))
                        .foregroundColor(QMDesign.Colors.textTertiary)
                }

                // Copy button
                Button(action: {
                    NSPasteboard.general.clearContents()
                    NSPasteboard.general.setString(content, forType: .string)
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
                .help(String(localized: "overlay.tooltip.copyToClipboard"))

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

                // Dismiss button (only for auto responses)
                if isAutomatic, let onDismiss {
                    Button(action: onDismiss) {
                        Image(systemName: "xmark")
                            .font(.system(size: 10, weight: .medium))
                            .foregroundColor(QMDesign.Colors.textTertiary)
                            .frame(width: 18, height: 18)
                            .background(
                                Circle()
                                    .fill(QMDesign.Colors.surfaceHover)
                            )
                    }
                    .buttonStyle(.plain)
                    .help(String(localized: "overlay.tooltip.dismissSuggestion"))
                }
            }

            // Content
            MarkdownText(content: content)
                .frame(maxWidth: .infinity, alignment: .leading)

            // Feedback buttons (Enterprise only, after streaming completes)
            if feedbackAvailable && !isStreaming && !content.isEmpty {
                HStack(spacing: QMDesign.Spacing.xs) {
                    Spacer()

                    if feedbackState == .none {
                        // Show feedback buttons
                        Button(action: {
                            feedbackState = .helpful
                            onFeedback?(true)
                        }) {
                            HStack(spacing: 3) {
                                Image(systemName: "hand.thumbsup")
                                    .font(.system(size: 10))
                                Text(String(localized: "overlay.feedback.helpful"))
                                    .font(QMDesign.Typography.captionSmall)
                            }
                            .foregroundColor(QMDesign.Colors.textTertiary)
                            .padding(.horizontal, 8)
                            .padding(.vertical, 4)
                            .background(
                                Capsule()
                                    .fill(QMDesign.Colors.surfaceHover)
                            )
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
                            .background(
                                Capsule()
                                    .fill(QMDesign.Colors.surfaceHover)
                            )
                        }
                        .buttonStyle(.plain)
                    } else {
                        // Show feedback confirmation
                        HStack(spacing: 4) {
                            Image(systemName: feedbackState == .helpful ? "hand.thumbsup.fill" : "hand.thumbsdown.fill")
                                .font(.system(size: 10))
                            Text(feedbackState == .helpful ? String(localized: "overlay.feedback.thanks") : String(localized: "overlay.feedback.gotIt"))
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
                    // Left orange border for auto responses
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

// MARK: - Status Section

struct StatusSection: View {
    let isSessionActive: Bool
    let enableScreenCapture: Bool
    let responseCount: Int
    let onExport: () -> Void
    let onClear: () -> Void

    @State private var exportFeedback: Bool = false

    var body: some View {
        HStack(spacing: QMDesign.Spacing.xs) {
            // Warning if no session
            if !isSessionActive {
                HStack(spacing: 4) {
                    Image(systemName: enableScreenCapture ? "display" : "exclamationmark.triangle")
                        .font(.system(size: 10))
                    Text(enableScreenCapture ? String(localized: "overlay.status.screenOnly") : String(localized: "overlay.status.noInput"))
                        .font(QMDesign.Typography.captionSmall)
                }
                .foregroundColor(enableScreenCapture ? QMDesign.Colors.warning : QMDesign.Colors.error)
                .padding(.horizontal, QMDesign.Spacing.xs)
                .padding(.vertical, 3)
                .background(
                    Capsule()
                        .fill(enableScreenCapture ? QMDesign.Colors.warningLight : QMDesign.Colors.errorLight)
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
                        Text(exportFeedback ? String(localized: "overlay.action.copied") : String(localized: "overlay.action.export"))
                            .font(QMDesign.Typography.captionSmall)
                    }
                }
                .buttonStyle(.qmGhost)
                .foregroundColor(exportFeedback ? QMDesign.Colors.success : nil)

                Button(action: onClear) {
                    HStack(spacing: 3) {
                        Image(systemName: QMDesign.Icons.delete)
                            .font(.system(size: 9))
                        Text(String(localized: "overlay.action.clear"))
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

@MainActor
struct ModernInputAreaView: View {
    @Binding var inputText: String
    @Binding var isSmartModeEnabled: Bool
    @ObservedObject var dictationService: DictationService
    let isSessionActive: Bool
    let onSubmit: () -> Void

    @State private var isHoveringSend = false
    @State private var isHoveringMic = false
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
                    Text(String(localized: "overlay.status.smart"))
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
            .help(smartModeAvailable
                ? (isSmartModeEnabled ? String(localized: "overlay.tooltip.smartModeOn") : String(localized: "overlay.tooltip.smartModeOff"))
                : String(localized: "overlay.tooltip.smartModeRequiresEnterprise"))

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
                    // Pulsing ring when recording
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
                            : (isHoveringMic ? QMDesign.Colors.surfaceLight.opacity(0.8) : Color.clear))
                        .frame(width: 28, height: 28)

                    Image(systemName: dictationService.isRecording ? QMDesign.Icons.microphone : "mic")
                        .font(.system(size: 12, weight: dictationService.isRecording ? .bold : .regular))
                        .foregroundColor(dictationService.isRecording
                            ? QMDesign.Colors.error
                            : QMDesign.Colors.textTertiary)
                }
            }
            .buttonStyle(.plain)
            .onHover { isHoveringMic = $0 }
            .help(dictationService.isRecording ? String(localized: "overlay.tooltip.stopDictation") : String(localized: "overlay.tooltip.startDictation"))
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
                dictationService.isRecording ? String(localized: "overlay.input.listening") : String(localized: "overlay.input.placeholder"),
                text: $inputText
            )
            .textFieldStyle(.plain)
            .font(QMDesign.Typography.bodySmall)
            .onSubmit(onSubmit)

            // Keyboard shortcut hint
            KeyboardShortcutBadge(shortcut: "Cmd+Enter", size: .small)
                .opacity(inputText.isEmpty && !dictationService.isRecording ? 1 : 0)

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
                        .stroke(dictationService.isRecording
                            ? QMDesign.Colors.error.opacity(0.3)
                            : QMDesign.Colors.borderSubtle, lineWidth: 1)
                )
        )
        .frame(height: QMDesign.Dimensions.Overlay.inputHeight)
        .onChange(of: dictationService.interimText) { newText in
            if !newText.isEmpty {
                inputText = newText
            }
        }
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

            // Dark overlay (minimal to let background show through)
            Color.black.opacity(0.05)
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

// MARK: - Expand Preview View (Hover Tooltip)

struct ExpandPreviewView: View {
    var body: some View {
        VStack(alignment: .leading, spacing: QMDesign.Spacing.sm) {
            // Header
            HStack(spacing: QMDesign.Spacing.xs) {
                Image(systemName: QMDesign.Icons.assist)
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(QMDesign.Colors.primaryGradient)
                Text(String(localized: "overlay.preview.aiAssistant"))
                    .font(QMDesign.Typography.labelMedium)
                    .foregroundColor(QMDesign.Colors.textPrimary)
            }

            // Features preview
            VStack(alignment: .leading, spacing: QMDesign.Spacing.xs) {
                FeaturePreviewRow(icon: QMDesign.Icons.assist, text: String(localized: "overlay.preview.realtimeAssistance"))
                FeaturePreviewRow(icon: QMDesign.Icons.whatToSay, text: String(localized: "overlay.preview.suggestionsWhatToSay"))
                FeaturePreviewRow(icon: QMDesign.Icons.followUp, text: String(localized: "overlay.preview.smartFollowUp"))
                FeaturePreviewRow(icon: QMDesign.Icons.recap, text: String(localized: "overlay.preview.conversationRecap"))
            }

            // Hint
            HStack(spacing: 4) {
                Text(String(localized: "overlay.preview.clickToExpand"))
                    .font(QMDesign.Typography.caption)
                    .foregroundColor(QMDesign.Colors.textTertiary)
                Image(systemName: "chevron.down")
                    .font(.system(size: 8, weight: .bold))
                    .foregroundColor(QMDesign.Colors.textTertiary)
            }
        }
        .padding(QMDesign.Spacing.md)
        .frame(width: 200)
        .background(QMDesign.Colors.backgroundElevated)
    }
}

struct FeaturePreviewRow: View {
    let icon: String
    let text: String

    var body: some View {
        HStack(spacing: QMDesign.Spacing.xs) {
            Image(systemName: icon)
                .font(.system(size: 10))
                .foregroundColor(QMDesign.Colors.accent)
                .frame(width: 16)
            Text(text)
                .font(QMDesign.Typography.caption)
                .foregroundColor(QMDesign.Colors.textSecondary)
        }
    }
}

// MARK: - Window Drag Handle

/// A view that allows dragging the window when clicked and dragged
/// Used to make the logo a drag handle for moving the overlay
struct WindowDragHandle: NSViewRepresentable {
    func makeNSView(context: Context) -> WindowDragNSView {
        WindowDragNSView()
    }

    func updateNSView(_ nsView: WindowDragNSView, context: Context) {}
}

/// Custom NSView that initiates window drag on mouse down
class WindowDragNSView: NSView {
    override func mouseDown(with event: NSEvent) {
        window?.performDrag(with: event)
    }

    override func mouseDragged(with event: NSEvent) {
        window?.performDrag(with: event)
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
                Text(String(localized: "overlay.toast.smartModeEnabled"))
                    .font(QMDesign.Typography.labelSmall)
                    .foregroundColor(QMDesign.Colors.textPrimary)

                Text(String(localized: "overlay.toast.smartModeDescription"))
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

// MARK: - Display Selection Toast

struct DisplaySelectionToast: View {
    let displayName: String

    var body: some View {
        HStack(spacing: QMDesign.Spacing.xs) {
            Image(systemName: "display")
                .font(.system(size: 14, weight: .medium))
                .foregroundColor(QMDesign.Colors.success)

            Text(String(localized: "overlay.toast.capturing \(displayName)"))
                .font(QMDesign.Typography.labelSmall)
                .foregroundColor(QMDesign.Colors.textPrimary)
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
                .stroke(QMDesign.Colors.success.opacity(0.3), lineWidth: 1)
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
                Text(String(localized: "overlay.connection.reconnecting \(attempt) \(maxAttempts)"))
                    .font(QMDesign.Typography.captionSmall)

                Button(action: onRetry) {
                    Text(String(localized: "overlay.connection.retryNow"))
                        .font(QMDesign.Typography.captionSmall)
                        .fontWeight(.semibold)
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(
                            Capsule()
                                .fill(QMDesign.Colors.warning.opacity(0.3))
                        )
                }
                .buttonStyle(.plain)
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
                    Text(String(localized: "overlay.connection.transcriptionPaused"))
                        .font(QMDesign.Typography.captionSmall)
                        .fontWeight(.medium)

                    if transcriptionService.autoRecoveryCountdown > 0 {
                        Text(String(localized: "overlay.connection.retryIn \(transcriptionService.autoRecoveryCountdown)"))
                            .font(QMDesign.Typography.captionSmall)
                            .foregroundColor(QMDesign.Colors.textTertiary)
                    }

                    Button(action: onRetry) {
                        Text(String(localized: "overlay.connection.retryNow"))
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

                // Reassurance: AI still works
                HStack(spacing: 4) {
                    Image(systemName: "checkmark.circle.fill")
                        .font(.system(size: 8))
                        .foregroundColor(QMDesign.Colors.success)
                    Text(String(localized: "overlay.connection.aiStillWorks"))
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

// MARK: - Error Classification Helpers

/// Whether the error is transient and worth retrying (timeout, network, server 5xx).
private func isRetryableError(_ error: Error) -> Bool {
    if let urlError = error as? URLError {
        switch urlError.code {
        case .timedOut, .networkConnectionLost, .notConnectedToInternet, .cannotConnectToHost:
            return true
        default:
            return false
        }
    }
    if let proxyError = error as? ProxyError {
        switch proxyError {
        case .requestFailed(let code, _) where code >= 500:
            return true
        case .serverError:
            return true
        default:
            return false
        }
    }
    return false
}

/// User-friendly, localized error message for known error types.
/// ProxyError and AILicenseError already implement LocalizedError.errorDescription with i18n keys,
/// so we only need to handle URLError here — everything else falls through to localizedDescription.
private func localizedErrorMessage(for error: Error) -> String {
    if let urlError = error as? URLError {
        switch urlError.code {
        case .timedOut:
            return String(localized: "error.network.timeout")
        case .networkConnectionLost:
            return String(localized: "error.network.connectionLost")
        case .notConnectedToInternet:
            return String(localized: "error.network.notConnected")
        case .cannotConnectToHost:
            return String(localized: "error.network.cannotConnect")
        default:
            break
        }
    }
    return error.localizedDescription
}

// MARK: - AI Error Toast

struct AIErrorToast: View {
    let message: String
    let isRetryable: Bool
    let onDismiss: () -> Void
    var onRetry: (() -> Void)?

    var body: some View {
        HStack(spacing: QMDesign.Spacing.xs) {
            Image(systemName: "exclamationmark.circle.fill")
                .font(.system(size: 12, weight: .semibold))

            Text(message)
                .font(QMDesign.Typography.captionSmall)
                .lineLimit(2)

            Spacer()

            if isRetryable, let onRetry {
                Button(action: onRetry) {
                    Text(String(localized: "error.toast.retry"))
                        .font(.system(size: 10, weight: .semibold))
                        .padding(.horizontal, 8)
                        .padding(.vertical, 3)
                        .background(
                            RoundedRectangle(cornerRadius: 4)
                                .fill(QMDesign.Colors.error.opacity(0.2))
                        )
                }
                .buttonStyle(.plain)
            }

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

// MARK: - Overlay Transcript Strip

struct OverlayTranscriptStripView: View {
    @ObservedObject var transcriptionService: TranscriptionService

    private static let tailChars = 150

    private var tail: String {
        let full = transcriptionService.currentTranscript
        guard full.count > Self.tailChars else { return full }
        let slice = full.suffix(Self.tailChars)
        if let space = slice.firstIndex(of: " ") {
            return "…" + String(slice[slice.index(after: space)...])
        }
        return "…" + String(slice)
    }

    private var isTruncated: Bool {
        transcriptionService.currentTranscript.count > Self.tailChars
    }

    /// Fixed minimum height for the transcript text area (3 lines of 10.5pt font).
    /// Prevents the response section below from jumping when transcript toggles between 2-3 lines.
    private var transcriptStripMinHeight: CGFloat {
        let lineHeight: CGFloat = ceil(10.5 * 1.4) // 10.5pt font × ~1.4 line height factor
        return lineHeight * 3
    }

    var body: some View {
        let interim = transcriptionService.interimTranscript
        let t = tail

        textContent(tail: t, interim: interim)
            .font(.system(size: 10.5, weight: .regular))
            .lineLimit(3)
            .frame(maxWidth: .infinity, minHeight: transcriptStripMinHeight, alignment: .leading)
            .padding(.horizontal, QMDesign.Spacing.sm)
            .padding(.vertical, QMDesign.Spacing.xs)
            .background(QMDesign.Colors.surfaceLight.opacity(0.5))
            .clipShape(RoundedRectangle(cornerRadius: QMDesign.Radius.sm))
            .overlay(alignment: .top) {
                if isTruncated {
                    LinearGradient(
                        colors: [QMDesign.Colors.backgroundSecondary.opacity(0.9), Color.clear],
                        startPoint: .top,
                        endPoint: .bottom
                    )
                    .frame(height: 14)
                    .clipShape(RoundedRectangle(cornerRadius: QMDesign.Radius.sm))
                    .allowsHitTesting(false)
                }
            }
    }

    @ViewBuilder
    private func textContent(tail: String, interim: String) -> some View {
        if tail.isEmpty && interim.isEmpty {
            Text(String(localized: "overlay.transcript.listening"))
                .foregroundColor(QMDesign.Colors.textTertiary)
                .italic()
        } else {
            speakerColoredText(tail) +
            Text(interim.isEmpty ? "" : " " + interim)
                .foregroundColor(QMDesign.Colors.textTertiary)
                .italic()
        }
    }

    /// Build a Text with per-speaker color differentiation.
    /// "Moi: ..." segments get white, "Interlocuteur: ..." get dimmed blue-gray.
    /// Lines without speaker prefix keep the default secondary color.
    private func speakerColoredText(_ text: String) -> Text {
        let lines = text.split(separator: "\n", omittingEmptySubsequences: false)
        var result = Text("")
        for (i, line) in lines.enumerated() {
            let str = String(line)
            let color: Color
            let content: String
            if str.hasPrefix("Moi: ") {
                color = .white
                content = String(str.dropFirst(5))
            } else if str.hasPrefix("Interlocuteur: ") {
                color = QMDesign.Colors.textSecondary.opacity(0.6)
                content = String(str.dropFirst(15))
            } else {
                color = QMDesign.Colors.textSecondary
                content = str
            }
            if i > 0 { result = result + Text("\n") }
            result = result + Text(content).foregroundColor(color)
        }
        return result
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
