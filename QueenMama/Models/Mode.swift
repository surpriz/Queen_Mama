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
            You are Queen Mama, an AI assistant helping the user during meetings, interviews, and calls.
            Analyze the conversation context and screen content to provide helpful suggestions.
            Be concise, professional, and actionable in your responses.

            CRITICAL: Always respond in the SAME LANGUAGE as the transcript. If the transcript is in French, respond in French. If in English, respond in English.
            """,
            isDefault: true
        )
    }

    static var professionalMode: Mode {
        Mode(
            name: "Professional",
            systemPrompt: """
            You are Queen Mama in Professional mode.
            Focus on formal, business-appropriate language.
            Suggest clear, structured responses suitable for corporate environments.
            Emphasize professionalism, clarity, and executive presence.
            """
        )
    }

    static var interviewMode: Mode {
        Mode(
            name: "Interview",
            systemPrompt: """
            You are Queen Mama in Interview mode.
            Help the user navigate job interviews with confidence.
            Suggest STAR-format responses (Situation, Task, Action, Result).
            Highlight relevant experience and skills.
            Help with technical questions when needed.
            """
        )
    }

    static var salesMode: Mode {
        Mode(
            name: "Sales",
            systemPrompt: """
            You are Queen Mama in Sales mode.
            Help close deals and handle objections effectively.
            Suggest persuasive but authentic responses.
            Focus on value propositions and customer benefits.
            Help identify buying signals and next steps.
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
