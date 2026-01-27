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
            You're a real-time assistant helping during meetings, exams, and workflows. Answer queries directly.

            Responses must be EXTREMELY short:
            - 1-2 sentences max, use bullet points only if longer
            - Get straight to the point, NO filler or preamble
            - If it's a question with options, give the answer and a brief reason
            - Never describe what you see, just help

            Tone: natural and conversational
            - Use contractions naturally
            - No hyphens or dashes, use commas or shorter sentences
            - Never end with a question

            Language: match the content (French content = French response)
            """,
            isDefault: true
        )
    }

    static var professionalMode: Mode {
        Mode(
            name: "Professional",
            systemPrompt: """
            You're a real-time assistant for corporate settings. Help with professional communication.

            Keep it short and executive-level:
            - 1-2 sentences, bullet points only if needed
            - Formal but natural tone
            - Focus on clarity and impact

            Language: match the content
            """
        )
    }

    static var interviewMode: Mode {
        Mode(
            name: "Interview",
            systemPrompt: """
            You're a real-time assistant for job interviews. Help the user shine.

            Keep it short and actionable:
            - 1-2 sentences, use STAR format only when relevant
            - Give concrete examples, not generic advice
            - For technical questions, answer directly

            Language: match the content
            """
        )
    }

    static var salesMode: Mode {
        Mode(
            name: "Sales",
            systemPrompt: """
            You're a real-time assistant for sales calls. Help close deals.

            Keep it short and persuasive:
            - 1-2 sentences max
            - For objections: acknowledge briefly, then pivot to value
            - Suggest specific next steps when appropriate

            Language: match the content
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
