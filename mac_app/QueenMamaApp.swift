import SwiftUI
import SwiftData

// MARK: - App Delegate
class AppDelegate: NSObject, NSApplicationDelegate {
    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
        // Don't quit when main window is closed - keep running with widget and menu bar
        return false
    }

    func applicationDidFinishLaunching(_ notification: Notification) {
        // Force dark mode for the entire app (design is dark-only)
        NSApp.appearance = NSAppearance(named: .darkAqua)

        // Initialize crash reporting (requires Sentry DSN to be configured)
        CrashReporter.shared.start()

        // Initialize analytics (PostHog)
        AnalyticsService.shared.start()

        // Initialize Sparkle updater and check for updates in background
        // This ensures users get update notifications without opening Settings
        _ = UpdaterManager.shared
        DispatchQueue.main.asyncAfter(deadline: .now() + 5) {
            UpdaterManager.shared.checkForUpdatesInBackground()
        }

        // Restore authentication state on launch
        Task { @MainActor in
            await AuthenticationManager.shared.checkExistingAuth()

            // Set user context for crash reports and analytics if authenticated
            if let user = AuthenticationManager.shared.currentUser {
                CrashReporter.shared.setUser(id: user.id, email: user.email)
                AnalyticsService.shared.identify(
                    userId: user.id,
                    email: user.email,
                    name: user.name,
                    plan: LicenseManager.shared.currentLicense.plan.rawValue
                )
            }

            // Explicitly load proxy configuration after auth check
            // This ensures AI providers are available even if notification timing is off
            if AuthenticationManager.shared.isAuthenticated {
                do {
                    try await ProxyConfigManager.shared.refreshConfig()
                    print("[App] Proxy config loaded: \(ProxyConfigManager.shared.availableAIProviders)")
                } catch {
                    print("[App] Failed to load proxy config: \(error)")
                }

                // Pre-fetch transcription token for faster session start
                // This eliminates 200-400ms delay when user clicks "Start Recording"
                ProxyAPIClient.shared.prefetchTranscriptionToken()

                // Perform initial sync (upload unsynced + reconcile remote deletions)
                // Note: Sessions will be passed from SessionListView once it loads
                await SyncManager.shared.reconcileRemoteDeletions()
            }
        }
    }

    func applicationDidBecomeActive(_ notification: Notification) {
        // Revalidate license when app becomes active (user returns to app)
        Task { @MainActor in
            await LicenseManager.shared.revalidate()
        }
    }
}

@main
struct QueenMamaApp: App {
    @NSApplicationDelegateAdaptor(AppDelegate.self) var appDelegate

    @StateObject private var appState = AppState()
    @StateObject private var sessionManager = SessionManager()
    @StateObject private var authManager = AuthenticationManager.shared

    // Start with checking state, will be updated after auth check
    @State private var launchState: LaunchState = .checking

    enum LaunchState {
        case checking      // Checking existing auth
        case onboarding    // Not authenticated, show onboarding
        case dashboard     // Authenticated, show dashboard
    }

    var sharedModelContainer: ModelContainer = {
        let schema = Schema([
            Session.self,
            TranscriptEntry.self,
            Mode.self,
            AIResponse.self
        ])
        let modelConfiguration = ModelConfiguration(schema: schema, isStoredInMemoryOnly: false)

        do {
            return try ModelContainer(for: schema, configurations: [modelConfiguration])
        } catch {
            fatalError("Could not create ModelContainer: \(error)")
        }
    }()

    var body: some Scene {
        // Main Dashboard Window
        WindowGroup("Queen Mama", id: "dashboard") {
            Group {
                switch launchState {
                case .checking:
                    // Show loading while checking auth
                    LaunchLoadingView()
                        .onAppear {
                            checkAuthAndSetLaunchState()
                        }

                case .onboarding:
                    OnboardingView {
                        launchState = .dashboard
                    }
                    .environmentObject(appState)

                case .dashboard:
                    DashboardView()
                        .environmentObject(appState)
                        .environmentObject(sessionManager)
                        .onAppear {
                            // Connect SessionManager to AppState
                            appState.sessionManager = sessionManager

                            // Show widget by default
                            OverlayWindowController.shared.showOverlay(
                                appState: appState,
                                sessionManager: sessionManager
                            )
                        }
                }
            }
        }
        .modelContainer(sharedModelContainer)
        .windowStyle(.hiddenTitleBar)
        .defaultSize(width: launchState == .onboarding ? 800 : 900, height: launchState == .onboarding ? 600 : 700)

        // Menu Bar Extra
        MenuBarExtra("Queen Mama", systemImage: appState.isSessionActive ? "waveform.circle.fill" : "waveform.circle") {
            MenuBarView()
                .environmentObject(appState)
                .environmentObject(sessionManager)
        }
        .menuBarExtraStyle(.menu)

        // Settings Window
        Settings {
            SettingsView()
                .environmentObject(appState)
        }
    }

