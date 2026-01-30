import Foundation

enum TranscriptionProviderType: String, CaseIterable {
    case deepgram = "Deepgram Nova-3"
    case assemblyai = "AssemblyAI Universal"
    case deepgramFlux = "Deepgram Flux"

    var displayName: String { rawValue }
}

enum TranscriptionError: LocalizedError {
    case noAPIKey
    case notAuthenticated
    case connectionFailed(Error)
    case invalidResponse
    case disconnected
    case allProvidersFailed
    case tokenExpired

    var errorDescription: String? {
        switch self {
        case .noAPIKey:
            return "Transcription service not available."
        case .notAuthenticated:
            return "Please sign in to use transcription."
        case .connectionFailed(let error):
            return "Failed to connect to transcription service: \(error.localizedDescription)"
        case .invalidResponse:
            return "Invalid response from transcription service."
        case .disconnected:
            return "Disconnected from transcription service."
        case .allProvidersFailed:
            return "All transcription providers failed."
        case .tokenExpired:
            return "Transcription token expired. Reconnecting..."
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

    private let proxyClient = ProxyAPIClient.shared
    private let configManager = ProxyConfigManager.shared
    private var webSocketTask: URLSessionWebSocketTask?
    private var keepaliveTimer: Timer?
    private var audioBytesSent = 0
    private var currentToken: TranscriptionToken?
    private var tokenRefreshTask: Task<Void, Never>?

    // Deepgram configuration
    private let baseURL = "wss://api.deepgram.com/v1/listen"
    private let model = "nova-3"
    private let language = "multi"  // Multi-language auto-detection

    var isConfigured: Bool {
        // Check if transcription is available via proxy
        configManager.isTranscriptionProviderAvailable("deepgram")
    }

    func connect() async throws {
        print("[Deepgram] Connecting...")

        // Clean up existing connection
        if webSocketTask != nil {
            stopKeepalive()
            stopTokenRefresh()
            webSocketTask?.cancel(with: .goingAway, reason: nil)
            webSocketTask = nil
            try? await Task.sleep(nanoseconds: 100_000_000) // 100ms
        }

        // Get temporary token from proxy
        guard AuthenticationManager.shared.isAuthenticated else {
            print("[Deepgram] Not authenticated!")
            throw TranscriptionError.notAuthenticated
        }

        let token: TranscriptionToken
        do {
            token = try await proxyClient.getTranscriptionToken(provider: "deepgram")
            currentToken = token
            print("[Deepgram] Got temporary token, expires at: \(token.expiresAt)")
        } catch {
            print("[Deepgram] Failed to get transcription token: \(error)")
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
            URLQueryItem(name: "encoding", value: "linear16"),
            URLQueryItem(name: "sample_rate", value: "16000"),
            URLQueryItem(name: "channels", value: "1")
        ]

        guard let url = components.url else {
            throw TranscriptionError.connectionFailed(NSError(domain: "Invalid URL", code: -1))
        }

        var request = URLRequest(url: url)
        // Use Bearer for JWT tokens (from grant API), Token for legacy API keys
        let authScheme = token.tokenType == "bearer" ? "Bearer" : "Token"
        request.setValue("\(authScheme) \(token.token)", forHTTPHeaderField: "Authorization")
        print("[Deepgram] Using \(authScheme) authorization scheme")

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

        // Schedule token refresh before expiry
        scheduleTokenRefresh()
    }

    private func scheduleTokenRefresh() {
        guard let token = currentToken else { return }

        // Refresh 2 minutes before expiry
        let refreshTime = token.expiresAt.addingTimeInterval(-120)
        let delay = refreshTime.timeIntervalSinceNow

        if delay > 0 {
            tokenRefreshTask = Task { [weak self] in
                try? await Task.sleep(nanoseconds: UInt64(delay * 1_000_000_000))
                guard let self = self, self.isConnected else { return }

                print("[Deepgram] Token refresh needed, reconnecting...")
                self.disconnect()
                try? await self.connect()
            }
        }
    }

    private func stopTokenRefresh() {
        tokenRefreshTask?.cancel()
        tokenRefreshTask = nil
    }

    func disconnect() {
        print("[Deepgram] Disconnecting...")
        stopKeepalive()
        stopTokenRefresh()
        webSocketTask?.cancel(with: .normalClosure, reason: nil)
        webSocketTask = nil
        isConnected = false
        audioBytesSent = 0
        currentToken = nil
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
            guard let self else { return }
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

    private let proxyClient = ProxyAPIClient.shared
    private let configManager = ProxyConfigManager.shared
    private var webSocketTask: URLSessionWebSocketTask?
    private var audioBytesSent = 0
    private var sessionURL: String?
    private var currentToken: TranscriptionToken?
    private var tokenRefreshTask: Task<Void, Never>?

    // AssemblyAI configuration
    private let baseURL = "wss://api.assemblyai.com/v2/realtime/ws"

    var isConfigured: Bool {
        // Check if transcription is available via proxy
        configManager.isTranscriptionProviderAvailable("assemblyai")
    }

    func connect() async throws {
        print("[AssemblyAI] Connecting...")

        // Clean up existing connection
        if webSocketTask != nil {
            stopTokenRefresh()
            webSocketTask?.cancel(with: .goingAway, reason: nil)
            webSocketTask = nil
            try? await Task.sleep(nanoseconds: 100_000_000) // 100ms
        }

        // Get temporary token from proxy
        guard AuthenticationManager.shared.isAuthenticated else {
            print("[AssemblyAI] Not authenticated!")
            throw TranscriptionError.notAuthenticated
        }

        let token: TranscriptionToken
        do {
            token = try await proxyClient.getTranscriptionToken(provider: "assemblyai")
            currentToken = token
            print("[AssemblyAI] Got temporary token, expires at: \(token.expiresAt)")
        } catch {
            print("[AssemblyAI] Failed to get transcription token: \(error)")
            throw TranscriptionError.noAPIKey
        }

        // Build WebSocket URL with API key as query parameter
        guard let url = URL(string: "\(baseURL)?sample_rate=16000") else {
            throw TranscriptionError.connectionFailed(NSError(domain: "Invalid URL", code: -1))
        }

        var request = URLRequest(url: url)
        request.setValue(token.token, forHTTPHeaderField: "Authorization")

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

        // Schedule token refresh before expiry
        scheduleTokenRefresh()
    }

    private func scheduleTokenRefresh() {
        guard let token = currentToken else { return }

        // Refresh 2 minutes before expiry
        let refreshTime = token.expiresAt.addingTimeInterval(-120)
        let delay = refreshTime.timeIntervalSinceNow

        if delay > 0 {
            tokenRefreshTask = Task { [weak self] in
                try? await Task.sleep(nanoseconds: UInt64(delay * 1_000_000_000))
                guard let self = self, self.isConnected else { return }

                print("[AssemblyAI] Token refresh needed, reconnecting...")
                self.disconnect()
                try? await self.connect()
            }
        }
    }

    private func stopTokenRefresh() {
        tokenRefreshTask?.cancel()
        tokenRefreshTask = nil
    }

    func disconnect() {
        print("[AssemblyAI] Disconnecting...")

        stopTokenRefresh()

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
        currentToken = nil
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

// MARK: - Deepgram Flux Provider

@MainActor
final class DeepgramFluxProvider: TranscriptionProvider {
    let providerType: TranscriptionProviderType = .deepgramFlux

    var isConnected: Bool = false
    var onTranscript: ((String) -> Void)?
    var onInterimTranscript: ((String) -> Void)?
    var onError: ((Error) -> Void)?

    private let proxyClient = ProxyAPIClient.shared
    private let configManager = ProxyConfigManager.shared
    private var webSocketTask: URLSessionWebSocketTask?
    private var audioBytesSent = 0
    private var currentToken: TranscriptionToken?
    private var tokenRefreshTask: Task<Void, Never>?

    // Deepgram Flux configuration - uses v2 endpoint
    private let baseURL = "wss://api.deepgram.com/v2/listen"
    private let model = "flux-general-en"

    var isConfigured: Bool {
        // Flux uses the same Deepgram provider via proxy
        configManager.isTranscriptionProviderAvailable("deepgram")
    }

    func connect() async throws {
        print("[Deepgram Flux] Connecting...")

        // Clean up existing connection
        if webSocketTask != nil {
            stopTokenRefresh()
            webSocketTask?.cancel(with: .goingAway, reason: nil)
            webSocketTask = nil
            try? await Task.sleep(nanoseconds: 100_000_000) // 100ms
        }

        // Get temporary token from proxy
        guard AuthenticationManager.shared.isAuthenticated else {
            print("[Deepgram Flux] Not authenticated!")
            throw TranscriptionError.notAuthenticated
        }

        let token: TranscriptionToken
        do {
            token = try await proxyClient.getTranscriptionToken(provider: "deepgram")
            currentToken = token
            print("[Deepgram Flux] Got temporary token, expires at: \(token.expiresAt)")
        } catch {
            print("[Deepgram Flux] Failed to get transcription token: \(error)")
            throw TranscriptionError.noAPIKey
        }

        // Build WebSocket URL with Flux-specific parameters
        var components = URLComponents(string: baseURL)!
        components.queryItems = [
            URLQueryItem(name: "model", value: model),
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
        // Use Bearer for JWT tokens (from grant API), Token for legacy API keys
        let authScheme = token.tokenType == "bearer" ? "Bearer" : "Token"
        request.setValue("\(authScheme) \(token.token)", forHTTPHeaderField: "Authorization")
        print("[Deepgram Flux] Using \(authScheme) authorization scheme")

        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest = 30
        config.timeoutIntervalForResource = 300

        let session = URLSession(configuration: config)
        webSocketTask = session.webSocketTask(with: request)
        webSocketTask?.resume()

        isConnected = true
        audioBytesSent = 0

        print("[Deepgram Flux] WebSocket connected successfully!")

        // Start receiving messages
        receiveMessages()

        // Schedule token refresh before expiry
        scheduleTokenRefresh()
    }

    private func scheduleTokenRefresh() {
        guard let token = currentToken else { return }

        // Refresh 2 minutes before expiry
        let refreshTime = token.expiresAt.addingTimeInterval(-120)
        let delay = refreshTime.timeIntervalSinceNow

        if delay > 0 {
            tokenRefreshTask = Task { [weak self] in
                try? await Task.sleep(nanoseconds: UInt64(delay * 1_000_000_000))
                guard let self = self, self.isConnected else { return }

                print("[Deepgram Flux] Token refresh needed, reconnecting...")
                self.disconnect()
                try? await self.connect()
            }
        }
    }

    private func stopTokenRefresh() {
        tokenRefreshTask?.cancel()
        tokenRefreshTask = nil
    }

    func disconnect() {
        print("[Deepgram Flux] Disconnecting...")
        stopTokenRefresh()
        webSocketTask?.cancel(with: .normalClosure, reason: nil)
        webSocketTask = nil
        isConnected = false
        audioBytesSent = 0
        currentToken = nil
    }

    func sendAudioData(_ data: Data) async throws {
        guard isConnected, let task = webSocketTask else {
            throw TranscriptionError.disconnected
        }

        audioBytesSent += data.count
        if audioBytesSent % 50000 < data.count {
            print("[Deepgram Flux] Sent \(audioBytesSent / 1000)KB of audio")
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
            print("[Deepgram Flux] Unknown message type received")
        }
    }

    private func parseTranscriptionResponse(_ jsonString: String) {
        guard let data = jsonString.data(using: .utf8) else { return }

        do {
            let response = try JSONDecoder().decode(DeepgramFluxResponse.self, from: data)

            guard let alternative = response.channel?.alternatives?.first else { return }

            let transcript = alternative.transcript ?? ""

            if response.isFinal == true {
                if !transcript.isEmpty {
                    print("[Deepgram Flux] FINAL: \"\(transcript)\"")
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
                print("[Deepgram Flux] Parse error: \(error)")
            }
        }
    }

    private func handleError(_ error: Error) {
        print("[Deepgram Flux] Error: \(error.localizedDescription)")
        isConnected = false
        onError?(error)
    }
}

// MARK: - Deepgram Flux Response Models

private struct DeepgramFluxResponse: Codable {
    let type: String?
    let channel: FluxChannel?
    let isFinal: Bool?

    enum CodingKeys: String, CodingKey {
        case type
        case channel
        case isFinal = "is_final"
    }
}

private struct FluxChannel: Codable {
    let alternatives: [FluxAlternative]?
}

private struct FluxAlternative: Codable {
    let transcript: String?
    let confidence: Double?
}
