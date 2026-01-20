import Foundation
import SwiftUI

#if canImport(Sparkle)
import Sparkle

/// Manages application updates using Sparkle framework
///
/// To use Sparkle, add it as a Swift Package dependency:
/// 1. In Xcode, go to File → Add Package Dependencies
/// 2. Enter URL: https://github.com/sparkle-project/Sparkle
/// 3. Select "Up to Next Major Version" from 2.0.0
/// 4. Add to the QueenMama target
///
/// Also ensure you have:
/// - SUFeedURL in Info.plist pointing to your appcast.xml
/// - SUPublicEDKey with your EdDSA public key (generate with Sparkle's generate_keys tool)
@MainActor
final class UpdaterManager: NSObject, ObservableObject {

    // MARK: - Singleton
    static let shared = UpdaterManager()

    // MARK: - Properties
    private var updaterController: SPUStandardUpdaterController!

    /// Whether the updater can check for updates
    @Published var canCheckForUpdates = false

    /// Last update check date
    @Published var lastUpdateCheckDate: Date?

    /// Whether automatic update checks are enabled
    @Published var automaticallyChecksForUpdates: Bool = true {
        didSet {
            updaterController.updater.automaticallyChecksForUpdates = automaticallyChecksForUpdates
        }
    }

    /// Whether to automatically download updates
    @Published var automaticallyDownloadsUpdates: Bool = false {
        didSet {
            updaterController.updater.automaticallyDownloadsUpdates = automaticallyDownloadsUpdates
        }
    }

    /// Whether Sparkle is available
    var isSparkleAvailable: Bool { true }

    // MARK: - Initialization

    private override init() {
        super.init()

        // Initialize the standard updater controller
        updaterController = SPUStandardUpdaterController(
            startingUpdater: true,
            updaterDelegate: nil,
            userDriverDelegate: nil
        )

        // Observe canCheckForUpdates
        updaterController.updater.publisher(for: \.canCheckForUpdates)
            .assign(to: &$canCheckForUpdates)

        // Observe lastUpdateCheckDate
        updaterController.updater.publisher(for: \.lastUpdateCheckDate)
            .assign(to: &$lastUpdateCheckDate)

        // Sync published properties with updater state
        automaticallyChecksForUpdates = updaterController.updater.automaticallyChecksForUpdates
        automaticallyDownloadsUpdates = updaterController.updater.automaticallyDownloadsUpdates

        print("[Updater] Initialized. Feed URL: \(updaterController.updater.feedURL?.absoluteString ?? "not set")")
    }

    // MARK: - Public Methods

    /// Check for updates manually
    func checkForUpdates() {
        guard canCheckForUpdates else {
            print("[Updater] Cannot check for updates at this time")
            return
        }

        print("[Updater] Checking for updates...")
        updaterController.checkForUpdates(nil)
    }

    /// Check for updates in background (no UI)
    func checkForUpdatesInBackground() {
        print("[Updater] Checking for updates in background...")
        updaterController.updater.checkForUpdatesInBackground()
    }

    /// Get the current app version
    var currentVersion: String {
        Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "Unknown"
    }

    /// Get the current build number
    var currentBuild: String {
        Bundle.main.infoDictionary?["CFBundleVersion"] as? String ?? "Unknown"
    }

    /// Format last check date for display
    var lastCheckDescription: String {
        guard let date = lastUpdateCheckDate else {
            return "Never"
        }

        let formatter = RelativeDateTimeFormatter()
        formatter.unitsStyle = .full
        return formatter.localizedString(for: date, relativeTo: Date())
    }
}

#else

/// Stub UpdaterManager when Sparkle is not available
///
/// To enable auto-updates, add Sparkle as a Swift Package dependency:
/// 1. In Xcode, go to File → Add Package Dependencies
/// 2. Enter URL: https://github.com/sparkle-project/Sparkle
/// 3. Select "Up to Next Major Version" from 2.0.0
/// 4. Add to the QueenMama target
@MainActor
final class UpdaterManager: NSObject, ObservableObject {

    // MARK: - Singleton
    static let shared = UpdaterManager()

    /// Whether the updater can check for updates
    @Published var canCheckForUpdates = false

    /// Last update check date
    @Published var lastUpdateCheckDate: Date?

    /// Whether automatic update checks are enabled
    @Published var automaticallyChecksForUpdates: Bool = false

    /// Whether to automatically download updates
    @Published var automaticallyDownloadsUpdates: Bool = false

    /// Whether Sparkle is available
    var isSparkleAvailable: Bool { false }

    // MARK: - Initialization

    private override init() {
        super.init()
        print("[Updater] Sparkle not installed. Add Sparkle via Swift Package Manager to enable auto-updates.")
    }

    // MARK: - Public Methods

    /// Check for updates manually
    func checkForUpdates() {
        print("[Updater] Sparkle not installed. Cannot check for updates.")
    }

    /// Check for updates in background (no UI)
    func checkForUpdatesInBackground() {
        print("[Updater] Sparkle not installed. Cannot check for updates.")
    }

    /// Get the current app version
    var currentVersion: String {
        Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "Unknown"
    }

    /// Get the current build number
    var currentBuild: String {
        Bundle.main.infoDictionary?["CFBundleVersion"] as? String ?? "Unknown"
    }

    /// Format last check date for display
    var lastCheckDescription: String {
        "Auto-updates not available"
    }
}

#endif
