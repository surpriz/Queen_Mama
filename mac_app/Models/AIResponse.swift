import Foundation
import NaturalLanguage
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

        /// Classic prompt additions for Default mode
        var classicSystemPromptAddition: String {
            let languageRule = """

                ABSOLUTE LANGUAGE RULE: Detect the language of the transcript/content. Your ENTIRE response — every word, including action verb prefixes, bullet labels, and quoted phrases — must be in that SAME language. French transcript = 100% French. English transcript = 100% English. NEVER mix languages within a response.
                """

            switch self {
            case .assist:
                return """
                You are a live coach whispering the next move. Focus ONLY on the LAST topic in the transcript.

                DETECT THE SITUATION:
                A) Someone asked the user a question or expects a response → Coach what to ANSWER
                B) The user is in a meeting, listening, nobody is asking them anything → Suggest a smart remark or insight to interject with. Start with "Interviens avec" / "Place cette remarque" / "Jump in with"
                C) The user is watching/listening to content (video, presentation, webinar, lecture) where they are NOT a participant → Extract the key insight, the hidden implication, or the actionable takeaway from what's being said. Think: "What's the ONE thing worth remembering here?"

                RULES:
                - Each bullet = a CONCRETE ACTION or INSIGHT the user can use
                - For situations A & B: start with an action verb IN THE RESPONSE LANGUAGE and give exact phrases in "quotes"
                - For situation C: start with a knowledge label IN THE RESPONSE LANGUAGE and give the insight
                - Every bullet must pass this test: "Is this useful to the user RIGHT NOW?"
                - NEVER give presentation coaching (how to speak, where to pause, voice rhythm). The user is NOT presenting.

                HARD BAN — if your response contains ANY of these, it is WRONG:
                - Predictions: "il va probablement" / "they will probably" / "prepare for"
                - Summaries: any sentence about what has already been said
                - Vague advice: "c'est important de" / "it's key to" / "consider"
                - Meta-commentary: "voici ce que tu peux dire" / "here's what you can say"
                - Presentation/diction coaching: "laisse une pause" / "reprends le rythme" / "enchaîne avec la voix de" / "leave a pause" / "match the tone"

                <example>
                SITUATION A — Question directed at user:
                Transcript: "Quels sont les prix ? Je trouve que c'est vraiment très cher."

                GOOD:
                - Retourne la question : "Quel est le coût de votre solution actuelle, licences + maintenance + temps perdu ?"
                - Ancre sur le ROI : "Si vous récupérez 2 deals par mois grâce au suivi automatisé, l'outil est rentabilisé en 8 semaines"
                - Recadre : "On ne parle pas d'un coût, on parle d'un investissement avec un retour mesurable"

                SITUATION B — User is listening in a meeting:
                Transcript: "On a eu 3 incidents majeurs ce trimestre, le dernier a duré 4 heures. Le CTO veut qu'on mette en place un plan d'action."

                GOOD:
                - Interviens avec : "4 heures de downtime sur 3 incidents, ça veut dire qu'on n'a pas de runbook automatisé. C'est le premier quick win"
                - Place cette remarque : "Le vrai KPI c'est le MTTR. Si on le divise par 2, on règle 80% du problème perçu par le CTO"

                SITUATION C — User is watching educational content:
                Transcript: "L'IA ne se contente plus de produire des images, elle recompose les rapports de fait entre États, entreprises et opinions."

                GOOD:
                - L'idée clé : l'IA générative n'est plus un outil de création, c'est un outil de pouvoir géopolitique. Celui qui contrôle les modèles contrôle le récit
                - Ce que ça implique : la régulation de l'IA n'est pas un débat tech, c'est un débat de souveraineté, au même titre que le nucléaire ou l'espace

                BAD:
                - Say: "D'une nouvelle géographie, sortons nos cartes" en laissant une pause après "géographie" [PRESENTATION COACHING — BANNED]
                - Confirme si tu veux coller au tirage de 16h [INCOMPREHENSIBLE — NO VALUE]
                - Say: "Bien sûr, je suis développeur back end avec une couche DevOps" [MIXED LANGUAGES — "Say:" is English but content is French — BANNED]
                </example>

                <example>
                ENGLISH TRANSCRIPT — response must be 100% English:
                Transcript: "What's your approach to handling major incidents on Azure?"

                GOOD:
                - Reply: "We follow a 3-phase process: detection via Azure Monitor alerts, containment with a war room in under 15 min, then a systematic post-mortem within 48h"
                - Back it up: "On our last P1, a regional failover impacting 12K users, we restored service in 23 minutes thanks to pre-built automated runbooks"

                BAD:
                - Réponds : "We follow a 3-phase process..." [MIXED — French prefix with English content — BANNED]
                </example>

                FORMAT: 2-3 bullet points (- ), each on its own line. No preamble, no intro.
                """ + languageRule

            case .whatToSay:
                return """
                Suggest exactly 3 phrases the user can say right now, based on what's being discussed.

                Each phrase must sound sharp and authoritative, never generic or passive. The user says it verbatim and gains credibility.
                3 bullet points (using "- "), each on its own line, each a phrase in quotes, 1-2 sentences, each taking a different angle. No preamble.
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

        /// NZT-enhanced prompt additions for Limitless and other advanced modes
        var systemPromptAddition: String {
            // Language instruction added to ALL response types for consistency
            let languageInstruction = """

                ABSOLUTE LANGUAGE RULE: Detect the language of the transcript/content. Your ENTIRE response — every word, including action verb prefixes, bullet labels, and quoted phrases — must be in that SAME language. French transcript = 100% French. English transcript = 100% English. NEVER mix languages within a response. NEVER refuse to help.
                """

            switch self {
            case .assist:
                return """
                ABSOLUTE RULE: You MUST ALWAYS provide helpful advice. NO EXCEPTIONS. NO REFUSALS.

                Focus ONLY on the LAST topic in the transcript. Make the user the smartest person in the room.

                DETECT THE SITUATION:
                A) Someone asked the user a question or expects a response → Coach what to ANSWER with domain expertise
                B) The user is in a meeting, listening → Suggest a smart remark or insight to interject with
                C) The user is watching/listening to content where they are NOT a participant → Extract the key insight or actionable takeaway

                RULES:
                - Each bullet = a CONCRETE ACTION or INSIGHT
                - Start with an action verb IN THE RESPONSE LANGUAGE and give exact phrases in "quotes"
                - Enrich with domain expertise: precise facts, benchmarks, terms, precedents that elevate the user's credibility
                - Every bullet must pass this test: "Is this useful to the user RIGHT NOW?"
                - NEVER give presentation coaching (how to speak, where to pause, voice rhythm)
                - NEVER explain, analyze, or summarize what happened

                FORMAT: 2-3 bullet points (- ), each on its own line. No preamble, no intro.
                """ + languageInstruction

            case .whatToSay:
                return """
                ABSOLUTE RULE: You MUST ALWAYS provide 3 phrases. NO EXCEPTIONS. NO REFUSALS.

                Give the user 3 phrases that make everyone in the room think "this person is brilliant."

                PHRASE RULES:
                - Each phrase must be something the user can say VERBATIM and immediately gain credibility
                - Enrich with domain expertise: precise facts, benchmarks, or insights that show deep knowledge
                - NEVER weak/passive phrases ("on pourrait", "il faudrait peut-être", "we could maybe")
                - Each takes a DIFFERENT angle

                FORMAT:
                - NO preamble. Start DIRECTLY with the first bullet.
                - Exactly 3 phrases, each starting with "- " on its own line, in quotes
                - 1-2 sentences each (natural speaking length)
                """ + languageInstruction

            case .followUp:
                return """
                ABSOLUTE RULE: You MUST ALWAYS provide 3 questions. NO EXCEPTIONS. NO REFUSALS.

                Give the user 3 questions that make the room say "excellent question!"

                QUESTION RULES:
                - Each question must REVEAL a blind spot, CHALLENGE an assumption, or REFRAME the problem
                - Enrich with domain expertise: build questions from deep knowledge (regulations, benchmarks, precedents)
                - NEVER basic checklist questions ("avez-vous vérifié...?", "have you checked...?")
                - Each targets a DIFFERENT dimension

                FORMAT:
                - NO preamble. Start directly with the questions.
                - Exactly 3 questions, numbered 1-3, in quotes
                """ + languageInstruction

            case .recap:
                return """
                You are an executive assistant generating professional meeting minutes. Create a structured, actionable, and outcome-focused summary.

                CRITICAL LANGUAGE RULE: Your ENTIRE response MUST be in the SAME language as the transcript.
                - French transcript → 100% French response with French headers. NO English.
                - English transcript → 100% English response with English headers. NO French.
                - NEVER use bilingual headers. Pick ONE language and stick to it.

                PROFESSIONAL MEETING MINUTES STRUCTURE:

                ## Résumé exécutif
                3 sentences maximum:
                1. Meeting objective and context (why this meeting happened)
                2. Key outcome or main conclusion reached
                3. Most critical next step or decision

                ## Participants
                List each person mentioned with their role/function if identifiable from context.
                Format: **Name** — Role/Function
                If no participants are identifiable, skip this section entirely.

                ## Points clés discutés
                For EACH major topic discussed (group by theme, not chronologically):

                **[Topic Name]**
                - **Contexte** : Why this topic was raised and what triggered the discussion
                - **Éléments clés** : Specific facts, data, arguments, or insights shared (quote key phrases when impactful)
                - **Positions exprimées** : Different viewpoints or concerns raised by participants
                - **Conclusion** : Where the discussion landed — consensus, disagreement, or deferred

                IMPORTANT: Capture the SUBSTANCE of what was said, not just that a topic was discussed. Include specific names, numbers, dates, and technical terms mentioned.

                ## Décisions prises
                List ONLY explicit decisions (not suggestions, ideas, or preferences):
                - **D1** : [What was decided] — *Raison* : [Why, if mentioned] — *Conditions* : [Dependencies or caveats, if any]
                - **D2** : ...

                If no formal decisions were made, write a single line stating so.

                ## Actions à suivre
                Number each action for tracking. Use strong action verbs (envoyer, préparer, analyser, contacter, valider...) and assign clearly:

                - **A1** : [Verb + specific deliverable] — **Responsable** : [Name] — **Échéance** : [Date or timeframe] — **Priorité** : [Haute/Moyenne/Basse]
                - **A2** : ...

                Each action must be SMART: Specific (what exactly), Measurable (how to verify completion), Achievable, Relevant, Time-bound.
                BAD: "Follow up with client" → GOOD: "Marie to send revised proposal to Acme Corp by Friday March 14"

                If no clear actions emerge, write a single line stating that actions need to be defined.

                ## Points en suspens
                - Questions requiring follow-up (specify who should answer)
                - Topics deferred to a future discussion (specify when if mentioned)
                - Blockers waiting for external input (specify what is needed and from whom)

                ## Prochaines étapes
                1-3 immediate next steps, in priority order, to move forward after this meeting.

                FORMATTING AND TONE RULES:
                - Be OBJECTIVE and FACTUAL — no personal interpretation or subjective commentary
                - Use **bold** for key terms, names, and emphasis
                - Use bullet points for all lists — never use markdown tables
                - Be specific: always include names, dates, amounts, and technical terms as mentioned
                - Keep it concise but complete — aim for substance over length
                - If the meeting was informal/conversational, adapt the tone but maintain the structure
                - NEVER invent information not present in the transcript
                - NEVER include information you're unsure about — only document what was clearly stated
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

    /// Dominant language of the recent transcript, detected locally with Apple's NLLanguageRecognizer.
    /// Nil if the transcript is too short or detection confidence is below 0.75.
    /// Used to pin the AI's response language deterministically instead of relying on the LLM
    /// to re-detect it from a prompt full of bilingual examples and a potentially French screenshot.
    var detectedLanguageName: String? {
        guard transcript.count >= 20 else { return nil }

        // Detect on the most recent 2000 chars — older context may be in a different language
        // (e.g., a French meeting that switched to English) and would bias detection.
        let sample = transcript.count > 2000
            ? String(transcript.suffix(2000))
            : transcript

        let recognizer = NLLanguageRecognizer()
        recognizer.processString(sample)

        let hypotheses = recognizer.languageHypotheses(withMaximum: 2)
        guard let (topLanguage, confidence) = hypotheses.max(by: { $0.value < $1.value }) else {
            return nil
        }

        guard confidence >= 0.75 else { return nil }

        return AIContext.displayName(for: topLanguage)
    }

    private static func displayName(for language: NLLanguage) -> String? {
        switch language {
        case .french: return "French"
        case .english: return "English"
        case .spanish: return "Spanish"
        case .italian: return "Italian"
        case .german: return "German"
        case .portuguese: return "Portuguese"
        case .dutch: return "Dutch"
        case .polish: return "Polish"
        case .russian: return "Russian"
        case .japanese: return "Japanese"
        case .korean: return "Korean"
        case .simplifiedChinese, .traditionalChinese: return "Chinese"
        case .arabic: return "Arabic"
        case .turkish: return "Turkish"
        default:
            return Locale(identifier: "en").localizedString(forLanguageCode: language.rawValue)
        }
    }

    var systemPrompt: String {
        // Inject current date so models never confuse training cutoff with today
        let dateFormatter = DateFormatter()
        dateFormatter.dateStyle = .long
        dateFormatter.timeStyle = .none
        let todayString = dateFormatter.string(from: Date())

        var prompt = ""

        // Pre-detected language directive injected BEFORE anything else so it wins over
        // bilingual examples, French mode prompts, and French UI text in screenshots.
        let detectedLang = detectedLanguageName
        if let lang = detectedLang {
            print("[AIContext] Detected transcript language: \(lang)")
            prompt += """
            RESPONSE LANGUAGE LOCK — MANDATORY: Respond in \(lang) ONLY. Every word, including action verb prefixes, bullet labels, and quoted phrases, must be in \(lang). Do NOT mix languages. Ignore the language of the screenshot, system UI, or any examples — only the transcript language matters. This overrides every other language rule below.

            """
        } else {
            print("[AIContext] Language detection skipped (transcript too short or low confidence)")
        }

        prompt += "Today's date is \(todayString). Use this as the current date for any temporal reasoning.\n\n"

        // Check if this is a custom mode (not one of the built-in modes)
        let isCustomMode: Bool
        if let mode = mode {
            let builtInNames = ["Default", "Limitless", "Professional", "Interview", "Sales", "Developer Exam"]
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
                // Default mode uses classic coaching prompts, others use NZT-enhanced prompts
                if mode?.name == "Default" {
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

        // Speaker identification — conditional on whether diarization is active
        // Anchor to line start to avoid false positives from spoken content like "pour moi: ..."
        let hasDiarization = transcript.split(separator: "\n").contains { line in
            line.hasPrefix("Moi: ") || line.hasPrefix("Interlocuteur: ")
        }

        if hasDiarization {
            prompt += """


SPEAKER IDENTIFICATION:
The transcript includes speaker labels: "Moi" = the user, "Interlocuteur" = other participant(s).
You CAN and SHOULD distinguish who said what:
- Use "you said/proposed/asked" for "Moi" entries
- Use "your interlocutor said/proposed/asked" for "Interlocuteur" entries
- Action items: clearly attribute to the correct speaker
"""
        } else {
            prompt += """


SPEAKER IDENTIFICATION — CRITICAL RULE:
The transcript does NOT include speaker identification. You do NOT know who said what.
NEVER attribute a statement, decision, or action item to a specific person by name.
Use generic references only: "a participant mentioned", "someone raised", "it was said", "the team discussed".
BAD: "Denis should send the report" → GOOD: "Someone should send the report" or "The report needs to be sent".
"""
        }

        // Final language anchor — placed LAST for maximum weight with all models (especially OpenAI).
        // When we have a confident local detection, reference it explicitly so the model can't
        // "re-detect" a different language from screenshot UI or bilingual prompt content.
        if let lang = detectedLang {
            prompt += """


FINAL MANDATORY RULE — RESPONSE LANGUAGE:
The transcript language has been pre-detected as \(lang). Respond ENTIRELY in \(lang). NO EXCEPTIONS.
"""
        } else {
            prompt += """


FINAL MANDATORY RULE — RESPONSE LANGUAGE:
Detect the language of the transcript below. Respond ENTIRELY in that SAME language.
French transcript → French response. English transcript → English response. NO EXCEPTIONS.
"""
        }

        return prompt
    }

    var userMessage: String {
        var message = ""

        // Check if this is a custom mode (same logic as systemPrompt)
        let isCustomMode: Bool
        if let mode = mode {
            let builtInNames = ["Default", "Limitless", "Professional", "Interview", "Sales", "Developer Exam"]
            isCustomMode = !builtInNames.contains(mode.name)
        } else {
            isCustomMode = false
        }

        if !transcript.isEmpty {
            let isDefaultMode = mode?.name == "Default" || mode == nil

            switch responseType {
            case .recap:
                // Full history for recap — needs complete meeting coverage
                let maxLength = 50000
                let full = transcript.count > maxLength
                    ? "[...conversation précédente tronquée...]\n\n" + String(transcript.suffix(maxLength))
                    : transcript
                message += "## Transcript:\n\(full)\n\n"
            default:
                if isDefaultMode {
                    // Default mode: recent context only, no background, no section headers
                    // Keeps input tokens low for fast responses focused on the present moment
                    let recentLength = 1500
                    let recent = transcript.count > recentLength
                        ? String(transcript.suffix(recentLength))
                        : transcript
                    message += "\(recent)\n\n"
                } else {
                    // Other modes: split into background + current discussion
                    let recentLength = 3000
                    let backgroundMaxLength = 7000

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