    init() {
        // Register global keyboard shortcuts
        KeyboardShortcutManager.shared.registerGlobalShortcuts()
    }

    private func checkAuthAndSetLaunchState() {
        Task { @MainActor in
            // Wait for auth state to be determined (not .unknown)
            // The auth check is started in AppDelegate.applicationDidFinishLaunching
            var attempts = 0
            let maxAttempts = 20 // Max 2 seconds wait

            while attempts < maxAttempts {
                switch authManager.authState {
                case .unknown:
                    // Still checking, wait a bit
                    try? await Task.sleep(nanoseconds: 100_000_000) // 0.1s
                    attempts += 1

                case .authenticated(_):
                    print("[App] User authenticated, skipping onboarding")
                    launchState = .dashboard
                    return

                case .unauthenticated, .error(_), .authenticating, .deviceCodePending(_, _, _):
                    print("[App] User not authenticated, showing onboarding")
                    launchState = .onboarding
                    return
                }
            }

            // Timeout - default to onboarding
            print("[App] Auth check timeout, showing onboarding")
            launchState = .onboarding
        }
    }
}

// MARK: - Launch Loading View
struct LaunchLoadingView: View {
    var body: some View {
        ZStack {
            QMDesign.Colors.backgroundPrimary
                .ignoresSafeArea()

            VStack(spacing: QMDesign.Spacing.lg) {
                // App icon or logo
                Image(systemName: "waveform.circle.fill")
                    .font(.system(size: 64))
                    .foregroundStyle(QMDesign.Colors.primaryGradient)

                ProgressView()
                    .scaleEffect(1.2)
                    .progressViewStyle(CircularProgressViewStyle(tint: QMDesign.Colors.accent))

                Text("Loading...")
                    .font(QMDesign.Typography.bodyMedium)
                    .foregroundColor(QMDesign.Colors.textSecondary)
            }
        }
        .frame(minWidth: 400, minHeight: 300)
    }
}

// MARK: - App State
@MainActor
class AppState: ObservableObject {
    @Published var isSessionActive = false
    @Published var isOverlayVisible = true
    @Published var currentTranscript = ""
    @Published var aiResponse = ""
    @Published var isProcessing = false
    @Published var audioLevel: Float = 0.0
    @Published var selectedMode: Mode?
    @Published var errorMessage: String?
    @Published var isFinalizingSession = false  // Indicates AI is generating title/summary

    // Services
    let audioService = AudioCaptureService()
    let screenService = ScreenCaptureService()
    let transcriptionService = TranscriptionService()
    let aiService = AIService()
    let autoAnswerService = AutoAnswerService()

    // Session Manager reference (injected from QueenMamaApp)
    weak var sessionManager: SessionManager?

