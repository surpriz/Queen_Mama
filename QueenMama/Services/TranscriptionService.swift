import Foundation
import Combine

enum TranscriptionError: LocalizedError {
    case noAPIKey
    case connectionFailed(Error)
    case invalidResponse
    case disconnected

    var errorDescription: String? {
        switch self {
        case .noAPIKey:
            return "Deepgram API key not configured."
        case .connectionFailed(let error):
            return "Failed to connect to transcription service: \(error.localizedDescription)"
        case .invalidResponse:
            return "Invalid response from transcription service."
        case .disconnected:
            return "Disconnected from transcription service."
        }
    }
}

@MainActor
final class TranscriptionService: ObservableObject {
    // MARK: - Published Properties

    @Published var isConnected = false
    @Published var currentTranscript = ""
    @Published var interimTranscript = ""
    @Published var errorMessage: String?

    // MARK: - Callbacks

    var onTranscript: ((String) -> Void)?
    var onInterimTranscript: ((String) -> Void)?
    var onError: ((Error) -> Void)?

    // MARK: - Private Properties

    private var webSocketTask: URLSessionWebSocketTask?
    private let keychain = KeychainManager.shared
    private var isReconnecting = false
    private var reconnectAttempts = 0
    private let maxReconnectAttempts = 5
    private var intentionalDisconnect = false  // Track if disconnect was user-initiated

    // Deepgram configuration
    private let baseURL = "wss://api.deepgram.com/v1/listen"
    private let model = "nova-3"
    private let language = "fr"  // French for user's language

    // MARK: - Initialization

    init() {}

    // Keepalive timer
    private var keepaliveTimer: Timer?

    // MARK: - Connection Management

    func connect() async throws {
        // Clean up existing connection without triggering reconnect
        if webSocketTask != nil {
            print("[Transcription] Cleaning up existing connection...")
            stopKeepalive()
            webSocketTask?.cancel(with: .goingAway, reason: nil)
            webSocketTask = nil
            // Small delay to ensure clean disconnect
            try? await Task.sleep(nanoseconds: 100_000_000) // 100ms
        }

        guard let apiKey = keychain.getAPIKey(for: .deepgram) else {
            print("[Transcription] No Deepgram API key found!")
            throw TranscriptionError.noAPIKey
        }

        print("[Transcription] Connecting to Deepgram with API key: \(apiKey.prefix(10))...")

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
        errorMessage = nil
        reconnectAttempts = 0
        intentionalDisconnect = false  // Reset flag for new connection

        print("[Transcription] WebSocket connected successfully!")

        // Start receiving messages
        receiveMessages()

        // Start keepalive timer
        startKeepalive()
    }

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

