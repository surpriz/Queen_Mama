import SwiftUI
import SwiftData

struct SessionDetailView: View {
    let session: Session

    @State private var showingShareSheet = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: QMDesign.Spacing.lg) {
                // Header Card
                VStack(alignment: .leading, spacing: QMDesign.Spacing.sm) {
                    HStack {
                        VStack(alignment: .leading, spacing: QMDesign.Spacing.xs) {
                            Text(session.formattedDate)
                                .font(QMDesign.Typography.caption)
                                .foregroundColor(QMDesign.Colors.textTertiary)

                            Text(session.formattedDuration)
                                .font(QMDesign.Typography.subheadline)
                                .foregroundColor(QMDesign.Colors.textSecondary)
                        }

                        Spacer()

                        if let contact = session.contact {
                            HStack(spacing: QMDesign.Spacing.xs) {
                                ZStack {
                                    Circle()
                                        .fill(QMDesign.Colors.primaryGradient)
                                        .frame(width: 32, height: 32)
                                    Text(contact.initials)
                                        .font(QMDesign.Typography.labelSmall)
                                        .foregroundColor(.white)
                                }
                                Text(contact.fullName)
                                    .font(QMDesign.Typography.labelMedium)
                                    .foregroundColor(QMDesign.Colors.textPrimary)
                            }
                        }
                    }
                }
                .padding(QMDesign.Spacing.md)
                .background(
                    RoundedRectangle(cornerRadius: QMDesign.Radius.lg)
                        .fill(QMDesign.Colors.surfaceMedium)
                )

                // Summary Section
                if let summary = session.summary, !summary.isEmpty {
                    VStack(alignment: .leading, spacing: QMDesign.Spacing.sm) {
                        Label("Summary", systemImage: "doc.text")
                            .font(QMDesign.Typography.headline)
                            .foregroundColor(QMDesign.Colors.textPrimary)

                        MarkdownText(content: summary)
                    }
                    .padding(QMDesign.Spacing.md)
                    .background(
                        RoundedRectangle(cornerRadius: QMDesign.Radius.lg)
                            .fill(QMDesign.Colors.surfaceMedium)
                    )
                }

                // Action Items
                if !session.actionItems.isEmpty {
                    VStack(alignment: .leading, spacing: QMDesign.Spacing.sm) {
                        Label("Action Items", systemImage: "checkmark.circle")
                            .font(QMDesign.Typography.headline)
                            .foregroundColor(QMDesign.Colors.textPrimary)

                        ForEach(session.actionItems, id: \.self) { item in
                            HStack(alignment: .top, spacing: QMDesign.Spacing.xs) {
                                Image(systemName: "circle")
                                    .font(.system(size: 8))
                                    .foregroundColor(QMDesign.Colors.accent)
                                    .padding(.top, 4)
                                Text(item)
                                    .font(QMDesign.Typography.bodyMedium)
                                    .foregroundColor(QMDesign.Colors.textPrimary)
                            }
                        }
                    }
                    .padding(QMDesign.Spacing.md)
                    .background(
                        RoundedRectangle(cornerRadius: QMDesign.Radius.lg)
                            .fill(QMDesign.Colors.surfaceMedium)
                    )
                }

                // Transcript Section
                if !session.transcript.isEmpty {
                    VStack(alignment: .leading, spacing: QMDesign.Spacing.sm) {
                        HStack {
                            Label("Transcript", systemImage: "text.quote")
                                .font(QMDesign.Typography.headline)
                                .foregroundColor(QMDesign.Colors.textPrimary)

                            Spacer()

                            Text("\(session.transcript.split(separator: " ").count) words")
                                .font(QMDesign.Typography.caption)
                                .foregroundColor(QMDesign.Colors.textTertiary)
                        }

                        Text(session.transcript)
                            .font(QMDesign.Typography.bodyMedium)
                            .foregroundColor(QMDesign.Colors.textSecondary)
                            .textSelection(.enabled)
                    }
                    .padding(QMDesign.Spacing.md)
                    .background(
                        RoundedRectangle(cornerRadius: QMDesign.Radius.lg)
                            .fill(QMDesign.Colors.surfaceMedium)
                    )
                }
            }
            .padding(QMDesign.Spacing.md)
        }
        .navigationTitle(session.title)
        .navigationBarTitleDisplayMode(.large)
        .background(QMDesign.Colors.backgroundPrimary)
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                ShareLink(item: exportContent) {
                    Image(systemName: "square.and.arrow.up")
                }
            }
        }
    }

    private var exportContent: String {
        var content = "# \(session.title)\n"
        content += "Date: \(session.formattedDate)\n"
        content += "Duration: \(session.formattedDuration)\n\n"

        if let summary = session.summary {
            content += "## Summary\n\(summary)\n\n"
        }

        if !session.actionItems.isEmpty {
            content += "## Action Items\n"
            for item in session.actionItems {
                content += "- \(item)\n"
            }
            content += "\n"
        }

        if !session.transcript.isEmpty {
            content += "## Transcript\n\(session.transcript)\n"
        }

        return content
    }
}
