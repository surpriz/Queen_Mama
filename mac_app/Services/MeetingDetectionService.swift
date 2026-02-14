import AppKit
import Combine

@MainActor
final class MeetingDetectionService: ObservableObject {

    // MARK: - Callbacks

    /// Called when a meeting app is detected and no session is active
    var onMeetingDetected: ((String) -> Void)?

    /// Returns whether a session is currently active
    var isSessionActive: (() -> Bool)?

    // MARK: - State

    @Published private(set) var isMonitoring = false
    private var cooldowns: [String: Date] = [:]
    private let cooldownInterval: TimeInterval = 30 * 60 // 30 minutes

    private var launchObserver: NSObjectProtocol?
    private var activateObserver: NSObjectProtocol?
    private var meetingScanTimer: Timer?

    // MARK: - Meeting Detection Config

    /// Apps where just launching strongly indicates a meeting
    /// (users rarely open these without joining a call)
    private let launchDetectedApps: [String: String] = [
        "us.zoom.xos": "Zoom",
        "com.cisco.webexmeetingsapp": "WebEx",
    ]

    /// Window-based detection: app bundle IDs mapped to (display name, idle window titles to IGNORE)
    /// If the app has a window title NOT in the idle list, it likely means a call is in progress.
    private let windowDetectedApps: [String: (appName: String, idleTitles: Set<String>)] = [
        "com.microsoft.teams": (appName: "Microsoft Teams", idleTitles: ["Microsoft Teams", "Microsoft Teams (work or school)", "Microsoft Teams classic", ""]),
        "com.microsoft.teams2": (appName: "Microsoft Teams", idleTitles: ["Microsoft Teams", "Microsoft Teams (work or school)", "Microsoft Teams classic", ""]),
        "com.apple.FaceTime": (appName: "FaceTime", idleTitles: ["FaceTime", ""]),
        "com.tinyspeck.slackmacgap": (appName: "Slack", idleTitles: []),
        "com.discord.Discord": (appName: "Discord", idleTitles: []),
    ]

    /// For Slack: window title must contain one of these keywords to indicate a call
    private let slackCallKeywords = ["Huddle", "huddle"]

    /// For Discord: window title must contain one of these keywords
    private let discordCallKeywords = ["Voice Connected", "Screen Share"]

    /// For Teams: window title prefixes that indicate non-meeting views (chats, navigation)
    /// These should NOT trigger meeting detection even though they're not "idle" titles
    private let teamsNonMeetingPrefixes = [
        "Conversation ",   // Chat conversation window
        "Chat ",           // Alternative chat format
        "Activity",        // Activity feed
        "Calendar",        // Calendar view (not in a meeting)
        "Files",           // Files browser
        "Calls",           // Calls list (not actively in a call)
        "Teams",           // Teams list
        "People",          // People browser
        "Settings",        // Settings view
        "Notifications",   // Notification settings
    ]

    /// Browser bundle IDs
    private let browserBundleIDs: Set<String> = [
        "com.google.Chrome",
        "com.apple.Safari",
        "org.mozilla.firefox",
        "company.thebrowser.Browser", // Arc
        "com.brave.Browser",
        "com.microsoft.edgemac",
    ]

    /// Browser window title keywords for Google Meet
    private let meetingBrowserKeywords: [(keyword: String, appName: String)] = [
        ("Google Meet", "Google Meet"),
        ("meet.google.com", "Google Meet"),
        ("Meet \u{2013}", "Google Meet"),  // Google Meet tab title: "Meet – xxx" (en dash U+2013)
        ("Meet \u{2014}", "Google Meet"),  // em dash variant U+2014
        ("Meet -", "Google Meet"),         // regular hyphen fallback
    ]

    // MARK: - Lifecycle

    func startMonitoring() {
        guard !isMonitoring else { return }
        isMonitoring = true
        print("[MeetingDetection] Started monitoring (callbacks set: onMeetingDetected=\(onMeetingDetected != nil), isSessionActive=\(isSessionActive != nil))")

        // Observe new app launches only for meeting-specific apps (Zoom, WebEx)
        launchObserver = NSWorkspace.shared.notificationCenter.addObserver(
            forName: NSWorkspace.didLaunchApplicationNotification,
            object: nil,
            queue: .main
        ) { [weak self] notification in
            Task { @MainActor [weak self] in
                guard let self,
                      let app = notification.userInfo?[NSWorkspace.applicationUserInfoKey] as? NSRunningApplication,
                      let bundleID = app.bundleIdentifier else { return }

                if let appName = self.launchDetectedApps[bundleID] {
                    print("[MeetingDetection] Meeting app launched: \(appName) (\(bundleID))")
                    self.triggerIfEligible(appName: appName)
                }
            }
        }

        // Immediate meeting window scan
        scanMeetingWindows()

        // Timer for window scanning (every 15s)
        meetingScanTimer = Timer.scheduledTimer(withTimeInterval: 15, repeats: true) { [weak self] _ in
            Task { @MainActor [weak self] in
                self?.scanMeetingWindows()
            }
        }
    }

