//
//  DictationService.swift
//  QueenMama
//
//  Voice dictation service using Deepgram WebSocket for real-time speech-to-text.
//  Shares audio buffer from AudioCaptureService during active sessions.
//

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

    // Deepgram configuration (same as session transcription)
    private let baseURL = "wss://api.deepgram.com/v1/listen"
    private let model = "nova-3"
    private let language = "multi"

    // MARK: - Public Methods

    func startRecording() async throws {
        guard !isRecording else { return }

        print("[Dictation] Starting dictation...")

        // Clear previous text
        interimText = ""
        finalText = ""

        // Get token and connect WebSocket
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

        // Build WebSocket URL
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
        config.timeoutIntervalForResource = 300 // 5 min max for dictation

        let session = URLSession(configuration: config)
        webSocketTask = session.webSocketTask(with: request)
        webSocketTask?.resume()

        isConnected = true
        isRecording = true

        print("[Dictation] WebSocket connected, listening...")

        receiveMessages()
        startKeepalive()
    }

    func stopRecording() {
        print("[Dictation] Stopping dictation...")

        // Apply interim text as final if we have interim but no final yet
        if isRecording && finalText.isEmpty && !interimText.isEmpty {
            finalText = interimText
            interimText = finalText
        }

        isRecording = false
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

    // MARK: - Private Methods

    private func disconnect() {
        stopKeepalive()
        webSocketTask?.cancel(with: .normalClosure, reason: nil)
        webSocketTask = nil
        isConnected = false
        currentToken = nil
    }

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
                // Append final text (Deepgram sends finals per utterance)
                if finalText.isEmpty {
                    finalText = transcript
                } else {
                    finalText += " " + transcript
                }
                interimText = finalText
                print("[Dictation] Final: \"\(transcript)\"")
            } else {
                // Show interim text (current utterance being spoken)
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

// MARK: - Deepgram Response Models (local to dictation)

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
