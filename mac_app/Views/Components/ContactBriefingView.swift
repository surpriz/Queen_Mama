//
//  ContactBriefingView.swift
//  QueenMama
//
//  Memory Palace: Enriched briefing view showing contact info, history, and notes
//

import SwiftUI
import SwiftData

struct ContactBriefingView: View {
    let contact: Contact

    @Environment(\.modelContext) private var modelContext

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: QMDesign.Spacing.md) {
                // Contact Card
                contactCard

                // Previous Sessions
                if !recentSessions.isEmpty {
                    previousSessionsSection
                }

                // Memory Palace Notes
                if !contact.notes.isEmpty {
                    notesSection
                }
            }
            .padding(QMDesign.Spacing.md)
        }
    }

    // MARK: - Contact Card

    private var contactCard: some View {
        HStack(spacing: QMDesign.Spacing.md) {
            // Avatar
            ZStack {
                Circle()
                    .fill(QMDesign.Colors.primaryGradient)
                    .frame(width: 48, height: 48)
                Text(contact.initials)
                    .font(QMDesign.Typography.headline)
                    .fontWeight(.bold)
                    .foregroundColor(.white)
            }

            // Info
            VStack(alignment: .leading, spacing: QMDesign.Spacing.xs) {
                Text(contact.fullName)
                    .font(QMDesign.Typography.headline)
                    .foregroundColor(QMDesign.Colors.textPrimary)

                if let subtitle = contact.displaySubtitle {
                    Text(subtitle)
                        .font(QMDesign.Typography.bodySmall)
                        .foregroundColor(QMDesign.Colors.textSecondary)
                }

                if let email = contact.email {
                    HStack(spacing: QMDesign.Spacing.xs) {
                        Image(systemName: "envelope")
                            .font(.system(size: 10))
                        Text(email)
                            .font(QMDesign.Typography.caption)
                    }
                    .foregroundColor(QMDesign.Colors.textTertiary)
                }
            }

            Spacer()

            // Session count badge
            VStack(spacing: 2) {
                Text("\(contact.sessionCount)")
                    .font(QMDesign.Typography.headline)
                    .fontWeight(.bold)
                    .foregroundStyle(QMDesign.Colors.primaryGradient)
                Text(String(localized: "contact.briefing.sessions"))
                    .font(QMDesign.Typography.captionSmall)
                    .foregroundColor(QMDesign.Colors.textTertiary)
            }
        }
        .padding(QMDesign.Spacing.md)
        .background(
            RoundedRectangle(cornerRadius: QMDesign.Radius.md)
                .fill(QMDesign.Colors.surfaceLight)
        )
    }

    // MARK: - Previous Sessions Section

    private var recentSessions: [Session] {
        Array(contact.sessions.sorted { $0.startTime > $1.startTime }.prefix(3))
    }

    private var previousSessionsSection: some View {
        VStack(alignment: .leading, spacing: QMDesign.Spacing.sm) {
            sectionHeader(String(localized: "contact.briefing.previousSessions"), icon: "clock.arrow.circlepath")

            VStack(spacing: QMDesign.Spacing.xs) {
                ForEach(recentSessions) { session in
                    sessionRow(session)
                }
            }
        }
    }

    private func sessionRow(_ session: Session) -> some View {
        VStack(alignment: .leading, spacing: QMDesign.Spacing.xs) {
            HStack {
                Text(session.title)
                    .font(QMDesign.Typography.bodySmall)
                    .fontWeight(.medium)
                    .foregroundColor(QMDesign.Colors.textPrimary)
                    .lineLimit(1)

                Spacer()

                Text(formatSessionDate(session.startTime))
                    .font(QMDesign.Typography.captionSmall)
                    .foregroundColor(QMDesign.Colors.textTertiary)
            }

            if let summary = session.summary, !summary.isEmpty {
                Text(truncateSummary(summary))
                    .font(QMDesign.Typography.caption)
                    .foregroundColor(QMDesign.Colors.textSecondary)
                    .lineLimit(2)
            }
        }
        .padding(QMDesign.Spacing.sm)
        .background(
            RoundedRectangle(cornerRadius: QMDesign.Radius.sm)
                .fill(QMDesign.Colors.surfaceLight)
        )
    }

    // MARK: - Notes Section

    private var notesSection: some View {
        VStack(alignment: .leading, spacing: QMDesign.Spacing.sm) {
            sectionHeader(String(localized: "contact.briefing.memoryPalace"), icon: "brain.head.profile")

            VStack(spacing: QMDesign.Spacing.xs) {
                ForEach(Array(contact.notes.prefix(3))) { note in
                    noteRow(note)
                }
            }
        }
    }

    private func noteRow(_ note: ContactNote) -> some View {
        HStack(alignment: .top, spacing: QMDesign.Spacing.sm) {
            Image(systemName: "note.text")
                .font(.system(size: 12))
                .foregroundColor(QMDesign.Colors.accent)
                .frame(width: 20)

            VStack(alignment: .leading, spacing: 2) {
                Text(note.content)
                    .font(QMDesign.Typography.bodySmall)
                    .foregroundColor(QMDesign.Colors.textPrimary)
                    .lineLimit(3)

                Text(note.formattedDate)
                    .font(QMDesign.Typography.captionSmall)
                    .foregroundColor(QMDesign.Colors.textTertiary)
            }

            Spacer()
        }
        .padding(QMDesign.Spacing.sm)
        .background(
            RoundedRectangle(cornerRadius: QMDesign.Radius.sm)
                .fill(QMDesign.Colors.accent.opacity(0.05))
        )
        .overlay(
            RoundedRectangle(cornerRadius: QMDesign.Radius.sm)
                .stroke(QMDesign.Colors.accent.opacity(0.1), lineWidth: 1)
        )
    }

    // MARK: - Helpers

    private func sectionHeader(_ title: String, icon: String) -> some View {
        HStack(spacing: QMDesign.Spacing.xs) {
            Image(systemName: icon)
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(QMDesign.Colors.primaryGradient)
            Text(title)
                .font(QMDesign.Typography.caption)
                .fontWeight(.semibold)
                .foregroundColor(QMDesign.Colors.textSecondary)
                .textCase(.uppercase)
        }
    }

    private func formatSessionDate(_ date: Date) -> String {
        let formatter = RelativeDateTimeFormatter()
        formatter.unitsStyle = .abbreviated
        return formatter.localizedString(for: date, relativeTo: Date())
    }

    private func truncateSummary(_ summary: String) -> String {
        let lines = summary.components(separatedBy: .newlines)
        let first = lines.first ?? summary
        if first.count > 120 {
            return String(first.prefix(120)) + "..."
        }
        return first
    }
}

