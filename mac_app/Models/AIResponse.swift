import Foundation
import SwiftData

@Model
final class AIResponse: Identifiable {
    @Attribute(.unique) var id: UUID
    var typeRaw: String
    var content: String
    var timestamp: Date
    var providerRaw: String
    var latencyMs: Int?
    var isAutomatic: Bool  // Indicates auto-generated response from AutoAnswer

    init(
        id: UUID = UUID(),
        type: ResponseType,
        content: String,
        timestamp: Date = Date(),
        provider: AIProviderType,
        latencyMs: Int? = nil,
        isAutomatic: Bool = false
    ) {
        self.id = id
        self.typeRaw = type.rawValue
        self.content = content
        self.timestamp = timestamp
        self.providerRaw = provider.rawValue
        self.latencyMs = latencyMs
        self.isAutomatic = isAutomatic
    }

    /// Convenience initializer for automatic responses
    convenience init(
        automatic type: ResponseType,
        content: String,
        provider: AIProviderType
    ) {
        self.init(type: type, content: content, provider: provider, isAutomatic: true)
    }

    // Computed properties for easier access
    var type: ResponseType {
        ResponseType(rawValue: typeRaw) ?? .assist
    }

    var provider: AIProviderType {
        AIProviderType(rawValue: providerRaw) ?? .openai
    }

    enum ResponseType: String, CaseIterable {
        case assist = "Assist"
        case whatToSay = "What should I say?"
        case followUp = "Follow-up questions"
        case recap = "Recap"
        case custom = "Custom"

        var icon: String {
            switch self {
            case .assist: return "sparkles"
            case .whatToSay: return "text.bubble"
            case .followUp: return "questionmark.bubble"
            case .recap: return "arrow.counterclockwise"
            case .custom: return "bubble.left.and.bubble.right"
            }
        }

        var systemPromptAddition: String {
            switch self {
            case .assist:
                return """
                Help with what's on screen. If it's a question, give the answer. If it's code, explain or fix it.
                1-2 sentences max, bullets only if needed. Match the language of the content.
                """

            case .whatToSay:
                return """
                Give 2-3 short phrases the user can say right now. Keep each under 15 words.
                Match the language of the content.
                """

            case .followUp:
                return """
                Suggest 3 relevant follow-up questions. Keep them specific, not generic.
                Match the language of the content.
                """

            case .recap:
                return """
                Summarize the key points in 3-5 bullets max. Include any decisions or action items.
                Match the language of the content.
                """

            case .custom:
                return "Answer directly. Match the language of the content."
            }
        }
    }
}

enum AIProviderType: String, CaseIterable, Sendable {
    case anthropic = "Anthropic"
    case grok = "xAI Grok"
    case openai = "OpenAI"
    case gemini = "Google Gemini"

    var displayName: String { rawValue }

    var icon: String {
        switch self {
        case .anthropic: return "a.circle.fill"
        case .grok: return "x.circle.fill"
        case .openai: return "circle.hexagongrid.fill"
        case .gemini: return "g.circle.fill"
        }
    }
}

struct AIContext: @unchecked Sendable {
    let transcript: String
    let screenshot: Data?
    let mode: Mode?
    let responseType: AIResponse.ResponseType
    let customPrompt: String?
    let smartMode: Bool

    init(
        transcript: String,
        screenshot: Data? = nil,
        mode: Mode? = nil,
        responseType: AIResponse.ResponseType,
        customPrompt: String? = nil,
        smartMode: Bool = false
    ) {
        self.transcript = transcript
        self.screenshot = screenshot
        self.mode = mode
        self.responseType = responseType
        self.customPrompt = customPrompt
        self.smartMode = smartMode
    }

    var systemPrompt: String {
        var prompt = ""

        // Check if this is a custom mode (not one of the built-in modes)
        let isCustomMode: Bool
        if let mode = mode {
            let builtInNames = ["Default", "Professional", "Interview", "Sales"]
            isCustomMode = !builtInNames.contains(mode.name)
            print("[AIContext] Mode name: '\(mode.name)', isCustomMode: \(isCustomMode)")
            print("[AIContext] Mode systemPrompt (first 100 chars): '\(String(mode.systemPrompt.prefix(100)))'")
        } else {
            isCustomMode = false
            print("[AIContext] Mode is nil, using default")
        }

        if isCustomMode {
            // For custom modes, use ONLY the mode's system prompt
            // This allows users to have full control over AI behavior
            prompt = mode?.systemPrompt ?? Mode.defaultMode.systemPrompt
            print("[AIContext] Using CUSTOM mode logic - no responseType additions")

            // Add language instruction only (not the generic response type instructions)
            prompt += "\n\nIMPORTANT: Respond in the SAME LANGUAGE as the transcript or screen content. If French, respond in French."
        } else {
            // For built-in modes, use the traditional combination
            prompt = mode?.systemPrompt ?? Mode.defaultMode.systemPrompt
            prompt += "\n\n" + responseType.systemPromptAddition
            print("[AIContext] Using BUILT-IN mode logic with responseType: \(responseType.rawValue)")
        }

        // Smart Mode: Add enhanced reasoning instructions
        if smartMode {
            prompt += """


SMART MODE ENABLED: Please provide enhanced, thorough analysis:
- Think step-by-step before responding
- Consider multiple perspectives and implications
- Provide deeper insights and more nuanced recommendations
- Be more comprehensive in your response
"""
        }

        return prompt
    }

    var userMessage: String {
        var message = ""

        // Check if this is a custom mode (same logic as systemPrompt)
        let isCustomMode: Bool
        if let mode = mode {
            let builtInNames = ["Default", "Professional", "Interview", "Sales"]
            isCustomMode = !builtInNames.contains(mode.name)
        } else {
            isCustomMode = false
        }

        if !transcript.isEmpty {
            // Limit transcript to ~8000 chars (~2000 tokens) for cost optimization
            let maxTranscriptLength = 8000
            let truncatedTranscript: String

            if transcript.count > maxTranscriptLength {
                truncatedTranscript = "[...conversation précédente tronquée...]\n\n" +
                    String(transcript.suffix(maxTranscriptLength))
            } else {
                truncatedTranscript = transcript
            }

            message += "## Transcript:\n\(truncatedTranscript)\n\n"
        }

        if screenshot != nil {
            message += "[Screenshot attached - analyze it]\n\n"
        }

        if let customPrompt, !customPrompt.isEmpty {
            message += customPrompt
        } else if isCustomMode {
            message += "Help me with this."
        } else {
            // Keep it simple - the system prompt already has instructions
            switch responseType {
            case .assist:
                message += "Help me."
            case .whatToSay:
                message += "What should I say?"
            case .followUp:
                message += "What questions should I ask?"
            case .recap:
                message += "Summarize this."
            case .custom:
                message += "Help me."
            }
        }

        return message
    }
}
