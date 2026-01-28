import Foundation
import Combine

@MainActor
final class ConfigurationManager: ObservableObject {
    static let shared = ConfigurationManager()

    private let defaults = UserDefaults.standard

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

    // MARK: - Proactive Suggestions Settings (Enterprise)

    @Published var proactiveEnabled: Bool {
        didSet { defaults.set(proactiveEnabled, forKey: Keys.proactiveEnabled) }
    }

    @Published var proactiveSensitivity: Double {
        didSet { defaults.set(proactiveSensitivity, forKey: Keys.proactiveSensitivity) }
    }

    @Published var proactiveCooldown: Int {
        didSet { defaults.set(proactiveCooldown, forKey: Keys.proactiveCooldown) }
    }

    @Published var proactiveObjectionsEnabled: Bool {
        didSet { defaults.set(proactiveObjectionsEnabled, forKey: Keys.proactiveObjections) }
    }

    @Published var proactiveQuestionsEnabled: Bool {
        didSet { defaults.set(proactiveQuestionsEnabled, forKey: Keys.proactiveQuestions) }
    }

    @Published var proactiveHesitationsEnabled: Bool {
        didSet { defaults.set(proactiveHesitationsEnabled, forKey: Keys.proactiveHesitations) }
    }

    @Published var proactiveClosingEnabled: Bool {
        didSet { defaults.set(proactiveClosingEnabled, forKey: Keys.proactiveClosing) }
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
        // Proactive Suggestions
        static let proactiveEnabled = "proactive_enabled"
        static let proactiveSensitivity = "proactive_sensitivity"
        static let proactiveCooldown = "proactive_cooldown"
        static let proactiveObjections = "proactive_objections"
        static let proactiveQuestions = "proactive_questions"
        static let proactiveHesitations = "proactive_hesitations"
        static let proactiveClosing = "proactive_closing"
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

        // Proactive Suggestions settings (Enterprise only)
        self.proactiveEnabled = defaults.object(forKey: Keys.proactiveEnabled) as? Bool ?? false
        self.proactiveSensitivity = defaults.object(forKey: Keys.proactiveSensitivity) as? Double ?? 0.7
        self.proactiveCooldown = defaults.object(forKey: Keys.proactiveCooldown) as? Int ?? 15
        self.proactiveObjectionsEnabled = defaults.object(forKey: Keys.proactiveObjections) as? Bool ?? true
        self.proactiveQuestionsEnabled = defaults.object(forKey: Keys.proactiveQuestions) as? Bool ?? true
        self.proactiveHesitationsEnabled = defaults.object(forKey: Keys.proactiveHesitations) as? Bool ?? false
        self.proactiveClosingEnabled = defaults.object(forKey: Keys.proactiveClosing) as? Bool ?? true
    }

    // MARK: - Onboarding

    var hasCompletedOnboarding: Bool {
        get { defaults.bool(forKey: Keys.hasCompletedOnboarding) }
        set { defaults.set(newValue, forKey: Keys.hasCompletedOnboarding) }
    }

    // MARK: - Service Availability Helpers

    func hasRequiredServices() -> Bool {
        let configManager = ProxyConfigManager.shared
        return configManager.isTranscriptionEnabled && configManager.isAIEnabled
    }

    func areMissingServices() -> Bool {
        return !hasRequiredServices()
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
        // Proactive Suggestions
        proactiveEnabled = false
        proactiveSensitivity = 0.7
        proactiveCooldown = 15
        proactiveObjectionsEnabled = true
        proactiveQuestionsEnabled = true
        proactiveHesitationsEnabled = false
        proactiveClosingEnabled = true
    }

    // MARK: - Proactive Moment Check

    /// Check if a specific moment type is enabled for proactive suggestions
    func isMomentTypeEnabled(_ momentType: String) -> Bool {
        switch momentType {
        case "objection":
            return proactiveObjectionsEnabled
        case "expertiseQuestion":
            return proactiveQuestionsEnabled
        case "hesitation":
            return proactiveHesitationsEnabled
        case "closingOpportunity":
            return proactiveClosingEnabled
        default:
            return false
        }
    }
}
