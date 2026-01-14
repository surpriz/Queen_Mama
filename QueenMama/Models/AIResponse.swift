import Foundation

struct AIResponse: Identifiable, Equatable {
    let id: UUID
    let type: ResponseType
    let content: String
    let timestamp: Date
    let provider: AIProviderType
    let latencyMs: Int?

    init(
        id: UUID = UUID(),
        type: ResponseType,
        content: String,
        timestamp: Date = Date(),
        provider: AIProviderType,
        latencyMs: Int? = nil
    ) {
        self.id = id
        self.type = type
        self.content = content
        self.timestamp = timestamp
        self.provider = provider
        self.latencyMs = latencyMs
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
            let languageInstruction = "\n\nIMPORTANT: Respond in the SAME LANGUAGE as the transcript or screen content. If French, respond in French."

            switch self {
            case .assist:
                return """
                Provide general guidance and help understanding the current conversation or screen content.
                Analyze both the transcript (if available) and screen content to give contextual advice.
                Be helpful but concise.
                """ + languageInstruction
            case .whatToSay:
                return """
                Generate specific phrases the user can say right now.
                Provide 2-3 natural, conversational options.
                Each suggestion should be ready to use verbatim.
                Format as a numbered list.
                """ + languageInstruction
            case .followUp:
                return """
                Suggest 3-5 follow-up questions the user could ask.
                Questions should be relevant to the current conversation or screen content.
                Make them open-ended to encourage discussion.
                Format as a numbered list.
                """ + languageInstruction
            case .recap:
                return """
                Provide a concise summary of the conversation or screen content so far.
                Include:
                - Key points discussed or visible
                - Decisions made
                - Action items identified
                - Any important details mentioned
                Format with clear sections.
                """ + languageInstruction
            case .custom:
                return languageInstruction
            }
        }
    }
}

enum AIProviderType: String, CaseIterable {
    case openai = "OpenAI"
    case anthropic = "Anthropic"
    case gemini = "Google Gemini"

    var displayName: String { rawValue }

    var icon: String {
        switch self {
        case .openai: return "circle.hexagongrid.fill"
        case .anthropic: return "a.circle.fill"
        case .gemini: return "g.circle.fill"
        }
    }
}

struct AIContext {
    let transcript: String
    let screenshot: Data?
    let mode: Mode?
    let responseType: AIResponse.ResponseType
    let customPrompt: String?

    var systemPrompt: String {
        var prompt = mode?.systemPrompt ?? Mode.defaultMode.systemPrompt
        prompt += "\n\n" + responseType.systemPromptAddition
        return prompt
    }

    var userMessage: String {
        var message = ""

        if !transcript.isEmpty {
            message += "## Current Conversation Transcript:\n\(transcript)\n\n"
        }

        if screenshot != nil {
            message += "[Screenshot of current screen is attached - analyze it carefully]\n\n"
        }

        if let customPrompt, !customPrompt.isEmpty {
            message += "## User's Question:\n\(customPrompt)"
        } else {
            if transcript.isEmpty && screenshot != nil {
                message += "Analyze the screenshot and provide \(responseType.rawValue.lowercased()) based on what you see."
            } else {
                message += "Based on the above context, please provide \(responseType.rawValue.lowercased())."
            }
        }

        return message
    }
}
