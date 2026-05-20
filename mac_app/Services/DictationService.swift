//
//  DictationService.swift
//  QueenMama
//
//  Voice dictation service using Deepgram WebSocket for real-time speech-to-text.
//  When a session is active, shares audio from AudioCaptureService.
//  When no session is active, manages its own microphone capture.
//

import AVFoundation
import Foundation

@MainActor
final class DictationService: ObservableObject {
    // MARK: - Published State

    @Published var isRecording = false
    @Published var interimText = ""
    @Published var finalText = ""

    // MARK: - Private Properties

    private let proxyClient = ProxyAPIClient.shared
    private var webSocketTask: URLSessionWebSocketTask?
    private var keepaliveTimer: Timer?
    private var currentToken: TranscriptionToken?
    private var isConnected = false

    // Standalone audio capture (used when no session is active)
    private var standaloneEngine: AVAudioEngine?
    private var audioConverter: AVAudioConverter?
    private var isUsingStandaloneAudio = false

    // Deepgram configuration
    private let baseURL = "wss://api.deepgram.com/v1/listen"
    private let model = "nova-3"
    private let language = "multi"
    private let targetSampleRate: Double = 16000
    private let targetChannelCount: AVAudioChannelCount = 1

    // MARK: - Public Methods

    /// Start dictation. If `useSharedAudio` is true, audio comes from AppState's audio pipeline.
    /// If false, DictationService starts its own microphone capture.
    func startRecording(useSharedAudio: Bool) async throws {
        guard !isRecording else { return }

        print("[Dictation] Starting dictation (shared audio: \(useSharedAudio))...")

        // Clear previous text
        interimText = ""
        finalText = ""

        // Connect Deepgram WebSocket
        try await connectWebSocket()

        isRecording = true

        // If no session active, start standalone mic capture
        if !useSharedAudio {
            try await startStandaloneAudioCapture()
            isUsingStandaloneAudio = true
            print("[Dictation] Standalone audio capture started")
        } else {
            isUsingStandaloneAudio = false
            print("[Dictation] Using shared audio from session")
        }
    }

    func stopRecording() {
        print("[Dictation] Stopping dictation...")

        // Apply interim text as final if we have interim but no final yet
        if isRecording && finalText.isEmpty && !interimText.isEmpty {
            finalText = interimText
            interimText = finalText
        }

        isRecording = false

        // Stop standalone audio if we started it
        if isUsingStandaloneAudio {
            stopStandaloneAudioCapture()
            isUsingStandaloneAudio = false
        }

        disconnect()
    }

    func sendAudio(_ data: Data) {
        guard isConnected, isRecording, let task = webSocketTask else { return }

        let message = URLSessionWebSocketTask.Message.data(data)
        task.send(message) { error in
            if let error {
                print("[Dictation] Send error: \(error.localizedDescription)")
            }
        }
    }

    func reset() {
        interimText = ""
        finalText = ""
    }

    // MARK: - WebSocket Connection

    private func connectWebSocket() async throws {
        guard AuthenticationManager.shared.isAuthenticated else {
            print("[Dictation] Not authenticated")
            throw TranscriptionError.notAuthenticated
        }

        let token: TranscriptionToken
        do {
            token = try await proxyClient.getTranscriptionToken(provider: "deepgram")
            currentToken = token
        } catch {
            print("[Dictation] Failed to get token: \(error)")
            throw TranscriptionError.noAPIKey
        }

        var components = URLComponents(string: baseURL)!
        components.queryItems = [
            URLQueryItem(name: "model", value: model),
            URLQueryItem(name: "language", value: language),
            URLQueryItem(name: "smart_format", value: "true"),
            URLQueryItem(name: "interim_results", value: "true"),
            URLQueryItem(name: "punctuate", value: "true"),
            URLQueryItem(name: "encoding", value: "linear16"),
            URLQueryItem(name: "sample_rate", value: "16000"),
            URLQueryItem(name: "channels", value: "1"),
            URLQueryItem(name: "endpointing", value: "300"),
            URLQueryItem(name: "utterance_end_ms", value: "1000"),
            URLQueryItem(name: "vad_events", value: "true"),
        ]

        guard let url = components.url else {
            throw TranscriptionError.connectionFailed(NSError(domain: "Invalid URL", code: -1))
        }

        var request = URLRequest(url: url)
        let authScheme = token.tokenType == "bearer" ? "Bearer" : "Token"
        request.setValue("\(authScheme) \(token.token)", forHTTPHeaderField: "Authorization")

        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest = 30
        config.timeoutIntervalForResource = 300

        let session = URLSession(configuration: config)
        webSocketTask = session.webSocketTask(with: request)
        webSocketTask?.resume()

        isConnected = true

        print("[Dictation] WebSocket connected")

        receiveMessages()
        startKeepalive()
    }

    private func disconnect() {
        stopKeepalive()
        webSocketTask?.cancel(with: .normalClosure, reason: nil)
        webSocketTask = nil
        isConnected = false
        currentToken = nil
    }

    // MARK: - Standalone Audio Capture

