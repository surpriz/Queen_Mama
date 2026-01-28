//
//  AutoAnswerService.swift
//  QueenMama
//
//  Service for automatic AI response triggering based on conversation flow
//

import Foundation
import Combine

@MainActor
final class AutoAnswerService: ObservableObject {

    // MARK: - Published Properties

    @Published var isEnabled = false {
        didSet {
            if isEnabled {
                startMonitoring()
            } else {
                stopMonitoring()
            }
        }
    }

    @Published var lastAutoAnswerTime: Date?
    @Published var isPendingTrigger = false

    /// Last detected moment for proactive suggestions
    @Published var lastDetectedMoment: MomentDetectionService.DetectedMoment?

    // MARK: - Configuration

    /// Minimum seconds of silence before triggering
    var silenceThreshold: TimeInterval = 2.5

    /// Cooldown period between auto-answers
    var cooldownPeriod: TimeInterval = 10.0

    /// Minimum words required for silence trigger
    let minWordsForSilence = 20

    /// Minimum words required for question trigger
    let minWordsForQuestion = 10

    /// Minimum words required for sentence completion trigger
    let minWordsForSentence = 50

    /// Response type to use for auto-answers
    var responseType: AIResponse.ResponseType = .assist

    // MARK: - Proactive Mode Configuration

    /// Whether proactive suggestions are enabled (Enterprise only)
    var proactiveEnabled = false

    /// Cooldown period between proactive suggestions (seconds)
    var proactiveCooldown: TimeInterval = 15.0

    /// Minimum confidence for proactive moment detection
    var proactiveSensitivity: Float = 0.7

    // MARK: - Internal State

    private var lastSpeechTime = Date()
    private var lastProcessedTranscriptHash: Int = 0
    private var silenceTimer: Timer?
    private var currentTranscript = ""
    private var wordCount = 0

    // Proactive tracking
    private var lastProactiveTriggerTime: Date?
    private var lastMomentType: MomentDetectionService.ConversationMoment?
    private var lastMomentTime: Date?
    private var consecutiveDismisses = 0
    private var proactivePausedUntil: Date?

    // MARK: - Callbacks

    /// Called when auto-answer should be triggered
    var onTrigger: (() -> Void)?

    /// Called when a proactive moment is detected (Enterprise)
    var onMomentDetected: ((MomentDetectionService.DetectedMoment) -> Void)?

    // MARK: - Initialization

    init() {}

    // MARK: - Public Methods

    /// Called when new transcript text is received (final)
    func onTranscriptReceived(_ text: String) {
        guard isEnabled || proactiveEnabled else { return }

        currentTranscript = text
        wordCount = text.split(separator: " ").count
        lastSpeechTime = Date()

        // Cancel any pending trigger since new speech was detected
        cancelPendingTrigger()

        // Check for proactive moments (Enterprise feature)
        if proactiveEnabled {
            checkProactiveMoments(text)
        }

        // Check for immediate triggers (Auto-Answer)
        if isEnabled {
            checkImmediateTriggers(text)

            // Start silence timer
            startSilenceTimer()
        }
    }

    /// Called when interim transcript is received (not final)
    func onInterimTranscriptReceived(_ text: String) {
        guard isEnabled else { return }

        // Reset speech time on any audio activity
        lastSpeechTime = Date()

        // Cancel pending trigger on new activity
        cancelPendingTrigger()
    }

    /// Reset all state
    func reset() {
        cancelPendingTrigger()
        currentTranscript = ""
        wordCount = 0
        lastProcessedTranscriptHash = 0
        lastAutoAnswerTime = nil
    }

    // MARK: - Private Methods

    private func startMonitoring() {
        print("[AutoAnswer] Started monitoring")
        reset()
    }

    private func stopMonitoring() {
        print("[AutoAnswer] Stopped monitoring")
        cancelPendingTrigger()
        silenceTimer?.invalidate()
        silenceTimer = nil
    }

    private func startSilenceTimer() {
        silenceTimer?.invalidate()

        silenceTimer = Timer.scheduledTimer(withTimeInterval: 0.5, repeats: true) { [weak self] _ in
            guard let self else { return }
            Task { @MainActor [self] in
                self.checkSilenceTrigger()
            }
        }
    }

    private func checkSilenceTrigger() {
        guard isEnabled else { return }

        let silenceDuration = Date().timeIntervalSince(lastSpeechTime)

        // Check if silence threshold met with sufficient words
        if silenceDuration >= silenceThreshold && wordCount >= minWordsForSilence {
            triggerIfConditionsMet(reason: "silence (\(String(format: "%.1f", silenceDuration))s)")
        }
    }

