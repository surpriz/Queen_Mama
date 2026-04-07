import SwiftUI
import SwiftData
import Combine

// MARK: - App Delegate
class AppDelegate: NSObject, NSApplicationDelegate {
    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
        // Don't quit when main window is closed - keep running with widget and menu bar
        return false
    }

    func applicationWillFinishLaunching(_ notification: Notification) {
        // Apply language override before any UI loads
        let lang = UserDefaults.standard.string(forKey: "app_language") ?? "system"
        ConfigurationManager.applyLanguageOverride(lang)
    }

    func applicationDidFinishLaunching(_ notification: Notification) {
        // Force dark mode for the entire app (design is dark-only)
        NSApp.appearance = NSAppearance(named: .darkAqua)

        // Check if the app needs to be moved to /Applications
        // Must happen before Sparkle init to prevent "can't update from Downloads" error
        AppMoveHelper.moveToApplicationsFolderIfNeeded()

        // Initialize crash reporting (requires Sentry DSN to be configured)
        CrashReporter.shared.start()

        // Initialize analytics (PostHog)
        AnalyticsService.shared.start()

        // Defer Sparkle initialization to avoid AuthorizationCopyRights XPC call
        // blocking the main thread during app launch (Sentry: App Hanging, 51 events)
        DispatchQueue.main.asyncAfter(deadline: .now() + 3.0) {
            _ = UpdaterManager.shared
        }

        // Log environment for diagnostics
        print("[App] Environment: \(AppEnvironment.current.displayName)")
        print("[App] API URL: \(AppEnvironment.current.apiBaseURL)")

        // Restore authentication state on launch
        Task { @MainActor in
            // Preload Keychain values on background thread to avoid blocking main thread
            // with ~8 synchronous SecItemCopyMatching calls during auth check
            await AuthTokenStore.shared.preloadCache()

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

            // Clean up orphaned sessions (endTime == nil) from crashes
            cleanupOrphanedSessions()

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

                // Delay initial sync to let SwiftUI @Query views settle first
                // Immediate writes during layout registration can cause infinite recursion
                try? await Task.sleep(nanoseconds: 2_000_000_000)
                await SyncManager.shared.reconcileRemoteDeletions()
            }
        }
    }

    /// Close sessions left open by a crash (endTime == nil)
    @MainActor
    private func cleanupOrphanedSessions() {
        let context = QueenMamaApp.sharedModelContainer.mainContext
        let descriptor = FetchDescriptor<Session>(
            predicate: #Predicate<Session> { $0.endTime == nil }
        )
        if let orphans = try? context.fetch(descriptor) {
            for session in orphans {
                session.endTime = session.startTime.addingTimeInterval(3600)
                print("[App] Closed orphaned session: \(session.id)")
            }
            if !orphans.isEmpty {
                try? context.save()
                print("[App] Cleaned up \(orphans.count) orphaned session(s)")
            }
        }

        // Fix built-in modes that were incorrectly saved with isDefault = false
        let builtInNames = ["Default", "Professional", "Interview", "Sales", "Developer Exam"]
        let modeDescriptor = FetchDescriptor<Mode>()
        if let allModes = try? context.fetch(modeDescriptor) {
            var fixedCount = 0
            for mode in allModes where builtInNames.contains(mode.name) && !mode.isDefault {
                mode.isDefault = true
                fixedCount += 1
            }
            if fixedCount > 0 {
                try? context.save()
                print("[App] Fixed \(fixedCount) built-in mode(s) with incorrect isDefault flag")
            }
        }
    }

    func applicationDidBecomeActive(_ notification: Notification) {
        // Delay revalidation to avoid re-render storm during SwiftUI layout pass
        // The 1s delay lets @Query views settle before @Published mutations fire
        Task { @MainActor in
            try? await Task.sleep(nanoseconds: 1_000_000_000)
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
        case login         // Known user with expired token, show re-auth
        case dashboard     // Authenticated, show dashboard
    }

    /// Shared model container - accessible statically for overlay window
    static let sharedModelContainer: ModelContainer = {
        let schema = Schema(versionedSchema: SchemaV1.self)
        let modelConfiguration = ModelConfiguration(schema: schema, isStoredInMemoryOnly: false)

        do {
            return try ModelContainer(for: schema, migrationPlan: QueenMamaMigrationPlan.self,
                                      configurations: [modelConfiguration])
        } catch {
            // Attempt to delete corrupted store and recreate
            print("[App] CRITICAL: ModelContainer creation failed: \(error)")
            CrashReporter.shared.captureError(error, extras: ["service": "swiftdata", "operation": "modelcontainer_init"])
            print("[App] Attempting to delete corrupted store and recreate...")

            let url = modelConfiguration.url
            let fileManager = FileManager.default
            let storePaths = [url, url.appendingPathExtension("shm"), url.appendingPathExtension("wal")]
            for path in storePaths {
                try? fileManager.removeItem(at: path)
            }

            do {
                return try ModelContainer(for: schema, migrationPlan: QueenMamaMigrationPlan.self,
                                          configurations: [modelConfiguration])
            } catch {
                // Last resort: use in-memory store
                print("[App] CRITICAL: Still failed after store deletion: \(error)")
                let inMemoryConfig = ModelConfiguration(schema: schema, isStoredInMemoryOnly: true)
                do {
                    return try ModelContainer(for: schema, configurations: [inMemoryConfig])
                } catch {
                    CrashReporter.shared.captureError(error, extras: ["service": "swiftdata", "operation": "modelcontainer_inmemory_fallback"])
                    fatalError("Could not create even in-memory ModelContainer: \(error)")
                }
            }
        }
    }()

    var sharedModelContainer: ModelContainer { Self.sharedModelContainer }

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

                case .login:
                    ReauthenticationView {
                        launchState = .dashboard
                    }

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
                                sessionManager: sessionManager,
                                modelContainer: QueenMamaApp.sharedModelContainer
                            )

                            // Start meeting detection
                            appState.setupMeetingDetection()
                        }
                }
            }
            // Auth state transitions: handle both recovery and session expiry
            .onChange(of: authManager.authState) { _, newState in
                // Recovery: if auth succeeds after timeout showed "Session Expired",
                // automatically transition to dashboard without requiring manual re-login
                if launchState == .login, case .authenticated = newState {
                    if ConfigurationManager.shared.hasCompletedOnboarding {
                        print("[App] Auth recovered after timeout - switching to dashboard")
                        launchState = .dashboard
                    }
                }

                // Auth lost while on dashboard (token refresh permanently failed)
                // → stop active session, hide overlay, show re-authentication screen
                if launchState == .dashboard, case .unauthenticated = newState {
                    print("[App] Auth lost while on dashboard - switching to re-authentication")
                    if appState.isSessionActive {
                        Task { await appState.stopSession() }
                    }
                    OverlayWindowController.shared.hideOverlay()
                    launchState = .login
                }
            }
        }
        .modelContainer(sharedModelContainer)
        .windowStyle(.hiddenTitleBar)
        .defaultSize(
            width: launchState == .onboarding ? 800 : launchState == .login ? 500 : 900,
            height: launchState == .onboarding ? 750 : launchState == .login ? 600 : 700
        )

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
            let maxAttempts = 100 // Max 10 seconds wait (handles slow networks and Vercel cold starts)

            while attempts < maxAttempts {
                switch authManager.authState {
                case .unknown:
                    // Still checking, wait a bit
                    try? await Task.sleep(nanoseconds: 100_000_000) // 0.1s
                    attempts += 1

                case .authenticated(_):
                    if ConfigurationManager.shared.hasCompletedOnboarding {
                        print("[App] User authenticated, showing dashboard")
                        launchState = .dashboard
                    } else {
                        print("[App] User authenticated but onboarding not completed, showing onboarding")
                        launchState = .onboarding
                    }
                    return

                case .unauthenticated, .error(_), .authenticating, .deviceCodePending(_, _, _):
                    if ConfigurationManager.shared.hasCompletedOnboarding {
                        print("[App] User not authenticated but onboarding completed, showing login")
                        launchState = .login
                    } else {
                        print("[App] User not authenticated, showing onboarding")
                        launchState = .onboarding
                    }
                    return
                }
            }

            // Timeout - check onboarding completion before defaulting
            if ConfigurationManager.shared.hasCompletedOnboarding {
                print("[App] Auth check timeout (10s) but onboarding completed, showing login")
                launchState = .login
            } else {
                print("[App] Auth check timeout (10s), showing onboarding")
                launchState = .onboarding
            }
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

                Text(String(localized: "app.loading"))
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
    @Published var aiResponse = ""
    @Published var isProcessing = false
    @Published var audioLevel: Float = 0.0
    @Published var selectedMode: Mode?
    @Published var errorMessage: String?
    @Published var isErrorRetryable: Bool = false

    func clearError() {
        errorMessage = nil
        isErrorRetryable = false
    }
    @Published var isFinalizingSession = false  // Indicates AI is generating title/summary

    /// Memory Palace: Triggers contact picker from menu bar or keyboard shortcut
    @Published var shouldShowContactPicker = false

    // MARK: - Memory-Managed Transcript

    /// Maximum transcript size in memory (50KB)
    /// Full transcript is persisted to SwiftData via SessionManager
    private let maxTranscriptMemorySize = 50_000

    /// Internal transcript storage with memory limit
    private var _currentTranscript = ""

    /// Public transcript accessor - automatically trims if too large
    var currentTranscript: String {
        get { _currentTranscript }
        set {
            _currentTranscript = newValue
            // Trim if exceeds memory limit (keep most recent content)
            if _currentTranscript.count > maxTranscriptMemorySize {
                let trimStart = _currentTranscript.index(
                    _currentTranscript.endIndex,
                    offsetBy: -(maxTranscriptMemorySize - 5000)  // Keep 45KB
                )
                _currentTranscript = String(_currentTranscript[trimStart...])
                print("[AppState] Transcript trimmed to \(_currentTranscript.count) chars in memory")
            }
        }
    }

    // Services
    let audioService = AudioCaptureService()
    let screenService = ScreenCaptureService()
    let transcriptionService = TranscriptionService()
    let aiService = AIService()
    let autoAnswerService = AutoAnswerService()
    let audioBatchingService = AudioBatchingService()
    let systemAudioBatchingService = AudioBatchingService()  // Separate batching for system audio
    let transcriptBuffer = TranscriptBuffer()
    let systemTranscriptBuffer = TranscriptBuffer()  // Separate buffer for system audio (Them)
    let dictationService = DictationService()
    let preGenerationService = PreGenerationService()
    let meetingDetectionService = MeetingDetectionService()

    // System Audio Service for speaker separation ("Moi" vs "Interlocuteur")
    let systemAudioService = SystemAudioCaptureService()

    // Session Manager reference (injected from QueenMamaApp)
    weak var sessionManager: SessionManager?

    /// Meeting detection config observer
    private var meetingDetectionObserver: AnyCancellable?

    /// Memory Palace: Contact to associate with current session
    var currentSessionContact: Contact?

    func startSession(contact: Contact? = nil) async {
        // Check authentication before starting session
        let sessionAccess = LicenseManager.shared.canUse(.sessionStart)
        guard sessionAccess.isAllowed else {
            errorMessage = sessionAccess.errorMessage
            return
        }

        // Pre-flight: ensure proxy config is loaded and transcription is available
        guard ProxyConfigManager.shared.isTranscriptionEnabled else {
            // Proxy config not loaded or transcription not available
            // This happens when auth is in degraded mode (invalid token)
            if !AuthenticationManager.shared.isAuthenticated {
                errorMessage = String(localized: "app.error.signInRequired")
            } else {
                errorMessage = String(localized: "app.error.transcriptionUnavailable")
                // Attempt to reload config for next try
                Task { try? await ProxyConfigManager.shared.refreshConfig() }
            }
            print("[AppState] Pre-flight failed: transcription not available (proxy config loaded: \(ProxyConfigManager.shared.config != nil))")
            return
        }

        errorMessage = nil
        currentSessionContact = contact
        CrashReporter.shared.addBreadcrumb(category: "session", message: "Session started")

        // Record session start usage
        LicenseManager.shared.recordUsage(.sessionStart)

        // Start health monitoring for proactive issue detection
        HealthCheckService.shared.startMonitoring()

        // Track session start in analytics
        AnalyticsService.shared.trackSessionStarted(
            modeId: selectedMode?.id,
            modeName: selectedMode?.name
        )

        do {
            // Start all services BEFORE creating the session in SwiftData.
            // This prevents ghost sessions (0:00 duration) when a service fails to start.

            // Parallel startup of all services for faster session start
            // Saves 200-400ms compared to sequential startup
            let startTime = CFAbsoluteTimeGetCurrent()

            async let audioStart: () = audioService.startCapture()
            async let screenStart: () = screenService.startCapture()
            async let transcriptionStart: () = transcriptionService.connect()

            // Wait for all services to be ready
            try await audioStart
            try await screenStart
            try await transcriptionStart

            let startupTime = (CFAbsoluteTimeGetCurrent() - startTime) * 1000
            print("[AppState] All services started in \(Int(startupTime))ms (parallel)")

            // Services are ready — now create the session record
            isSessionActive = true
            let defaultTitle = "Session - \(Date().formatted(date: .abbreviated, time: .shortened))"
            _ = sessionManager?.startSession(title: defaultTitle, modeId: selectedMode?.id, contact: contact)

            // Update contact lastSeenAt
            if let contact = contact {
                contact.lastSeenAt = Date()
            }

            // Start audio batching service (mic only — Deepgram diarize handles speaker separation)
            audioBatchingService.start()

            // Wire audio batching: Audio → Batch → Transcription
            audioService.onAudioBuffer = { [weak self] buffer in
                self?.audioBatchingService.append(buffer)
                // Send to dictation if recording
                if self?.dictationService.isRecording == true {
                    self?.dictationService.sendAudio(buffer)
                }
            }

            audioBatchingService.onBatchReady = { [weak self] batch in
                self?.transcriptionService.sendAudio(batch)
            }

            // Configure Buffered Pre-Generation (before callback wiring)
            preGenerationService.configure(
                aiService: aiService,
                screenService: screenService,
                modeProvider: { [weak self] in self?.selectedMode }
            )

            // Start transcript buffer for non-diarized fallback
            transcriptBuffer.start()

            // Handle non-diarized transcripts (fallback if Deepgram doesn't return speaker info)
            transcriptionService.onTranscript = { [weak self] text in
                Task { @MainActor in
                    self?.transcriptBuffer.append(text)
                }
            }

            // Handle DIARIZED transcripts from Deepgram (speaker 0 = Moi, speaker 1+ = Interlocuteur)
            transcriptionService.onDiarizedTranscript = { [weak self] (text: String, speaker: Int) in
                guard let self = self else { return }

                // Speaker 0 = first to speak = typically the other person in a call.
                // Speaker 1 = the user (closer to mic, usually speaks second).
                // All other speakers (2, 3, ...) = additional participants = "Interlocuteur".
                let label = speaker == 1 ? "Moi" : "Interlocuteur"

                self.sessionManager?.addTranscriptEntry(
                    speaker: label,
                    text: text,
                    isFinal: true
                )

                self.currentTranscript += "\(label): \(text)\n"

                let wordCount = text.split(separator: " ").count
                HealthCheckService.shared.recordWordsTranscribed(wordCount)

                self.autoAnswerService.onTranscriptReceived(self.currentTranscript)
                self.preGenerationService.onTranscriptUpdated(self.currentTranscript)
            }

            // Non-diarized fallback flush → "Moi" entries (when no speaker info available)
            transcriptBuffer.onFlush = { [weak self] (batchedText: String) in
                guard let self = self else { return }

                self.sessionManager?.addTranscriptEntry(
                    speaker: "Moi",
                    text: batchedText,
                    isFinal: true
                )

                self.currentTranscript += "Moi: \(batchedText)\n"

                let wordCount = batchedText.split(separator: " ").count
                HealthCheckService.shared.recordWordsTranscribed(wordCount)

                self.autoAnswerService.onTranscriptReceived(self.currentTranscript)
                self.preGenerationService.onTranscriptUpdated(self.currentTranscript)
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
            // Service startup failed — clean up without creating a ghost session
            print("[AppState] Session start failed: \(error.localizedDescription)")
            CrashReporter.shared.captureError(error, extras: ["service": "session", "operation": "start"])
            errorMessage = error.localizedDescription
            HealthCheckService.shared.stopMonitoring()
            audioService.stopCapture()
            screenService.stopCapture()
            transcriptionService.disconnect()
            isSessionActive = false
            currentSessionContact = nil
        }
    }

    func stopSession() async {
        CrashReporter.shared.addBreadcrumb(category: "session", message: "Session stopped (transcript: \(currentTranscript.count) chars)")

        // 0. Stop health monitoring and report summary
        HealthCheckService.shared.stopMonitoring()

        // 1. Stop services immediately (for good UX)
        audioBatchingService.reset()  // Flush remaining audio before stopping
        systemAudioBatchingService.reset()  // Flush remaining system audio before stopping
        transcriptBuffer.reset()  // Flush remaining mic transcript before stopping
        systemTranscriptBuffer.reset()  // Flush remaining system transcript before stopping
        audioService.stopCapture()
        screenService.stopCapture()
        transcriptionService.disconnect()
        transcriptionService.disconnectSystemAudio()  // Disconnect system audio WebSocket
        systemAudioService.reset()  // Reset system audio service
        autoAnswerService.reset()  // Reset auto-answer state
        autoAnswerService.resetProactiveState()  // Reset proactive state
        preGenerationService.reset()  // Reset pre-generation buffer
        dictationService.stopRecording()  // Stop dictation if active
        isSessionActive = false

        // 2. Get the current session before finalizing
        guard let manager = sessionManager,
              let session = manager.currentSession else {
            clearContext()
            return
        }

        // 3. Get the final transcript
        let finalTranscript = currentTranscript.trimmingCharacters(in: .whitespacesAndNewlines)

        // 4. Skip AI processing if transcript is too short or auth is lost
        if finalTranscript.count < 50 || !AuthenticationManager.shared.isAuthenticated {
            if !AuthenticationManager.shared.isAuthenticated {
                print("[AppState] Skipping AI finalization - auth lost")
            } else {
                print("[AppState] Session too short for AI processing (\(finalTranscript.count) chars)")
            }
            manager.endSession()
            syncSessionIfEligible(session)
            clearContext()
            return
        }

        // 5. Activate finalization indicator
        isFinalizingSession = true

        // 6. Generate title and summary using AI
        let title = await aiService.generateSessionTitle(transcript: finalTranscript)
        manager.setTitle(title)
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

        // 10. Memory Palace: Extract contact info if no contact associated
        if session.contact == nil && finalTranscript.count > 100 {
            Task {
                if let extracted = await ContactExtractionService.shared.extractFromTranscript(finalTranscript),
                   extracted.isViable {
                    // Notify UI to show extraction sheet
                    NotificationCenter.default.post(
                        name: .contactExtractionAvailable,
                        object: (extracted, session)
                    )
                }
            }
        }

        // 11. Deactivate indicator and clear context
        isFinalizingSession = false
        currentSessionContact = nil
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
        preGenerationService.cancelAndReset()
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

    // MARK: - Meeting Detection

    func setupMeetingDetection() {
        // Wire up callbacks
        meetingDetectionService.isSessionActive = { [weak self] in
            self?.isSessionActive ?? false
        }

        meetingDetectionService.onMeetingDetected = { [weak self] appName in
            guard let self else { return }
            MeetingReminderController.shared.showReminder(
                appName: appName,
                onStartSession: {
                    Task { @MainActor in
                        await self.startSession()
                    }
                },
                onDismiss: {
                    // Cooldown already recorded by detection service
                }
            )
        }

        // Observe config changes
        meetingDetectionObserver = ConfigurationManager.shared.$meetingDetectionEnabled
            .receive(on: DispatchQueue.main)
            .sink { [weak self] enabled in
                guard let self else { return }
                if enabled {
                    self.meetingDetectionService.startMonitoring()
                } else {
                    self.meetingDetectionService.stopMonitoring()
                }
            }
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
                Button(String(localized: "app.menu.stopSession")) {
                    Task { await appState.stopSession() }
                }
                .keyboardShortcut("s", modifiers: [.command, .shift])

                Divider()

                Button(appState.isOverlayVisible ? String(localized: "app.menu.hideWidget") : String(localized: "app.menu.showWidget")) {
                    appState.toggleOverlay()
                }
                .keyboardShortcut("\\", modifiers: .command)
            } else {
                Button(String(localized: "app.menu.startSession")) {
                    // Show contact picker instead of starting directly
                    appState.shouldShowContactPicker = true
                    // Ensure dashboard is visible so user can see the picker
                    NSApp.activate(ignoringOtherApps: true)
                    if let window = NSApp.windows.first(where: { $0.title.contains("Queen Mama") && !$0.title.contains("Settings") }) {
                        window.makeKeyAndOrderFront(nil)
                    } else {
                        openWindow(id: "dashboard")
                    }
                }
                .keyboardShortcut("s", modifiers: [.command, .shift])
            }

            Divider()

            Button(String(localized: "app.menu.openDashboard")) {
                // Try to bring existing window to front, or open new one
                NSApp.activate(ignoringOtherApps: true)
                if let window = NSApp.windows.first(where: { $0.title.contains("Queen Mama") && !$0.title.contains("Settings") }) {
                    window.makeKeyAndOrderFront(nil)
                } else {
                    openWindow(id: "dashboard")
                }
            }
            .keyboardShortcut("d", modifiers: [.command, .shift])

            Button(String(localized: "app.menu.giveFeedback")) {
                if let url = URL(string: "https://queenmama.featurebase.app") {
                    NSWorkspace.shared.open(url)
                }
            }

            Divider()

            Button(String(localized: "app.menu.quitApp")) {
                NSApplication.shared.terminate(nil)
            }
            .keyboardShortcut("q", modifiers: .command)
        }
    }
}
