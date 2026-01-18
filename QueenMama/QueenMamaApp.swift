import SwiftUI
import SwiftData

// MARK: - App Delegate
class AppDelegate: NSObject, NSApplicationDelegate {
    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
        // Don't quit when main window is closed - keep running with widget and menu bar
        return false
    }

    func applicationDidFinishLaunching(_ notification: Notification) {
        // Restore authentication state on launch
        Task { @MainActor in
            await AuthenticationManager.shared.checkExistingAuth()
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
    @State private var showingOnboarding = !ConfigurationManager.shared.hasCompletedOnboarding

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
                if showingOnboarding {
                    OnboardingView {
                        showingOnboarding = false
                    }
                    .environmentObject(appState)
                } else {
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
        .defaultSize(width: showingOnboarding ? 800 : 900, height: showingOnboarding ? 600 : 700)

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

        // 9. Deactivate indicator and clear context
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

            Divider()

            Button("Quit Queen Mama") {
                NSApplication.shared.terminate(nil)
            }
            .keyboardShortcut("q", modifiers: .command)
        }
    }
}