    private func checkImmediateTriggers(_ text: String) {
        // Question detection - look for "?" in recent text
        let recentText = String(text.suffix(100))
        if recentText.contains("?") && wordCount >= minWordsForQuestion {
            triggerIfConditionsMet(reason: "question detected")
            return
        }

        // Sentence completion with high word count
        let lastChar = text.trimmingCharacters(in: .whitespaces).last
        if (lastChar == "." || lastChar == "!" || lastChar == ";") && wordCount >= minWordsForSentence {
            // Delay slightly to avoid triggering mid-thought
            DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) { [weak self] in
                self?.triggerIfConditionsMet(reason: "sentence completion")
            }
        }
    }

    private func triggerIfConditionsMet(reason: String) {
        // Guard conditions
        guard isEnabled else { return }
        guard !isPendingTrigger else { return }

        // Check cooldown
        if let lastTime = lastAutoAnswerTime {
            let elapsed = Date().timeIntervalSince(lastTime)
            guard elapsed >= cooldownPeriod else {
                print("[AutoAnswer] Skipping - cooldown (\(String(format: "%.1f", cooldownPeriod - elapsed))s remaining)")
                return
            }
        }

        // Check transcript changed
        let currentHash = currentTranscript.hashValue
        guard currentHash != lastProcessedTranscriptHash else {
            print("[AutoAnswer] Skipping - transcript unchanged")
            return
        }

        // Trigger!
        print("[AutoAnswer] Triggering auto-answer: \(reason)")
        isPendingTrigger = true
        lastProcessedTranscriptHash = currentHash
        lastAutoAnswerTime = Date()

        // Invalidate silence timer
        silenceTimer?.invalidate()

        // Execute trigger callback
        onTrigger?()

        // Reset pending state after a delay
        DispatchQueue.main.asyncAfter(deadline: .now() + 2.0) { [weak self] in
            self?.isPendingTrigger = false
        }
    }

    private func cancelPendingTrigger() {
        if isPendingTrigger {
            print("[AutoAnswer] Cancelled pending trigger - new speech detected")
        }
        isPendingTrigger = false
    }

    // MARK: - Proactive Mode Methods

    /// Check for proactive moments in the transcript
    private func checkProactiveMoments(_ text: String) {
        guard proactiveEnabled else { return }

        // Check if paused due to consecutive dismisses
        if let pausedUntil = proactivePausedUntil, Date() < pausedUntil {
            return
        }

        // Check cooldown
        if let lastTrigger = lastProactiveTriggerTime {
            let elapsed = Date().timeIntervalSince(lastTrigger)
            guard elapsed >= proactiveCooldown else {
                return
            }
        }

        // Detect moments
        let sensitivity = 1.0 - Double(proactiveSensitivity) + 0.5 // Convert 0.5-1.0 to 0.5-1.0 threshold
        let threshold = Float(max(0.5, min(1.0, sensitivity)))

        guard let moment = MomentDetectionService.shared.detect(
            in: text,
            minConfidence: threshold
        ) else {
            return
        }

        // Check if this moment type is enabled
        guard ConfigurationManager.shared.isMomentTypeEnabled(moment.type.rawValue) else {
            return
        }

        // Don't repeat same moment type too quickly (30s)
        if let lastType = lastMomentType, lastType == moment.type,
           let lastTime = lastMomentTime,
           Date().timeIntervalSince(lastTime) < 30 {
            print("[AutoAnswer] Skipping duplicate moment type: \(moment.type.rawValue)")
            return
        }

        // Trigger proactive suggestion
        print("[AutoAnswer] Proactive moment detected: \(moment.type.label) (confidence: \(String(format: "%.2f", moment.confidence)))")
        print("[AutoAnswer] Trigger phrase: \"\(moment.triggerPhrase)\"")

        lastDetectedMoment = moment
        lastProactiveTriggerTime = Date()
        lastMomentType = moment.type
        lastMomentTime = Date()

        onMomentDetected?(moment)
    }

    /// Record that user dismissed a proactive suggestion
    func recordProactiveDismiss() {
        consecutiveDismisses += 1
        print("[AutoAnswer] Proactive dismiss #\(consecutiveDismisses)")

        // After 3 consecutive dismisses, pause for 5 minutes
        if consecutiveDismisses >= 3 {
            let pauseDuration: TimeInterval = 5 * 60 // 5 minutes
            proactivePausedUntil = Date().addingTimeInterval(pauseDuration)
            consecutiveDismisses = 0
            print("[AutoAnswer] Proactive suggestions paused for 5 minutes due to consecutive dismisses")
        }
    }

    /// Record that user engaged with a proactive suggestion (thumbs up/down, didn't dismiss)
    func recordProactiveEngagement() {
        consecutiveDismisses = 0
        proactivePausedUntil = nil
    }

    /// Reset proactive state
    func resetProactiveState() {
        lastProactiveTriggerTime = nil
        lastMomentType = nil
        lastMomentTime = nil
        lastDetectedMoment = nil
        consecutiveDismisses = 0
        proactivePausedUntil = nil
    }
}

// MARK: - Auto Answer Trigger Reason

enum AutoAnswerTrigger: String, CaseIterable {
    case silence = "Silence Detection"
    case question = "Question Detection"
    case sentenceEnd = "Sentence Completion"
    case manual = "Manual"
    case proactive = "Proactive Suggestion"

    var icon: String {
        switch self {
        case .silence: return "waveform.slash"
        case .question: return "questionmark.circle"
        case .sentenceEnd: return "text.badge.checkmark"
        case .manual: return "hand.tap"
        case .proactive: return "sparkles"
        }
    }
}
