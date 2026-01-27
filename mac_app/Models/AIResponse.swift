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
            let languageInstruction = "\n\nIMPORTANT: Respond in the SAME LANGUAGE as the content. French → French."

            switch self {
            case .assist:
                return """
                ## YOUR TASK: Provide ACTIONABLE help

                **If you see an EXAM QUESTION:**
                • Give the answer directly: "**Answer: [X]**"
                • Add 1-2 bullet explanation why
                • Cite relevant concepts/services

                **If you see CODE:**
                • Explain what it does or identify the bug
                • Provide fix if needed

                **If you see a DOCUMENT/FORM:**
                • Help complete it or explain requirements

                **If you see a CONVERSATION:**
                • Suggest what to say next
                • Identify key points to address

                ## FORMAT:
                • Use bullet points (•)
                • **Bold** important terms
                • Max 4-5 short bullets
                • NO walls of text
                • NO describing what you see - HELP instead
                """ + languageInstruction

            case .whatToSay:
                return """
                ## YOUR TASK: Give ready-to-use phrases

                Provide 2-3 options the user can say RIGHT NOW:

                **1.** "[Exact phrase to say]"

                **2.** "[Alternative phrase]"

                **3.** "[Different approach]"

                Keep each under 2 sentences. Natural, conversational tone.
                """ + languageInstruction

            case .followUp:
                return """
                ## YOUR TASK: Suggest follow-up questions

                Provide 3-4 relevant questions:

                **1.** [Open-ended question]

                **2.** [Clarifying question]

                **3.** [Strategic question]

                Make them specific to the context, not generic.
                """ + languageInstruction

            case .recap:
                return """
                ## YOUR TASK: Summarize key points

                **Points clés:**
                • [Key point 1]
                • [Key point 2]

                **Décisions:**
                • [Decision if any]

                **Actions:**
                • [Action item if any]

                Keep it scannable. Max 6-8 bullets total.
                """ + languageInstruction

            case .custom:
                return """
                Answer the user's specific question directly.
                Use bullet points for clarity.
                """ + languageInstruction
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
            message += "## Question: \(customPrompt)"
        } else if isCustomMode {
            // For custom modes, use minimal prompt
            if transcript.isEmpty && screenshot != nil {
                message += "Help me with what's on screen. Be direct and actionable."
            } else {
                message += "Help me with this. Be direct and actionable."
            }
        } else {
            // For built-in modes, use action-oriented prompts
            if transcript.isEmpty && screenshot != nil {
                // Screenshot-only mode: Be very direct
                switch responseType {
                case .assist:
                    message += "Look at this screenshot and HELP me. If it's a question, give me the answer. If it's code, explain or fix it. If it's a form, help me fill it. Be direct - don't describe what you see."
                case .whatToSay:
                    message += "Based on this screenshot, what should I say or respond?"
                case .followUp:
                    message += "Based on this screenshot, what questions should I ask?"
                case .recap:
                    message += "Summarize the key points from this screenshot."
                case .custom:
                    message += "Help me with this screenshot."
                }
            } else {
                // Has transcript
                switch responseType {
                case .assist:
                    message += "Help me with this conversation. What should I know or do?"
                case .whatToSay:
                    message += "What should I say next in this conversation?"
                case .followUp:
                    message += "What follow-up questions should I ask?"
                case .recap:
                    message += "Summarize the key points of this conversation."
                case .custom:
                    message += "Help me with this."
                }
            }
        }

        return message
    }
}