    private func startStandaloneAudioCapture() async throws {
        // Request mic permission if needed
        let status = AVCaptureDevice.authorizationStatus(for: .audio)
        if status == .notDetermined {
            let granted = await withCheckedContinuation { continuation in
                AVCaptureDevice.requestAccess(for: .audio) { granted in
                    continuation.resume(returning: granted)
                }
            }
            guard granted else {
                throw AudioCaptureError.microphonePermissionDenied
            }
        } else if status == .denied || status == .restricted {
            throw AudioCaptureError.microphonePermissionDenied
        }

        let engine = AVAudioEngine()
        let inputNode = engine.inputNode
        let inputFormat = inputNode.outputFormat(forBus: 0)

        guard let floatFormat = AVAudioFormat(
            commonFormat: .pcmFormatFloat32,
            sampleRate: targetSampleRate,
            channels: targetChannelCount,
            interleaved: false
        ) else {
            throw AudioCaptureError.formatMismatch
        }

        let converter = AVAudioConverter(from: inputFormat, to: floatFormat)
        guard converter != nil else {
            throw AudioCaptureError.formatMismatch
        }
        audioConverter = converter

        let bufferSize: AVAudioFrameCount = 4096

        inputNode.installTap(onBus: 0, bufferSize: bufferSize, format: inputFormat) { [weak self] buffer, _ in
            self?.processAudioBuffer(buffer, inputFormat: inputFormat, floatFormat: floatFormat)
        }

        try engine.start()
        standaloneEngine = engine

        print("[Dictation] Standalone AVAudioEngine started")
    }

    private func stopStandaloneAudioCapture() {
        if let engine = standaloneEngine {
            engine.inputNode.removeTap(onBus: 0)
            engine.stop()
            print("[Dictation] Standalone AVAudioEngine stopped")
        }
        standaloneEngine = nil
        audioConverter = nil
    }

    /// Convert audio buffer from native mic format to 16kHz PCM16 and send to Deepgram
    private func processAudioBuffer(_ buffer: AVAudioPCMBuffer, inputFormat: AVAudioFormat, floatFormat: AVAudioFormat) {
        guard let converter = audioConverter else { return }

        let ratio = floatFormat.sampleRate / inputFormat.sampleRate
        let frameCount = AVAudioFrameCount(Double(buffer.frameLength) * ratio)

        guard let convertedBuffer = AVAudioPCMBuffer(pcmFormat: floatFormat, frameCapacity: frameCount) else {
            return
        }

        var error: NSError?
        let inputBlock: AVAudioConverterInputBlock = { _, outStatus in
            outStatus.pointee = .haveData
            return buffer
        }

        converter.convert(to: convertedBuffer, error: &error, withInputFrom: inputBlock)
        if error != nil { return }

        guard let floatData = convertedBuffer.floatChannelData else { return }

        let frameLength = Int(convertedBuffer.frameLength)
        var int16Data = [Int16](repeating: 0, count: frameLength)

        for i in 0..<frameLength {
            let sample = floatData[0][i]
            let clampedSample = max(-1.0, min(1.0, sample))
            int16Data[i] = Int16(clampedSample * Float(Int16.max))
        }

        let data = Data(bytes: &int16Data, count: frameLength * 2)

        DispatchQueue.main.async { [weak self] in
            self?.sendAudio(data)
        }
    }

    // MARK: - Keepalive

    private func startKeepalive() {
        stopKeepalive()
        keepaliveTimer = Timer.scheduledTimer(withTimeInterval: 8.0, repeats: true) { [weak self] _ in
            Task { @MainActor [weak self] in
                self?.sendKeepalive()
            }
        }
    }

    private func stopKeepalive() {
        keepaliveTimer?.invalidate()
        keepaliveTimer = nil
    }

    private func sendKeepalive() {
        guard isConnected, let task = webSocketTask else { return }
        let message = URLSessionWebSocketTask.Message.string("{\"type\": \"KeepAlive\"}")
        task.send(message) { _ in }
    }

    // MARK: - Message Handling

    private func receiveMessages() {
        guard let task = webSocketTask else { return }

        task.receive { [weak self] result in
            Task { @MainActor [weak self] in
                guard let self else { return }

                switch result {
                case .success(let message):
                    self.handleMessage(message)
                    if self.isConnected {
                        self.receiveMessages()
                    }
                case .failure(let error):
                    print("[Dictation] WebSocket error: \(error.localizedDescription)")
                    self.isConnected = false
                    CrashReporter.shared.captureError(error, extras: [
                        "service": "dictation",
                        "operation": "websocket_receive"
                    ])
                }
            }
        }
    }

    private func handleMessage(_ message: URLSessionWebSocketTask.Message) {
        let text: String
        switch message {
        case .string(let str):
            text = str
        case .data(let data):
            guard let str = String(data: data, encoding: .utf8) else { return }
            text = str
        @unknown default:
            return
        }

        guard let data = text.data(using: .utf8) else { return }

        do {
            let response = try JSONDecoder().decode(DictationResponse.self, from: data)
            guard let transcript = response.channel?.alternatives?.first?.transcript,
                  !transcript.isEmpty else { return }

            if response.isFinal == true {
                if finalText.isEmpty {
                    finalText = transcript
                } else {
                    finalText += " " + transcript
                }
                interimText = finalText
                print("[Dictation] Final: \"\(transcript)\"")
            } else {
                if finalText.isEmpty {
                    interimText = transcript
                } else {
                    interimText = finalText + " " + transcript
                }
            }
        } catch {
            // Ignore non-transcript messages (UtteranceEnd, SpeechStarted, etc.)
        }
    }
}

// MARK: - Deepgram Response Models

private struct DictationResponse: Codable {
    let type: String?
    let channel: DictationChannel?
    let isFinal: Bool?

    enum CodingKeys: String, CodingKey {
        case type
        case channel
        case isFinal = "is_final"
    }
}

private struct DictationChannel: Codable {
    let alternatives: [DictationAlternative]?
}

private struct DictationAlternative: Codable {
    let transcript: String?
    let confidence: Double?
}
