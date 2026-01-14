import Foundation

final class GeminiProvider: BaseAIProvider, AIProvider {
    let providerType: AIProviderType = .gemini

    private let baseURL = "https://generativelanguage.googleapis.com/v1beta/models"
    private let standardModel = "gemini-2.0-flash"
    private let smartModel = "gemini-2.0-flash-thinking-exp"  // Experimental thinking model for Smart Mode

    private func getModel(for context: AIContext) -> String {
        context.smartMode ? smartModel : standardModel
    }

    /// Get optimized max_tokens based on response type
    private func getMaxTokens(for context: AIContext) -> Int {
        let baseTokens: Int
        switch context.responseType {
        case .assist:     baseTokens = 1024
        case .whatToSay:  baseTokens = 512
        case .followUp:   baseTokens = 512
        case .recap:      baseTokens = 1536
        case .custom:     baseTokens = 1024
        }
        // Smart mode gets 50% more (not 2x) for cost efficiency
        return context.smartMode ? Int(Double(baseTokens) * 1.5) : baseTokens
    }

    var isConfigured: Bool {
        keychain.hasAPIKey(for: .gemini)
    }

    func generateResponse(context: AIContext) async throws -> AIResponse {
        guard let apiKey = keychain.getAPIKey(for: .gemini) else {
            throw AIProviderError.noAPIKey
        }

        let startTime = Date()

        let requestBody = try buildRequestBody(context: context)
        let url = URL(string: "\(baseURL)/\(getModel(for: context)):generateContent?key=\(apiKey)")!

        let data = try await makeRequest(
            url: url,
            headers: [
                "Content-Type": "application/json"
            ],
            body: requestBody
        )

        let response = try JSONDecoder().decode(GeminiResponse.self, from: data)

        guard let content = response.candidates?.first?.content?.parts?.first?.text else {
            throw AIProviderError.invalidResponse
        }

        let latencyMs = Int(Date().timeIntervalSince(startTime) * 1000)

        return AIResponse(
            type: context.responseType,
            content: content,
            provider: .gemini,
            latencyMs: latencyMs
        )
    }

    func generateStreamingResponse(context: AIContext) -> AsyncThrowingStream<String, Error> {
        AsyncThrowingStream { continuation in
            Task {
                guard let apiKey = self.keychain.getAPIKey(for: .gemini) else {
                    continuation.finish(throwing: AIProviderError.noAPIKey)
                    return
                }

                do {
                    let requestBody = try self.buildRequestBody(context: context)
                    let url = URL(string: "\(self.baseURL)/\(self.getModel(for: context)):streamGenerateContent?key=\(apiKey)&alt=sse")!

                    let request = self.createStreamingRequest(
                        url: url,
                        headers: [
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
                               let chunk = try? JSONDecoder().decode(GeminiResponse.self, from: data),
                               let text = chunk.candidates?.first?.content?.parts?.first?.text {
                                continuation.yield(text)
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

    private func buildRequestBody(context: AIContext) throws -> Data {
        var parts: [[String: Any]] = []

        // Add system prompt as first part
        parts.append(["text": context.systemPrompt + "\n\n" + context.userMessage])

        // Add image if present
        if let screenshot = context.screenshot {
            let base64Image = screenshot.base64EncodedString()
            parts.insert([
                "inline_data": [
                    "mime_type": "image/jpeg",
                    "data": base64Image
                ]
            ], at: 0)
        }

        let requestDict: [String: Any] = [
            "contents": [
                ["parts": parts]
            ],
            "generationConfig": [
                "maxOutputTokens": getMaxTokens(for: context),
                "temperature": context.smartMode ? 0.5 : 0.7  // More deterministic for Smart Mode
            ],
            "safetySettings": [
                ["category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_NONE"],
                ["category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "BLOCK_NONE"],
                ["category": "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold": "BLOCK_NONE"],
                ["category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "BLOCK_NONE"]
            ]
        ]

        return try JSONSerialization.data(withJSONObject: requestDict)
    }
}

// MARK: - Response Models

private struct GeminiResponse: Codable {
    let candidates: [Candidate]?
    let usageMetadata: UsageMetadata?
    let modelVersion: String?

    struct Candidate: Codable {
        let content: Content?
        let finishReason: String?
        let safetyRatings: [SafetyRating]?
    }

    struct Content: Codable {
        let parts: [Part]?
        let role: String?
    }

    struct Part: Codable {
        let text: String?
    }

    struct SafetyRating: Codable {
        let category: String?
        let probability: String?
    }

    struct UsageMetadata: Codable {
        let promptTokenCount: Int?
        let candidatesTokenCount: Int?
        let totalTokenCount: Int?
    }
}