// MARK: - Empty Briefing View

struct EmptyBriefingView: View {
    var body: some View {
        VStack(spacing: QMDesign.Spacing.md) {
            Image(systemName: "person.crop.circle.badge.questionmark")
                .font(.system(size: 40))
                .foregroundColor(QMDesign.Colors.textTertiary)

            VStack(spacing: QMDesign.Spacing.xs) {
                Text(String(localized: "contact.briefing.empty.title"))
                    .font(QMDesign.Typography.bodySmall)
                    .fontWeight(.medium)
                    .foregroundColor(QMDesign.Colors.textSecondary)

                Text(String(localized: "contact.briefing.empty.subtitle"))
                    .font(QMDesign.Typography.caption)
                    .foregroundColor(QMDesign.Colors.textTertiary)
                    .multilineTextAlignment(.center)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .padding(QMDesign.Spacing.lg)
    }
}

// MARK: - Preview

#Preview("With Contact") {
    let config = ModelConfiguration(isStoredInMemoryOnly: true)
    let container = try! ModelContainer(for: Contact.self, ContactNote.self, Session.self, configurations: config)

    let contact = Contact(
        firstName: "Jean",
        lastName: "Dupont",
        email: "jean.dupont@acme.com",
        company: "Acme Inc.",
        role: "Directeur Commercial"
    )

    let note = ContactNote(content: "Intéressé par notre solution CRM - a mentionné un budget Q2")
    contact.notes.append(note)

    container.mainContext.insert(contact)

    return ContactBriefingView(contact: contact)
        .modelContainer(container)
        .frame(width: 380, height: 400)
}

#Preview("Empty") {
    EmptyBriefingView()
        .frame(width: 380, height: 400)
        .background(Color.black)
}
