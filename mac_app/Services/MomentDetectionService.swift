//
//  MomentDetectionService.swift
//  QueenMama
//
//  Service for detecting conversation moments that should trigger proactive AI suggestions.
//  Implements pattern-based detection for objections, questions, hesitations, and closing opportunities.
//

import Foundation

@MainActor
final class MomentDetectionService {
    static let shared = MomentDetectionService()

    // MARK: - Configuration

    /// Minimum confidence required to trigger a moment
    var minConfidence: Float = 0.6

    /// Patterns for each moment type (supports both French and English)
    private let patterns: [ConversationMoment: [String]] = [
        .objection: [
            // French patterns
            "trop cher", "trop coûteux", "pas le budget", "budget limité",
            "hors budget", "on ne peut pas", "c'est cher", "prix élevé",
            "concurrent", "la concurrence", "autre solution", "déjà une solution",
            "pas le moment", "pas maintenant", "pas prioritaire", "plus tard",
            "je dois réfléchir", "j'hésite", "pas convaincu", "pourquoi vous",
            "trop complexe", "trop compliqué", "ça prend du temps",
            // English patterns
            "too expensive", "can't afford", "over budget", "budget concerns",
            "competitor", "competition", "already have", "existing solution",
            "not the right time", "not now", "later", "need to think",
            "not convinced", "why you", "too complex", "takes too long"
        ],

        .expertiseQuestion: [
            // French patterns
            "comment ça", "comment fonctionne", "comment marche", "expliquez",
            "pourquoi", "c'est quoi", "qu'est-ce que", "pouvez-vous expliquer",
            "techniquement", "concrètement", "en pratique", "comment faire",
            "quel est le", "quelle est la", "quels sont",
            // English patterns
            "how does", "how do you", "can you explain", "explain how",
            "why is", "what is", "what are", "technically",
            "in practice", "specifically", "concretely"
        ],

        .hesitation: [
            // French patterns
            "euh", "hmm", "hein", "je sais pas", "je ne sais pas",
            "pas sûr", "pas certain", "je suppose", "peut-être",
            "comment dire", "enfin", "c'est-à-dire", "en fait",
            "bonne question", "laissez-moi", "attendez", "un instant",
            // English patterns
            "umm", "uh", "hmm", "I don't know", "not sure",
            "I guess", "maybe", "perhaps", "let me think",
            "good question", "hold on", "wait", "one moment"
        ],

        .closingOpportunity: [
            // French patterns
            "d'accord", "ok ça marche", "ça m'intéresse", "intéressant",
            "on peut faire", "on peut commencer", "prochaine étape",
            "next steps", "comment on procède", "qu'est-ce qu'il faut",
            "quand peut-on", "quand pourrait-on", "on démarre", "je signe",
            "envoyez-moi", "envoie-moi", "je prends", "on y va",
            // English patterns
            "okay", "sounds good", "I'm interested", "interesting",
            "let's do it", "next steps", "what's next", "how do we proceed",
            "when can we", "let's start", "I'll take", "send me",
            "sign me up", "let's go", "ready to"
        ]
    ]

    // MARK: - Detected Moment

    struct DetectedMoment {
        let type: ConversationMoment
        let confidence: Float
        let triggerPhrase: String
        let timestamp: Date

        var isSignificant: Bool {
            confidence >= 0.6
        }
    }

    // MARK: - Conversation Moment Types

    enum ConversationMoment: String, CaseIterable {
        case objection
        case expertiseQuestion
        case hesitation
        case closingOpportunity
        case generic

        var suggestedResponseType: AIResponse.ResponseType {
            switch self {
            case .objection: return .whatToSay
            case .expertiseQuestion: return .assist
            case .hesitation: return .whatToSay
            case .closingOpportunity: return .whatToSay
            case .generic: return .assist
            }
        }

        var icon: String {
            switch self {
            case .objection: return "exclamationmark.triangle.fill"
            case .expertiseQuestion: return "questionmark.circle.fill"
            case .hesitation: return "ellipsis.bubble.fill"
            case .closingOpportunity: return "checkmark.seal.fill"
            case .generic: return "sparkles"
            }
        }

        var label: String {
            switch self {
            case .objection: return "OBJECTION"
            case .expertiseQuestion: return "QUESTION"
            case .hesitation: return "HESITATION"
            case .closingOpportunity: return "CLOSING"
            case .generic: return "ASSIST"
            }
        }

        var color: (red: Double, green: Double, blue: Double) {
            switch self {
            case .objection: return (1.0, 0.3, 0.3)      // Red
            case .expertiseQuestion: return (0.3, 0.6, 1.0) // Blue
            case .hesitation: return (1.0, 0.8, 0.3)     // Yellow
            case .closingOpportunity: return (0.3, 0.9, 0.5) // Green
            case .generic: return (0.7, 0.5, 1.0)       // Purple
            }
        }