    func stopMonitoring() {
        guard isMonitoring else { return }
        isMonitoring = false

        if let observer = launchObserver {
            NSWorkspace.shared.notificationCenter.removeObserver(observer)
            launchObserver = nil
        }
        if let observer = activateObserver {
            NSWorkspace.shared.notificationCenter.removeObserver(observer)
            activateObserver = nil
        }

        meetingScanTimer?.invalidate()
        meetingScanTimer = nil

        print("[MeetingDetection] Stopped monitoring")
    }

    // MARK: - Unified Window Scanning

    private func scanMeetingWindows() {
        guard isMonitoring else { return }
        guard let windowList = CGWindowListCopyWindowInfo([.optionOnScreenOnly, .excludeDesktopElements], kCGNullWindowID) as? [[String: Any]] else {
            return
        }

        // Group windows by owning app bundle ID
        var windowsByApp: [String: [(title: String, layer: Int)]] = [:]

        for window in windowList {
            guard let ownerPID = window[kCGWindowOwnerPID as String] as? pid_t else { continue }
            let windowName = window[kCGWindowName as String] as? String ?? ""
            let windowLayer = window[kCGWindowLayer as String] as? Int ?? 0

            let app = NSRunningApplication(processIdentifier: ownerPID)
            guard let bundleID = app?.bundleIdentifier else { continue }

            windowsByApp[bundleID, default: []].append((title: windowName, layer: windowLayer))
        }

        // Check window-detected apps (Teams, FaceTime, Slack, Discord)
        for (bundleID, config) in windowDetectedApps {
            guard let windows = windowsByApp[bundleID] else { continue }

            let hasActiveMeeting: Bool

            if bundleID.contains("slackmacgap") {
                // Slack: check for huddle keywords
                hasActiveMeeting = windows.contains { win in
                    slackCallKeywords.contains(where: { win.title.localizedCaseInsensitiveContains($0) })
                }
            } else if bundleID.contains("Discord") {
                // Discord: check for voice channel keywords
                hasActiveMeeting = windows.contains { win in
                    discordCallKeywords.contains(where: { win.title.localizedCaseInsensitiveContains($0) })
                }
            } else if bundleID.contains("microsoft.teams") {
                // Teams: must have a non-idle window that's NOT a chat/conversation/navigation view
                hasActiveMeeting = windows.contains { win in
                    win.layer == 0 &&
                    !win.title.isEmpty &&
                    !config.idleTitles.contains(win.title) &&
                    !teamsNonMeetingPrefixes.contains(where: { win.title.hasPrefix($0) })
                }
            } else {
                // FaceTime: check if there's a non-idle window at layer 0 (normal windows)
                hasActiveMeeting = windows.contains { win in
                    win.layer == 0 &&
                    !win.title.isEmpty &&
                    !config.idleTitles.contains(win.title)
                }
            }

            if hasActiveMeeting {
                let titles = windows.filter { $0.layer == 0 && !$0.title.isEmpty }.map { $0.title }
                print("[MeetingDetection] Active call detected in \(config.appName): \(titles)")
                triggerIfEligible(appName: config.appName)
            } else if !windows.filter({ $0.layer == 0 && !$0.title.isEmpty }).isEmpty {
                let titles = windows.filter { $0.layer == 0 && !$0.title.isEmpty }.map { $0.title }
                print("[MeetingDetection] \(config.appName) windows found but no active meeting: \(titles)")
            }
        }

        // Check browser windows for Google Meet (and other browser-based meetings)
        var browserTitles: [(bundleID: String, title: String)] = []
        for browserBundleID in browserBundleIDs {
            guard let windows = windowsByApp[browserBundleID] else { continue }
            for win in windows where !win.title.isEmpty {
                browserTitles.append((bundleID: browserBundleID, title: win.title))
            }
        }

        for entry in browserTitles {
            let normalizedTitle = entry.title.lowercased()
            for pattern in meetingBrowserKeywords {
                if normalizedTitle.contains(pattern.keyword.lowercased()) {
                    print("[MeetingDetection] Browser meeting detected: '\(entry.title)' in \(entry.bundleID)")
                    triggerIfEligible(appName: pattern.appName)
                    return
                }
            }
        }

        if !browserTitles.isEmpty {
            let desc = browserTitles.map { "[\($0.bundleID)] '\($0.title)'" }.joined(separator: ", ")
            print("[MeetingDetection] Browser windows (\(browserTitles.count)): \(desc)")
        }
    }

    // MARK: - Trigger Logic

    private func triggerIfEligible(appName: String) {
        // Don't trigger if session is already active
        if isSessionActive?() == true {
            return
        }

        // Don't trigger if within cooldown
        if let lastReminder = cooldowns[appName],
           Date().timeIntervalSince(lastReminder) < cooldownInterval {
            return
        }

        // Record cooldown
        cooldowns[appName] = Date()

        print("[MeetingDetection] Triggering reminder for: \(appName)")
        onMeetingDetected?(appName)
    }

    // MARK: - Reset

    func resetCooldowns() {
        cooldowns.removeAll()
    }
}
