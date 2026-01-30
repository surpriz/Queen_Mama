import Foundation
import Combine

// MARK: - Connection State Machine

enum TranscriptionConnectionState: Equatable {
    case disconnected
    case connecting
    case connected
    case reconnecting(attempt: Int, maxAttempts: Int)
    case failed(reason: String)

    var isActive: Bool {
        switch self {
        case .connected, .connecting, .reconnecting:
            return true
        case .disconnected, .failed:
            return false
        }
    }

    var displayStatus: String {
        switch self {
        case .disconnected:
            return "Disconnected"
        case .connecting:
            return "Connecting..."
        case .connected:
            return "Connected"
        case .reconnecting(let attempt, let max):
            return "Reconnecting (\(attempt)/\(max))..."
        case .failed(let reason):
            return "Failed: \(reason)"
        }
    }
}

@MainActor
final class TranscriptionService: ObservableObject {
    // MARK: - Published Properties

    @Published var isConnected = false
    @Published var connectionState: TranscriptionConnectionState = .disconnected
    @Published var currentTranscript = ""
    @Published var interimTranscript = ""
    @Published var errorMessage: String?
    @Published var currentProvider: TranscriptionProviderType?

    // MARK: - Callbacks

    var onTranscript: ((String) -> Void)?
    var onInterimTranscript: ((String) -> Void)?
    var onError: ((Error) -> Void)?

    // MARK: - Providers
    // Fallback order: Deepgram Nova-3 -> AssemblyAI Universal -> Deepgram Flux

    private let deepgramProvider = DeepgramProvider()           // Nova-3 (primary)
    private let assemblyAIProvider = AssemblyAIProvider()       // Universal-Streaming (fallback)
    private let deepgramFluxProvider = DeepgramFluxProvider()   // Flux (backup)

    private var providers: [TranscriptionProvider] {
        [deepgramProvider, assemblyAIProvider, deepgramFluxProvider]
    }

    private var configuredProviders: [TranscriptionProvider] {
        providers.filter { $0.isConfigured }
    }

    private var currentActiveProvider: TranscriptionProvider?

    // MARK: - Reconnection Configuration

    private let maxReconnectAttempts = 5
    private let baseReconnectDelay: TimeInterval = 1.0  // Base delay in seconds
    private let maxReconnectDelay: TimeInterval = 30.0  // Max delay cap
    private var reconnectAttempts = 0
    private var intentionalDisconnect = false
    private var reconnectTask: Task<Void, Never>?

    // MARK: - Audio Batching Configuration
    // Accumulates audio buffers to reduce WebSocket message frequency by ~50%

    private var audioBatchBuffer = Data()
    private var audioBatchTimer: Timer?
    private let batchIntervalMs: Int = 400      // Max time before flushing batch (ms)
    private let maxBatchSize: Int = 32000       // ~1 second of 16kHz mono audio

    // MARK: - Initialization

    init() {
        setupProviderCallbacks()
    }

    // MARK: - Connection Management

    func connect() async throws {
        print("[Transcription] Connecting to transcription service...")

        // Cancel any pending reconnection
        reconnectTask?.cancel()
        reconnectTask = nil

        // Update state
        connectionState = .connecting

        // Clean up existing connection
        if let current = currentActiveProvider {
            current.disconnect()
            currentActiveProvider = nil
        }

        intentionalDisconnect = false
        reconnectAttempts = 0

        // Try each configured provider
        var lastError: Error?

        for provider in configuredProviders {
            do {
                print("[Transcription] Trying provider: \(provider.providerType.displayName)")
                try await provider.connect()
                currentActiveProvider = provider
                currentProvider = provider.providerType
                isConnected = true
                connectionState = .connected
                errorMessage = nil
                print("[Transcription] Successfully connected with \(provider.providerType.displayName)")
                return
            } catch {
                print("[Transcription] Provider \(provider.providerType.displayName) failed: \(error)")
                lastError = error
                continue
            }
        }

        // All providers failed
        isConnected = false
        connectionState = .failed(reason: lastError?.localizedDescription ?? "All providers failed")
        throw lastError ?? TranscriptionError.allProvidersFailed
    }

    func disconnect() {
        print("[Transcription] Disconnecting...")
        intentionalDisconnect = true

        // Cancel any pending reconnection
        reconnectTask?.cancel()
        reconnectTask = nil

        // Flush any pending audio before disconnecting
        flushAudioBatch()

        currentActiveProvider?.disconnect()
        currentActiveProvider = nil
        isConnected = false
        connectionState = .disconnected
        currentProvider = nil
    }

