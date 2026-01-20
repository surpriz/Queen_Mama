import SwiftUI

// MARK: - Localization Helper

/// Shorthand for localized strings
/// Usage: L("menu.startSession")
func L(_ key: String) -> String {
    NSLocalizedString(key, comment: "")
}

/// Shorthand for localized strings with format arguments
/// Usage: L("usage.dailyLimit", 3, 5)
func L(_ key: String, _ arguments: CVarArg...) -> String {
    String(format: NSLocalizedString(key, comment: ""), arguments: arguments)
}

// MARK: - LocalizedStringKey Extension

extension LocalizedStringKey {
    /// Create a LocalizedStringKey from a localization key
    static func key(_ key: String) -> LocalizedStringKey {
        LocalizedStringKey(key)
    }
}

// MARK: - String Extension for Localization

extension String {
    /// Get the localized version of this string
    var localized: String {
        NSLocalizedString(self, comment: "")
    }

    /// Get the localized version with format arguments
    func localized(with arguments: CVarArg...) -> String {
        String(format: NSLocalizedString(self, comment: ""), arguments: arguments)
    }
}

// MARK: - View Extension for Localization

extension View {
    /// Apply a localized accessibility label
    func localizedAccessibilityLabel(_ key: String) -> some View {
        self.accessibilityLabel(Text(L(key)))
    }

    /// Apply a localized accessibility hint
    func localizedAccessibilityHint(_ key: String) -> some View {
        self.accessibilityHint(Text(L(key)))
    }
}

// MARK: - Localization Keys

/// Namespace for all localization keys
/// This provides type-safe access to localization keys with autocomplete
enum LocalizationKey {

    // MARK: - App General
    enum App {
        static let name = "app.name"
        static let tagline = "app.tagline"
    }

    // MARK: - Common Actions
    enum Action {
        static let cancel = "action.cancel"
        static let confirm = "action.confirm"
        static let save = "action.save"
        static let delete = "action.delete"
        static let edit = "action.edit"
        static let done = "action.done"
        static let close = "action.close"
        static let retry = "action.retry"
        static let copy = "action.copy"
        static let copied = "action.copied"
        static let `continue` = "action.continue"
        static let back = "action.back"
        static let skip = "action.skip"
        static let next = "action.next"
    }

    // MARK: - Menu
    enum Menu {
        static let startSession = "menu.startSession"
        static let stopSession = "menu.stopSession"
        static let showWidget = "menu.showWidget"
        static let hideWidget = "menu.hideWidget"
        static let openDashboard = "menu.openDashboard"
        static let quit = "menu.quit"
    }

    // MARK: - Dashboard
    enum Dashboard {
        static let title = "dashboard.title"
        static let sessions = "dashboard.sessions"
        static let modes = "dashboard.modes"
        static let noSessions = "dashboard.noSessions"
        static let noSessionsDescription = "dashboard.noSessionsDescription"
    }

    // MARK: - Session
    enum Session {
        static let start = "session.start"
        static let stop = "session.stop"
        static let active = "session.active"
        static let duration = "session.duration"
        static let transcript = "session.transcript"
        static let summary = "session.summary"
        static let actionItems = "session.actionItems"
        static let noTranscript = "session.noTranscript"
        static let finalizingTitle = "session.finalizingTitle"
        static let finalizingSummary = "session.finalizingSummary"
    }

    // MARK: - AI
    enum AI {
        static let assist = "ai.assist"
        static let whatToSay = "ai.whatToSay"
        static let followUp = "ai.followUp"
        static let recap = "ai.recap"
        static let processing = "ai.processing"
        static let error = "ai.error"
        static let noResponse = "ai.noResponse"
        static let triggerAssist = "ai.triggerAssist"
    }

    // MARK: - Settings
    enum Settings {
        static let title = "settings.title"
        static let account = "settings.account"
        static let general = "settings.general"
        static let autoAnswer = "settings.autoAnswer"
        static let models = "settings.models"
        static let audio = "settings.audio"
        static let sync = "settings.sync"
        static let shortcuts = "settings.shortcuts"
        static let updates = "settings.updates"
    }

    // MARK: - Account
    enum Account {
        static let connected = "account.connected"
        static let notConnected = "account.notConnected"
        static let signIn = "account.signIn"
        static let signOut = "account.signOut"
        static let signOutConfirm = "account.signOutConfirm"
        static let connectAccount = "account.connectAccount"
        static let connecting = "account.connecting"
        static let enterCode = "account.enterCode"
        static let waitingAuthorization = "account.waitingAuthorization"
        static let browserOpened = "account.browserOpened"
    }

    // MARK: - Subscription
    enum Subscription {
        static let free = "subscription.free"
        static let pro = "subscription.pro"
        static let enterprise = "subscription.enterprise"
        static let upgrade = "subscription.upgrade"
        static let manageBilling = "subscription.manageBilling"
        static let trialDaysRemaining = "subscription.trialDaysRemaining"
        static let allFeaturesUnlocked = "subscription.allFeaturesUnlocked"
        static let upgradeForUnlimited = "subscription.upgradeForUnlimited"
    }

    // MARK: - Errors
    enum Error {
        static let generic = "error.generic"
        static let networkError = "error.networkError"
        static let authenticationRequired = "error.authenticationRequired"
        static let featureNotAvailable = "error.featureNotAvailable"
        static let sessionLimitReached = "error.sessionLimitReached"
        static let transcriptionFailed = "error.transcriptionFailed"
        static let aiFailed = "error.aiFailed"
    }
}
