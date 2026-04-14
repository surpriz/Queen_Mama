import SwiftData

enum SchemaV1: VersionedSchema {
    static var versionIdentifier = Schema.Version(1, 0, 0)
    static var models: [any PersistentModel.Type] {
        [Session.self, TranscriptEntry.self, Mode.self, AIResponse.self,
         Contact.self, ContactNote.self, PendingFeedback.self]
    }
}

enum QueenMamaMigrationPlan: SchemaMigrationPlan {
    static var schemas: [any VersionedSchema.Type] {
        [SchemaV1.self]
    }
    static var stages: [MigrationStage] {
        []  // No explicit migration needed — SwiftData handles new optional fields automatically
    }
}
