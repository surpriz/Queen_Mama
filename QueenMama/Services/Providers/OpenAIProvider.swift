import Foundation

final class OpenAIProvider: BaseAIProvider, AIProvider {
    let providerType: AIProviderType = .openai

    private let baseURL = "https://api.openai.com/v1/chat/completions"
    private let model = "gpt-4o"

    var isConfigured: Bool {
        keychain.hasAPIKey(for: .openai)
    }

    func generateResponse(context: AIContext) async throws -> AIResponse {
        guard let apiKey = keychain.getAPIKey(for: .openai) else {
            print("[OpenAI] No API key found in keychain!")
            throw AIProviderError.noAPIKey
        }

        print("[OpenAI] Using API key: \(apiKey.prefix(20))...")
        let startTime = Date()

        let requestBody = try buildRequestBody(context: context, stream: false)

        let data = try await makeRequest(
            url: URL(string: baseURL)!,
            headers: [
                "Authorization": "Bearer \(apiKey)",
                "Content-Type": "application/json"
            ],
            body: requestBody
        )

        let response = try JSONDecoder().decode(OpenAIResponse.self, from: data)

        guard let content = response.choices?.first?.message?.content else {
            throw AIProviderError.invalidResponse
        }

        let latencyMs = Int(Date().timeIntervalSince(startTime) * 1000)

        return AIResponse(
            type: context.responseType,
            content: content,
            provider: .openai,
            latencyMs: latencyMs
        )
    }

    func generateStreamingResponse(context: AIContext) -> AsyncThrowingStream<String, Error> {
        AsyncThrowingStream { continuation in
            Task {
                guard let apiKey = self.keychain.getAPIKey(for: .openai) else {
                    continuation.finish(throwing: AIProviderError.noAPIKey)
                    return
                }

                do {
                    let requestBody = try self.buildRequestBody(context: context, stream: true)

                    let request = self.createStreamingRequest(
                        url: URL(string: self.baseURL)!,
                        headers: [
                            "Authorization": "Bearer \(apiKey)",
                            "Content-Type": "application/json"
                        ],
                        body: requestBody
                    )

                    let (asyncBytes, response) = try await URLSession.shared.bytes(for: request)

                    guard let httpResponse = response as? HTTPURLResponse else {
                        print("[OpenAI] Invalid response type")
                        continuation.finish(throwing: AIProviderError.invalidResponse)
                        return
                    }

                    if httpResponse.statusCode != 200 {
                        // Try to read the error response
                        var errorBody = ""
                        for try await line in asyncBytes.lines {
                            errorBody += line
                        }
                        print("[OpenAI] Streaming error \(httpResponse.statusCode): \(errorBody.prefix(500))")
                        continuation.finish(throwing: AIProviderError.requestFailed(
                            NSError(domain: "HTTP", code: httpResponse.statusCode, userInfo: [NSLocalizedDescriptionKey: errorBody])
                        ))
                        return
                    }

                    for try await line in asyncBytes.lines {
                        if line.hasPrefix("data: ") {
                            let jsonString = String(line.dropFirst(6))

                            if jsonString == "[DONE]" {
                                break
                            }

                            if let data = jsonString.data(using: .utf8),
                               let chunk = try? JSONDecoder().decode(OpenAIStreamChunk.self, from: data),
                               let content = chunk.choices?.first?.delta?.content {
                                continuation.yield(content)
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
        var messages: [[String: Any]] = [
            ["role": "system", "content": context.systemPrompt]
        ]

        // Build user message
        if let screenshot = context.screenshot {
            // Vision request with image
            let base64Image = screenshot.base64EncodedString()
            messages.append([
                "role": "user",
                "content": [
                    ["type": "text", "text": context.userMessage],
                    [
                        "type": "image_url",
                        "image_url": ["url": "data:image/jpeg;base64,\(base64Image)"]
                    ]
                ]
            ])
        } else {
            messages.append(["role": "user", "content": context.userMessage])
        }

        let requestDict: [String: Any] = [
            "model": model,
            "messages": messages,
            "max_tokens": 2048,
            "temperature": 0.7,
            "stream": stream
        ]

        return try JSONSerialization.data(withJSONObject: requestDict)
    }
}

// MARK: - Response Models

private struct OpenAIResponse: Codable {
    let id: String?
    let object: String?
    let created: Int?
    let model: String?
    let choices: [Choice]?
    let usage: Usage?

    struct Choice: Codable {
        let index: Int?
        let message: Message?
        let finishReason: String?

        enum CodingKeys: String, CodingKey {
            case index
            case message
            case finishReason = "finish_reason"
        }
    }

    struct Message: Codable {
        let role: String?
        let content: String?
    }

    struct Usage: Codable {
        let promptTokens: Int?
        let completionTokens: Int?
        let totalTokens: Int?

        enum CodingKeys: String, CodingKey {
            case promptTokens = "prompt_tokens"
            case completionTokens = "completion_tokens"
            case totalTokens = "total_tokens"
        }
    }
}

private struct OpenAIStreamChunk: Codable {
    let id: String?
    let object: String?
    let created: Int?
    let model: String?
    let choices: [StreamChoice]?

    struct StreamChoice: Codable {
        let index: Int?
        let delta: Delta?
        let finishReason: String?

        enum CodingKeys: String, CodingKey {
            case index
            case delta
            case finishReason = "finish_reason"
        }
    }

    struct Delta: Codable {
        let role: String?
        let content: String?
    }
}
