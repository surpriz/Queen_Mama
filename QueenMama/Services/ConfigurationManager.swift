import Foundation
import Combine

final class ConfigurationManager: ObservableObject {
    static let shared = ConfigurationManager()

    private let defaults = UserDefaults.standard
    private let keychain = KeychainManager.shared

    // MARK: - Published Settings

    @Published var isUndetectabilityEnabled: Bool {
        didSet { defaults.set(isUndetectabilityEnabled, forKey: Keys.undetectability) }
    }

    @Published var captureSystemAudio: Bool {
        didSet { defaults.set(captureSystemAudio, forKey: Keys.captureSystemAudio) }
    }

    @Published var captureMicrophone: Bool {
        didSet { defaults.set(captureMicrophone, forKey: Keys.captureMicrophone) }
    }

    @Published var autoScreenCapture: Bool {
        didSet { defaults.set(autoScreenCapture, forKey: Keys.autoScreenCapture) }
    }

    @Published var screenCaptureIntervalSeconds: Double {
        didSet { defaults.set(screenCaptureIntervalSeconds, forKey: Keys.screenCaptureInterval) }
    }

    @Published var smartModeEnabled: Bool {
        didSet { defaults.set(smartModeEnabled, forKey: Keys.smartMode) }
    }

    @Published var selectedAIProvider: AIProviderType {
        didSet { defaults.set(selectedAIProvider.rawValue, forKey: Keys.aiProvider) }
    }

    @Published var primaryLanguage: String {
        didSet { defaults.set(primaryLanguage, forKey: Keys.primaryLanguage) }
    }

    // MARK: - Auto-Answer Settings

    @Published var autoAnswerEnabled: Bool {
        didSet { defaults.set(autoAnswerEnabled, forKey: Keys.autoAnswerEnabled) }
    }

    @Published var autoAnswerSilenceThreshold: Double {
        didSet { defaults.set(autoAnswerSilenceThreshold, forKey: Keys.autoAnswerSilenceThreshold) }
    }

    @Published var autoAnswerCooldown: Double {
        didSet { defaults.set(autoAnswerCooldown, forKey: Keys.autoAnswerCooldown) }
    }

    @Published var autoAnswerResponseType: String {
        didSet { defaults.set(autoAnswerResponseType, forKey: Keys.autoAnswerResponseType) }
    }

    // MARK: - Keyboard Shortcuts

    @Published var shortcutToggleWidget: String {
        didSet { defaults.set(shortcutToggleWidget, forKey: Keys.shortcutToggleWidget) }
    }

    @Published var shortcutAssist: String {
        didSet { defaults.set(shortcutAssist, forKey: Keys.shortcutAssist) }
    }

    @Published var shortcutClearContext: String {
        didSet { defaults.set(shortcutClearContext, forKey: Keys.shortcutClearContext) }
    }

    // MARK: - Keys

    private enum Keys {
        static let undetectability = "undetectability_enabled"
        static let captureSystemAudio = "capture_system_audio"
        static let captureMicrophone = "capture_microphone"
        static let autoScreenCapture = "auto_screen_capture"
        static let screenCaptureInterval = "screen_capture_interval"
        static let smartMode = "smart_mode_enabled"
        static let aiProvider = "selected_ai_provider"
        static let primaryLanguage = "primary_language"
        static let shortcutToggleWidget = "shortcut_toggle_widget"
        static let shortcutAssist = "shortcut_assist"
        static let shortcutClearContext = "shortcut_clear_context"
        static let hasCompletedOnboarding = "has_completed_onboarding"
        // Auto-Answer
        static let autoAnswerEnabled = "auto_answer_enabled"
        static let autoAnswerSilenceThreshold = "auto_answer_silence_threshold"
        static let autoAnswerCooldown = "auto_answer_cooldown"
        static let autoAnswerResponseType = "auto_answer_response_type"
    }

    // MARK: - Initialization

    private init() {
        // Load settings from UserDefaults with defaults
        self.isUndetectabilityEnabled = defaults.bool(forKey: Keys.undetectability)
        self.captureSystemAudio = defaults.object(forKey: Keys.captureSystemAudio) as? Bool ?? true
        self.captureMicrophone = defaults.object(forKey: Keys.captureMicrophone) as? Bool ?? true
        self.autoScreenCapture = defaults.object(forKey: Keys.autoScreenCapture) as? Bool ?? true
        self.screenCaptureIntervalSeconds = defaults.object(forKey: Keys.screenCaptureInterval) as? Double ?? 5.0
        self.smartModeEnabled = defaults.object(forKey: Keys.smartMode) as? Bool ?? false
        self.primaryLanguage = defaults.string(forKey: Keys.primaryLanguage) ?? "en"

        if let providerRaw = defaults.string(forKey: Keys.aiProvider),
           let provider = AIProviderType(rawValue: providerRaw) {
            self.selectedAIProvider = provider
        } else {
            self.selectedAIProvider = .openai
        }

        // Keyboard shortcuts
        self.shortcutToggleWidget = defaults.string(forKey: Keys.shortcutToggleWidget) ?? "cmd+\\"
        self.shortcutAssist = defaults.string(forKey: Keys.shortcutAssist) ?? "cmd+return"
        self.shortcutClearContext = defaults.string(forKey: Keys.shortcutClearContext) ?? "cmd+r"

        // Auto-Answer settings
        self.autoAnswerEnabled = defaults.object(forKey: Keys.autoAnswerEnabled) as? Bool ?? false
        self.autoAnswerSilenceThreshold = defaults.object(forKey: Keys.autoAnswerSilenceThreshold) as? Double ?? 2.5
        self.autoAnswerCooldown = defaults.object(forKey: Keys.autoAnswerCooldown) as? Double ?? 10.0
        self.autoAnswerResponseType = defaults.string(forKey: Keys.autoAnswerResponseType) ?? "assist"
    }

    // MARK: - Onboarding

    var hasCompletedOnboarding: Bool {
        get { defaults.bool(forKey: Keys.hasCompletedOnboarding) }
        set { defaults.set(newValue, forKey: Keys.hasCompletedOnboarding) }
    }

    // MARK: - API Key Helpers

    func hasAllRequiredAPIKeys() -> Bool {
        return keychain.hasAPIKey(for: .deepgram) &&
               (keychain.hasAPIKey(for: .openai) ||
                keychain.hasAPIKey(for: .anthropic) ||
                keychain.hasAPIKey(for: .gemini))
    }

    func getMissingAPIKeys() -> [KeychainManager.APIKeyType] {
        var missing: [KeychainManager.APIKeyType] = []

        if !keychain.hasAPIKey(for: .deepgram) {
            missing.append(.deepgram)
        }

        // Need at least one AI provider
        if !keychain.hasAPIKey(for: .openai) &&
           !keychain.hasAPIKey(for: .anthropic) &&
           !keychain.hasAPIKey(for: .gemini) {
            missing.append(.openai) // Suggest OpenAI as primary
        }

        return missing
    }

    // MARK: - Reset

    func resetToDefaults() {
        isUndetectabilityEnabled = false
        captureSystemAudio = true
        captureMicrophone = true
        autoScreenCapture = true
        screenCaptureIntervalSeconds = 5.0
        smartModeEnabled = false
        selectedAIProvider = .openai
        primaryLanguage = "en"
        shortcutToggleWidget = "cmd+\\"
        shortcutAssist = "cmd+return"
        shortcutClearContext = "cmd+r"
        // Auto-Answer
        autoAnswerEnabled = false
        autoAnswerSilenceThreshold = 2.5
        autoAnswerCooldown = 10.0
        autoAnswerResponseType = "assist"
    }
}