    func startSession() async {
        // Check authentication before starting session
        let sessionAccess = LicenseManager.shared.canUse(.sessionStart)
        guard sessionAccess.isAllowed else {
            errorMessage = sessionAccess.errorMessage
            return
        }

        isSessionActive = true
        errorMessage = nil

        // Record session start usage
        LicenseManager.shared.recordUsage(.sessionStart)

        // Track session start in analytics
        AnalyticsService.shared.trackSessionStarted(
            modeId: selectedMode?.id,
            modeName: selectedMode?.name
        )

        // Create session in SessionManager
        let defaultTitle = "Session - \(Date().formatted(date: .abbreviated, time: .shortened))"
        _ = sessionManager?.startSession(title: defaultTitle, modeId: selectedMode?.id)

        do {
            try await audioService.startCapture()
            try await screenService.startCapture()
            try await transcriptionService.connect()

            // Start streaming audio to transcription
            audioService.onAudioBuffer = { [weak self] buffer in
                self?.transcriptionService.sendAudio(buffer)
            }

            // Handle transcription results
            transcriptionService.onTranscript = { [weak self] text in
                Task { @MainActor in
                    self?.currentTranscript += text + " "
                    // Persist transcription to SessionManager
                    self?.sessionManager?.updateTranscript(self?.currentTranscript ?? "")
                    // Feed transcript to AutoAnswerService
                    self?.autoAnswerService.onTranscriptReceived(self?.currentTranscript ?? "")
                }
            }

            // Wire up AutoAnswerService trigger
            autoAnswerService.onTrigger = { [weak self] in
                Task { @MainActor in
                    await self?.handleAutoAnswer()
                }
            }

            // Wire up proactive moment detection (Enterprise)
            autoAnswerService.onMomentDetected = { [weak self] moment in
                Task { @MainActor in
                    await self?.handleProactiveMoment(moment)
                }
            }

            // Configure proactive settings from ConfigurationManager
            let config = ConfigurationManager.shared
            autoAnswerService.proactiveEnabled = config.proactiveEnabled && LicenseManager.shared.isFeatureAvailable(.proactiveSuggestions)
            autoAnswerService.proactiveCooldown = TimeInterval(config.proactiveCooldown)
            autoAnswerService.proactiveSensitivity = Float(config.proactiveSensitivity)
        } catch {
            errorMessage = error.localizedDescription
            await stopSession()
        }
    }

    func stopSession() async {
        // 1. Stop services immediately (for good UX)
        audioService.stopCapture()
        screenService.stopCapture()
        transcriptionService.disconnect()
        autoAnswerService.reset()  // Reset auto-answer state
        autoAnswerService.resetProactiveState()  // Reset proactive state
        isSessionActive = false

        // 2. Get the current session before finalizing
        guard let manager = sessionManager,
              let session = manager.currentSession else {
            clearContext()
            return
        }

        // 3. Get the final transcript
        let finalTranscript = currentTranscript.trimmingCharacters(in: .whitespacesAndNewlines)

        // 4. Skip AI processing if transcript is too short (< 50 characters)
        if finalTranscript.count < 50 {
            print("[AppState] Session too short for AI processing (\(finalTranscript.count) chars)")
            manager.endSession()
            syncSessionIfEligible(session)
            clearContext()
            return
        }

        // 5. Activate finalization indicator
        isFinalizingSession = true

        // 6. Generate title and summary using AI
        let title = await aiService.generateSessionTitle(transcript: finalTranscript)
        session.title = title
        print("[AppState] Generated title: \(title)")

        if let summary = await aiService.generateSessionSummary(transcript: finalTranscript) {
            manager.setSummary(summary)
            print("[AppState] Generated summary (\(summary.count) chars)")
        }

        // 7. Finalize the session
        manager.endSession()

        // 8. Queue for sync if PRO+ subscription
        syncSessionIfEligible(session)

        // 9. Track session end in analytics
        let duration = Int(session.endTime?.timeIntervalSince(session.startTime) ?? 0)
        AnalyticsService.shared.trackSessionEnded(
            durationSeconds: duration,
            transcriptLength: finalTranscript.count,
            hadAIResponses: !aiResponse.isEmpty
        )

        // 10. Deactivate indicator and clear context
        isFinalizingSession = false
        clearContext()
    }

    /// Queue session for sync if user has PRO+ subscription
    private func syncSessionIfEligible(_ session: Session) {
        if LicenseManager.shared.isFeatureAvailable(.sessionSync) {
            SyncManager.shared.queueSession(session)
            print("[AppState] Session queued for sync: \(session.id)")
        } else {
            print("[AppState] Session sync requires PRO subscription - stored locally only")
        }
    }

    func toggleOverlay() {
        isOverlayVisible.toggle()
        OverlayWindowController.shared.setVisible(isOverlayVisible)
        AnalyticsService.shared.trackOverlayToggled(visible: isOverlayVisible)
    }

    func clearContext() {
        currentTranscript = ""
        aiResponse = ""
        aiService.clearHistory()
    }

    // MARK: - Auto Answer

    /// Handle automatic AI response triggered by AutoAnswerService
    private func handleAutoAnswer() async {
        // Check enterprise license for auto-answer feature
        guard LicenseManager.shared.isFeatureAvailable(.autoAnswer) else {
            print("[AppState] Auto-answer requires Enterprise license")
            return
        }

        // Don't trigger if already processing
        guard !aiService.isProcessing else {
            print("[AppState] Skipping auto-answer - AI already processing")
            return
        }

        // Need some transcript content
        guard !currentTranscript.isEmpty else {
            print("[AppState] Skipping auto-answer - no transcript")
            return
        }

        print("[AppState] Triggering automatic response...")

        do {
            let response = try await aiService.generateAutoResponse(
                transcript: currentTranscript,
                mode: selectedMode
            )
            print("[AppState] Auto-response generated: \(response.content.prefix(100))...")
        } catch {
            print("[AppState] Auto-response failed: \(error)")
        }
    }