        var promptAddition: String {
            switch self {
            case .objection:
                return """

                CONTEXT: An OBJECTION has been detected in the conversation.
                The other party expressed concerns about price, competition, timing, or complexity.

                RESPONSE STRATEGY:
                1. First, acknowledge and validate their concern with empathy
                2. Then provide a thoughtful counter-argument or alternative perspective
                3. Use the user's knowledge base (if available) for proven responses
                4. Keep the tone professional and non-defensive
                """

            case .expertiseQuestion:
                return """

                CONTEXT: An EXPERTISE QUESTION has been asked.
                The other party wants a detailed, technical, or factual explanation.

                RESPONSE STRATEGY:
                1. Provide a clear, accurate, and comprehensive answer
                2. Use concrete examples when possible
                3. Structure the response for easy understanding
                4. Leverage any relevant knowledge atoms for domain expertise
                """

            case .hesitation:
                return """

                CONTEXT: HESITATION detected in the user's speech.
                They seem unsure about what to say or how to respond.

                RESPONSE STRATEGY:
                1. Provide clear, confident talking points
                2. Suggest a way to clarify or redirect the conversation
                3. Offer reassurance if appropriate
                4. Keep suggestions natural and conversational
                """

            case .closingOpportunity:
                return """

                CONTEXT: A CLOSING OPPORTUNITY has been identified.
                The other party is showing interest and may be ready to commit.

                RESPONSE STRATEGY:
                1. Strike while the iron is hot - suggest a clear call-to-action
                2. Propose concrete next steps (meeting, trial, contract)
                3. Create a sense of forward momentum
                4. Don't oversell - keep it confident but not pushy
                """

            case .generic:
                return ""
            }
        }
    }

    private init() {}

    // MARK: - Detection

    /// Detect conversation moments in the given text
    /// - Parameters:
    ///   - text: The transcript text to analyze
    ///   - minConfidence: Minimum confidence threshold (default: 0.6)
    /// - Returns: The detected moment with highest confidence, or nil if none found
    func detect(in text: String, minConfidence: Float? = nil) -> DetectedMoment? {
        let threshold = minConfidence ?? self.minConfidence
        let lowercasedText = text.lowercased()

        // Only analyze the recent part of the conversation (last ~500 chars)
        let recentText = String(lowercasedText.suffix(500))

        var bestMatch: DetectedMoment?

        // Check each moment type
        for moment in ConversationMoment.allCases where moment != .generic {
            guard let momentPatterns = patterns[moment] else { continue }

            let result = calculateConfidence(
                text: recentText,
                patterns: momentPatterns
            )

            if result.confidence >= threshold {
                if bestMatch == nil || result.confidence > bestMatch!.confidence {
                    bestMatch = DetectedMoment(
                        type: moment,
                        confidence: result.confidence,
                        triggerPhrase: result.matchedPhrase,
                        timestamp: Date()
                    )
                }
            }
        }

        return bestMatch
    }

    /// Detect all moments above threshold (for debugging/analytics)
    func detectAll(in text: String, minConfidence: Float? = nil) -> [DetectedMoment] {
        let threshold = minConfidence ?? self.minConfidence
        let lowercasedText = text.lowercased()
        let recentText = String(lowercasedText.suffix(500))

        var moments: [DetectedMoment] = []

        for moment in ConversationMoment.allCases where moment != .generic {
            guard let momentPatterns = patterns[moment] else { continue }

            let result = calculateConfidence(
                text: recentText,
                patterns: momentPatterns
            )

            if result.confidence >= threshold {
                moments.append(DetectedMoment(
                    type: moment,
                    confidence: result.confidence,
                    triggerPhrase: result.matchedPhrase,
                    timestamp: Date()
                ))
            }
        }

        return moments.sorted { $0.confidence > $1.confidence }
    }

    // MARK: - Private Methods

    private func calculateConfidence(
        text: String,
        patterns: [String]
    ) -> (confidence: Float, matchedPhrase: String) {
        var matchCount = 0
        var bestMatch = ""

        for pattern in patterns {
            if text.contains(pattern.lowercased()) {
                matchCount += 1
                if pattern.count > bestMatch.count {
                    bestMatch = pattern
                }
            }
        }

        // Calculate confidence based on match ratio with diminishing returns
        // 1 match = 0.6, 2 matches = 0.75, 3+ matches = 0.85+
        let baseConfidence: Float
        switch matchCount {
        case 0:
            baseConfidence = 0.0
        case 1:
            baseConfidence = 0.6
        case 2:
            baseConfidence = 0.75
        case 3:
            baseConfidence = 0.85
        default:
            baseConfidence = min(0.95, 0.85 + Float(matchCount - 3) * 0.03)
        }

        // Boost confidence if the match is recent (in the last 100 chars)
        let veryRecentText = String(text.suffix(100))
        if !bestMatch.isEmpty && veryRecentText.contains(bestMatch.lowercased()) {
            return (min(0.98, baseConfidence + 0.1), bestMatch)
        }

        return (baseConfidence, bestMatch)
    }

    /// Extract the sentence containing the trigger phrase for display
    func extractTriggerContext(from text: String, trigger: String, maxLength: Int = 80) -> String {
        let lowercasedText = text.lowercased()
        guard let range = lowercasedText.range(of: trigger.lowercased()) else {
            return trigger
        }

        // Find sentence boundaries
        let startIndex = text.index(range.lowerBound, offsetBy: -min(40, text.distance(from: text.startIndex, to: range.lowerBound)))
        let endIndex = text.index(range.upperBound, offsetBy: min(40, text.distance(from: range.upperBound, to: text.endIndex)))

        var excerpt = String(text[startIndex..<endIndex])

        // Clean up
        excerpt = excerpt.trimmingCharacters(in: .whitespacesAndNewlines)

        if excerpt.count > maxLength {
            excerpt = String(excerpt.prefix(maxLength)) + "..."
        }

        // Add ellipsis if not at sentence start
        if startIndex != text.startIndex && !excerpt.hasPrefix("...") {
            excerpt = "..." + excerpt
        }

        return excerpt
    }
}
