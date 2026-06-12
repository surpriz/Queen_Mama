//
//  ContactExtractionSheet.swift
//  QueenMamaIOS
//
//  Memory Palace: Sheet for reviewing and saving AI-extracted contact information
//  Adapted from macOS: removed fixed frame constraints for iOS adaptive layout
//

import SwiftUI
import SwiftData

struct ContactExtractionSheet: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(\.modelContext) private var modelContext

    let extractedContact: ContactExtractionService.ExtractedContact
    let session: Session?
    let onSave: (Contact) -> Void

    // Editable fields (pre-filled with extracted data)
    @State private var firstName: String
    @State private var lastName: String
    @State private var email: String
    @State private var company: String
    @State private var role: String
    @State private var selectedNotes: Set<String>

    init(
        extractedContact: ContactExtractionService.ExtractedContact,
        session: Session? = nil,
        onSave: @escaping (Contact) -> Void
    ) {
        self.extractedContact = extractedContact
        self.session = session
        self.onSave = onSave

        // Initialize state with extracted values
        _firstName = State(initialValue: extractedContact.firstName ?? "")
        _lastName = State(initialValue: extractedContact.lastName ?? "")
        _email = State(initialValue: extractedContact.email ?? "")
        _company = State(initialValue: extractedContact.company ?? "")
        _role = State(initialValue: extractedContact.role ?? "")
        _selectedNotes = State(initialValue: Set(extractedContact.suggestedNotes))
    }

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                // Content
                ScrollView {
                    VStack(spacing: QMDesign.Spacing.lg) {
                        // Confidence indicator
                        confidenceIndicator

                        // Form fields
                        formFields

                        // Suggested notes
                        if !extractedContact.suggestedNotes.isEmpty {
                            suggestedNotesSection
                        }
                    }
                    .padding(QMDesign.Spacing.md)
                }

                Divider()

                // Footer
                footer
            }
            .background(QMDesign.Colors.backgroundPrimary)
            .navigationTitle(Text("contact.extraction.title"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(action: { dismiss() }) {
                        Image(systemName: "xmark.circle.fill")
                            .foregroundColor(QMDesign.Colors.textTertiary)
                    }
                }
            }
        }
    }

    // MARK: - Confidence Indicator

    private var confidenceIndicator: some View {
        HStack(spacing: QMDesign.Spacing.sm) {
            Image(systemName: confidenceIcon)
                .font(.system(size: 14, weight: .semibold))
                .foregroundColor(confidenceColor)

            Text(String(localized: "contact.extraction.confidence \(Int(extractedContact.confidence * 100))"))
                .font(QMDesign.Typography.caption)
                .foregroundColor(QMDesign.Colors.textSecondary)

            Spacer()

            // Progress bar
            GeometryReader { geometry in
                ZStack(alignment: .leading) {
                    RoundedRectangle(cornerRadius: QMDesign.Radius.xs)
                        .fill(QMDesign.Colors.surfaceLight)
                        .frame(height: 6)

                    RoundedRectangle(cornerRadius: QMDesign.Radius.xs)
                        .fill(confidenceColor)
                        .frame(width: geometry.size.width * CGFloat(extractedContact.confidence), height: 6)
                }
            }
            .frame(width: 100, height: 6)
        }
        .padding(QMDesign.Spacing.sm)
        .background(
            RoundedRectangle(cornerRadius: QMDesign.Radius.md)
                .fill(confidenceColor.opacity(0.1))
        )
    }

    private var confidenceIcon: String {
        if extractedContact.confidence >= 0.8 {
            return "checkmark.circle.fill"
        } else if extractedContact.confidence >= 0.6 {
            return "exclamationmark.circle.fill"
        } else {
            return "questionmark.circle.fill"
        }
    }

    private var confidenceColor: Color {
        if extractedContact.confidence >= 0.8 {
            return QMDesign.Colors.success
        } else if extractedContact.confidence >= 0.6 {
            return QMDesign.Colors.warning
        } else {
            return QMDesign.Colors.error
        }
    }

    // MARK: - Form Fields

    private var formFields: some View {
        VStack(spacing: QMDesign.Spacing.md) {
            HStack(spacing: QMDesign.Spacing.md) {
                formField(title: String(localized: "contact.extraction.firstName"), text: $firstName, placeholder: String(localized: "contact.extraction.placeholder.firstName"), wasExtracted: extractedContact.firstName != nil)
                formField(title: String(localized: "contact.extraction.lastName"), text: $lastName, placeholder: String(localized: "contact.extraction.placeholder.lastName"), wasExtracted: extractedContact.lastName != nil)
            }

            formField(title: String(localized: "contact.extraction.email"), text: $email, placeholder: String(localized: "contact.extraction.placeholder.email"), wasExtracted: extractedContact.email != nil)

            HStack(spacing: QMDesign.Spacing.md) {
                formField(title: String(localized: "contact.extraction.company"), text: $company, placeholder: String(localized: "contact.extraction.placeholder.company"), wasExtracted: extractedContact.company != nil)
                formField(title: String(localized: "contact.extraction.role"), text: $role, placeholder: String(localized: "contact.extraction.placeholder.role"), wasExtracted: extractedContact.role != nil)
            }
        }
    }

    private func formField(title: String, text: Binding<String>, placeholder: String, wasExtracted: Bool) -> some View {
        VStack(alignment: .leading, spacing: QMDesign.Spacing.xs) {
            HStack(spacing: QMDesign.Spacing.xs) {
                Text(title)
                    .font(QMDesign.Typography.caption)
                    .fontWeight(.medium)
                    .foregroundColor(QMDesign.Colors.textSecondary)

                if wasExtracted {
                    Image(systemName: "sparkles")
                        .font(.system(size: 10))
                        .foregroundStyle(QMDesign.Colors.primaryGradient)
                }
            }

            TextField(placeholder, text: text)
                .textFieldStyle(.plain)
                .font(QMDesign.Typography.bodyMedium)
                .padding(QMDesign.Spacing.sm)
                .background(
                    RoundedRectangle(cornerRadius: QMDesign.Radius.md)
                        .fill(wasExtracted ? QMDesign.Colors.accent.opacity(0.05) : QMDesign.Colors.surfaceLight)
                )
                .overlay(
                    RoundedRectangle(cornerRadius: QMDesign.Radius.md)
                        .stroke(wasExtracted ? QMDesign.Colors.accent.opacity(0.2) : QMDesign.Colors.borderSubtle, lineWidth: 1)
                )
        }
    }

    // MARK: - Suggested Notes Section

    private var suggestedNotesSection: some View {
        VStack(alignment: .leading, spacing: QMDesign.Spacing.sm) {
            HStack(spacing: QMDesign.Spacing.xs) {
                Image(systemName: "note.text")
                    .font(.system(size: 12))
                    .foregroundColor(QMDesign.Colors.accent)
                Text(String(localized: "contact.extraction.suggestedNotes"))
                    .font(QMDesign.Typography.caption)
                    .fontWeight(.semibold)
                    .foregroundColor(QMDesign.Colors.textSecondary)
            }

            VStack(spacing: QMDesign.Spacing.xs) {
                ForEach(extractedContact.suggestedNotes, id: \.self) { note in
                    noteRow(note: note)
                }
            }
        }
        .padding(QMDesign.Spacing.sm)
        .background(
            RoundedRectangle(cornerRadius: QMDesign.Radius.md)
                .fill(QMDesign.Colors.surfaceLight)
        )
    }

    private func noteRow(note: String) -> some View {
        Button(action: { toggleNote(note) }) {
            HStack(spacing: QMDesign.Spacing.sm) {
                Image(systemName: selectedNotes.contains(note) ? "checkmark.circle.fill" : "circle")
                    .font(.system(size: 16))
                    .foregroundColor(selectedNotes.contains(note) ? QMDesign.Colors.accent : QMDesign.Colors.textTertiary)

                Text(note)
                    .font(QMDesign.Typography.bodySmall)
                    .foregroundColor(QMDesign.Colors.textPrimary)
                    .lineLimit(2)
                    .multilineTextAlignment(.leading)

                Spacer()
            }
            .padding(QMDesign.Spacing.sm)
            .background(
                RoundedRectangle(cornerRadius: QMDesign.Radius.sm)
                    .fill(selectedNotes.contains(note) ? QMDesign.Colors.accent.opacity(0.1) : Color.clear)
            )
        }
        .buttonStyle(.plain)
    }

    private func toggleNote(_ note: String) {
        if selectedNotes.contains(note) {
            selectedNotes.remove(note)
        } else {
            selectedNotes.insert(note)
        }
    }

    // MARK: - Footer

    private var footer: some View {
        HStack(spacing: QMDesign.Spacing.md) {
            // Ignore button
            Button(action: { dismiss() }) {
                Text(String(localized: "contact.extraction.dismiss"))
                    .font(QMDesign.Typography.labelSmall)
                    .foregroundColor(QMDesign.Colors.textSecondary)
                    .padding(.horizontal, QMDesign.Spacing.md)
                    .padding(.vertical, QMDesign.Spacing.sm)
            }
            .buttonStyle(.plain)

            Spacer()

            // Save button
            Button(action: saveContact) {
                HStack(spacing: QMDesign.Spacing.xs) {
                    Image(systemName: "checkmark.circle.fill")
                    Text(String(localized: "contact.extraction.save"))
                }
                .font(QMDesign.Typography.labelSmall)
                .fontWeight(.semibold)
                .foregroundColor(.white)
                .padding(.horizontal, QMDesign.Spacing.lg)
                .padding(.vertical, QMDesign.Spacing.sm)
                .background(
                    Capsule()
                        .fill(canSave ? AnyShapeStyle(QMDesign.Colors.primaryGradient) : AnyShapeStyle(QMDesign.Colors.surfaceMedium))
                )
            }
            .buttonStyle(.plain)
            .disabled(!canSave)
        }
        .padding(QMDesign.Spacing.md)
    }

    private var canSave: Bool {
        !firstName.trimmingCharacters(in: .whitespaces).isEmpty
    }

    // MARK: - Actions

    private func saveContact() {
        let contact = Contact(
            firstName: firstName.trimmingCharacters(in: .whitespaces),
            lastName: lastName.isEmpty ? nil : lastName.trimmingCharacters(in: .whitespaces),
            email: email.isEmpty ? nil : email.trimmingCharacters(in: .whitespaces),
            company: company.isEmpty ? nil : company.trimmingCharacters(in: .whitespaces),
            role: role.isEmpty ? nil : role.trimmingCharacters(in: .whitespaces)
        )

        // Add selected notes
        for noteContent in selectedNotes {
            let note = ContactNote(content: noteContent)
            contact.notes.append(note)
        }

        // Associate with session if provided
        if let session = session {
            session.contact = contact
            session.contactId = contact.id
        }

        modelContext.insert(contact)
        try? modelContext.save()

        onSave(contact)
        dismiss()
    }
}