    // MARK: - Proactive Mode (Enterprise)

    /// Handle proactive moment detected by MomentDetectionService
    private func handleProactiveMoment(_ moment: MomentDetectionService.DetectedMoment) async {
        // Check enterprise license for proactive suggestions
        guard LicenseManager.shared.isFeatureAvailable(.proactiveSuggestions) else {
            print("[AppState] Proactive suggestions require Enterprise license")
            return
        }

        // Don't trigger if already processing
        guard !aiService.isProcessing else {
            print("[AppState] Skipping proactive - AI already processing")
            autoAnswerService.lastDetectedMoment = nil
            return
        }

        // Need some transcript content
        guard !currentTranscript.isEmpty else {
            print("[AppState] Skipping proactive - no transcript")
            autoAnswerService.lastDetectedMoment = nil
            return
        }

        print("[AppState] Proactive moment detected: \(moment.type.label)")
        print("[AppState] Confidence: \(String(format: "%.1f%%", moment.confidence * 100))")
        print("[AppState] Trigger: \"\(moment.triggerPhrase)\"")

        // Auto-expand overlay for proactive suggestion
        OverlayWindowController.shared.expandForProactiveSuggestion(moment: moment)

        // Generate proactive response
        do {
            for try await chunk in aiService.generateProactiveResponse(
                transcript: currentTranscript,
                moment: moment,
                mode: selectedMode,
                screenshot: nil
            ) {
                _ = chunk // Response updates are handled by AIService
            }
            print("[AppState] Proactive response completed")

            // Record engagement (user saw the suggestion)
            autoAnswerService.recordProactiveEngagement()

            // Track in analytics
            AnalyticsService.shared.capture(
                "proactive_suggestion_shown",
                properties: [
                    "moment_type": moment.type.rawValue,
                    "confidence": moment.confidence,
                    "trigger_phrase": moment.triggerPhrase
                ]
            )
        } catch {
            print("[AppState] Proactive response failed: \(error)")
            autoAnswerService.lastDetectedMoment = nil
        }
    }

    /// User dismissed a proactive suggestion
    func dismissProactiveSuggestion() {
        autoAnswerService.recordProactiveDismiss()
        autoAnswerService.lastDetectedMoment = nil

        AnalyticsService.shared.capture("proactive_suggestion_dismissed", properties: [:])
    }
}

// MARK: - Menu Bar View
struct MenuBarView: View {
    @EnvironmentObject var appState: AppState
    @EnvironmentObject var sessionManager: SessionManager
    @Environment(\.openWindow) private var openWindow

    var body: some View {
        Group {
            if appState.isSessionActive {
                Button("Stop Session") {
                    Task { await appState.stopSession() }
                }
                .keyboardShortcut("s", modifiers: [.command, .shift])

                Divider()

                Button(appState.isOverlayVisible ? "Hide Widget" : "Show Widget") {
                    appState.toggleOverlay()
                }
                .keyboardShortcut("\\", modifiers: .command)
            } else {
                Button("Start Session") {
                    Task { await appState.startSession() }
                }
                .keyboardShortcut("s", modifiers: [.command, .shift])
            }

            Divider()

            Button("Open Dashboard") {
                // Try to bring existing window to front, or open new one
                NSApp.activate(ignoringOtherApps: true)
                if let window = NSApp.windows.first(where: { $0.title.contains("Queen Mama") && !$0.title.contains("Settings") }) {
                    window.makeKeyAndOrderFront(nil)
                } else {
                    openWindow(id: "dashboard")
                }
            }
            .keyboardShortcut("d", modifiers: [.command, .shift])

            Button("Give Feedback...") {
                if let url = URL(string: "https://queenmama.featurebase.app") {
                    NSWorkspace.shared.open(url)
                }
            }

            Divider()

            Button("Quit Queen Mama") {
                NSApplication.shared.terminate(nil)
            }
            .keyboardShortcut("q", modifiers: .command)
        }
    }
}
