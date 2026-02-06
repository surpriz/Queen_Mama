//
//  ContactPickerSheet.swift
//  QueenMama
//
//  Memory Palace: Contact picker shown before starting a session
//

import SwiftUI
import SwiftData

struct ContactPickerSheet: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(\.modelContext) private var modelContext
    @Query(sort: \Contact.lastSeenAt, order: .reverse) private var contacts: [Contact]

    @Binding var selectedContact: Contact?
    let onStart: (Contact?) -> Void

    @State private var searchText = ""
    @State private var showingNewContactForm = false

    // New contact form fields
    @State private var newFirstName = ""
    @State private var newLastName = ""
    @State private var newEmail = ""
    @State private var newCompany = ""
    @State private var newRole = ""

    var body: some View {
        VStack(spacing: 0) {
            // Header
            header

            Divider()

            // Content
            if showingNewContactForm {
                newContactFormView
            } else {
                contactListView
            }

            Divider()

            // Footer with actions
            footer
        }
        .frame(width: 420, height: 520)
        .background(QMDesign.Colors.backgroundPrimary)
    }

    // MARK: - Header

    private var header: some View {
        VStack(spacing: QMDesign.Spacing.sm) {
            HStack(spacing: QMDesign.Spacing.md) {
                ZStack {
                    Circle()
                        .fill(QMDesign.Colors.primaryGradient)
                        .frame(width: 40, height: 40)
                    Image(systemName: "brain.head.profile")
                        .font(.system(size: 18, weight: .semibold))
                        .foregroundColor(.white)
                }

                VStack(alignment: .leading, spacing: 2) {
                    Text("Who are you talking to?")
                        .font(QMDesign.Typography.headline)
                        .foregroundColor(QMDesign.Colors.textPrimary)
                    Text("Memory Palace")
                        .font(QMDesign.Typography.caption)
                        .foregroundColor(QMDesign.Colors.textSecondary)
                }

                Spacer()

                Button(action: { dismiss() }) {
                    Image(systemName: "xmark.circle.fill")
                        .font(.system(size: 20))
                        .foregroundColor(QMDesign.Colors.textTertiary)
                }
                .buttonStyle(.plain)
            }

            // Value proposition
            HStack(spacing: QMDesign.Spacing.xs) {
                Image(systemName: "lightbulb.fill")
                    .font(.system(size: 11))
                    .foregroundColor(QMDesign.Colors.accent)
                Text("Link a contact to get AI briefings, track past conversations, and never forget key details")
                    .font(QMDesign.Typography.captionSmall)
                    .foregroundColor(QMDesign.Colors.textTertiary)
            }
            .padding(.horizontal, QMDesign.Spacing.sm)
            .padding(.vertical, QMDesign.Spacing.xs)
            .background(
                RoundedRectangle(cornerRadius: QMDesign.Radius.sm)
                    .fill(QMDesign.Colors.accent.opacity(0.08))
            )
        }
        .padding(QMDesign.Spacing.md)
    }

    // MARK: - Contact List View

    private var contactListView: some View {
        VStack(spacing: 0) {
            // Search bar
            HStack(spacing: QMDesign.Spacing.sm) {
                Image(systemName: "magnifyingglass")
                    .foregroundColor(QMDesign.Colors.textTertiary)
                TextField("Search contacts...", text: $searchText)
                    .textFieldStyle(.plain)
                    .font(QMDesign.Typography.bodyMedium)
                if !searchText.isEmpty {
                    Button(action: { searchText = "" }) {
                        Image(systemName: "xmark.circle.fill")
                            .foregroundColor(QMDesign.Colors.textTertiary)
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(QMDesign.Spacing.sm)
            .background(
                RoundedRectangle(cornerRadius: QMDesign.Radius.md)
                    .fill(QMDesign.Colors.surfaceLight)
            )
            .padding(.horizontal, QMDesign.Spacing.md)
            .padding(.vertical, QMDesign.Spacing.sm)

            // Contact list
            ScrollView {
                LazyVStack(spacing: QMDesign.Spacing.xs) {
                    // Recent contacts section
                    if searchText.isEmpty && !recentContacts.isEmpty {
                        sectionHeader("Recent")
                        ForEach(recentContacts) { contact in
                            contactRow(contact)
                        }

                        if !otherContacts.isEmpty {
                            sectionHeader("All contacts")
                            ForEach(otherContacts) { contact in
                                contactRow(contact)
                            }
                        }
                    } else if !filteredContacts.isEmpty {
                        ForEach(filteredContacts) { contact in
                            contactRow(contact)
                        }
                    } else {
                        emptyState
                    }
                }
                .padding(.horizontal, QMDesign.Spacing.md)
                .padding(.bottom, QMDesign.Spacing.md)
            }
        }
    }

    private func sectionHeader(_ title: String) -> some View {
        HStack {
            Text(title)
                .font(QMDesign.Typography.caption)
                .fontWeight(.semibold)
                .foregroundColor(QMDesign.Colors.textTertiary)
                .textCase(.uppercase)
            Spacer()
        }
        .padding(.top, QMDesign.Spacing.sm)
        .padding(.bottom, QMDesign.Spacing.xs)
    }

    private func contactRow(_ contact: Contact) -> some View {
        Button(action: { selectedContact = contact }) {
            HStack(spacing: QMDesign.Spacing.sm) {
                // Avatar
                ZStack {
                    Circle()
                        .fill(QMDesign.Colors.accent.opacity(0.15))
                        .frame(width: 40, height: 40)
                    Text(contact.initials)
                        .font(QMDesign.Typography.bodySmall)
                        .fontWeight(.semibold)
                        .foregroundColor(QMDesign.Colors.accent)
                }

                // Info
                VStack(alignment: .leading, spacing: 2) {
                    Text(contact.fullName)
                        .font(QMDesign.Typography.bodySmall)
                        .fontWeight(.medium)
                        .foregroundColor(QMDesign.Colors.textPrimary)
                    if let subtitle = contact.displaySubtitle {
                        Text(subtitle)
                            .font(QMDesign.Typography.captionSmall)
                            .foregroundColor(QMDesign.Colors.textSecondary)
                    }
                }

                Spacer()

                // Selection indicator
                if selectedContact?.id == contact.id {
                    Image(systemName: "checkmark.circle.fill")
                        .font(.system(size: 20))
                        .foregroundStyle(QMDesign.Colors.primaryGradient)
                }

                // Session count
                if contact.sessionCount > 0 {
                    Text("\(contact.sessionCount)")
                        .font(QMDesign.Typography.captionSmall)
                        .foregroundColor(QMDesign.Colors.textTertiary)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 2)
                        .background(
                            Capsule()
                                .fill(QMDesign.Colors.surfaceLight)
                        )
                }
            }
            .padding(QMDesign.Spacing.sm)
            .background(
                RoundedRectangle(cornerRadius: QMDesign.Radius.md)
                    .fill(selectedContact?.id == contact.id
                          ? QMDesign.Colors.accent.opacity(0.1)
                          : QMDesign.Colors.surfaceLight)
            )
            .overlay(
                RoundedRectangle(cornerRadius: QMDesign.Radius.md)
                    .stroke(selectedContact?.id == contact.id
                            ? QMDesign.Colors.accent.opacity(0.3)
                            : Color.clear, lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
    }

    private var emptyState: some View {
        VStack(spacing: QMDesign.Spacing.md) {
            Image(systemName: "person.crop.circle.badge.questionmark")
                .font(.system(size: 40))
                .foregroundColor(QMDesign.Colors.textTertiary)

            Text(searchText.isEmpty ? "No contacts yet" : "No results")
                .font(QMDesign.Typography.bodySmall)
                .foregroundColor(QMDesign.Colors.textSecondary)

            if searchText.isEmpty {
                Button(action: { showingNewContactForm = true }) {
                    HStack(spacing: QMDesign.Spacing.xs) {
                        Image(systemName: "plus.circle.fill")
                        Text("Create a contact")
                    }
                    .font(QMDesign.Typography.labelSmall)
                }
                .buttonStyle(.plain)
                .foregroundStyle(QMDesign.Colors.primaryGradient)
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, QMDesign.Spacing.xxl)
    }

    // MARK: - New Contact Form

    private var newContactFormView: some View {
        VStack(spacing: QMDesign.Spacing.md) {
            // Back button
            HStack {
                Button(action: {
                    showingNewContactForm = false
                    clearNewContactForm()
                }) {
                    HStack(spacing: QMDesign.Spacing.xs) {
                        Image(systemName: "chevron.left")
                        Text("Back")
                    }
                    .font(QMDesign.Typography.labelSmall)
                    .foregroundColor(QMDesign.Colors.accent)
                }
                .buttonStyle(.plain)

                Spacer()
            }
            .padding(.horizontal, QMDesign.Spacing.md)
            .padding(.top, QMDesign.Spacing.sm)

            ScrollView {
                VStack(spacing: QMDesign.Spacing.md) {
                    // Form fields
                    formField(title: "First name *", text: $newFirstName, placeholder: "John")
                    formField(title: "Last name", text: $newLastName, placeholder: "Doe")
                    formField(title: "Email", text: $newEmail, placeholder: "john@example.com")
                    formField(title: "Company", text: $newCompany, placeholder: "Acme Inc.")
                    formField(title: "Role", text: $newRole, placeholder: "Sales Director")
                }
                .padding(.horizontal, QMDesign.Spacing.md)
                .padding(.bottom, QMDesign.Spacing.md)
            }
        }
    }

    private func formField(title: String, text: Binding<String>, placeholder: String) -> some View {
        VStack(alignment: .leading, spacing: QMDesign.Spacing.xs) {
            Text(title)
                .font(QMDesign.Typography.caption)
                .fontWeight(.medium)
                .foregroundColor(QMDesign.Colors.textSecondary)

            TextField(placeholder, text: text)
                .textFieldStyle(.plain)
                .font(QMDesign.Typography.bodyMedium)
                .padding(QMDesign.Spacing.sm)
                .background(
                    RoundedRectangle(cornerRadius: QMDesign.Radius.md)
                        .fill(QMDesign.Colors.surfaceLight)
                )
                .overlay(
                    RoundedRectangle(cornerRadius: QMDesign.Radius.md)
                        .stroke(QMDesign.Colors.borderSubtle, lineWidth: 1)
                )
        }
    }

    // MARK: - Footer

    private var footer: some View {
        HStack(spacing: QMDesign.Spacing.md) {
            if showingNewContactForm {
                // Create contact button
                Button(action: createNewContact) {
                    HStack(spacing: QMDesign.Spacing.xs) {
                        Image(systemName: "plus.circle.fill")
                        Text("Create & Start")
                    }
                    .font(QMDesign.Typography.labelSmall)
                    .fontWeight(.semibold)
                    .foregroundColor(.white)
                    .padding(.horizontal, QMDesign.Spacing.lg)
                    .padding(.vertical, QMDesign.Spacing.sm)
                    .background(
                        Capsule()
                            .fill(canCreateContact ? AnyShapeStyle(QMDesign.Colors.primaryGradient) : AnyShapeStyle(QMDesign.Colors.surfaceMedium))
                    )
                }
                .buttonStyle(.plain)
                .disabled(!canCreateContact)
            } else {
                // New contact button
                Button(action: { showingNewContactForm = true }) {
                    HStack(spacing: QMDesign.Spacing.xs) {
                        Image(systemName: "plus")
                        Text("New")
                    }
                    .font(QMDesign.Typography.labelSmall)
                    .foregroundColor(QMDesign.Colors.accent)
                    .padding(.horizontal, QMDesign.Spacing.md)
                    .padding(.vertical, QMDesign.Spacing.sm)
                    .background(
                        Capsule()
                            .stroke(QMDesign.Colors.accent, lineWidth: 1)
                    )
                }
                .buttonStyle(.plain)

                Spacer()

                // Start button - adapts based on selection
                Button(action: { startSession(with: selectedContact) }) {
                    HStack(spacing: QMDesign.Spacing.xs) {
                        Image(systemName: "play.fill")
                        Text(selectedContact != nil ? "Start" : "Start Solo")
                    }
                    .font(QMDesign.Typography.labelSmall)
                    .fontWeight(.semibold)
                    .foregroundColor(.white)
                    .padding(.horizontal, QMDesign.Spacing.lg)
                    .padding(.vertical, QMDesign.Spacing.sm)
                    .background(
                        Capsule()
                            .fill(QMDesign.Colors.primaryGradient)
                    )
                }
                .buttonStyle(.plain)
            }
        }
        .padding(QMDesign.Spacing.md)
    }

    // MARK: - Helper Properties

    private var recentContacts: [Contact] {
        Array(contacts.prefix(5))
    }

    private var otherContacts: [Contact] {
        Array(contacts.dropFirst(5))
    }

    private var filteredContacts: [Contact] {
        if searchText.isEmpty {
            return contacts
        }
        let search = searchText.lowercased()
        return contacts.filter { contact in
            contact.fullName.lowercased().contains(search) ||
            (contact.email?.lowercased().contains(search) ?? false) ||
            (contact.company?.lowercased().contains(search) ?? false)
        }
    }

    private var canCreateContact: Bool {
        !newFirstName.trimmingCharacters(in: .whitespaces).isEmpty
    }

    // MARK: - Actions

    private func startSession(with contact: Contact?) {
        if let contact = contact {
            contact.lastSeenAt = Date()
            // Sync contact to server (creates or updates)
            ContactSyncManager.shared.queueContact(contact)
        }
        dismiss()
        onStart(contact)
    }

    private func createNewContact() {
        let contact = Contact(
            firstName: newFirstName.trimmingCharacters(in: .whitespaces),
            lastName: newLastName.isEmpty ? nil : newLastName.trimmingCharacters(in: .whitespaces),
            email: newEmail.isEmpty ? nil : newEmail.trimmingCharacters(in: .whitespaces),
            company: newCompany.isEmpty ? nil : newCompany.trimmingCharacters(in: .whitespaces),
            role: newRole.isEmpty ? nil : newRole.trimmingCharacters(in: .whitespaces)
        )
        modelContext.insert(contact)
        try? modelContext.save()

        // Sync contact to server
        ContactSyncManager.shared.queueContact(contact)

        selectedContact = contact
        startSession(with: contact)
    }

    private func clearNewContactForm() {
        newFirstName = ""
        newLastName = ""
        newEmail = ""
        newCompany = ""
        newRole = ""
    }
}

// MARK: - Preview

#Preview {
    ContactPickerSheet(
        selectedContact: .constant(nil),
        onStart: { _ in }
    )
}
