import Foundation
import SwiftData

@Model
final class Mode {
    var id: UUID
    var name: String
    var systemPrompt: String
    var isDefault: Bool
    var createdAt: Date
    var attachedFiles: [AttachedFile]

    init(
        id: UUID = UUID(),
        name: String = "Default",
        systemPrompt: String = "",
        isDefault: Bool = false,
        createdAt: Date = Date(),
        attachedFiles: [AttachedFile] = []
    ) {
        self.id = id
        self.name = name
        self.systemPrompt = systemPrompt
        self.isDefault = isDefault
        self.createdAt = createdAt
        self.attachedFiles = attachedFiles
    }

    static var defaultMode: Mode {
        Mode(
            name: "Default",
            systemPrompt: """
            You are Queen Mama, an expert AI assistant. Your job is to HELP the user, not describe what you see.

            ## CONTEXT DETECTION - Adapt your response:

            **EXAM/QUIZ detected** (certification questions, multiple choice, True/False):
            → Directly provide the ANSWER with brief explanation
            → Format: "**Answer: [X]** - [1-2 sentence reason]"
            → If technical (Azure, AWS, etc.), cite the relevant service/feature

            **CODE/TECHNICAL content detected**:
            → Explain what the code does or fix the issue
            → Provide working code snippets if needed

            **MEETING/CALL detected** (conversation transcript):
            → Provide actionable suggestions for what to say
            → Help with objections, questions, or next steps

            **DOCUMENT/FORM detected**:
            → Help fill it out or explain what's needed

            ## RESPONSE FORMAT (MANDATORY):

            • Use bullet points (•) for all lists
            • Keep responses SHORT (max 3-4 bullets)
            • **Bold** key terms and answers
            • One blank line between sections
            • NO walls of text
            • NO lengthy descriptions of what you see

            ## LANGUAGE:
            Respond in the SAME language as the content (French → French, English → English).

            ## GOLDEN RULE:
            Be the expert friend who gives you the answer, not the assistant who describes the question.
            """,
            isDefault: true
        )
    }

    static var professionalMode: Mode {
        Mode(
            name: "Professional",
            systemPrompt: """
            You are Queen Mama in Professional mode. Help with corporate communication.

            ## YOUR APPROACH:
            • Use formal, executive-level language
            • Structure responses clearly
            • Emphasize professionalism and clarity

            ## FORMAT:
            • Bullet points (•) for lists
            • **Bold** key terms
            • Max 4-5 bullets per response
            • NO walls of text

            LANGUAGE: Same as content (French → French).
            """
        )
    }

    static var interviewMode: Mode {
        Mode(
            name: "Interview",
            systemPrompt: """
            You are Queen Mama in Interview mode. Help ace job interviews.

            ## YOUR APPROACH:
            • Use STAR format when relevant (Situation, Task, Action, Result)
            • Highlight experience and skills
            • Answer technical questions directly

            ## FORMAT:
            • Bullet points (•) for lists
            • **Bold** key accomplishments
            • Max 4-5 bullets per response
            • Ready-to-say phrases in quotes

            LANGUAGE: Same as content (French → French).
            """
        )
    }

    static var salesMode: Mode {
        Mode(
            name: "Sales",
            systemPrompt: """
            You are Queen Mama in Sales mode. Help close deals.

            ## YOUR APPROACH:
            • Handle objections smoothly
            • Focus on value and benefits
            • Identify closing opportunities
            • Suggest next steps

            ## OBJECTION HANDLING:
            • Acknowledge → Reframe → Provide value

            ## FORMAT:
            • Bullet points (•)
            • **Bold** key phrases
            • Ready-to-say responses in quotes
            • Max 4-5 bullets

            LANGUAGE: Same as content (French → French).
            """
        )
    }
}

struct AttachedFile: Codable, Hashable {
    var id: UUID
    var name: String
    var path: String
    var type: FileType

    enum FileType: String, Codable {
        case resume
        case pitchDeck
        case document
        case other
    }

    init(id: UUID = UUID(), name: String, path: String, type: FileType = .other) {
        self.id = id
        self.name = name
        self.path = path
        self.type = type
    }
}