    func sendAudio(_ data: Data) {
        guard isConnected, currentActiveProvider != nil else {
            return
        }

        // Accumulate audio data in batch buffer
        audioBatchBuffer.append(data)

        // Start batch timer if not already running
        if audioBatchTimer == nil {
            audioBatchTimer = Timer.scheduledTimer(
                withTimeInterval: TimeInterval(batchIntervalMs) / 1000.0,
                repeats: false
            ) { [weak self] _ in
                Task { @MainActor in
                    self?.flushAudioBatch()
                }
            }
        }

        // Flush immediately if batch exceeds max size (prevents excessive latency)
        if audioBatchBuffer.count >= maxBatchSize {
            flushAudioBatch()
        }
    }

    /// Flushes accumulated audio batch to the transcription provider
    private func flushAudioBatch() {
        // Cancel pending timer
        audioBatchTimer?.invalidate()
        audioBatchTimer = nil

        guard !audioBatchBuffer.isEmpty,
              isConnected,
              let provider = currentActiveProvider else {
            audioBatchBuffer.removeAll()
            return
        }

        let batchToSend = audioBatchBuffer
        audioBatchBuffer.removeAll()

        Task {
            do {
                try await provider.sendAudioData(batchToSend)
            } catch {
                print("[Transcription] Error sending audio batch: \(error)")
                handleError(error)
            }
        }
    }

    func clearTranscript() {
        currentTranscript = ""
        interimTranscript = ""

        // Clear any pending audio batch
        audioBatchTimer?.invalidate()
        audioBatchTimer = nil
        audioBatchBuffer.removeAll()
    }

    // MARK: - Private Methods

    private func setupProviderCallbacks() {
        for provider in providers {
            provider.onTranscript = { [weak self] transcript in
                Task { @MainActor in
                    self?.handleTranscript(transcript)
                }
            }

            provider.onInterimTranscript = { [weak self] transcript in
                Task { @MainActor in
                    self?.handleInterimTranscript(transcript)
                }
            }

            provider.onError = { [weak self] error in
                Task { @MainActor in
                    self?.handleError(error)
                }
            }
        }
    }

    private func handleTranscript(_ transcript: String) {
        currentTranscript += transcript + " "
        onTranscript?(transcript)
        interimTranscript = ""
    }

    private func handleInterimTranscript(_ transcript: String) {
        interimTranscript = transcript
        onInterimTranscript?(transcript)
    }

    private func handleError(_ error: Error) {
        print("[Transcription] Error: \(error.localizedDescription)")
        errorMessage = error.localizedDescription
        isConnected = false
        onError?(error)

        // Try to reconnect if not intentionally disconnected
        if !intentionalDisconnect {
            scheduleReconnect()
        }
    }

    /// Schedule a reconnection attempt with exponential backoff and jitter
    private func scheduleReconnect() {
        // Don't schedule if already reconnecting or intentionally disconnected
        guard reconnectTask == nil, !intentionalDisconnect else { return }

        reconnectAttempts += 1

        if reconnectAttempts > maxReconnectAttempts {
            print("[Transcription] Max reconnection attempts reached (\(maxReconnectAttempts))")
            connectionState = .failed(reason: "Max reconnection attempts reached")
            return
        }

        // Update state
        connectionState = .reconnecting(attempt: reconnectAttempts, maxAttempts: maxReconnectAttempts)

        // Calculate delay with exponential backoff + jitter
        let exponentialDelay = baseReconnectDelay * pow(2.0, Double(reconnectAttempts - 1))
        let jitter = Double.random(in: 0...0.5) * exponentialDelay
        let delay = min(exponentialDelay + jitter, maxReconnectDelay)

        print("[Transcription] Reconnecting in \(String(format: "%.1f", delay))s (attempt \(reconnectAttempts)/\(maxReconnectAttempts))")

        reconnectTask = Task { [weak self] in
            do {
                try await Task.sleep(nanoseconds: UInt64(delay * 1_000_000_000))

                // Check if still needed
                guard let self = self, !self.intentionalDisconnect else { return }

                await MainActor.run {
                    self.reconnectTask = nil
                }

                try await self.connect()
                print("[Transcription] Reconnected successfully!")

            } catch is CancellationError {
                print("[Transcription] Reconnection cancelled")
            } catch {
                print("[Transcription] Reconnection failed: \(error)")

                await MainActor.run { [weak self] in
                    self?.reconnectTask = nil
                    // Schedule next attempt
                    self?.scheduleReconnect()
                }
            }
        }
    }

    /// Reset reconnection state (call after successful manual connect)
    private func resetReconnectionState() {
        reconnectTask?.cancel()
        reconnectTask = nil
        reconnectAttempts = 0
    }
}
