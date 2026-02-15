import SwiftUI
import SwiftData

// MARK: - App Delegate
class AppDelegate: NSObject, UIApplicationDelegate {
    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil) -> Bool {
        // Initialize crash reporting
        CrashReporter.shared.start()

        // Initialize analytics
        AnalyticsService.shared.start()

        // Restore authentication state on launch
        Task { @MainActor in
            await AuthenticationManager.shared.checkExistingAuth()

            // Explicitly validate license after auth is restored
            // (LicenseManager's Combine subscription uses .dropFirst() which
            // misses the initial value when initialized after auth completes)
            if AuthenticationManager.shared.isAuthenticated {
                await LicenseManager.shared.revalidate()
            }

            if let user = AuthenticationManager.shared.currentUser {
                CrashReporter.shared.setUser(id: user.id, email: user.email)
                AnalyticsService.shared.identify(
                    userId: user.id,
                    email: user.email,
                    name: user.name,
                    plan: LicenseManager.shared.currentLicense.plan.rawValue
                )
            }

            // Clean up orphaned sessions
            cleanupOrphanedSessions()

            if AuthenticationManager.shared.isAuthenticated {
                do {
                    try await ProxyConfigManager.shared.refreshConfig()
                    print("[App] Proxy config loaded: \(ProxyConfigManager.shared.availableAIProviders)")
                } catch {
                    print("[App] Failed to load proxy config: \(error)")
                }

                ProxyAPIClient.shared.prefetchTranscriptionToken()

                await SyncManager.shared.reconcileRemoteDeletions()
            }
        }

        return true
    }

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
    }

    // Note: applicationDidBecomeActive is NOT called in SwiftUI scene-based lifecycle.
    // License revalidation on foreground is handled via ScenePhase in QueenMamaApp.body.
}

@main
struct QueenMamaApp: App {
    @UIApplicationDelegateAdaptor(AppDelegate.self) var appDelegate

    @StateObject private var appState = AppState()
    @StateObject private var sessionManager = SessionManager()
    @StateObject private var authManager = AuthenticationManager.shared

    @Environment(\.scenePhase) private var scenePhase
    @State private var launchState: LaunchState = .checking

    enum LaunchState {
        case checking
        case onboarding
        case login
        case dashboard
    }

    static let sharedModelContainer: ModelContainer = {
        let schema = Schema(versionedSchema: SchemaV1.self)
        let modelConfiguration = ModelConfiguration(schema: schema, isStoredInMemoryOnly: false)

        do {
            return try ModelContainer(for: schema, migrationPlan: QueenMamaMigrationPlan.self,
                                      configurations: [modelConfiguration])
        } catch {
            print("[App] CRITICAL: ModelContainer creation failed: \(error)")
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
                print("[App] CRITICAL: Still failed after store deletion: \(error)")
                let inMemoryConfig = ModelConfiguration(schema: schema, isStoredInMemoryOnly: true)
                do {
                    return try ModelContainer(for: schema, configurations: [inMemoryConfig])
                } catch {
                    fatalError("Could not create even in-memory ModelContainer: \(error)")
                }
            }
        }
    }()

    var sharedModelContainer: ModelContainer { Self.sharedModelContainer }

    var body: some Scene {
        WindowGroup {
            Group {
                switch launchState {
                case .checking:
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
                    MainTabView()
                        .environmentObject(appState)
                        .environmentObject(sessionManager)
                        .onAppear {
                            appState.sessionManager = sessionManager
                        }
                }
            }
            .preferredColorScheme(.dark)
        }
        .modelContainer(sharedModelContainer)
        .onChange(of: scenePhase) { _, newPhase in
            if newPhase == .active {
                Task { @MainActor in
                    await LicenseManager.shared.revalidate()
                }
            }
        }
    }

    private func checkAuthAndSetLaunchState() {
        Task { @MainActor in
            var attempts = 0
            let maxAttempts = 20

            while attempts < maxAttempts {
                switch authManager.authState {
                case .unknown:
                    try? await Task.sleep(nanoseconds: 100_000_000)
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

            if ConfigurationManager.shared.hasCompletedOnboarding {
                print("[App] Auth check timeout but onboarding completed, showing login")
                launchState = .login
            } else {
                print("[App] Auth check timeout, showing onboarding")
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
    }
}