        // Send a keepalive message (empty JSON object)
        let keepaliveMessage = "{\"type\": \"KeepAlive\"}"
        let message = URLSessionWebSocketTask.Message.string(keepaliveMessage)
        task.send(message) { error in
            if let error {
                print("[Transcription] Keepalive error: \(error)")
            }
        }
    }

    private var audioBytesSent = 0

    func disconnect() {
        print("[Transcription] Disconnecting...")
        intentionalDisconnect = true  // Mark as intentional to prevent auto-reconnect
        stopKeepalive()
        webSocketTask?.cancel(with: .normalClosure, reason: nil)
        webSocketTask = nil
        isConnected = false
        isReconnecting = false
        audioBytesSent = 0
    }

    func sendAudio(_ data: Data) {
        guard isConnected, let task = webSocketTask else {
            if !isConnected {
                print("[Transcription] Cannot send audio - not connected")
            }
            return
        }

        audioBytesSent += data.count
        if audioBytesSent % 50000 < data.count {
            print("[Transcription] Sent \(audioBytesSent / 1000)KB of audio to Deepgram")
        }

        let message = URLSessionWebSocketTask.Message.data(data)
        task.send(message) { [weak self] error in
            if let error {
                print("[Transcription] Error sending audio: \(error)")
                Task { @MainActor in
                    self?.handleError(error)
                }
            }
        }
    }

    // MARK: - Private Methods

    private func receiveMessages() {
        guard let task = webSocketTask else {
            print("[Transcription] No WebSocket task available for receiving")
            return
        }

        task.receive { [weak self] result in
            guard let self = self else { return }

            switch result {
            case .success(let message):
                Task { @MainActor in
                    self.handleMessage(message)
                }
                // Continue receiving only if still connected
                if self.isConnected {
                    self.receiveMessages()
                }
            case .failure(let error):
                let nsError = error as NSError
                print("[Transcription] Receive error: \(nsError.domain) code: \(nsError.code)")

                // Check if it's a normal close or an error
                if nsError.code == 57 || nsError.domain == "NSPOSIXErrorDomain" {
                    print("[Transcription] Connection closed by server")
                }

                Task { @MainActor in
                    self.handleError(error)
                }
            }
        }
    }

    private func handleMessage(_ message: URLSessionWebSocketTask.Message) {
        switch message {
        case .string(let text):
            // Check for Deepgram metadata or error messages
            if text.contains("\"type\":\"Metadata\"") {
                print("[Transcription] Received metadata from Deepgram")
            } else if text.contains("\"type\":\"Error\"") || text.contains("\"error\"") {
                print("[Transcription] Deepgram error: \(text)")
            } else if text.contains("\"type\":\"CloseStream\"") {
                print("[Transcription] Deepgram requested stream close")
            }
            parseTranscriptionResponse(text)
        case .data(let data):
            if let text = String(data: data, encoding: .utf8) {
                parseTranscriptionResponse(text)
            }
        @unknown default:
            print("[Transcription] Unknown message type received")
        }
    }

    private func parseTranscriptionResponse(_ jsonString: String) {
        guard let data = jsonString.data(using: .utf8) else { return }

        do {
            let response = try JSONDecoder().decode(DeepgramResponse.self, from: data)

            guard let alternative = response.channel?.alternatives?.first else { return }

            let transcript = alternative.transcript ?? ""

            if response.isFinal == true {
                // Final transcript
                if !transcript.isEmpty {
                    print("[Transcription] FINAL: \"\(transcript)\"")
                    currentTranscript += transcript + " "
                    onTranscript?(transcript)
                }
                interimTranscript = ""
            } else {
                // Interim transcript
                if !transcript.isEmpty {
                    print("[Transcription] interim: \"\(transcript)\"")
                }
                interimTranscript = transcript
                onInterimTranscript?(transcript)
            }
        } catch {
            // Ignore parsing errors for non-transcript messages (e.g., metadata)
            // Only log if it looks like it might be a transcript
            if jsonString.contains("transcript") {
                print("[Transcription] Parse error: \(error)")
            }
        }
    }

    private func handleError(_ error: Error) {
        print("[Transcription] Error: \(error.localizedDescription)")
        errorMessage = error.localizedDescription
        stopKeepalive()
        isConnected = false
        onError?(error)

        // Only attempt reconnection if not intentional and not already reconnecting
        if !intentionalDisconnect && !isReconnecting && reconnectAttempts < maxReconnectAttempts {
            attemptReconnect()
        } else if intentionalDisconnect {
            print("[Transcription] Intentional disconnect - not reconnecting")
        }
    }

    private func attemptReconnect() {
        guard !isReconnecting else {
            print("[Transcription] Already reconnecting, skipping")
            return
        }

        isReconnecting = true
        reconnectAttempts += 1

        let delay = Double(reconnectAttempts) * 3.0 // Exponential backoff (3s, 6s, 9s...)
        print("[Transcription] Will reconnect in \(delay)s (attempt \(reconnectAttempts)/\(maxReconnectAttempts))")

        Task {
            try? await Task.sleep(nanoseconds: UInt64(delay * 1_000_000_000))

            do {
                try await connect()
                isReconnecting = false
                print("[Transcription] Reconnected successfully!")
            } catch {
                print("[Transcription] Reconnection failed: \(error)")
                isReconnecting = false
                if reconnectAttempts < maxReconnectAttempts {
                    attemptReconnect()
                } else {
                    print("[Transcription] Max reconnection attempts reached")
                }
            }
        }
    }

    func clearTranscript() {
        currentTranscript = ""
        interimTranscript = ""
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
    let words: [Word]?
}

private struct Word: Codable {
    let word: String?
    let start: Double?
    let end: Double?
    let confidence: Double?
    let speaker: Int?
}
