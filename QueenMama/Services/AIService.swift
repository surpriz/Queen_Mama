import Foundation
import Combine
import SwiftData

@MainActor
final class AIService: ObservableObject {
    // MARK: - Published Properties

    @Published var isProcessing = false
    @Published var currentResponse = ""
    @Published var lastProvider: AIProviderType?
    @Published var errorMessage: String?
    @Published var responses: [AIResponse] = []

    // SwiftData
    var modelContext: ModelContext?

    // MARK: - Providers

    private let openAIProvider = OpenAIProvider()
    private let anthropicProvider = AnthropicProvider()
    private let geminiProvider = GeminiProvider()

    private var providers: [AIProvider] {
        [openAIProvider, anthropicProvider, geminiProvider]
    }

    private var configuredProviders: [AIProvider] {
        providers.filter { $0.isConfigured }
    }

    // MARK: - Initialization

    init() {}

    func loadHistory(from context: ModelContext) {
        self.modelContext = context

        // Load persisted responses
        let descriptor = FetchDescriptor<AIResponse>(
            sortBy: [SortDescriptor(\.timestamp, order: .reverse)]
        )

        do {
            responses = try context.fetch(descriptor)
            print("[AIService] Loaded \(responses.count) responses from history")
        } catch {
            print("[AIService] Failed to load history: \(error)")
        }
    }

    func clearHistory() {
        // Clear in-memory responses
        responses.removeAll()
        currentResponse = ""

        // Clear persisted responses
        if let context = modelContext {
            do {
                try context.delete(model: AIResponse.self)
                try context.save()
                print("[AIService] Cleared all response history")
            } catch {
                print("[AIService] Failed to clear history: \(error)")
            }
        }
    }

    // MARK: - Public Methods

    func hasConfiguredProviders() -> Bool {
        !configuredProviders.isEmpty
    }

    func generateResponse(
        transcript: String,
        screenshot: Data? = nil,
        mode: Mode? = nil,
        type: AIResponse.ResponseType,
        customPrompt: String? = nil,
        smartMode: Bool? = nil
    ) async throws -> AIResponse {
        isProcessing = true
        currentResponse = ""
        errorMessage = nil

        defer { isProcessing = false }

        let context = AIContext(
            transcript: transcript,
            screenshot: screenshot,
            mode: mode,
            responseType: type,
            customPrompt: customPrompt,
            smartMode: smartMode ?? ConfigurationManager.shared.smartModeEnabled
        )

        // Try each configured provider in order
        var lastError: Error?

        for provider in configuredProviders {
            do {
                let response = try await provider.generateResponse(context: context)
                lastProvider = provider.providerType
                responses.insert(response, at: 0)
                return response
            } catch {
                lastError = error
                print("Provider \(provider.providerType.displayName) failed: \(error)")
                continue
            }
        }

        throw lastError ?? AIProviderError.allProvidersFailed
    }

    func generateStreamingResponse(
        transcript: String,
        screenshot: Data? = nil,
        mode: Mode? = nil,
        type: AIResponse.ResponseType,
        customPrompt: String? = nil,
        smartMode: Bool? = nil
    ) -> AsyncThrowingStream<String, Error> {
        AsyncThrowingStream { continuation in
            Task { @MainActor in
                let isSmartMode = smartMode ?? ConfigurationManager.shared.smartModeEnabled
                print("[AIService] Starting streaming response for type: \(type.rawValue)")
                print("[AIService] Smart Mode: \(isSmartMode)")
                print("[AIService] Configured providers: \(self.configuredProviders.map { $0.providerType.displayName })")
                print("[AIService] Transcript length: \(transcript.count) chars")

                self.isProcessing = true
                self.currentResponse = ""
                self.errorMessage = nil

                let context = AIContext(
                    transcript: transcript,
                    screenshot: screenshot,
                    mode: mode,
                    responseType: type,
                    customPrompt: customPrompt,
                    smartMode: isSmartMode
                )

                var succeeded = false

                for provider in self.configuredProviders {
                    print("[AIService] Trying provider: \(provider.providerType.displayName)")
                    do {
                        for try await chunk in provider.generateStreamingResponse(context: context) {
                            self.currentResponse += chunk
                            continuation.yield(chunk)
                        }
                        self.lastProvider = provider.providerType
                        succeeded = true
                        print("[AIService] Successfully completed with \(provider.providerType.displayName)")
                        print("[AIService] Response length: \(self.currentResponse.count) chars")
                        print("[AIService] Response preview: \(self.currentResponse.prefix(200))...")

                        // Save completed response
                        let response = AIResponse(
                            type: type,
                            content: self.currentResponse,
                            provider: provider.providerType
                        )
                        self.responses.insert(response, at: 0)

                        // Persist to SwiftData
                        if let context = self.modelContext {
                            context.insert(response)
                            try? context.save()
                        }
                        break
                    } catch {
                        print("[AIService] Streaming provider \(provider.providerType.displayName) failed: \(error)")
                        self.currentResponse = ""
                        continue
                    }
                }

                self.isProcessing = false

                if succeeded {
                    continuation.finish()
                } else {
                    continuation.finish(throwing: AIProviderError.allProvidersFailed)
                }
            }
        }
    }

