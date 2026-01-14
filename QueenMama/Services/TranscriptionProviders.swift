import Foundation

enum TranscriptionProviderType: String, CaseIterable {
    case deepgram = "Deepgram"
    case assemblyai = "AssemblyAI"

    var displayName: String { rawValue }
}

enum TranscriptionError: LocalizedError {
    case noAPIKey
    case connectionFailed(Error)
    case invalidResponse
    case disconnected
    case allProvidersFailed

    var errorDescription: String? {
        switch self {
        case .noAPIKey:
            return "Transcription API key not configured."
        case .connectionFailed(let error):
            return "Failed to connect to transcription service: \(error.localizedDescription)"
        case .invalidResponse:
            return "Invalid response from transcription service."
        case .disconnected:
            return "Disconnected from transcription service."
        case .allProvidersFailed:
            return "All transcription providers failed."
        }
    }
}

@MainActor
protocol TranscriptionProvider: AnyObject {
    var providerType: TranscriptionProviderType { get }
    var isConfigured: Bool { get }
    var isConnected: Bool { get set }

    var onTranscript: ((String) -> Void)? { get set }
    var onInterimTranscript: ((String) -> Void)? { get set }
    var onError: ((Error) -> Void)? { get set }

    func connect() async throws
    func disconnect()
    func sendAudioData(_ data: Data) async throws
}
import Foundation

@MainActor
final class DeepgramProvider: TranscriptionProvider {
    let providerType: TranscriptionProviderType = .deepgram

    var isConnected: Bool = false
    var onTranscript: ((String) -> Void)?
    var onInterimTranscript: ((String) -> Void)?
    var onError: ((Error) -> Void)?

    private let keychain = KeychainManager.shared
    private var webSocketTask: URLSessionWebSocketTask?
    private var keepaliveTimer: Timer?
    private var audioBytesSent = 0

    // Deepgram configuration
    private let baseURL = "wss://api.deepgram.com/v1/listen"
    private let model = "nova-3"
    private let language = "multi"  // Multi-language auto-detection

    var isConfigured: Bool {
        keychain.hasAPIKey(for: .deepgram)
    }

    func connect() async throws {
        print("[Deepgram] Connecting...")

        // Clean up existing connection
        if webSocketTask != nil {
            stopKeepalive()
            webSocketTask?.cancel(with: .goingAway, reason: nil)
            webSocketTask = nil
            try? await Task.sleep(nanoseconds: 100_000_000) // 100ms
        }

        guard let apiKey = keychain.getAPIKey(for: .deepgram) else {
            print("[Deepgram] No API key found!")
            throw TranscriptionError.noAPIKey
        }

        print("[Deepgram] Connecting with API key: \(apiKey.prefix(10))...")

        // Build WebSocket URL with parameters
        var components = URLComponents(string: baseURL)!
        components.queryItems = [
            URLQueryItem(name: "model", value: model),
            URLQueryItem(name: "language", value: language),
            URLQueryItem(name: "smart_format", value: "true"),
            URLQueryItem(name: "interim_results", value: "true"),
            URLQueryItem(name: "punctuate", value: "true"),
            URLQueryItem(name: "encoding", value: "linear16"),
            URLQueryItem(name: "sample_rate", value: "16000"),
            URLQueryItem(name: "channels", value: "1")
        ]

        guard let url = components.url else {
            throw TranscriptionError.connectionFailed(NSError(domain: "Invalid URL", code: -1))
        }

        var request = URLRequest(url: url)
        request.setValue("Token \(apiKey)", forHTTPHeaderField: "Authorization")

        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest = 30
        config.timeoutIntervalForResource = 300

        let session = URLSession(configuration: config)
        webSocketTask = session.webSocketTask(with: request)
        webSocketTask?.resume()

        isConnected = true
        audioBytesSent = 0

        print("[Deepgram] WebSocket connected successfully!")

        // Start receiving messages
        receiveMessages()

        // Start keepalive timer
        startKeepalive()
    }

    func disconnect() {
        print("[Deepgram] Disconnecting...")
        stopKeepalive()
        webSocketTask?.cancel(with: .normalClosure, reason: nil)
        webSocketTask = nil
        isConnected = false
        audioBytesSent = 0
    }

