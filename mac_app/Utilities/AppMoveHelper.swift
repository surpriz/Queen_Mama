import AppKit

/// Detects if the app is running from a transient location (Downloads, DMG, temp)
/// and offers to move it to /Applications before Sparkle tries to update.
/// This prevents the Sparkle error: "can't be updated if it's running from the location it was downloaded to"
enum AppMoveHelper {

    /// Check if the app needs to be moved to /Applications and prompt the user if so.
    /// Call this early in `applicationDidFinishLaunching`, before initializing Sparkle.
    /// Returns `true` if the app should continue launching, `false` if it will relaunch from /Applications.
    @discardableResult
    static func moveToApplicationsFolderIfNeeded() -> Bool {
        let bundlePath = Bundle.main.bundlePath
        let bundleURL = URL(fileURLWithPath: bundlePath)

        // Only check .app bundles (not when running from Xcode)
        guard bundlePath.hasSuffix(".app") else { return true }

        // Check if already in /Applications or ~/Applications
        if isInApplicationsFolder(bundlePath) { return true }

        // Check if running from a transient location
        guard isTransientLocation(bundlePath) else { return true }

        // Determine which location is problematic for the alert message
        let locationDescription: String
        if isOnDMG(bundlePath) {
            locationDescription = String(localized: "appmove.location.dmg")
        } else if isInDownloadsFolder(bundlePath) {
            locationDescription = String(localized: "appmove.location.downloads")
        } else {
            locationDescription = String(localized: "appmove.location.temporary")
        }

        // Show alert on main thread
        let alert = NSAlert()
        alert.messageText = String(localized: "appmove.alert.title")
        alert.informativeText = String(
            localized: "appmove.alert.message \(locationDescription)"
        )
        alert.alertStyle = .warning
        alert.addButton(withTitle: String(localized: "appmove.alert.move"))
        alert.addButton(withTitle: String(localized: "appmove.alert.later"))

        let response = alert.runModal()

        if response == .alertFirstButtonReturn {
            return moveToApplications(from: bundleURL)
        }

        // User chose "Later" — continue launching from current location
        // Sparkle updates won't work, but the app will still function
        return true
    }

    // MARK: - Location Checks

    private static func isInApplicationsFolder(_ path: String) -> Bool {
        // System /Applications
        if path.hasPrefix("/Applications/") { return true }

        // User ~/Applications
        let userApps = NSHomeDirectory() + "/Applications/"
        if path.hasPrefix(userApps) { return true }

        return false
    }

    private static func isTransientLocation(_ path: String) -> Bool {
        return isInDownloadsFolder(path)
            || isOnDMG(path)
            || isInTempFolder(path)
    }

    private static func isInDownloadsFolder(_ path: String) -> Bool {
        // ~/Downloads
        let userDownloads = NSHomeDirectory() + "/Downloads/"
        if path.hasPrefix(userDownloads) { return true }

        // Also check via FileManager for localized Downloads folder
        if let downloadsURL = FileManager.default.urls(for: .downloadsDirectory, in: .userDomainMask).first {
            if path.hasPrefix(downloadsURL.path) { return true }
        }

        return false
    }

    private static func isOnDMG(_ path: String) -> Bool {
        // DMG volumes are mounted under /Volumes/
        // But /Volumes/Macintosh HD is the real disk, so exclude it
        guard path.hasPrefix("/Volumes/") else { return false }

        // Check if the volume is read-only (DMGs are)
        let components = path.split(separator: "/")
        guard components.count >= 2 else { return false }

        let volumePath = "/\(components[0])/\(components[1])"
        return !FileManager.default.isWritableFile(atPath: volumePath)
    }

    private static func isInTempFolder(_ path: String) -> Bool {
        let tempPaths = [
            "/private/tmp/",
            "/private/var/folders/",
            NSTemporaryDirectory()
        ]
        return tempPaths.contains { path.hasPrefix($0) }
    }

    // MARK: - Move Operation

    private static func moveToApplications(from sourceURL: URL) -> Bool {
        let appName = sourceURL.lastPathComponent
        let destinationURL = URL(fileURLWithPath: "/Applications/\(appName)")
        let fileManager = FileManager.default

        do {
            // Remove existing version in /Applications if present
            if fileManager.fileExists(atPath: destinationURL.path) {
                try fileManager.removeItem(at: destinationURL)
            }

            // Copy to /Applications (copy instead of move for DMG compatibility)
            try fileManager.copyItem(at: sourceURL, to: destinationURL)

            print("[AppMove] Successfully copied app to \(destinationURL.path)")

            // Relaunch from /Applications
            relaunch(from: destinationURL)

            // Terminate current instance
            NSApplication.shared.terminate(nil)
            return false

        } catch {
            print("[AppMove] Failed to move app: \(error.localizedDescription)")

            // Show error alert
            let errorAlert = NSAlert()
            errorAlert.messageText = String(localized: "appmove.error.title")
            errorAlert.informativeText = String(
                localized: "appmove.error.message \(error.localizedDescription)"
            )
            errorAlert.alertStyle = .critical
            errorAlert.addButton(withTitle: "OK")
            errorAlert.runModal()

            return true
        }
    }

    private static func relaunch(from appURL: URL) {
        // Use open command to launch the new copy after a short delay
        let task = Process()
        task.launchPath = "/bin/sh"
        task.arguments = [
            "-c",
            "sleep 1 && open \"\(appURL.path)\""
        ]
        try? task.run()
    }
}
