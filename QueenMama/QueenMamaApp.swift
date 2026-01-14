import SwiftUI
import SwiftData

@main
struct QueenMamaApp: App {
    @StateObject private var appState = AppState()
    @StateObject private var sessionManager = SessionManager()

    var sharedModelContainer: ModelContainer = {
        let schema = Schema([
            Session.self,
            TranscriptEntry.self,
            Mode.self
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
            DashboardView()
                .environmentObject(appState)
                .environmentObject(sessionManager)
        }
        .modelContainer(sharedModelContainer)
        .windowStyle(.hiddenTitleBar)
        .defaultSize(width: 900, height: 700)

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
}

// MARK: - Menu Bar View
struct MenuBarView: View {
    @EnvironmentObject var appState: AppState
    @EnvironmentObject var sessionManager: SessionManager

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
                NSApp.activate(ignoringOtherApps: true)
                if let window = NSApp.windows.first(where: { $0.identifier?.rawValue == "dashboard" }) {
                    window.makeKeyAndOrderFront(nil)
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