    func sendAudioData(_ data: Data) async throws {
        guard isConnected, let task = webSocketTask else {
            throw TranscriptionError.disconnected
        }

        audioBytesSent += data.count
        if audioBytesSent % 50000 < data.count {
            print("[Deepgram] Sent \(audioBytesSent / 1000)KB of audio")
        }

        let message = URLSessionWebSocketTask.Message.data(data)
        try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
            task.send(message) { error in
                if let error {
                    continuation.resume(throwing: error)
                } else {
                    continuation.resume()
                }
            }
        }
    }

    // MARK: - Private Methods

    private func startKeepalive() {
        stopKeepalive()
        keepaliveTimer = Timer.scheduledTimer(withTimeInterval: 8.0, repeats: true) { [weak self] _ in
            self?.sendKeepalive()
        }
    }

    private func stopKeepalive() {
        keepaliveTimer?.invalidate()
        keepaliveTimer = nil
    }

    private func sendKeepalive() {
        guard isConnected, let task = webSocketTask else { return }

        let keepaliveMessage = "{\"type\": \"KeepAlive\"}"
        let message = URLSessionWebSocketTask.Message.string(keepaliveMessage)
        task.send(message) { error in
            if let error {
                print("[Deepgram] Keepalive error: \(error)")
            }
        }
    }

    private func receiveMessages() {
        guard let task = webSocketTask else { return }

        task.receive { [weak self] result in
            guard let self = self else { return }

            switch result {
            case .success(let message):
                Task { @MainActor in
                    self.handleMessage(message)
                }
                if self.isConnected {
                    self.receiveMessages()
                }
            case .failure(let error):
                Task { @MainActor in
                    self.handleError(error)
                }
            }
        }
    }

    private func handleMessage(_ message: URLSessionWebSocketTask.Message) {
        switch message {
        case .string(let text):
            parseTranscriptionResponse(text)
        case .data(let data):
            if let text = String(data: data, encoding: .utf8) {
                parseTranscriptionResponse(text)
            }
        @unknown default:
            print("[Deepgram] Unknown message type received")
        }
    }

    private func parseTranscriptionResponse(_ jsonString: String) {
        guard let data = jsonString.data(using: .utf8) else { return }

        do {
            let response = try JSONDecoder().decode(DeepgramResponse.self, from: data)

            guard let alternative = response.channel?.alternatives?.first else { return }

            let transcript = alternative.transcript ?? ""

            if response.isFinal == true {
                if !transcript.isEmpty {
                    print("[Deepgram] FINAL: \"\(transcript)\"")
                    onTranscript?(transcript)
                }
            } else {
                if !transcript.isEmpty {
                    onInterimTranscript?(transcript)
                }
            }
        } catch {
            // Ignore parsing errors for non-transcript messages
            if jsonString.contains("transcript") {
                print("[Deepgram] Parse error: \(error)")
            }
        }
    }

    private func handleError(_ error: Error) {
        print("[Deepgram] Error: \(error.localizedDescription)")
        stopKeepalive()
        isConnected = false
        onError?(error)
    }
}

// MARK: - Deepgram Response Models

private struct DeepgramResponse: Codable {
    let type: String?
    let channel: Channel?
    let isFinal: Bool?

    enum CodingKeys: String, CodingKey {
        case type
        case channel
        case isFinal = "is_final"
    }
}

private struct Channel: Codable {
    let alternatives: [Alternative]?
}

private struct Alternative: Codable {
    let transcript: String?
    let confidence: Double?
}
import Foundation

@MainActor
final class AssemblyAIProvider: TranscriptionProvider {
    let providerType: TranscriptionProviderType = .assemblyai

    var isConnected: Bool = false
    var onTranscript: ((String) -> Void)?
    var onInterimTranscript: ((String) -> Void)?
    var onError: ((Error) -> Void)?

    private let keychain = KeychainManager.shared
    private var webSocketTask: URLSessionWebSocketTask?
    private var audioBytesSent = 0
    private var sessionURL: String?

    // AssemblyAI configuration
    private let baseURL = "wss://api.assemblyai.com/v2/realtime/ws"

    var isConfigured: Bool {
        keychain.hasAPIKey(for: .assemblyai)
    }

    func connect() async throws {
        print("[AssemblyAI] Connecting...")

        // Clean up existing connection
        if webSocketTask != nil {
            webSocketTask?.cancel(with: .goingAway, reason: nil)
            webSocketTask = nil
            try? await Task.sleep(nanoseconds: 100_000_000) // 100ms
        }

        guard let apiKey = keychain.getAPIKey(for: .assemblyai) else {
            print("[AssemblyAI] No API key found!")
            throw TranscriptionError.noAPIKey
        }

        print("[AssemblyAI] Connecting with API key: \(apiKey.prefix(10))...")

        // Build WebSocket URL with API key as query parameter
        guard let url = URL(string: "\(baseURL)?sample_rate=16000") else {
            throw TranscriptionError.connectionFailed(NSError(domain: "Invalid URL", code: -1))
        }

        var request = URLRequest(url: url)
        request.setValue(apiKey, forHTTPHeaderField: "Authorization")

        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest = 30
        config.timeoutIntervalForResource = 300

        let session = URLSession(configuration: config)
        webSocketTask = session.webSocketTask(with: request)
        webSocketTask?.resume()

        // Wait for session initialization
        try await waitForSessionStart()

        isConnected = true
        audioBytesSent = 0

        print("[AssemblyAI] WebSocket connected successfully!")

        // Start receiving messages
        receiveMessages()
    }

