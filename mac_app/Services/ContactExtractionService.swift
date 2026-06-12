//
//  ContactExtractionService.swift
//  QueenMama
//
//  Memory Palace: AI-powered contact information extraction from transcripts
//

import Foundation

/// Notification posted when contact extraction is available after a session
extension Notification.Name {
    static let contactExtractionAvailable = Notification.Name("contactExtractionAvailable")
}

/// Service for extracting contact information from session transcripts using AI
@MainActor
final class ContactExtractionService {
    static let shared = ContactExtractionService()

    private let proxyClient = ProxyAPIClient.shared
    private let configManager = ProxyConfigManager.shared

    /// Minimum transcript length required for extraction
    private let minimumTranscriptLength = 100

    /// Confidence threshold for suggesting contact extraction
    private let confidenceThreshold: Float = 0.7

    private init() {}

    // MARK: - Extracted Contact Data

    struct ExtractedContact: Equatable {
        var firstName: String?
        var lastName: String?
        var email: String?
        var company: String?
        var role: String?
        var confidence: Float
        var suggestedNotes: [String]

        /// Check if we have enough data to suggest creating a contact
        var isViable: Bool {
            confidence >= 0.7 && firstName != nil && !firstName!.isEmpty
        }
    }

    // MARK: - Extraction

    /// Extract contact information from a transcript using AI
    /// Returns nil if extraction fails or no viable contact data found
    func extractFromTranscript(_ transcript: String) async -> ExtractedContact? {
        // Validate transcript length
        guard transcript.count >= minimumTranscriptLength else {
            print("[ContactExtraction] Transcript too short (\(transcript.count) chars)")
            return nil
        }

        // Check authentication
        guard AuthenticationManager.shared.isAuthenticated else {
            print("[ContactExtraction] Not authenticated")
            return nil
        }

        // Check if we have an AI provider available
        guard configManager.availableAIProviders.count > 0 else {
            print("[ContactExtraction] No AI provider available")
            return nil
        }

        do {
            let prompt = buildExtractionPrompt(transcript: transcript)
            let response = try await proxyClient.generateAIResponse(
                provider: configManager.availableAIProviders.first ?? "openai",
                smartMode: false,
                systemPrompt: extractionSystemPrompt,
                userMessage: prompt,
                screenshot: nil,
                maxTokens: 1000
            )

            return parseExtractionResponse(response.content)
        } catch {
            print("[ContactExtraction] AI extraction failed: \(error)")
            return nil
        }
    }

    // MARK: - Prompt Building

    private var extractionSystemPrompt: String {
        """
        You are a contact extraction assistant. Your role is to analyze conversation transcripts (in any language) and extract the contact information of the other party.

        RULES:
        1. Extract ONLY information explicitly mentioned in the conversation
        2. NEVER invent or guess information
        3. If a piece of information is not mentioned, leave the field empty
        4. Rate your confidence (0.0 to 1.0) based on how clear the found information is
        5. Suggest relevant notes based on the conversation content
        6. Write the suggested notes in the SAME LANGUAGE as the conversation

        RESPOND ONLY IN JSON with this exact format:
        {
            "firstName": "string or null",
            "lastName": "string or null",
            "email": "string or null",
            "company": "string or null",
            "role": "string or null",
            "confidence": 0.0-1.0,
            "suggestedNotes": ["note1", "note2"]
        }
        """
    }

    private func buildExtractionPrompt(transcript: String) -> String {
        // Limit transcript to last 5000 characters for cost efficiency
        let trimmedTranscript = String(transcript.suffix(5000))

        return """
        Analyze this transcript and extract the other party's contact information:

        ---
        \(trimmedTranscript)
        ---

        Extract the information as JSON.
        """
    }

    // MARK: - Response Parsing

    private func parseExtractionResponse(_ response: String) -> ExtractedContact? {
        // Try to extract JSON from the response
        guard let jsonString = extractJSON(from: response),
              let data = jsonString.data(using: .utf8) else {
            print("[ContactExtraction] Could not find JSON in response")
            return nil
        }

        do {
            let decoded = try JSONDecoder().decode(ExtractionResponse.self, from: data)

            let extracted = ExtractedContact(
                firstName: decoded.firstName?.nilIfEmpty,
                lastName: decoded.lastName?.nilIfEmpty,
                email: decoded.email?.nilIfEmpty,
                company: decoded.company?.nilIfEmpty,
                role: decoded.role?.nilIfEmpty,
                confidence: decoded.confidence,
                suggestedNotes: decoded.suggestedNotes ?? []
            )

            // Log extraction result
            if extracted.isViable {
                print("[ContactExtraction] Viable contact found: \(extracted.firstName ?? "") \(extracted.lastName ?? "") (confidence: \(extracted.confidence))")
            } else {
                print("[ContactExtraction] No viable contact (confidence: \(extracted.confidence), firstName: \(extracted.firstName ?? "nil"))")
            }

            return extracted
        } catch {
            print("[ContactExtraction] JSON decode error: \(error)")
            return nil
        }
    }

    private func extractJSON(from text: String) -> String? {
        // Try to find JSON object in the response
        if let startIndex = text.firstIndex(of: "{"),
           let endIndex = text.lastIndex(of: "}") {
            return String(text[startIndex...endIndex])
        }
        return nil
    }

    // MARK: - Response Model

    private struct ExtractionResponse: Decodable {
        let firstName: String?
        let lastName: String?
        let email: String?
        let company: String?
        let role: String?
        let confidence: Float
        let suggestedNotes: [String]?
    }
}

// MARK: - String Extension

private extension String {
    var nilIfEmpty: String? {
        let trimmed = self.trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? nil : trimmed
    }
}
