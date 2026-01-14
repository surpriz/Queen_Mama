import SwiftUI
import SwiftData

// MARK: - App Delegate
class AppDelegate: NSObject, NSApplicationDelegate {
    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
        // Don't quit when main window is closed - keep running with widget and menu bar
        return false
    }

    func applicationDidFinishLaunching(_ notification: Notification) {
        // App will keep running even without windows
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

    // Services
    let audioService = AudioCaptureService()
    let screenService = ScreenCaptureService()
    let transcriptionService = TranscriptionService()
    let aiService = AIService()

    func startSession() async {
        isSessionActive = true
        errorMessage = nil

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
                }
            }
        } catch {
            errorMessage = error.localizedDescription
            await stopSession()
        }
    }

    func stopSession() async {
        audioService.stopCapture()
        screenService.stopCapture()
        transcriptionService.disconnect()
        isSessionActive = false
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