    func disconnect() {
        print("[AssemblyAI] Disconnecting...")

        // Send termination message to AssemblyAI
        if let task = webSocketTask {
            let terminateMessage = "{\"terminate_session\": true}"
            let message = URLSessionWebSocketTask.Message.string(terminateMessage)
            task.send(message) { _ in }
        }

        webSocketTask?.cancel(with: .normalClosure, reason: nil)
        webSocketTask = nil
        isConnected = false
        audioBytesSent = 0
        sessionURL = nil
    }

    func sendAudioData(_ data: Data) async throws {
        guard isConnected, let task = webSocketTask else {
            throw TranscriptionError.disconnected
        }

        audioBytesSent += data.count
        if audioBytesSent % 50000 < data.count {
            print("[AssemblyAI] Sent \(audioBytesSent / 1000)KB of audio")
        }

        // AssemblyAI expects base64-encoded audio data in JSON format
        let base64Audio = data.base64EncodedString()
        let jsonMessage = "{\"audio_data\": \"\(base64Audio)\"}"

        let message = URLSessionWebSocketTask.Message.string(jsonMessage)
        try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
            task.send(message) { error in
                if let error {
                    continuation.resume(throwing: error)
                } else {
                    continuation.resume()
                }
            }
        }
    }

    // MARK: - Private Methods

    private func waitForSessionStart() async throws {
        // AssemblyAI sends a session_begins message when ready
        try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
            guard let task = webSocketTask else {
                continuation.resume(throwing: TranscriptionError.disconnected)
                return
            }

            task.receive { result in
                switch result {
                case .success(let message):
                    if case .string(let text) = message {
                        if text.contains("\"message_type\":\"SessionBegins\"") {
                            print("[AssemblyAI] Session started successfully")
                            continuation.resume()
                        } else {
                            print("[AssemblyAI] Unexpected message during init: \(text)")
                            continuation.resume(throwing: TranscriptionError.invalidResponse)
                        }
                    }
                case .failure(let error):
                    continuation.resume(throwing: error)
                }
            }
        }
    }

    private func receiveMessages() {
        guard let task = webSocketTask else { return }

        task.receive { [weak self] result in
            guard let self = self else { return }

            switch result {
            case .success(let message):
                Task { @MainActor in
                    self.handleMessage(message)
                }
                if self.isConnected {
                    self.receiveMessages()
                }
            case .failure(let error):
                Task { @MainActor in
                    self.handleError(error)
                }
            }
        }
    }

    private func handleMessage(_ message: URLSessionWebSocketTask.Message) {
        switch message {
        case .string(let text):
            parseTranscriptionResponse(text)
        case .data(let data):
            if let text = String(data: data, encoding: .utf8) {
                parseTranscriptionResponse(text)
            }
        @unknown default:
            print("[AssemblyAI] Unknown message type received")
        }
    }

    private func parseTranscriptionResponse(_ jsonString: String) {
        guard let data = jsonString.data(using: .utf8) else { return }

        do {
            let response = try JSONDecoder().decode(AssemblyAIResponse.self, from: data)

            switch response.messageType {
            case "PartialTranscript":
                if let transcript = response.text, !transcript.isEmpty {
                    onInterimTranscript?(transcript)
                }
            case "FinalTranscript":
                if let transcript = response.text, !transcript.isEmpty {
                    print("[AssemblyAI] FINAL: \"\(transcript)\"")
                    onTranscript?(transcript)
                }
            case "SessionBegins":
                print("[AssemblyAI] Session begins message received")
            case "SessionTerminated":
                print("[AssemblyAI] Session terminated by server")
                isConnected = false
            default:
                break
            }
        } catch {
            // Ignore parsing errors for unknown messages
            if jsonString.contains("text") {
                print("[AssemblyAI] Parse error: \(error)")
            }
        }
    }

    private func handleError(_ error: Error) {
        print("[AssemblyAI] Error: \(error.localizedDescription)")
        isConnected = false
        onError?(error)
    }
}

// MARK: - AssemblyAI Response Models

private struct AssemblyAIResponse: Codable {
    let messageType: String?
    let text: String?
    let confidence: Double?
    let audioStart: Int?
    let audioEnd: Int?
    let created: String?

    enum CodingKeys: String, CodingKey {
        case messageType = "message_type"
        case text
        case confidence
        case audioStart = "audio_start"
        case audioEnd = "audio_end"
        case created
    }
}
