import SwiftUI
import SwiftData

struct ContactsListView: View {
    @Environment(\.modelContext) private var modelContext
    @Query(sort: \Contact.lastSeenAt, order: .reverse) private var contacts: [Contact]

    @State private var searchText = ""
    @State private var showingNewContact = false

    private var filteredContacts: [Contact] {
        if searchText.isEmpty { return contacts }
        return contacts.filter {
            $0.fullName.localizedCaseInsensitiveContains(searchText) ||
            ($0.company ?? "").localizedCaseInsensitiveContains(searchText) ||
            ($0.email ?? "").localizedCaseInsensitiveContains(searchText)
        }
    }

    var body: some View {
        List {
            if filteredContacts.isEmpty {
                ContentUnavailableView(
                    searchText.isEmpty ? "No Contacts" : "No Results",
                    systemImage: searchText.isEmpty ? "person.2" : "magnifyingglass",
                    description: Text(searchText.isEmpty ? "Contacts are created from your sessions" : "Try a different search term")
                )
            } else {
                ForEach(filteredContacts) { contact in
                    NavigationLink(value: contact) {
                        ContactRowView(contact: contact)
                    }
                    .swipeActions(edge: .trailing) {
                        Button(role: .destructive) {
                            modelContext.delete(contact)
                            try? modelContext.save()
                        } label: {
                            Label("Delete", systemImage: "trash")
                        }
                    }
                }
            }
        }
        .navigationTitle("Contacts")
        .navigationDestination(for: Contact.self) { contact in
            ContactDetailView(contact: contact)
        }
        .searchable(text: $searchText, prompt: "Search contacts...")
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button { showingNewContact = true } label: {
                    Image(systemName: "plus.circle.fill")
                        .foregroundStyle(QMDesign.Colors.primaryGradient)
                }
            }
        }
        .sheet(isPresented: $showingNewContact) {
            NewContactSheet()
        }
        .onAppear {
            // Wire import callback to SwiftData
            ContactSyncManager.shared.onContactsImported = { importedContacts in
                for contact in importedContacts {
                    modelContext.insert(contact)
                }
                try? modelContext.save()
                print("[ContactsListView] Imported \(importedContacts.count) contacts into SwiftData")
            }

            // Pull contacts from server (skip already-local ones)
            let localRemoteIds = Set(contacts.compactMap { $0.remoteId })
            let localEmails = Set(contacts.compactMap { $0.email?.lowercased() })
            Task {
                await ContactSyncManager.shared.pullRemoteContacts(
                    localContactIds: localRemoteIds,
                    localContactEmails: localEmails
                )
            }
        }
    }
}

// MARK: - Contact Row View

struct ContactRowView: View {
    let contact: Contact

    var body: some View {
        HStack(spacing: QMDesign.Spacing.sm) {
            // Avatar
            ZStack {
                Circle()
                    .fill(QMDesign.Colors.primaryGradient)
                    .frame(width: 44, height: 44)
                Text(contact.initials)
                    .font(QMDesign.Typography.labelLarge)
                    .foregroundColor(.white)
            }

            VStack(alignment: .leading, spacing: QMDesign.Spacing.xxxs) {
                Text(contact.fullName)
                    .font(QMDesign.Typography.headline)
                    .foregroundColor(QMDesign.Colors.textPrimary)

                if let subtitle = contact.displaySubtitle {
                    Text(subtitle)
                        .font(QMDesign.Typography.caption)
                        .foregroundColor(QMDesign.Colors.textSecondary)
                }

                HStack(spacing: QMDesign.Spacing.sm) {
                    Text("\(contact.sessionCount) sessions")
                        .font(QMDesign.Typography.captionSmall)
                        .foregroundColor(QMDesign.Colors.textTertiary)

                    Text(contact.formattedLastSeen)
                        .font(QMDesign.Typography.captionSmall)
                        .foregroundColor(QMDesign.Colors.textTertiary)
                }
            }
        }
        .padding(.vertical, QMDesign.Spacing.xxs)
    }
}

// MARK: - Contact Detail View

struct ContactDetailView: View {
    @Bindable var contact: Contact
    @Environment(\.modelContext) private var modelContext

    @State private var newNoteContent = ""
    @State private var isEditingName = false

    var body: some View {
        List {
            // Info Section
            Section("Contact Info") {
                LabeledContent("First Name") {
                    Text(contact.firstName)
                }
                if let lastName = contact.lastName {
                    LabeledContent("Last Name") {
                        Text(lastName)
                    }
                }
                if let email = contact.email {
                    LabeledContent("Email") {
                        Text(email)
                    }
                }
                if let company = contact.company {
                    LabeledContent("Company") {
                        Text(company)
                    }
                }
                if let role = contact.role {
                    LabeledContent("Role") {
                        Text(role)
                    }
                }
            }

            // Notes Section
            Section("Notes (\(contact.notes.count))") {
                ForEach(contact.notes.sorted(by: { $0.createdAt > $1.createdAt })) { note in
                    VStack(alignment: .leading, spacing: QMDesign.Spacing.xs) {
                        Text(note.content)
                            .font(QMDesign.Typography.bodyMedium)
                            .foregroundColor(QMDesign.Colors.textPrimary)
                        Text(note.formattedDate)
                            .font(QMDesign.Typography.captionSmall)
                            .foregroundColor(QMDesign.Colors.textTertiary)
                    }
                }

                HStack {
                    TextField("Add a note...", text: $newNoteContent)
                    Button("Add") {
                        guard !newNoteContent.isEmpty else { return }
                        let note = ContactNote(content: newNoteContent)
                        contact.notes.append(note)
                        newNoteContent = ""
                        try? modelContext.save()
                    }
                    .disabled(newNoteContent.isEmpty)
                }
            }

            // Sessions Section
            Section("Sessions (\(contact.sessionCount))") {
                ForEach(contact.sessions.sorted(by: { $0.startTime > $1.startTime })) { session in
                    NavigationLink(value: session) {
                        SessionRowView(session: session)
                    }
                }
            }
        }
        .navigationTitle(contact.fullName)
        .navigationBarTitleDisplayMode(.large)
        .navigationDestination(for: Session.self) { session in
            SessionDetailView(session: session)
        }
    }
}

// MARK: - New Contact Sheet

struct NewContactSheet: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(\.modelContext) private var modelContext

    @State private var firstName = ""
    @State private var lastName = ""
    @State private var email = ""
    @State private var company = ""
    @State private var role = ""

    var body: some View {
        NavigationStack {
            Form {
                Section("Name") {
                    TextField("First Name", text: $firstName)
                    TextField("Last Name", text: $lastName)
                }
                Section("Details") {
                    TextField("Email", text: $email)
                        .textContentType(.emailAddress)
                        .keyboardType(.emailAddress)
                    TextField("Company", text: $company)
                    TextField("Role", text: $role)
                }
            }
            .navigationTitle("New Contact")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        let contact = Contact(
                            firstName: firstName,
                            lastName: lastName.isEmpty ? nil : lastName,
                            email: email.isEmpty ? nil : email,
                            company: company.isEmpty ? nil : company,
                            role: role.isEmpty ? nil : role
                        )
                        modelContext.insert(contact)
                        try? modelContext.save()
                        ContactSyncManager.shared.queueContact(contact)
                        dismiss()
                    }
                    .disabled(firstName.isEmpty)
                }
            }
        }
    }
}
