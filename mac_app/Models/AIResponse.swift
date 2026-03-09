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

        var localizedName: String {
            switch self {
            case .assist: return String(localized: "response.type.assist")
            case .whatToSay: return String(localized: "response.type.whatToSay")
            case .followUp: return String(localized: "response.type.followUp")
            case .recap: return String(localized: "response.type.recap")
            case .custom: return String(localized: "response.type.custom")
            }
        }

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
            // Language instruction added to ALL response types for consistency
            let languageInstruction = """

                CRITICAL LANGUAGE RULE:
                - Detect the language of the transcript/screen content.
                - Your ENTIRE response — including the very FIRST word, headers, intros, and all text — MUST be in that SAME language.
                - French content → 100% French response from start to finish. NO English preamble, NO English intro sentence.
                - English content → 100% English response from start to finish.
                - NEVER mix languages. NEVER start in one language and switch to another.
                - NEVER refuse to help. NEVER say "I can't help with that."
                """

            switch self {
            case .assist:
                return """
                You are a coaching assistant whispering actionable advice. The user needs help RIGHT NOW.
                PRIORITY ORDER for providing help:
                1. FIRST: Answer based on the TRANSCRIPT/CONVERSATION if the question relates to what was discussed
                2. SECOND: Use your general knowledge to answer questions (like explaining terms, concepts, etc.)
                3. THIRD: Only reference the screenshot if the question is specifically about visual elements on screen

                COACHING RULES:
                - Always tell the user what to DO, not just what IS
                - Include the specific next action (e.g. "send a message to...", "click on...", "reply saying...")
                - When relevant, suggest exact words to say or write in quotes, ready to copy
                - If there are multiple steps, give them in order
                - Anticipate what comes after and prepare the user for the next move
                Keep responses concise but actionable: 2-4 sentences. Always be helpful, never refuse.
                """ + languageInstruction

            case .whatToSay:
                return """
                You are a helpful communication assistant. The user needs suggestions for what to say.
                PRIORITY ORDER:
                1. If a transcript/conversation exists: suggest 2-3 short phrases based on the conversation context
                2. If no transcript but a screenshot is attached: suggest responses based on what's visible on screen (email, chat, document)
                3. If neither: provide general helpful communication suggestions based on any available context
                Keep each suggestion under 15 words. Be helpful and constructive - ALWAYS provide suggestions, never refuse.
                """ + languageInstruction

            case .followUp:
                return """
                You are a helpful conversation assistant. The user wants smart follow-up questions to ask.
                PRIORITY ORDER:
                1. If a transcript/conversation exists: suggest 3 relevant questions based on what was discussed
                2. If no transcript but a screenshot is attached: suggest questions based on what's visible on screen
                3. If neither: provide general insightful questions based on any available context
                Make questions specific and actionable. Be helpful - ALWAYS provide questions, never refuse.
                Focus on clarifying points, exploring deeper, or moving the conversation forward productively.
                """ + languageInstruction

            case .recap:
                return """
                You are an executive assistant generating professional meeting minutes. Create a structured, actionable summary.

                CRITICAL LANGUAGE RULE: Your ENTIRE response MUST be in the SAME language as the transcript.
                - French transcript → French summary with French headers
                - English transcript → English summary with English headers

                PROFESSIONAL MEETING MINUTES STRUCTURE:

                ## 📋 Résumé exécutif / Executive Summary
                2-3 sentences maximum capturing: meeting objective, key outcome, and critical next step.

                ## 👥 Participants mentionnés / Participants Mentioned
                List names mentioned (if any). If none mentioned, skip this section entirely.

                ## 🎯 Points clés discutés / Key Discussion Points
                For EACH major topic discussed:
                **[Topic Name]**
                - Context: What was discussed and why
                - Key insights: Important information shared
                - Concerns raised: Any issues or blockers mentioned

                ## ✅ Décisions prises / Decisions Made
                List ONLY explicit decisions (not suggestions or ideas):
                - **Decision**: [What was decided]
                - **Rationale**: [Why, if mentioned]
                - **Conditions**: [Any dependencies or caveats]

                If no decisions were made, write: "Aucune décision formelle prise lors de cette réunion."

                ## 📌 Actions à suivre / Action Items
                Format each action as:
                | Action | Responsable | Échéance | Priorité |
                |--------|-------------|----------|----------|
                | [Specific task] | [Name or "À définir"] | [Date or "À définir"] | [Haute/Moyenne/Basse] |

                If no clear actions, write: "Actions à définir suite à cette réunion."

                ## ❓ Points en suspens / Open Items
                - Questions requiring follow-up
                - Topics deferred to future discussions
                - Blockers waiting for external input

                ## 📅 Prochaines étapes / Next Steps
                1-3 immediate next steps to move forward.

                FORMATTING RULES:
                - Use bold (**text**) for emphasis on key terms
                - Use bullet points for lists, tables for action items
                - Be specific: include names, dates, technical terms mentioned
                - Capture the SUBSTANCE, not just topics - what was actually said
                - If the meeting was informal/conversational, adapt the tone but keep the structure
                - Never invent information not in the transcript
                """

            case .custom:
                return """
                You are a helpful assistant. Answer the user's question directly and helpfully.
                Never refuse to help. Always provide useful information.
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

    // Memory Palace: Contact context for enriched AI responses
    let contactContext: ContactContext?

    /// Lightweight contact context for AI enrichment
    struct ContactContext: Sendable {
        let fullName: String
        let company: String?
        let role: String?
        let previousSessionSummaries: [String]
        let notes: [String]

        init(from contact: Contact) {
            self.fullName = contact.fullName
            self.company = contact.company
            self.role = contact.role

            // Get last 3 session summaries
            let recentSessions = contact.sessions.sorted { $0.startTime > $1.startTime }.prefix(3)
            self.previousSessionSummaries = recentSessions.compactMap { session in
                guard let summary = session.summary, !summary.isEmpty else { return nil }
                // Truncate to ~200 chars
                let truncated = String(summary.prefix(200))
                let dateStr = session.formattedDate
                return "[\(dateStr)] \(truncated)"
            }

            // Get last 3 notes
            self.notes = contact.notes.prefix(3).map { $0.content }
        }
    }

    init(
        transcript: String,
        screenshot: Data? = nil,
        mode: Mode? = nil,
        responseType: AIResponse.ResponseType,
        customPrompt: String? = nil,
        smartMode: Bool = false,
        contact: Contact? = nil
    ) {
        self.transcript = transcript
        self.screenshot = screenshot
        self.mode = mode
        self.responseType = responseType
        self.customPrompt = customPrompt
        self.smartMode = smartMode
        self.contactContext = contact.map { ContactContext(from: $0) }
    }

    var systemPrompt: String {
        var prompt = ""

        // Check if this is a custom mode (not one of the built-in modes)
        let isCustomMode: Bool
        if let mode = mode {
            let builtInNames = ["Default", "Professional", "Interview", "Sales", "Developer Exam"]
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

            // Add explicit instructions
            prompt += """

                CRITICAL RULES:
                - ALWAYS be helpful. NEVER refuse to help. NEVER say "I can't help with that."
                - Respond in the SAME language as the transcript or screen content.
                - French content → French response. English content → English response.
                - NEVER mix languages in your response.
                """
        } else {
            // For built-in modes, use the traditional combination
            prompt = mode?.systemPrompt ?? Mode.defaultMode.systemPrompt
            // Developer Exam has its own complete prompt — skip responseType addition
            // to avoid conflicting instructions (e.g. .assist adding "1-2 sentences max")
            if mode?.name != "Developer Exam" {
                prompt += "\n\n" + responseType.systemPromptAddition
            }
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

        // Memory Palace: Add contact context if available
        if let contactCtx = contactContext {
            prompt += "\n\n## Contact Context (Memory Palace)\n"
            prompt += "Name: \(contactCtx.fullName)\n"
            if let company = contactCtx.company {
                prompt += "Company: \(company)\n"
            }
            if let role = contactCtx.role {
                prompt += "Role: \(role)\n"
            }

            if !contactCtx.previousSessionSummaries.isEmpty {
                prompt += "\nPrevious conversations:\n"
                for summary in contactCtx.previousSessionSummaries {
                    prompt += "- \(summary)\n"
                }
            }

            if !contactCtx.notes.isEmpty {
                prompt += "\nImportant notes about this contact:\n"
                for note in contactCtx.notes {
                    prompt += "- \(note)\n"
                }
            }

            prompt += "\nUse this context to provide more personalized and relevant responses."
        }

        return prompt
    }

    var userMessage: String {
        var message = ""

        // Check if this is a custom mode (same logic as systemPrompt)
        let isCustomMode: Bool
        if let mode = mode {
            let builtInNames = ["Default", "Professional", "Interview", "Sales", "Developer Exam"]
            isCustomMode = !builtInNames.contains(mode.name)
        } else {
            isCustomMode = false
        }

        if !transcript.isEmpty {
            // Recap and session summaries need much more context for comprehensive coverage
            // Other tabs (Assist, WhatToSay, FollowUp) use a smaller window for speed
            let maxTranscriptLength: Int
            switch responseType {
            case .recap:
                maxTranscriptLength = 50000  // ~12500 tokens - full 1h meeting coverage
            default:
                maxTranscriptLength = 20000  // ~5000 tokens - ~25 min of meeting context
            }

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
            if transcript.isEmpty {
                message += "[Screenshot attached - analyze the screen content to help the user]\n\n"
            } else {
                message += "[Screenshot attached - use if relevant]\n\n"
            }
        }

        if let customPrompt, !customPrompt.isEmpty {
            message += customPrompt
        } else if isCustomMode {
            message += "Help me with this."
        } else {
            // Keep it simple - the system prompt already has instructions
            // Use language-neutral or bilingual prompts to avoid priming the AI in English
            switch responseType {
            case .assist:
                message += "[Assist / Aide]"
            case .whatToSay:
                message += "[Suggest what to say / Suggère quoi dire]"
            case .followUp:
                message += "[Suggest follow-up questions / Suggère des questions de suivi]"
            case .recap:
                message += "[Generate meeting summary / Génère un résumé de réunion]"
            case .custom:
                message += "[Help / Aide]"
            }
        }

        return message
    }
}
