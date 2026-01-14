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

    // Deepgram configuration
    private let baseURL = "wss://api.deepgram.com/v1/listen"
    private let model = "nova-3"
    private let language = "en"

    // MARK: - Initialization

    init() {}

    // MARK: - Connection Management

    func connect() async throws {
        guard let apiKey = keychain.getAPIKey(for: .deepgram) else {
            throw TranscriptionError.noAPIKey
        }

        // Build WebSocket URL with parameters
        var components = URLComponents(string: baseURL)!
        components.queryItems = [
            URLQueryItem(name: "model", value: model),
            URLQueryItem(name: "language", value: language),
            URLQueryItem(name: "smart_format", value: "true"),
            URLQueryItem(name: "interim_results", value: "true"),
            URLQueryItem(name: "punctuate", value: "true"),
            URLQueryItem(name: "diarize", value: "true"),
            URLQueryItem(name: "encoding", value: "linear16"),
            URLQueryItem(name: "sample_rate", value: "16000"),
            URLQueryItem(name: "channels", value: "1")
        ]

        guard let url = components.url else {
            throw TranscriptionError.connectionFailed(NSError(domain: "Invalid URL", code: -1))
        }

        var request = URLRequest(url: url)
        request.setValue("Token \(apiKey)", forHTTPHeaderField: "Authorization")

        let session = URLSession(configuration: .default)
        webSocketTask = session.webSocketTask(with: request)
        webSocketTask?.resume()

        isConnected = true
        errorMessage = nil
        reconnectAttempts = 0

        // Start receiving messages
        receiveMessages()
    }

    func disconnect() {
        webSocketTask?.cancel(with: .normalClosure, reason: nil)
        webSocketTask = nil
        isConnected = false
    }

    func sendAudio(_ data: Data) {
        guard isConnected, let task = webSocketTask else { return }

        let message = URLSessionWebSocketTask.Message.data(data)
        task.send(message) { [weak self] error in
            if let error {
                Task { @MainActor in
                    self?.handleError(error)
                }
            }
        }
    }

    // MARK: - Private Methods

    private func receiveMessages() {
        webSocketTask?.receive { [weak self] result in
            Task { @MainActor in
                switch result {
                case .success(let message):
                    self?.handleMessage(message)
                    // Continue receiving
                    self?.receiveMessages()
                case .failure(let error):
                    self?.handleError(error)
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
            break
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
                    currentTranscript += transcript + " "
                    onTranscript?(transcript)
                }
                interimTranscript = ""
            } else {
                // Interim transcript
                interimTranscript = transcript
                onInterimTranscript?(transcript)
            }
        } catch {
            // Ignore parsing errors for non-transcript messages (e.g., metadata)
            print("Parse error (non-critical): \(error)")
        }
    }

    private func handleError(_ error: Error) {
        errorMessage = error.localizedDescription
        isConnected = false
        onError?(error)

        // Attempt reconnection
        if !isReconnecting && reconnectAttempts < maxReconnectAttempts {
            attemptReconnect()
        }
    }

    private func attemptReconnect() {
        isReconnecting = true
        reconnectAttempts += 1

        let delay = Double(reconnectAttempts) * 2.0 // Exponential backoff

        Task {
            try? await Task.sleep(nanoseconds: UInt64(delay * 1_000_000_000))

            do {
                try await connect()
                isReconnecting = false
            } catch {
                isReconnecting = false
                if reconnectAttempts < maxReconnectAttempts {
                    attemptReconnect()
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
