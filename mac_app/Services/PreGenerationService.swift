//
//  PreGenerationService.swift
//  QueenMama
//
//  Buffered pre-generation: silently generates AI responses in the background
//  after detecting sentence completion or silence, so responses appear instantly
//  when the user presses Cmd+Enter.
//

import Foundation

@MainActor
final class PreGenerationService: ObservableObject {

    // MARK: - State

    enum State: Equatable {
        case idle
        case generating
        case ready(String)

        static func == (lhs: State, rhs: State) -> Bool {
            switch (lhs, rhs) {
            case (.idle, .idle): return true
            case (.generating, .generating): return true
            case (.ready(let a), .ready(let b)): return a == b
            default: return false
            }
        }
    }

    @Published var state: State = .idle

    var isReady: Bool {
        if case .ready = state { return true }
        return false
    }

    // MARK: - Dependencies (injected via configure())

    private weak var aiService: AIService?
    private weak var screenService: ScreenCaptureService?
    private var modeProvider: (() -> Mode?)?

    // MARK: - Configuration

    /// Number of final sentences before triggering pre-generation
    private let sentenceTriggerCount = 3

    /// Seconds of silence to trigger pre-generation (with ≥1 sentence)
    private let silenceThreshold: TimeInterval = 5.0

    /// Cooldown between pre-generation triggers (seconds)
    private let cooldownPeriod: TimeInterval = 20.0

    /// Max transcript change (in characters) before invalidating a ready buffer
    private let staleThreshold = 500

    /// Max time the silence timer runs before auto-stopping (seconds)
    private let silenceTimerMaxDuration: TimeInterval = 30.0

    // MARK: - Internal State

    private var generationTask: Task<Void, Never>?
    private var silenceTimer: Timer?
    private var silenceTimerStartTime: Date?
    private var lastSpeechTime = Date()
    private var sentencesSinceLastTrigger = 0
    private var lastTriggeredTranscriptHash: Int = 0
    private var lastTriggerTime: Date?
    private var transcriptLengthAtTrigger: Int = 0
    private var lastTranscript = ""

