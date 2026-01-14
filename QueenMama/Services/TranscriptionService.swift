import Foundation
import Combine

@MainActor
final class TranscriptionService: ObservableObject {
    // MARK: - Published Properties

    @Published var isConnected = false
    @Published var currentTranscript = ""
    @Published var interimTranscript = ""
    @Published var errorMessage: String?
    @Published var currentProvider: TranscriptionProviderType?

    // MARK: - Callbacks

    var onTranscript: ((String) -> Void)?
    var onInterimTranscript: ((String) -> Void)?
    var onError: ((Error) -> Void)?

    // MARK: - Providers

    private let deepgramProvider = DeepgramProvider()
    private let assemblyAIProvider = AssemblyAIProvider()

    private var providers: [TranscriptionProvider] {
        [deepgramProvider, assemblyAIProvider]
    }

    private var configuredProviders: [TranscriptionProvider] {
        providers.filter { $0.isConfigured }
    }

    private var currentActiveProvider: TranscriptionProvider?

    // MARK: - Private Properties

    private var isReconnecting = false
    private var reconnectAttempts = 0
    private let maxReconnectAttempts = 3
    private var intentionalDisconnect = false

    // MARK: - Initialization

    init() {
        setupProviderCallbacks()
    }

    // MARK: - Connection Management

    func connect() async throws {
        print("[Transcription] Connecting to transcription service...")

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
        throw lastError ?? TranscriptionError.allProvidersFailed
    }

    func disconnect() {
        print("[Transcription] Disconnecting...")
        intentionalDisconnect = true
        currentActiveProvider?.disconnect()
        currentActiveProvider = nil
        isConnected = false
        isReconnecting = false
        currentProvider = nil
    }

    func sendAudio(_ data: Data) {
        guard isConnected, let provider = currentActiveProvider else {
            return
        }

        Task {
            do {
                try await provider.sendAudioData(data)
            } catch {
                print("[Transcription] Error sending audio: \(error)")
                handleError(error)
            }
        }
    }

    func clearTranscript() {
        currentTranscript = ""
        interimTranscript = ""
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

        // Try to fallback to next provider or reconnect
        if !intentionalDisconnect && !isReconnecting {
            attemptReconnect()
        }
    }

    private func attemptReconnect() {
        guard !isReconnecting else { return }

        isReconnecting = true
        reconnectAttempts += 1

        if reconnectAttempts > maxReconnectAttempts {
            print("[Transcription] Max reconnection attempts reached")
            isReconnecting = false
            return
        }

        let delay = Double(reconnectAttempts) * 2.0 // 2s, 4s, 6s...
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
                attemptReconnect()
            }
        }
    }
}
