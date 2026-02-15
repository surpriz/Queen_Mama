import SwiftUI
import SwiftData
import Combine

// MARK: - App State
@MainActor
class AppState: ObservableObject {
    @Published var isSessionActive = false
    @Published var isOverlayVisible = true
    @Published var aiResponse = ""
    @Published var isProcessing = false
    @Published var audioLevel: Float = 0.0
    @Published var selectedMode: Mode?
    @Published var errorMessage: String?
    @Published var isFinalizingSession = false

    /// Bottom sheet overlay (replaces NSPanel on macOS)
    @Published var showOverlaySheet = false

    /// Memory Palace: Triggers contact picker
    @Published var shouldShowContactPicker = false

    // MARK: - Memory-Managed Transcript

    private let maxTranscriptMemorySize = 50_000
    private var _currentTranscript = ""

    var currentTranscript: String {
        get { _currentTranscript }
        set {
            _currentTranscript = newValue
            if _currentTranscript.count > maxTranscriptMemorySize {
                let trimStart = _currentTranscript.index(
                    _currentTranscript.endIndex,
                    offsetBy: -(maxTranscriptMemorySize - 5000)
                )
                _currentTranscript = String(_currentTranscript[trimStart...])
                print("[AppState] Transcript trimmed to \(_currentTranscript.count) chars in memory")
            }
        }
    }

    // Services (no screenService, systemAudioService, meetingDetectionService on iOS)
    let audioService = AudioCaptureService()
    let transcriptionService = TranscriptionService()
    let aiService = AIService()
    let autoAnswerService = AutoAnswerService()
    let audioBatchingService = AudioBatchingService()
    let transcriptBuffer = TranscriptBuffer()
    let dictationService = DictationService()

    // Session Manager reference (injected from QueenMamaApp)
    weak var sessionManager: SessionManager?

    /// Memory Palace: Contact to associate with current session
    var currentSessionContact: Contact?

    func startSession(contact: Contact? = nil) async {
        let sessionAccess = LicenseManager.shared.canUse(.sessionStart)
        guard sessionAccess.isAllowed else {
            errorMessage = sessionAccess.errorMessage
            return
        }

        isSessionActive = true
        errorMessage = nil
        currentSessionContact = contact

        LicenseManager.shared.recordUsage(.sessionStart)
        HealthCheckService.shared.startMonitoring()

        AnalyticsService.shared.trackSessionStarted(
            modeId: selectedMode?.id,
            modeName: selectedMode?.name
        )

        let defaultTitle = "Session - \(Date().formatted(date: .abbreviated, time: .shortened))"
        _ = sessionManager?.startSession(title: defaultTitle, modeId: selectedMode?.id, contact: contact)

        if let contact = contact {
            contact.lastSeenAt = Date()
        }

        do {
            let startTime = CFAbsoluteTimeGetCurrent()

            async let audioStart: () = audioService.startCapture()
            async let transcriptionStart: () = transcriptionService.connect()

            try await audioStart
            try await transcriptionStart

            let startupTime = (CFAbsoluteTimeGetCurrent() - startTime) * 1000
            print("[AppState] All services started in \(Int(startupTime))ms (parallel)")

            audioBatchingService.start()

            audioService.onAudioBuffer = { [weak self] buffer in
                self?.audioBatchingService.append(buffer)
                if self?.dictationService.isRecording == true {
                    self?.dictationService.sendAudio(buffer)
                }
            }

            audioBatchingService.onBatchReady = { [weak self] batch in
                self?.transcriptionService.sendAudio(batch)
            }

            transcriptBuffer.start()

            transcriptionService.onTranscript = { [weak self] text in
                Task { @MainActor in
                    self?.transcriptBuffer.append(text)
                }
            }

            transcriptBuffer.onFlush = { [weak self] (batchedText: String) in
                guard let self = self else { return }

                self.sessionManager?.addTranscriptEntry(
                    speaker: "",
                    text: batchedText,
                    isFinal: true
                )

                self.currentTranscript += "\(batchedText)\n"

                let wordCount = batchedText.split(separator: " ").count
                HealthCheckService.shared.recordWordsTranscribed(wordCount)

                self.autoAnswerService.onTranscriptReceived(self.currentTranscript)
            }

            autoAnswerService.onTrigger = { [weak self] in
                Task { @MainActor in
                    await self?.handleAutoAnswer()
                }
            }

            autoAnswerService.onMomentDetected = { [weak self] moment in
                Task { @MainActor in
                    await self?.handleProactiveMoment(moment)
                }
            }

            let config = ConfigurationManager.shared
            autoAnswerService.proactiveEnabled = config.proactiveEnabled && LicenseManager.shared.isFeatureAvailable(.proactiveSuggestions)
            autoAnswerService.proactiveCooldown = TimeInterval(config.proactiveCooldown)
            autoAnswerService.proactiveSensitivity = Float(config.proactiveSensitivity)
        } catch {
            errorMessage = error.localizedDescription
            await stopSession()
        }
    }