    /// Cached regex for sentence detection (avoid recompiling on every call)
    private static let sentenceEndingRegex: NSRegularExpression? = {
        try? NSRegularExpression(pattern: #"[.!?](?:\s|$)"#)
    }()

    // MARK: - Initialization

    init() {}

    // MARK: - Configuration

    func configure(
        aiService: AIService,
        screenService: ScreenCaptureService,
        modeProvider: @escaping () -> Mode?
    ) {
        self.aiService = aiService
        self.screenService = screenService
        self.modeProvider = modeProvider
    }

    // MARK: - Public Methods

    /// Called on every transcript buffer flush with the full accumulated transcript
    func onTranscriptUpdated(_ fullTranscript: String) {
        guard ConfigurationManager.shared.bufferedPreGenEnabled else { return }

        // Count new sentences in the delta
        let delta = String(fullTranscript.dropFirst(lastTranscript.count))
        let newSentences = countSentenceEndings(in: delta)
        sentencesSinceLastTrigger += newSentences
        lastSpeechTime = Date()
        lastTranscript = fullTranscript

        // Invalidate stale buffer if transcript grew significantly
        if case .ready = state {
            let growth = fullTranscript.count - transcriptLengthAtTrigger
            if growth > staleThreshold {
                print("[PreGen] Buffer invalidated — transcript grew by \(growth) chars")
                state = .idle
            }
        }

        // Cancel in-flight generation if significant new content arrived
        if case .generating = state, newSentences > 0 {
            print("[PreGen] Restarting — new sentence during generation")
            cancelGeneration()
        }

        // Check sentence trigger
        if sentencesSinceLastTrigger >= sentenceTriggerCount {
            triggerPreGen(reason: "\(sentencesSinceLastTrigger) sentences")
        }

        // Only start silence timer if there are sentences to act on
        // and we're not already in a ready state
        if sentencesSinceLastTrigger >= 1, case .idle = state {
            startSilenceTimer()
        } else if case .ready = state {
            // Already have a result — no need for silence timer
            stopSilenceTimer()
        }
    }

    /// Consume the pre-generated response buffer. Returns nil if not ready.
    /// Resets state to .idle after consumption.
    func consumeBuffer() -> String? {
        guard case .ready(let text) = state else { return nil }

        // Check staleness one more time
        let growth = lastTranscript.count - transcriptLengthAtTrigger
        if growth > staleThreshold {
            print("[PreGen] Buffer stale on consume — discarding")
            state = .idle
            return nil
        }

        print("[PreGen] Buffer consumed (\(text.count) chars)")
        state = .idle
        sentencesSinceLastTrigger = 0
        return text
    }

    /// Cancel any in-flight generation and reset to idle
    func cancelAndReset() {
        cancelGeneration()
        stopSilenceTimer()
        state = .idle
    }

    /// Full reset (called on session stop)
    func reset() {
        cancelGeneration()
        stopSilenceTimer()
        state = .idle
        lastSpeechTime = Date()
        sentencesSinceLastTrigger = 0
        lastTriggeredTranscriptHash = 0
        lastTriggerTime = nil
        transcriptLengthAtTrigger = 0
        lastTranscript = ""
        print("[PreGen] Reset")
    }

    // MARK: - Private Methods

    private func triggerPreGen(reason: String) {
        guard ConfigurationManager.shared.bufferedPreGenEnabled else { return }
        guard let aiService = aiService else { return }
        guard !lastTranscript.isEmpty else { return }

        // Cooldown check
        if let lastTime = lastTriggerTime {
            let elapsed = Date().timeIntervalSince(lastTime)
            guard elapsed >= cooldownPeriod else {
                print("[PreGen] Cooldown — \(String(format: "%.1f", cooldownPeriod - elapsed))s remaining")
                return
            }
        }

        // Dedup check
        let currentHash = lastTranscript.hashValue
        guard currentHash != lastTriggeredTranscriptHash else {
            print("[PreGen] Skipped — transcript unchanged")
            return
        }

        // Don't trigger if AI is already processing a manual request
        guard !aiService.isProcessing else {
            print("[PreGen] Skipped — AIService already processing")
            return
        }

        // Don't trigger if we already have a ready buffer
        if case .ready = state {
            print("[PreGen] Skipped — buffer already ready")
            return
        }

        print("[PreGen] Triggering: \(reason)")
        cancelGeneration()
        stopSilenceTimer()

        lastTriggeredTranscriptHash = currentHash
        lastTriggerTime = Date()
        transcriptLengthAtTrigger = lastTranscript.count
        sentencesSinceLastTrigger = 0
        state = .generating

        let transcript = AIService.trimTranscript(
            lastTranscript,
            maxLength: AIService.defaultMaxTranscriptLength
        )
        let mode = modeProvider?()
        let enableScreenCapture = UserDefaults.standard.bool(forKey: "enableScreenCapture")

        generationTask = Task { [weak self] in
            guard let self = self else { return }

            do {
                // Capture screenshot if enabled
                let screenshot: Data? = if enableScreenCapture {
                    try? await self.screenService?.getScreenshotForAI()
                } else {
                    nil
                }

                // Generate via AIService bypass method (no usage counting)
                var accumulated = ""
                for try await chunk in aiService.generatePreGenStreamingResponse(
                    transcript: transcript,
                    screenshot: screenshot,
                    mode: mode
                ) {
                    try Task.checkCancellation()
                    accumulated += chunk
                }

                try Task.checkCancellation()

                // Generation complete — buffer the result
                guard !accumulated.isEmpty else {
                    print("[PreGen] Empty response — staying idle")
                    self.state = .idle
                    return
                }

                self.state = .ready(accumulated)
                print("[PreGen] Ready (\(accumulated.count) chars)")

            } catch is CancellationError {
                // Expected — generation was cancelled
                print("[PreGen] Generation cancelled")
            } catch {
                print("[PreGen] Generation failed: \(error.localizedDescription)")
                self.state = .idle
            }
        }
    }

    private func cancelGeneration() {
        generationTask?.cancel()
        generationTask = nil
        if case .generating = state {
            state = .idle
        }
    }

    private func stopSilenceTimer() {
        silenceTimer?.invalidate()
        silenceTimer = nil
        silenceTimerStartTime = nil
    }

    private func startSilenceTimer() {
        // Don't restart if already running
        guard silenceTimer == nil else { return }

        silenceTimerStartTime = Date()

        silenceTimer = Timer.scheduledTimer(withTimeInterval: 1.0, repeats: true) { [weak self] _ in
            guard let self else { return }
            Task { @MainActor [self] in
                self.checkSilence()
            }
        }
    }

    private func checkSilence() {
        guard ConfigurationManager.shared.bufferedPreGenEnabled else {
            stopSilenceTimer()
            return
        }

        // Auto-stop timer after max duration to prevent indefinite polling
        if let startTime = silenceTimerStartTime,
           Date().timeIntervalSince(startTime) > silenceTimerMaxDuration {
            print("[PreGen] Silence timer expired after \(Int(silenceTimerMaxDuration))s")
            stopSilenceTimer()
            return
        }

        let silenceDuration = Date().timeIntervalSince(lastSpeechTime)

        if silenceDuration >= silenceThreshold && sentencesSinceLastTrigger >= 1 {
            stopSilenceTimer()
            triggerPreGen(reason: "silence (\(String(format: "%.1f", silenceDuration))s)")
        }
    }

    /// Count sentence-ending punctuation in a text snippet
    /// Only counts . ! ? when followed by whitespace or end of string,
    /// to avoid false positives from numbers (3.5%), abbreviations (M. Dupont), URLs, etc.
    private func countSentenceEndings(in text: String) -> Int {
        guard let regex = Self.sentenceEndingRegex else { return 0 }
        let range = NSRange(text.startIndex..., in: text)
        return regex.numberOfMatches(in: text, range: range)
    }
}
