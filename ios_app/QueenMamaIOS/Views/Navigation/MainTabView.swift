import SwiftUI

struct MainTabView: View {
    @EnvironmentObject var appState: AppState
    @EnvironmentObject var sessionManager: SessionManager
    @Environment(\.modelContext) private var modelContext
    @State private var selectedTab = 0

    var body: some View {
        TabView(selection: $selectedTab) {
            NavigationStack {
                SessionListView()
            }
            .tabItem {
                Label("Sessions", systemImage: "list.bullet.rectangle")
            }
            .tag(0)

            NavigationStack {
                ContactsListView()
            }
            .tabItem {
                Label("Contacts", systemImage: "person.2")
            }
            .tag(1)

            LiveSessionView()
                .tabItem {
                    Label("Live", systemImage: "waveform.circle")
                }
                .tag(2)

            NavigationStack {
                ModesListView()
            }
            .tabItem {
                Label("Modes", systemImage: "brain.head.profile")
            }
            .tag(3)

            NavigationStack {
                SettingsView()
            }
            .tabItem {
                Label("Settings", systemImage: "gearshape")
            }
            .tag(4)
        }
        .tint(QMDesign.Colors.accent)
        .onAppear {
            sessionManager.setModelContext(modelContext)
        }
        .sheet(isPresented: $appState.showOverlaySheet) {
            OverlayBottomSheet()
                .environmentObject(appState)
                .presentationDetents([.medium, .large])
                .presentationDragIndicator(.visible)
        }
    }
}