    func stopSession() async {
        HealthCheckService.shared.stopMonitoring()

        audioBatchingService.reset()
        transcriptBuffer.reset()
        audioService.stopCapture()
        transcriptionService.disconnect()
        autoAnswerService.reset()
        autoAnswerService.resetProactiveState()
        dictationService.stopRecording()
        isSessionActive = false

        guard let manager = sessionManager,
              let session = manager.currentSession else {
            clearContext()
            return
        }

        let finalTranscript = currentTranscript.trimmingCharacters(in: .whitespacesAndNewlines)

        if finalTranscript.count < 50 {
            print("[AppState] Session too short for AI processing (\(finalTranscript.count) chars)")
            manager.endSession()
            syncSessionIfEligible(session)
            clearContext()
            return
        }

        isFinalizingSession = true

        let title = await aiService.generateSessionTitle(transcript: finalTranscript)
        manager.setTitle(title)
        print("[AppState] Generated title: \(title)")

        if let summary = await aiService.generateSessionSummary(transcript: finalTranscript) {
            manager.setSummary(summary)
            print("[AppState] Generated summary (\(summary.count) chars)")
        }

        manager.endSession()
        syncSessionIfEligible(session)

        let duration = Int(session.endTime?.timeIntervalSince(session.startTime) ?? 0)
        AnalyticsService.shared.trackSessionEnded(
            durationSeconds: duration,
            transcriptLength: finalTranscript.count,
            hadAIResponses: !aiResponse.isEmpty
        )

        if session.contact == nil && finalTranscript.count > 100 {
            Task {
                if let extracted = await ContactExtractionService.shared.extractFromTranscript(finalTranscript),
                   extracted.isViable {
                    NotificationCenter.default.post(
                        name: .contactExtractionAvailable,
                        object: (extracted, session)
                    )
                }
            }
        }

        isFinalizingSession = false
        currentSessionContact = nil
        clearContext()
    }

    private func syncSessionIfEligible(_ session: Session) {
        if LicenseManager.shared.isFeatureAvailable(.sessionSync) {
            SyncManager.shared.queueSession(session)
            print("[AppState] Session queued for sync: \(session.id)")
        } else {
            print("[AppState] Session sync requires PRO subscription - stored locally only")
        }
    }

    func toggleOverlay() {
        showOverlaySheet.toggle()
        AnalyticsService.shared.trackOverlayToggled(visible: showOverlaySheet)
    }

    func clearContext() {
        currentTranscript = ""
        aiResponse = ""
        aiService.clearHistory()
    }

    // MARK: - Auto Answer

    private func handleAutoAnswer() async {
        guard LicenseManager.shared.isFeatureAvailable(.autoAnswer) else {
            print("[AppState] Auto-answer requires Enterprise license")
            return
        }

        guard !aiService.isProcessing else {
            print("[AppState] Skipping auto-answer - AI already processing")
            return
        }

        guard !currentTranscript.isEmpty else {
            print("[AppState] Skipping auto-answer - no transcript")
            return
        }

        print("[AppState] Triggering automatic response...")

        do {
            let response = try await aiService.generateAutoResponse(
                transcript: currentTranscript,
                mode: selectedMode
            )
            print("[AppState] Auto-response generated: \(response.content.prefix(100))...")
        } catch {
            print("[AppState] Auto-response failed: \(error)")
        }
    }

    // MARK: - Proactive Mode (Enterprise)

    private func handleProactiveMoment(_ moment: MomentDetectionService.DetectedMoment) async {
        guard LicenseManager.shared.isFeatureAvailable(.proactiveSuggestions) else {
            print("[AppState] Proactive suggestions require Enterprise license")
            return
        }

        guard !aiService.isProcessing else {
            print("[AppState] Skipping proactive - AI already processing")
            autoAnswerService.lastDetectedMoment = nil
            return
        }

        guard !currentTranscript.isEmpty else {
            print("[AppState] Skipping proactive - no transcript")
            autoAnswerService.lastDetectedMoment = nil
            return
        }

        print("[AppState] Proactive moment detected: \(moment.type.label)")

        // Show bottom sheet for proactive suggestion (replaces OverlayWindowController.shared.expandForProactiveSuggestion)
        showOverlaySheet = true

        do {
            for try await chunk in aiService.generateProactiveResponse(
                transcript: currentTranscript,
                moment: moment,
                mode: selectedMode,
                screenshot: nil
            ) {
                _ = chunk
            }
            print("[AppState] Proactive response completed")

            autoAnswerService.recordProactiveEngagement()

            AnalyticsService.shared.capture(
                "proactive_suggestion_shown",
                properties: [
                    "moment_type": moment.type.rawValue,
                    "confidence": moment.confidence,
                    "trigger_phrase": moment.triggerPhrase
                ]
            )
        } catch {
            print("[AppState] Proactive response failed: \(error)")
            autoAnswerService.lastDetectedMoment = nil
        }
    }

    func dismissProactiveSuggestion() {
        autoAnswerService.recordProactiveDismiss()
        autoAnswerService.lastDetectedMoment = nil

        AnalyticsService.shared.capture("proactive_suggestion_dismissed", properties: [:])
    }
}