    // MARK: - Convenience Methods

    func assist(transcript: String, screenshot: Data?, mode: Mode?) async throws -> AIResponse {
        try await generateResponse(
            transcript: transcript,
            screenshot: screenshot,
            mode: mode,
            type: .assist
        )
    }

    func whatToSay(transcript: String, screenshot: Data?, mode: Mode?) async throws -> AIResponse {
        try await generateResponse(
            transcript: transcript,
            screenshot: screenshot,
            mode: mode,
            type: .whatToSay
        )
    }

    func followUpQuestions(transcript: String, screenshot: Data?, mode: Mode?) async throws -> AIResponse {
        try await generateResponse(
            transcript: transcript,
            screenshot: screenshot,
            mode: mode,
            type: .followUp
        )
    }

    func recap(transcript: String, screenshot: Data?, mode: Mode?) async throws -> AIResponse {
        try await generateResponse(
            transcript: transcript,
            screenshot: screenshot,
            mode: mode,
            type: .recap
        )
    }

    func askCustomQuestion(
        question: String,
        transcript: String,
        screenshot: Data?,
        mode: Mode?
    ) async throws -> AIResponse {
        try await generateResponse(
            transcript: transcript,
            screenshot: screenshot,
            mode: mode,
            type: .custom,
            customPrompt: question
        )
    }

    // MARK: - Streaming Convenience Methods

    func assistStreaming(transcript: String, screenshot: Data?, mode: Mode?) -> AsyncThrowingStream<String, Error> {
        generateStreamingResponse(
            transcript: transcript,
            screenshot: screenshot,
            mode: mode,
            type: .assist
        )
    }

    func whatToSayStreaming(transcript: String, screenshot: Data?, mode: Mode?) -> AsyncThrowingStream<String, Error> {
        generateStreamingResponse(
            transcript: transcript,
            screenshot: screenshot,
            mode: mode,
            type: .whatToSay
        )
    }

    // MARK: - History Management

    func clearResponses() {
        responses.removeAll()
        currentResponse = ""

        // Clear from SwiftData
        if let context = modelContext {
            do {
                try context.delete(model: AIResponse.self)
                try context.save()
                print("[AIService] Cleared all responses from history")
            } catch {
                print("[AIService] Failed to clear history: \(error)")
            }
        }
    }

    func getResponse(by id: UUID) -> AIResponse? {
        responses.first { $0.id == id }
    }

    // MARK: - Export

    func exportToMarkdown() -> String {
        var markdown = "# Queen Mama - AI Response History\n\n"
        markdown += "Exported on \(Date().formatted(date: .long, time: .shortened))\n\n"
        markdown += "---\n\n"

        for response in responses.reversed() {
            let formatter = DateFormatter()
            formatter.dateStyle = .medium
            formatter.timeStyle = .short

            markdown += "## \(response.type.rawValue)\n\n"
            markdown += "**Time:** \(formatter.string(from: response.timestamp))  \n"
            markdown += "**Provider:** \(response.provider.displayName)  \n"
            if let latency = response.latencyMs {
                markdown += "**Latency:** \(latency)ms  \n"
            }
            markdown += "\n"
            markdown += response.content
            markdown += "\n\n---\n\n"
        }

        return markdown
    }
}
