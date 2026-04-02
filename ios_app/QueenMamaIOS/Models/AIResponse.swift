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

        /// Classic prompt additions for Default mode — terse, fast, focused on the present moment
        var classicSystemPromptAddition: String {
            let languageRule = """

                Respond in the same language as the transcript/content. French content = full French response. English content = full English response. Never mix languages.
                """

            switch self {
            case .assist:
                return """
                You are whispering real-time advice during a live meeting.

                Focus on what's happening RIGHT NOW. Tell the user what to do or what to note, not what already happened.
                Answer from the transcript first, then your general knowledge, then the screenshot if attached.

                FORMAT: 1-2 sentences. Use bullet points only when listing distinct items. No headers, no preamble.
                """ + languageRule

            case .whatToSay:
                return """
                Suggest exactly 3 phrases the user can say right now, based on what's being discussed.

                Each phrase must sound sharp and authoritative, never generic or passive. The user says it verbatim and gains credibility.
                3 bullet points, each a phrase in quotes, 1-2 sentences, each taking a different angle. No preamble.
                """ + languageRule

            case .followUp:
                return """
                Suggest exactly 3 questions the user can ask right now to elevate the conversation.

                Great questions reveal hidden assumptions, expose blind spots, or reframe the problem. They make the room think "excellent question."
                3 numbered questions in quotes, each targeting a different dimension. No preamble.
                """ + languageRule

            case .recap, .custom:
                return systemPromptAddition
            }
        }

        /// Full prompt additions for non-Default built-in modes
        var systemPromptAddition: String {
            // Language instruction added to ALL response types for consistency
            let languageInstruction = """

                CRITICAL LANGUAGE RULE: Your ENTIRE response MUST be in the SAME language as the transcript or screen content.
                - French content → respond entirely in French
                - English content → respond entirely in English
                - NEVER mix languages. NEVER refuse to help. NEVER say "I can't help with that."
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
                - Tell the user what to DO, not just what IS
                - When relevant, suggest exact words to say in quotes, ready to use verbatim
                - Bake the expertise INTO the bullet — no explanations outside the bullet itself

                RESPONSE FORMAT — CRITICAL (user reads DURING a live meeting):
                - MAXIMUM 3 bullet points total. NEVER more.
                - Each bullet: exactly ONE sentence. No sub-clauses. No "because", no "since".
                - Third bullet is optional — only include if genuinely needed.
                - NO titles, NO headers, NO numbered sub-lists.
                Always be helpful, never refuse.
                """ + languageInstruction

            case .whatToSay:
                return """
                You are a helpful communication assistant. The user is in a conversation and needs suggestions for what to say next.
                Based on the transcript and conversation context, suggest 2-3 short phrases or responses they could use.
                Keep each suggestion under 15 words. Be helpful and constructive - never refuse to help.
                Focus on the conversation flow and topics being discussed to provide relevant suggestions.
                """ + languageInstruction

            case .followUp:
                return """
                You are a helpful conversation assistant. The user wants to explore a topic or continue a discussion.
                Based on the transcript and conversation topics, suggest 3 relevant questions the user could ask.
                Make questions specific to what has been discussed. Be helpful - never refuse to help.
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
        // Inject current date so models never confuse training cutoff with today
        let dateFormatter = DateFormatter()
        dateFormatter.dateStyle = .long
        dateFormatter.timeStyle = .none
        let todayString = dateFormatter.string(from: Date())
        var prompt = "Today's date is \(todayString). Use this as the current date for any temporal reasoning.\n\n"

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
            prompt += mode?.systemPrompt ?? Mode.defaultMode.systemPrompt
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
            prompt += mode?.systemPrompt ?? Mode.defaultMode.systemPrompt
            // Developer Exam has its own complete prompt — skip responseType addition
            if mode?.name != "Developer Exam" {
                // Default mode uses classic terse prompts, others use full prompts
                if mode?.name == "Default" || mode == nil {
                    prompt += "\n\n" + responseType.classicSystemPromptAddition
                } else {
                    prompt += "\n\n" + responseType.systemPromptAddition
                }
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

        // Speaker identification unavailable — applies to ALL modes
        prompt += """


SPEAKER IDENTIFICATION — CRITICAL RULE:
The transcript does NOT include speaker identification. You do NOT know who said what.
NEVER attribute a statement, decision, or action item to a specific person by name.
Use generic references only: "a participant mentioned", "someone raised", "it was said", "the team discussed".
BAD: "Denis should send the report" → GOOD: "Someone should send the report" or "The report needs to be sent".
"""

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
            let isDefaultMode = mode?.name == "Default" || mode == nil

            if isDefaultMode && responseType != .recap {
                // Default mode: recent context only, no background, no section headers
                // Keeps input tokens low for fast responses focused on the present moment
                let recentLength = 1500
                let recent = transcript.count > recentLength
                    ? String(transcript.suffix(recentLength))
                    : transcript
                message += "\(recent)\n\n"
            } else {
                // Other modes: split into background + current discussion
                let recentLength = 2500
                let backgroundMaxLength = 5500

                if transcript.count <= recentLength {
                    message += "## Transcript:\n\(transcript)\n\n"
                } else {
                    let recentPart = String(transcript.suffix(recentLength))
                    let olderPart = String(transcript.dropLast(recentLength))
                    let backgroundPart = olderPart.count > backgroundMaxLength
                        ? "[...conversation précédente tronquée...]\n\n" + String(olderPart.suffix(backgroundMaxLength))
                        : olderPart
                    message += "## Contexte de réunion (plus tôt dans la discussion) :\n\(backgroundPart)\n\n## Discussion en cours (priorité ici) :\n\(recentPart)\n\n"
                }
            }
        }

        if screenshot != nil {
            message += "[Screenshot attached - use only if relevant to a visual question]\n\n"
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
