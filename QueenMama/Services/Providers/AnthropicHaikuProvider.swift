import Foundation

/// Dedicated provider for Claude Haiku 4.5 - used as fallback in Non-Smart mode
final class AnthropicHaikuProvider: BaseAIProvider, AIProvider {
    let providerType: AIProviderType = .anthropic

    private let baseURL = "https://api.anthropic.com/v1/messages"
    private let model = "claude-haiku-4-5-20251001"  // Haiku 4.5 for fast, cost-effective responses
    private let apiVersion = "2023-06-01"

    var isConfigured: Bool {
        keychain.hasAPIKey(for: .anthropic)
    }

    func generateResponse(context: AIContext) async throws -> AIResponse {
        guard let apiKey = keychain.getAPIKey(for: .anthropic) else {
            throw AIProviderError.noAPIKey
        }

        let startTime = Date()

        let requestBody = try buildRequestBody(context: context, stream: false)

        let data = try await makeRequest(
            url: URL(string: baseURL)!,
            headers: [
                "x-api-key": apiKey,
                "anthropic-version": apiVersion,
                "Content-Type": "application/json"
            ],
            body: requestBody
        )

        let response = try JSONDecoder().decode(AnthropicHaikuResponse.self, from: data)

        guard let content = response.content?.first?.text else {
            throw AIProviderError.invalidResponse
        }

        let latencyMs = Int(Date().timeIntervalSince(startTime) * 1000)

        return AIResponse(
            type: context.responseType,
            content: content,
            provider: .anthropic,
            latencyMs: latencyMs
        )
    }

    func generateStreamingResponse(context: AIContext) -> AsyncThrowingStream<String, Error> {
        AsyncThrowingStream { continuation in
            Task {
                guard let apiKey = self.keychain.getAPIKey(for: .anthropic) else {
                    continuation.finish(throwing: AIProviderError.noAPIKey)
                    return
                }

                do {
                    let requestBody = try self.buildRequestBody(context: context, stream: true)

                    let request = self.createStreamingRequest(
                        url: URL(string: self.baseURL)!,
                        headers: [
                            "x-api-key": apiKey,
                            "anthropic-version": self.apiVersion,
                            "Content-Type": "application/json"
                        ],
                        body: requestBody
                    )

                    let (asyncBytes, response) = try await URLSession.shared.bytes(for: request)

                    guard let httpResponse = response as? HTTPURLResponse,
                          httpResponse.statusCode == 200 else {
                        continuation.finish(throwing: AIProviderError.invalidResponse)
                        return
                    }

                    for try await line in asyncBytes.lines {
                        if line.hasPrefix("data: ") {
                            let jsonString = String(line.dropFirst(6))

                            if let data = jsonString.data(using: .utf8),
                               let event = try? JSONDecoder().decode(AnthropicHaikuStreamEvent.self, from: data) {
                                if event.type == "content_block_delta",
                                   let delta = event.delta,
                                   delta.type == "text_delta",
                                   let text = delta.text {
                                    continuation.yield(text)
                                } else if event.type == "message_stop" {
                                    break
                                }
                            }
                        }
                    }

                    continuation.finish()
                } catch {
                    continuation.finish(throwing: error)
                }
            }
        }
    }

    // MARK: - Private Methods

    private func buildRequestBody(context: AIContext, stream: Bool) throws -> Data {
        var content: [[String: Any]] = []

        // Add text content
        content.append([
            "type": "text",
            "text": context.userMessage
        ])

        // Add image if present
        if let screenshot = context.screenshot {
            let base64Image = screenshot.base64EncodedString()
            content.insert([
                "type": "image",
                "source": [
                    "type": "base64",
                    "media_type": "image/jpeg",
                    "data": base64Image
                ]
            ], at: 0) // Image should come before text for Claude
        }

        let requestDict: [String: Any] = [
            "model": model,
            "max_tokens": 2048,  // Haiku uses standard token limit
            "system": context.systemPrompt,
            "messages": [
                ["role": "user", "content": content]
            ],
            "stream": stream
        ]

        return try JSONSerialization.data(withJSONObject: requestDict)
    }
}

// MARK: - Response Models

private struct AnthropicHaikuResponse: Codable {
    let id: String?
    let type: String?
    let role: String?
    let content: [ContentBlock]?
    let model: String?
    let stopReason: String?
    let stopSequence: String?
    let usage: Usage?

    enum CodingKeys: String, CodingKey {
        case id
        case type
        case role
        case content
        case model
        case stopReason = "stop_reason"
        case stopSequence = "stop_sequence"
        case usage
    }

    struct ContentBlock: Codable {
        let type: String?
        let text: String?
    }

    struct Usage: Codable {
        let inputTokens: Int?
        let outputTokens: Int?

        enum CodingKeys: String, CodingKey {
            case inputTokens = "input_tokens"
            case outputTokens = "output_tokens"
        }
    }
}

private struct AnthropicHaikuStreamEvent: Codable {
    let type: String?
    let index: Int?
    let delta: Delta?
    let contentBlock: ContentBlock?
    let message: AnthropicHaikuResponse?

    enum CodingKeys: String, CodingKey {
        case type
        case index
        case delta
        case contentBlock = "content_block"
        case message
    }

    struct Delta: Codable {
        let type: String?
        let text: String?
    }

    struct ContentBlock: Codable {
        let type: String?
        let text: String?
    }
}
