import Foundation

// MARK: - AI Provider Protocol

protocol AIProvider: Sendable {
    var providerType: AIProviderType { get }
    var isConfigured: Bool { get }

    func generateResponse(context: AIContext) async throws -> AIResponse
    func generateStreamingResponse(context: AIContext) -> AsyncThrowingStream<String, Error>
}

// MARK: - AI Provider Errors

enum AIProviderError: LocalizedError {
    case notAuthenticated
    case requestFailed(Error)
    case invalidResponse
    case rateLimited
    case timeout
    case allProvidersFailed

    var errorDescription: String? {
        switch self {
        case .notAuthenticated:
            return "Please sign in to use AI features."
        case .requestFailed(let error):
            return "Request failed: \(error.localizedDescription)"
        case .invalidResponse:
            return "Invalid response from AI provider."
        case .rateLimited:
            return "Rate limited. Please try again later."
        case .timeout:
            return "Request timed out."
        case .allProvidersFailed:
            return "All AI providers failed. Please try again later."
        }
    }
}

// MARK: - Base HTTP Client

class BaseAIProvider {
    let timeoutSeconds: TimeInterval = 30

    func makeRequest(
        url: URL,
        method: String = "POST",
        headers: [String: String],
        body: Data?
    ) async throws -> Data {
        var request = URLRequest(url: url)
        request.httpMethod = method
        request.timeoutInterval = timeoutSeconds

        for (key, value) in headers {
            request.setValue(value, forHTTPHeaderField: key)
        }

        if let body {
            request.httpBody = body
        }

        let (data, response) = try await URLSession.shared.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse else {
            throw AIProviderError.invalidResponse
        }

        switch httpResponse.statusCode {
        case 200...299:
            return data
        case 429:
            throw AIProviderError.rateLimited
        default:
            let errorMessage = String(data: data, encoding: .utf8) ?? "Unknown error"
            throw AIProviderError.requestFailed(NSError(domain: "HTTP", code: httpResponse.statusCode, userInfo: [NSLocalizedDescriptionKey: errorMessage]))
        }
    }

    func createStreamingRequest(
        url: URL,
        headers: [String: String],
        body: Data?
    ) -> URLRequest {
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.timeoutInterval = 120 // Longer timeout for streaming

        for (key, value) in headers {
            request.setValue(value, forHTTPHeaderField: key)
        }

        if let body {
            request.httpBody = body
        }

        return request
    }
}

// MARK: - Message Types

struct ChatMessage: Codable {
    let role: String
    let content: MessageContent

    init(role: String, text: String) {
        self.role = role
        self.content = .text(text)
    }

    init(role: String, textAndImage: (text: String, imageData: Data)) {
        self.role = role
        self.content = .multipart([
            .text(textAndImage.text),
            .imageData(textAndImage.imageData)
        ])
    }
}

enum MessageContent: Codable {
    case text(String)
    case multipart([ContentPart])

    func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        switch self {
        case .text(let string):
            try container.encode(string)
        case .multipart(let parts):
            try container.encode(parts)
        }
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if let string = try? container.decode(String.self) {
            self = .text(string)
        } else if let parts = try? container.decode([ContentPart].self) {
            self = .multipart(parts)
        } else {
            throw DecodingError.dataCorrupted(
                DecodingError.Context(codingPath: decoder.codingPath, debugDescription: "Invalid content")
            )
        }
    }
}

enum ContentPart: Codable {
    case text(String)
    case imageData(Data)

    private enum CodingKeys: String, CodingKey {
        case type
        case text
        case imageUrl = "image_url"
    }

    private enum ImageURLKeys: String, CodingKey {
        case url
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .text(let string):
            try container.encode("text", forKey: .type)
            try container.encode(string, forKey: .text)
        case .imageData(let data):
            try container.encode("image_url", forKey: .type)
            var imageContainer = container.nestedContainer(keyedBy: ImageURLKeys.self, forKey: .imageUrl)
            let base64 = data.base64EncodedString()
            try imageContainer.encode("data:image/jpeg;base64,\(base64)", forKey: .url)
        }
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let type = try container.decode(String.self, forKey: .type)

        switch type {
        case "text":
            let text = try container.decode(String.self, forKey: .text)
            self = .text(text)
        default:
            throw DecodingError.dataCorrupted(
                DecodingError.Context(codingPath: decoder.codingPath, debugDescription: "Unknown content type")
            )
        }
    }
}
