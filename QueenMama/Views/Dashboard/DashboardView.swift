import SwiftUI
import SwiftData

struct DashboardView: View {
    @EnvironmentObject var appState: AppState
    @EnvironmentObject var sessionManager: SessionManager
    @Environment(\.modelContext) private var modelContext

    @State private var selectedSection: DashboardSection = .sessions
    @State private var searchText = ""

    var body: some View {
        NavigationSplitView {
            // Sidebar
            SidebarView(selectedSection: $selectedSection)
                .frame(minWidth: 200)
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
            .frame(minWidth: 500)
        }
        .navigationTitle("Queen Mama")
        .toolbar {
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
                    Label(
                        appState.isSessionActive ? "Stop Session" : "Start Session",
                        systemImage: appState.isSessionActive ? "stop.circle.fill" : "play.circle.fill"
                    )
                }
                .keyboardShortcut("s", modifiers: [.command, .shift])

                // Show/Hide Overlay
                Button(action: {
                    OverlayWindowController.shared.toggleVisibility()
                }) {
                    Label("Toggle Widget", systemImage: "pip.fill")
                }
                .keyboardShortcut("\\", modifiers: .command)
            }
        }
        .onAppear {
            sessionManager.setModelContext(modelContext)
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
        case .sessions: return "list.bullet.rectangle"
        case .liveSession: return "waveform"
        case .modes: return "person.2"
        case .settings: return "gear"
        }
    }
}

// MARK: - Sidebar View

struct SidebarView: View {
    @Binding var selectedSection: DashboardSection
    @EnvironmentObject var appState: AppState

    var body: some View {
        List(selection: $selectedSection) {
            Section("Navigation") {
                ForEach(DashboardSection.allCases, id: \.self) { section in
                    NavigationLink(value: section) {
                        Label(section.rawValue, systemImage: section.icon)
                    }
                }
            }

            Section("Status") {
                HStack {
                    Circle()
                        .fill(appState.isSessionActive ? Color.green : Color.gray)
                        .frame(width: 8, height: 8)
                    Text(appState.isSessionActive ? "Recording" : "Idle")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }

                if appState.isSessionActive {
                    HStack {
                        Image(systemName: "mic.fill")
                            .foregroundColor(.blue)
                        AudioLevelIndicator(level: appState.audioLevel)
                    }
                }
            }
        }
        .listStyle(.sidebar)
    }
}

// MARK: - Audio Level Indicator

struct AudioLevelIndicator: View {
    let level: Float

    var body: some View {
        GeometryReader { geometry in
            ZStack(alignment: .leading) {
                RoundedRectangle(cornerRadius: 2)
                    .fill(Color.gray.opacity(0.3))

                RoundedRectangle(cornerRadius: 2)
                    .fill(Color.green)
                    .frame(width: geometry.size.width * CGFloat(level))
            }
        }
        .frame(height: 4)
    }
}
