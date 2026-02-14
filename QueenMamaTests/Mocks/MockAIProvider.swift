//
//  MockAIProvider.swift
//  QueenMamaTests
//
//  Mock implementation of AIProvider for unit testing.
//

import Foundation
@testable import QueenMama

final class MockAIProvider: AIProvider, @unchecked Sendable {
    let providerType: AIProviderType
    var isConfigured: Bool

    // Configurable behavior
    var responseToReturn: String = "Mock AI response"
    var errorToThrow: Error?
    var latencyMs: Int = 100
    var generateCallCount = 0
    var streamCallCount = 0
    var lastContext: AIContext?

    init(type: AIProviderType = .openai, configured: Bool = true) {
        self.providerType = type
        self.isConfigured = configured
    }

    func generateResponse(context: AIContext) async throws -> AIResponse {
        generateCallCount += 1
        lastContext = context

        if let error = errorToThrow {
            throw error
        }

        return AIResponse(
            type: context.responseType,
            content: responseToReturn,
            provider: providerType,
            latencyMs: latencyMs
        )
    }

    func generateStreamingResponse(context: AIContext) -> AsyncThrowingStream<String, Error> {
        streamCallCount += 1
        lastContext = context

        return AsyncThrowingStream { continuation in
            if let error = self.errorToThrow {
                continuation.finish(throwing: error)
                return
            }

            // Simulate streaming by yielding words
            let words = self.responseToReturn.split(separator: " ")
            for word in words {
                continuation.yield(String(word) + " ")
            }
            continuation.finish()
        }
    }

    func reset() {
        generateCallCount = 0
        streamCallCount = 0
        lastContext = nil
        errorToThrow = nil
    }
}
