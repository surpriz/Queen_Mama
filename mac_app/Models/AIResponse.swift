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
                You are a live coach watching the LAST topic in the transcript. Adapt the SHAPE of your output to who is speaking and whether the user is involved.

                DETECT THE SITUATION:
                A) The user is directly addressed, named, asked a question, or challenged → coach what to ANSWER.
                B) Multi-speaker meeting (3+ distinct speakers) where a colleague is reporting on THEIR OWN task or status (daily standup, status round-table) and the user is just listening → give the KEY TAKEAWAY in 1-2 short plain sentences. NO bullets, NO action verb, NO quoted phrases, NO "Je peux..." / "I can...".
                C) Open discussion where the user can naturally interject with REAL value (topic concerns them, no one else has the floor, the user can add a sharp point) → ONE bullet with an action verb to interject with.
                D) Passive consumption of content (video, presentation, webinar, lecture) where the user is NOT a participant → extract the ONE insight worth remembering.

                DEFAULT RULE:
                - 1:1 (only 2 speakers in the recent transcript) AND the other person is asking questions, expressing doubt or resistance, raising an objection, explaining a case, or laying out a scenario → A by default. This is true EVEN IF the user has been silent for a long time, and EVEN IF the other person did NOT phrase their statement as a "?" question. Interviews, sales calls, customer calls, 1:1 reviews are A. The user is the addressee, their job is to respond.
                - Objections without a "?" still count as A. Recognize them by INTENT, not by exact wording or language. Detect ANY of these intents regardless of phrasing or the language used:
                  · status quo preference (current solution is fine, no urgency to change)
                  · price or cost resistance (too expensive, doesn't justify the spend, low perceived value)
                  · value skepticism (don't see the upside, can't see the difference)
                  · feature, scope or fit concerns (won't fit our needs, missing capabilities, wrong size)
                  · decision delay or deflection (need to think, need internal alignment, not my call, not the right time)
                  · trust or risk concerns (we don't know you, switching is risky, integration looks complex)
                  Any statement carrying one of these intents — in any language, with any phrasing — is an OBJECTION. Treat as Situation A and give the user a rebuttal phrase.
                - 3+ distinct speakers AND the user has not been named or directly asked something in the last ~30 seconds → B by default. Do NOT force a coaching response on someone else's status update.
                - Stacked questions: if the speaker has asked multiple questions back-to-back without giving the user a chance to respond, this is still A. Answer the LATEST question (the one expecting an answer right now). If the question is multi-part, give a structured answer covering the main parts in order.

                OUTPUT SHAPE — pick the right one:
                - A: 2-3 short bullets, action verb in the response language + exact phrase in "quotes". Lead with CONCRETE substance whenever the question invites it: a specific number, duration, deliverable, methodology, framework, named tool, regulation, KPI, or result — pick what fits the topic and profession (sales, HR, finance, legal, marketing, medical, education, ops, tech, etc.). Avoid generic fillers ("simple et partagé", "structuré et clair", "cohérent et aligné") that any junior could say.
                - B: 1-2 plain sentences. NO bullets. NO action verb. NO quotes. Be short and factual.
                - C: 1 bullet, action verb + exact phrase in "quotes"
                - D: 1-2 plain sentences with the takeaway

                ANTI-HALLUCINATION (HARD RULES):
                - Every fact, name, number, term, or acronym in your response MUST be present in the transcript. If it is not, do not write it.
                - Do NOT write "Je peux + verb" or "I can + verb" UNLESS the user just spoke about that exact task OR was just named and asked to do it. When a colleague reports on their own work, the user is NOT the one volunteering.
                - If you cannot honestly write something useful, output the single most important fact from the transcript in one short sentence. Empty is better than fabricated.
                - NEVER give presentation coaching (how to speak, where to pause, voice rhythm). The user is NOT presenting.

                HARD BAN — if your response contains ANY of these, it is WRONG:
                - First-person commitments on a task owned by another speaker ("Je peux lancer les tests..." when the colleague is reporting on their own tests)
                - Paraphrasing or summarizing the question back to the user instead of answering it ("L'interlocuteur vous demande X" / "The interviewer asks Y"). If a question is on the table in a 1:1, ANSWER the question, do not narrate it.
                - Telling the user what to do next as a directive instead of giving the actual phrase ("Puis enchaîne sur...", "Then continue with...", "Ensuite réponds à..."). Give the words to say, not the meta-instruction.
                - Third-person knowledge-attribution prefixes used in a 1:1 dialogue — any phrasing that frames the response as a third-person summary, observation or lecture about what is happening, in any language (FR illustrations: "L'idée clé :", "À noter :", "Le point clé :", "Ce qui se passe :", "L'autre personne dit que :"; EN illustrations: "The key idea:", "Note:", "What is happening:", "The interviewer is saying:"). These prefixes belong to Situation D (passive content consumption only). In a 1:1 conversation (interview, sales call, customer call), give the user a phrase to deliver in first person, never a lecture about what is happening.
                - Invented technical terms, acronyms, frameworks, or architectures not present in the transcript
                - Predictions: "il va probablement" / "they will probably" / "prepare for"
                - Vague advice: "c'est important de" / "it's key to" / "consider"
                - Meta-commentary: "voici ce que tu peux dire" / "here's what you can say"
                - Presentation/diction coaching: "laisse une pause" / "reprends le rythme" / "enchaîne avec la voix de" / "leave a pause" / "match the tone"

                <example>
                SITUATION A — Short direct question to user:
                Transcript: "Quels sont les prix ? Je trouve que c'est vraiment très cher."

                GOOD:
                - Retourne la question : "Quel est le coût de votre solution actuelle, licences plus maintenance plus temps perdu ?"
                - Ancre sur le ROI : "Si vous récupérez 2 deals par mois grâce au suivi automatisé, l'outil est rentabilisé en 8 semaines"
                - Recadre : "On ne parle pas d'un coût, on parle d'un investissement avec un retour mesurable"
                </example>

                <example>
                SITUATION A — Sales objection in a 1:1, NO "?" but a clear push-back from the prospect (status quo bias):
                Transcript: "Concrètement, nous avons déjà un CRM qui marche bien. Je ne sais pas si on a envie de changer. Qu'est-ce qu'ils pourraient faire que nous changions notre CRM par un nouveau."

                GOOD:
                - Recadre : "La vraie question n'est pas s'il marche, c'est combien il vous coûte en temps perdu, en données silotées et en deals manqués chaque mois."
                - Demande concret : "Quels sont les 3 process qui vous prennent le plus de temps aujourd'hui sur votre CRM actuel ?"
                - Verrouille : "On peut vous montrer en 15 minutes ce que les nouveaux outils font que le vôtre ne fait pas, et vous décidez."

                BAD:
                - L'idée clé : l'échange porte sur le fait de changer ou non le CRM [D-STYLE NARRATOR PREFIX IN A 1:1 SALES CALL — BANNED]
                - À noter : la bonne piste est d'exiger le problème concret avant d'ouvrir un remplacement [META-COACHING INSTEAD OF GIVING THE RESPONSE PHRASE — BANNED]
                - Si tu veux intervenir : "Quel problème précis le CRM actuel ne résout il pas" [SUGGESTING TO INTERJECT WHEN THE USER IS DIRECTLY ADDRESSED — BANNED]
                </example>

                <example>
                SITUATION A — Long rambling interview question with multiple sub-questions stacked (1:1 context, user has been silent, BUT they are clearly the addressee). Topic chosen to be domain-agnostic — works for HR, sales, operations, consulting, account management:
                Transcript: "On va faire une mise en situation. Vous arrivez dans une équipe de 15 personnes en sous-performance. Quelles bonnes pratiques mettez-vous en place les 90 premiers jours ? Et comment gérez-vous un client clé qui menace de partir suite à une livraison ratée ?"

                GOOD (answer the LATEST question with substance, structured):
                - Réponds : "Sur un compte clé qui menace de partir, je suis un protocole en 3 temps : 1:1 avec le sponsor sous 24h pour cartographier le vrai problème, plan de remédiation chiffré avec un référent sénior nommé de notre côté, puis revue à 30 jours sur critères de succès partagés."
                - Ancre concret : "Sur mon dernier dossier, un compte à 240 K€ d'ARR à risque après une livraison manquée, on a sauvé le contrat avec un avoir partiel et un point hebdo sur trois mois."
                - Verrouille : "L'objectif c'est zéro churn évitable et un NPS supérieur à 20 sur le compte sous 6 mois."

                BAD:
                - L'interlocuteur vous demande quelles bonnes pratiques mettre en place et comment gérer un client mécontent [PARAPHRASING THE QUESTION INSTEAD OF ANSWERING — BANNED]
                - Réponds : "Je peux vous détailler ma méthode." Puis enchaîne sur les bonnes pratiques. [META-DIRECTIVE INSTEAD OF GIVING THE ACTUAL CONTENT — BANNED]
                - Réponds : "Je mettrais en place des bonnes pratiques simples et partagées" [GENERIC FILLER, NO SUBSTANCE — WEAK, AVOID]
                </example>

                <example>
                SITUATION B — Colleague reports their own blocker in a stand-up, user just listening. Domain-neutral (marketing here, but the pattern applies to legal, finance, HR, ops, tech, etc.):
                Transcript: "Them: je suis bloquée sur le brief créa de la campagne Q3, l'agence me renvoie des concepts qui ne collent pas au positionnement validé en comité."

                GOOD:
                La collègue signale un blocage sur le brief créa Q3 : désalignement entre l'agence et le positionnement validé. Pas de demande à l'utilisateur.

                BAD:
                - Propose : "Tu peux passer par un moodboard validé avant de relancer l'agence" [INVENTS ADVICE FOR A TASK NOT OWNED BY THE USER — BANNED]
                - Réponds : "Tu parles de la déclinaison social ou print ?" [USER NOT ADDRESSED — BANNED]
                - Propose : "Je peux reprendre le brief et faire un atelier de cadrage..." [FIRST-PERSON COMMITMENT ON COLLEAGUE'S TASK — BANNED]
                </example>

                <example>
                SITUATION B — Colleague hesitates on their own decision (pricing topic — same logic applies to a legal clause, a recruitment shortlist, a clinical protocol, etc.):
                Transcript: "Them: il me reste à arbitrer le prix de l'offre Premium, je ne sais pas si je reste sur 79 euros comme l'an dernier ou si je passe à 99."

                GOOD:
                La collègue hésite entre maintenir le prix à 79 € et passer à 99 € sur l'offre Premium. À noter pour la prochaine réunion pricing.

                BAD:
                - Propose : "Je peux faire le benchmark concurrence et te revenir cet après-midi" [USER VOLUNTEERS ON SOMEONE ELSE'S TASK — BANNED]
                </example>

                <example>
                SITUATION C — Open meeting, the topic actually concerns the user (here a churn topic; works equally for a recruiting funnel, a litigation file, a clinical caseload, a logistics issue, an incident at work, etc.):
                Transcript: "On a perdu 3 gros clients ce trimestre, le dernier représentait 18% de l'ARR. Le COMEX veut un plan de rétention."

                GOOD:
                - Interviens avec : "3 churns dont un à 18 pour cent de l'ARR, ça veut dire qu'on n'a pas de système d'alerte précoce sur les comptes clés. C'est le premier chantier"
                </example>

                <example>
                SITUATION D — User is watching educational content:
                Transcript: "L'IA ne se contente plus de produire des images, elle recompose les rapports de fait entre États, entreprises et opinions."

                GOOD:
                L'idée à retenir : l'IA générative est devenue un outil de pouvoir géopolitique. La régulation est un débat de souveraineté, pas un débat de tech.

                BAD:
                - Say: "D'une nouvelle géographie, sortons nos cartes" en laissant une pause après "géographie" [PRESENTATION COACHING — BANNED]
                - Say: "Bien sûr, je suis chef de projet avec une casquette analytique" [MIXED LANGUAGES — "Say:" is English but content is French — BANNED]
                </example>

                <example>
                ENGLISH TRANSCRIPT — response must be 100% English. Topic chosen to be domain-agnostic (client escalation; the same shape works for any high-stakes 1:1 question across HR, sales, consulting, healthcare, legal, ops):
                Transcript: "How do you handle a critical client escalation when the relationship is already strained?"

                GOOD:
                - Reply: "I run a 3-step playbook: a 24-hour 1:1 with the sponsor to map the real issue, a quantified remediation plan with a senior sponsor named on our side, then a 30-day review on shared success criteria"
                - Back it up: "Last quarter, on a 240K ARR account at risk after a missed delivery, we saved the contract with a partial credit note and a weekly sync over 3 months"

                BAD:
                - Réponds : "I run a 3-step playbook..." [MIXED — French prefix with English content — BANNED]
                </example>

                FORMAT REMINDER: Match the OUTPUT SHAPE to the SITUATION. Do NOT force bullets or action verbs in situations B or D.
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

    /// True when the user has barely spoken in the most recent labeled window — signals they are
    /// LISTENING, not conversing, so the AI shouldn't push them to speak.
    /// Threshold: <2 "Moi:" entries among the last 10 labeled lines. Requires ≥3 labeled entries
    /// to judge, and ≥2 "Moi" to consider active — this guards against Deepgram occasionally
    /// misattributing a short utterance (e.g. "ça marche") the user didn't actually say.
    var isUserPassivelyListening: Bool {
        let labeled = transcript
            .split(separator: "\n", omittingEmptySubsequences: true)
            .map(String.init)
            .filter { $0.hasPrefix("Moi: ") || $0.hasPrefix("Interlocuteur: ") }

        guard labeled.count >= 3 else { return false }

        let recent = labeled.suffix(10)
        let userEntries = recent.filter { $0.hasPrefix("Moi: ") }.count
        return userEntries < 2
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

PERSPECTIVE GUARD — ABSOLUTE:
The user is the ONE receiving coaching. The user is NEVER the speaker of any "Interlocuteur" content.
- First-person pronouns ("je", "I") in "Interlocuteur" lines belong to the INTERLOCUTOR, NEVER to the user
- NEVER echo another speaker's first-person claims as if the user said them
- NEVER invent specific details the user hasn't mentioned (absence, availability, opinions, commitments, personal circumstances)
- When suggesting what to say, base it on what is a REASONABLE RESPONSE to the interlocutor, not a restatement
- BAD: Interlocuteur says "Je ne serai pas là la semaine prochaine" → You write "Réponds: Je ne serai pas là la semaine prochaine" (the user's absence is invented)
- GOOD: Interlocuteur says "Je ne serai pas là la semaine prochaine" → You write "Demande: « Quels jours exactement ? »" or "Propose: « Je peux couvrir tes sujets urgents »"
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

        // Passive listening override — when the user has barely spoken, Swift detects this
        // deterministically and overrides the mode's "coach the user to speak" directive.
        // Placed AFTER speaker identification so it applies on top, BEFORE the language anchor.
        if isUserPassivelyListening {
            print("[AIContext] User passively listening — injecting passive mode directive")
            prompt += """


PASSIVE LISTENING MODE — MANDATORY (overrides mode defaults):
The user has been SILENT and is LISTENING, not conversing. Do NOT force them to speak.
- DO NOT lead bullets with "Réponds", "Dis", "Demande", "Reply", "Say", "Ask" unless a question is DIRECTLY and UNAMBIGUOUSLY addressed to the user in the most recent interlocutor turn
- PREFER extracting the key takeaway, flagging a shift in the discussion, or offering an OPTIONAL interjection
- Use leads like: "L'idée clé :" / "Ce qu'il faut retenir :" / "Point important :" / "À noter :" / "Key insight:" / "Worth noting:"
- If the user MAY want to intervene, frame it as optional: "Si tu veux intervenir :" / "Tu peux glisser :" / "To chime in (optional):"
- NEVER fabricate details about the user (availability, absence, opinions, commitments)
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
