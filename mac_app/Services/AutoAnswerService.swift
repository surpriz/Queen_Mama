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

    // MARK: - Internal State

    private var lastSpeechTime = Date()
    private var lastProcessedTranscriptHash: Int = 0
    private var silenceTimer: Timer?
    private var currentTranscript = ""
    private var wordCount = 0

    // MARK: - Callbacks

    /// Called when auto-answer should be triggered
    var onTrigger: (() -> Void)?

    // MARK: - Initialization

    init() {}

    // MARK: - Public Methods

    /// Called when new transcript text is received (final)
    func onTranscriptReceived(_ text: String) {
        guard isEnabled else { return }

        currentTranscript = text
        wordCount = text.split(separator: " ").count
        lastSpeechTime = Date()

        // Cancel any pending trigger since new speech was detected
        cancelPendingTrigger()

        // Check for immediate triggers
        checkImmediateTriggers(text)

        // Start silence timer
        startSilenceTimer()
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
            Task { @MainActor in
                self?.checkSilenceTrigger()
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
}

// MARK: - Auto Answer Trigger Reason

enum AutoAnswerTrigger: String, CaseIterable {
    case silence = "Silence Detection"
    case question = "Question Detection"
    case sentenceEnd = "Sentence Completion"
    case manual = "Manual"

    var icon: String {
        switch self {
        case .silence: return "waveform.slash"
        case .question: return "questionmark.circle"
        case .sentenceEnd: return "text.badge.checkmark"
        case .manual: return "hand.tap"
        }
    }
}
