//
//  ContactsListView.swift
//  QueenMama
//
//  Memory Palace: Browse, edit, and manage contacts from the dashboard
//

import SwiftUI
import SwiftData

struct ContactsListView: View {
    @Environment(\.modelContext) private var modelContext
    @StateObject private var contactSyncManager = ContactSyncManager.shared

    @Query(sort: \Contact.lastSeenAt, order: .reverse)
    private var contacts: [Contact]

    @State private var selectedContact: Contact?
    @State private var searchText = ""
    @State private var showingNewContactForm = false
    @State private var contactToDelete: Contact?
    @State private var showingDeleteConfirmation = false

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

    var body: some View {
        HSplitView {
            // Contact List
            VStack(spacing: 0) {
                // Search Bar
                ContactSearchBar(searchText: $searchText)

                // Sync bar
                if contactSyncManager.canSync {
                    HStack(spacing: QMDesign.Spacing.md) {
                        if contactSyncManager.pendingCount > 0 {
                            Text("\(contactSyncManager.pendingCount) pending")
                                .font(QMDesign.Typography.captionSmall)
                                .foregroundColor(QMDesign.Colors.textTertiary)
                        }

                        Spacer()

                        // Pull from server
                        Button(action: {
                            Task { await pullContacts() }
                        }) {
                            HStack(spacing: 4) {
                                if contactSyncManager.isPulling {
                                    ProgressView()
                                        .scaleEffect(0.6)
                                        .frame(width: 12, height: 12)
                                } else {
                                    Image(systemName: "arrow.down.circle")
                                        .font(.system(size: 11))
                                }
                                Text("Refresh")
                                    .font(QMDesign.Typography.captionSmall)
                            }
                            .foregroundColor(QMDesign.Colors.accent)
                        }
                        .buttonStyle(.plain)
                        .disabled(contactSyncManager.isPulling)
                        .help("Pull contacts from web dashboard")

                        // Push to server
                        Button(action: {
                            Task {
                                await contactSyncManager.syncNow()
                            }
                        }) {
                            HStack(spacing: 4) {
                                if contactSyncManager.isSyncing {
                                    ProgressView()
                                        .scaleEffect(0.6)
                                        .frame(width: 12, height: 12)
                                } else {
                                    Image(systemName: "arrow.triangle.2.circlepath")
                                        .font(.system(size: 11))
                                }
                                Text("Sync")
                                    .font(QMDesign.Typography.captionSmall)
                            }
                            .foregroundColor(QMDesign.Colors.accent)
                        }
                        .buttonStyle(.plain)
                        .disabled(contactSyncManager.isSyncing)
                        .help("Sync contacts to web dashboard")
                    }
                    .padding(.horizontal, QMDesign.Spacing.sm)
                    .padding(.bottom, QMDesign.Spacing.xs)
                }

                // Contact List
                ScrollView {
                    LazyVStack(spacing: QMDesign.Spacing.xs) {
                        ForEach(filteredContacts) { contact in
                            ModernContactCard(
                                contact: contact,
                                isSelected: selectedContact?.id == contact.id,
                                isSynced: contactSyncManager.isSynced(contact.id),
                                canSync: contactSyncManager.canSync,
                                action: {
                                    selectedContact = contact
                                },
                                onDelete: {
                                    contactToDelete = contact
                                    showingDeleteConfirmation = true
                                },
                                onSync: {
                                    contactSyncManager.queueContact(contact)
                                }
                            )
                        }
                    }
                    .padding(QMDesign.Spacing.sm)
                }

                // Empty state
                if filteredContacts.isEmpty {
                    EmptyContactsView(isFiltered: !searchText.isEmpty)
                }

                // New contact button
                Button(action: { showingNewContactForm = true }) {
                    HStack(spacing: QMDesign.Spacing.xs) {
                        Image(systemName: "plus.circle.fill")
                            .font(.system(size: 14))
                        Text("New Contact")
                            .font(QMDesign.Typography.labelSmall)
                    }
                    .foregroundColor(.white)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, QMDesign.Spacing.sm)
                    .background(
                        RoundedRectangle(cornerRadius: QMDesign.Radius.md)
                            .fill(QMDesign.Colors.primaryGradient)
                    )
                }
                .buttonStyle(.plain)
                .padding(QMDesign.Spacing.sm)
            }
            .frame(minWidth: 300, maxWidth: 380)
            .background(QMDesign.Colors.backgroundSecondary)

            // Contact Detail
            if let contact = selectedContact {
                ContactDetailView(contact: contact, onDelete: {
                    contactToDelete = contact
                    showingDeleteConfirmation = true
                })
            } else {
                EmptyContactDetailView()
            }
        }
        .confirmationDialog(
            "Delete Contact",
            isPresented: $showingDeleteConfirmation,
            presenting: contactToDelete
        ) { contact in
            Button("Delete", role: .destructive) {
                deleteContact(contact)
            }
            Button("Cancel", role: .cancel) {}
        } message: { contact in
            Text("Delete \"\(contact.fullName)\"? This cannot be undone.")
        }
        .sheet(isPresented: $showingNewContactForm) {
            NewContactSheet { contact in
                selectedContact = contact
            }
        }
        .onAppear {
            // Wire up callbacks for bidirectional sync
            contactSyncManager.onContactsImported = { [weak modelContext] importedContacts in
                guard let modelContext else { return }
                for contact in importedContacts {
                    modelContext.insert(contact)
                }
                try? modelContext.save()
            }

            contactSyncManager.onContactSynced = { [weak modelContext] originalId, remoteId in
                guard let modelContext else { return }
                // Find the contact by its UUID and update remoteId
                guard let uuid = UUID(uuidString: originalId) else { return }
                let descriptor = FetchDescriptor<Contact>(predicate: #Predicate { $0.id == uuid })
                if let contact = try? modelContext.fetch(descriptor).first {
                    contact.remoteId = remoteId
                    contact.isSynced = true
                    try? modelContext.save()
                }
            }

            // Auto-sync pending contacts on view load
            if contactSyncManager.canSync && contactSyncManager.pendingCount > 0 {
                Task {
                    await contactSyncManager.syncNow()
                }
            }

            // Auto-pull if authenticated
            if contactSyncManager.canSync {
                Task { await pullContacts() }
            }
        }
    }

    private func pullContacts() async {
        let localIds = Set(contacts.compactMap { $0.remoteId })
        let localEmails = Set(contacts.compactMap { $0.email?.lowercased() })
        await contactSyncManager.pullRemoteContacts(localContactIds: localIds, localContactEmails: localEmails)
    }

    private func deleteContact(_ contact: Contact) {
        if selectedContact?.id == contact.id {
            selectedContact = nil
        }
        modelContext.delete(contact)
        try? modelContext.save()
    }
}

// MARK: - Contact Search Bar

private struct ContactSearchBar: View {
    @Binding var searchText: String
    @FocusState private var isFocused: Bool

    var body: some View {
        HStack(spacing: QMDesign.Spacing.xs) {
            Image(systemName: "magnifyingglass")
                .font(.system(size: 13))
                .foregroundColor(isFocused ? QMDesign.Colors.accent : QMDesign.Colors.textTertiary)

            TextField("Search contacts...", text: $searchText)
                .textFieldStyle(.plain)
                .font(QMDesign.Typography.bodySmall)
                .focused($isFocused)

            if !searchText.isEmpty {
                Button(action: { searchText = "" }) {
                    Image(systemName: "xmark.circle.fill")
                        .font(.system(size: 12))
                        .foregroundColor(QMDesign.Colors.textTertiary)
                }
                .buttonStyle(.plain)
            }
        }
        .padding(QMDesign.Spacing.sm)
        .background(
            RoundedRectangle(cornerRadius: QMDesign.Radius.md)
                .fill(QMDesign.Colors.surfaceLight)
                .overlay(
                    RoundedRectangle(cornerRadius: QMDesign.Radius.md)
                        .stroke(isFocused ? QMDesign.Colors.accent.opacity(0.5) : Color.clear, lineWidth: 1)
                )
        )
        .padding(QMDesign.Spacing.sm)
    }
}

// MARK: - Modern Contact Card

private struct ModernContactCard: View {
    let contact: Contact
    let isSelected: Bool
    var isSynced: Bool = false
    var canSync: Bool = false
    let action: () -> Void
    let onDelete: () -> Void
    var onSync: (() -> Void)?

    @State private var isHovered = false
    @State private var isDeleteHovered = false

    var body: some View {
        Button(action: action) {
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
                        .font(QMDesign.Typography.bodyMedium)
                        .fontWeight(.semibold)
                        .foregroundColor(QMDesign.Colors.textPrimary)
                        .lineLimit(1)

                    if let subtitle = contact.displaySubtitle {
                        Text(subtitle)
                            .font(QMDesign.Typography.captionSmall)
                            .foregroundColor(QMDesign.Colors.textSecondary)
                            .lineLimit(1)
                    }
                }

                Spacer()

                // Metadata
                VStack(alignment: .trailing, spacing: 4) {
                    // Last seen
                    Text(contact.formattedLastSeen)
                        .font(QMDesign.Typography.captionSmall)
                        .foregroundColor(QMDesign.Colors.textTertiary)

                    HStack(spacing: 6) {
                        // Session count
                        if contact.sessionCount > 0 {
                            HStack(spacing: 2) {
                                Image(systemName: "waveform")
                                    .font(.system(size: 8))
                                Text("\(contact.sessionCount)")
                                    .font(QMDesign.Typography.captionSmall)
                            }
                            .foregroundColor(QMDesign.Colors.textTertiary)
                        }

                        // Sync indicator
                        if canSync {
                            if isSynced {
                                Image(systemName: "checkmark.icloud")
                                    .font(.system(size: 10))
                                    .foregroundColor(QMDesign.Colors.success)
                            } else if let onSync = onSync {
                                Button(action: onSync) {
                                    Image(systemName: "icloud.slash")
                                        .font(.system(size: 10))
                                        .foregroundColor(QMDesign.Colors.textTertiary)
                                }
                                .buttonStyle(.plain)
                                .help("Sync to dashboard")
                            }
                        }
                    }
                }

                // Delete button (visible on hover)
                if isHovered {
                    Button(action: onDelete) {
                        Image(systemName: "trash")
                            .font(.system(size: 12))
                            .foregroundColor(isDeleteHovered ? QMDesign.Colors.error : QMDesign.Colors.textTertiary)
                    }
                    .buttonStyle(.plain)
                    .onHover { isDeleteHovered = $0 }
                    .help("Delete contact")
                }
            }
            .padding(QMDesign.Spacing.sm)
            .background(
                RoundedRectangle(cornerRadius: QMDesign.Radius.md)
                    .fill(isSelected ? AnyShapeStyle(QMDesign.Colors.accent.opacity(0.1)) : AnyShapeStyle(QMDesign.Colors.surfaceLight))
                    .overlay(
                        RoundedRectangle(cornerRadius: QMDesign.Radius.md)
                            .stroke(
                                isSelected ? QMDesign.Colors.accent.opacity(0.4) : (isHovered ? QMDesign.Colors.borderMedium : QMDesign.Colors.borderSubtle),
                                lineWidth: 1
                            )
                    )
            )
            .scaleEffect(isHovered && !isSelected ? 1.01 : 1.0)
        }
        .buttonStyle(.plain)
        .onHover { isHovered = $0 }
        .animation(QMDesign.Animation.quick, value: isHovered)
        .animation(QMDesign.Animation.quick, value: isSelected)
    }
}

// MARK: - Contact Detail View

private struct ContactDetailView: View {
    @Bindable var contact: Contact
    @Environment(\.modelContext) private var modelContext
    let onDelete: () -> Void

    @State private var isEditing = false
    @State private var editFirstName = ""
    @State private var editLastName = ""
    @State private var editEmail = ""
    @State private var editCompany = ""
    @State private var editRole = ""

    @State private var newNoteText = ""
    @State private var showingNotes = true
    @State private var showingSessions = true

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: QMDesign.Spacing.lg) {
                // Hero Header
                contactHeader

                // Info Section
                if isEditing {
                    editForm
                } else {
                    contactInfo
                }

                // Notes Section
                notesSection

                // Sessions Section
                sessionsSection

                // Danger Zone
                dangerZone
            }
            .padding(QMDesign.Spacing.lg)
        }
        .background(QMDesign.Colors.backgroundPrimary)
    }

    // MARK: - Header

    private var contactHeader: some View {
        VStack(alignment: .leading, spacing: QMDesign.Spacing.sm) {
            HStack(spacing: QMDesign.Spacing.md) {
                // Large avatar
                ZStack {
                    Circle()
                        .fill(QMDesign.Colors.primaryGradient)
                        .frame(width: 56, height: 56)
                    Text(contact.initials)
                        .font(QMDesign.Typography.titleSmall)
                        .fontWeight(.bold)
                        .foregroundColor(.white)
                }

                VStack(alignment: .leading, spacing: 4) {
                    Text(contact.fullName)
                        .font(QMDesign.Typography.titleMedium)
                        .foregroundStyle(QMDesign.Colors.primaryGradient)

                    if let subtitle = contact.displaySubtitle {
                        Text(subtitle)
                            .font(QMDesign.Typography.bodySmall)
                            .foregroundColor(QMDesign.Colors.textSecondary)
                    }
                }

                Spacer()

                // Edit button
                Button(action: {
                    if isEditing {
                        saveEdits()
                    } else {
                        startEditing()
                    }
                }) {
                    HStack(spacing: QMDesign.Spacing.xs) {
                        Image(systemName: isEditing ? "checkmark" : "pencil")
                            .font(.system(size: 12))
                        Text(isEditing ? "Save" : "Edit")
                            .font(QMDesign.Typography.labelSmall)
                    }
                    .foregroundColor(isEditing ? .white : QMDesign.Colors.accent)
                    .padding(.horizontal, QMDesign.Spacing.md)
                    .padding(.vertical, QMDesign.Spacing.xs)
                    .background(
                        Capsule()
                            .fill(isEditing ? AnyShapeStyle(QMDesign.Colors.primaryGradient) : AnyShapeStyle(QMDesign.Colors.accent.opacity(0.1)))
                    )
                }
                .buttonStyle(.plain)
            }

            // Metadata badges
            HStack(spacing: QMDesign.Spacing.md) {
                MetadataBadge(icon: "clock", text: contact.formattedLastSeen)
                MetadataBadge(icon: "waveform", text: "\(contact.sessionCount) sessions")
                MetadataBadge(icon: "note.text", text: "\(contact.notes.count) notes")
            }
        }
        .padding(QMDesign.Spacing.lg)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: QMDesign.Radius.lg)
                .fill(QMDesign.Colors.primaryGradient.opacity(0.05))
                .overlay(
                    RoundedRectangle(cornerRadius: QMDesign.Radius.lg)
                        .stroke(QMDesign.Colors.accent.opacity(0.2), lineWidth: 1)
                )
        )
    }

    // MARK: - Contact Info

    private var contactInfo: some View {
        VStack(alignment: .leading, spacing: QMDesign.Spacing.sm) {
            HStack {
                Image(systemName: "person.text.rectangle")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(QMDesign.Colors.primaryGradient)
                Text("Contact Info")
                    .font(QMDesign.Typography.headline)
                    .foregroundColor(QMDesign.Colors.textPrimary)
            }

            VStack(spacing: QMDesign.Spacing.xs) {
                if let email = contact.email {
                    infoRow(icon: "envelope", label: "Email", value: email)
                }
                if let company = contact.company {
                    infoRow(icon: "building.2", label: "Company", value: company)
                }
                if let role = contact.role {
                    infoRow(icon: "briefcase", label: "Role", value: role)
                }
                infoRow(icon: "calendar", label: "Created", value: formatDate(contact.createdAt))
            }
            .padding(QMDesign.Spacing.md)
            .background(
                RoundedRectangle(cornerRadius: QMDesign.Radius.md)
                    .fill(QMDesign.Colors.surfaceLight)
            )
        }
    }

    private func infoRow(icon: String, label: String, value: String) -> some View {
        HStack(spacing: QMDesign.Spacing.sm) {
            Image(systemName: icon)
                .font(.system(size: 11))
                .foregroundColor(QMDesign.Colors.textTertiary)
                .frame(width: 16)

            Text(label)
                .font(QMDesign.Typography.caption)
                .foregroundColor(QMDesign.Colors.textTertiary)
                .frame(width: 70, alignment: .leading)

            Text(value)
                .font(QMDesign.Typography.bodySmall)
                .foregroundColor(QMDesign.Colors.textPrimary)
                .textSelection(.enabled)

            Spacer()
        }
    }

    // MARK: - Edit Form

    private var editForm: some View {
        VStack(alignment: .leading, spacing: QMDesign.Spacing.sm) {
            HStack {
                Image(systemName: "pencil.circle")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(QMDesign.Colors.primaryGradient)
                Text("Edit Contact")
                    .font(QMDesign.Typography.headline)
                    .foregroundColor(QMDesign.Colors.textPrimary)

                Spacer()

                Button("Cancel") {
                    isEditing = false
                }
                .font(QMDesign.Typography.labelSmall)
                .foregroundColor(QMDesign.Colors.textSecondary)
                .buttonStyle(.plain)
            }

            VStack(spacing: QMDesign.Spacing.sm) {
                editField(title: "First name *", text: $editFirstName, placeholder: "John")
                editField(title: "Last name", text: $editLastName, placeholder: "Doe")
                editField(title: "Email", text: $editEmail, placeholder: "john@example.com")
                editField(title: "Company", text: $editCompany, placeholder: "Acme Inc.")
                editField(title: "Role", text: $editRole, placeholder: "Sales Director")
            }
            .padding(QMDesign.Spacing.md)
            .background(
                RoundedRectangle(cornerRadius: QMDesign.Radius.md)
                    .fill(QMDesign.Colors.surfaceLight)
            )
        }
    }

    private func editField(title: String, text: Binding<String>, placeholder: String) -> some View {
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
                        .fill(QMDesign.Colors.surfaceMedium)
                )
                .overlay(
                    RoundedRectangle(cornerRadius: QMDesign.Radius.md)
                        .stroke(QMDesign.Colors.borderSubtle, lineWidth: 1)
                )
        }
    }

    // MARK: - Notes Section

    private var notesSection: some View {
        VStack(alignment: .leading, spacing: QMDesign.Spacing.sm) {
            HStack {
                Image(systemName: "note.text")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(QMDesign.Colors.primaryGradient)
                Text("Notes")
                    .font(QMDesign.Typography.headline)
                    .foregroundColor(QMDesign.Colors.textPrimary)

                Spacer()

                Button(action: { withAnimation(QMDesign.Animation.quick) { showingNotes.toggle() } }) {
                    Image(systemName: showingNotes ? "chevron.up" : "chevron.down")
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundColor(QMDesign.Colors.textTertiary)
                }
                .buttonStyle(.plain)
            }

            if showingNotes {
                // Add note field
                HStack(spacing: QMDesign.Spacing.xs) {
                    TextField("Add a note...", text: $newNoteText)
                        .textFieldStyle(.plain)
                        .font(QMDesign.Typography.bodySmall)
                        .padding(QMDesign.Spacing.sm)
                        .background(
                            RoundedRectangle(cornerRadius: QMDesign.Radius.md)
                                .fill(QMDesign.Colors.surfaceLight)
                                .overlay(
                                    RoundedRectangle(cornerRadius: QMDesign.Radius.md)
                                        .stroke(QMDesign.Colors.borderSubtle, lineWidth: 1)
                                )
                        )
                        .onSubmit {
                            addNote()
                        }

                    Button(action: addNote) {
                        Image(systemName: "plus.circle.fill")
                            .font(.system(size: 20))
                            .foregroundStyle(QMDesign.Colors.primaryGradient)
                    }
                    .buttonStyle(.plain)
                    .disabled(newNoteText.trimmingCharacters(in: .whitespaces).isEmpty)
                }

                // Notes list
                let sortedNotes = contact.notes.sorted { $0.createdAt > $1.createdAt }
                if sortedNotes.isEmpty {
                    HStack {
                        Spacer()
                        Text("No notes yet")
                            .font(QMDesign.Typography.caption)
                            .foregroundColor(QMDesign.Colors.textTertiary)
                        Spacer()
                    }
                    .padding(QMDesign.Spacing.md)
                } else {
                    VStack(spacing: QMDesign.Spacing.xs) {
                        ForEach(sortedNotes) { note in
                            NoteRow(note: note, onDelete: {
                                deleteNote(note)
                            })
                        }
                    }
                }
            }
        }
    }

    // MARK: - Sessions Section

    private var sessionsSection: some View {
        VStack(alignment: .leading, spacing: QMDesign.Spacing.sm) {
            HStack {
                Image(systemName: "waveform")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(QMDesign.Colors.primaryGradient)
                Text("Sessions")
                    .font(QMDesign.Typography.headline)
                    .foregroundColor(QMDesign.Colors.textPrimary)

                Text("\(contact.sessionCount)")
                    .font(QMDesign.Typography.captionSmall)
                    .foregroundColor(QMDesign.Colors.textTertiary)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 2)
                    .background(
                        Capsule()
                            .fill(QMDesign.Colors.surfaceLight)
                    )

                Spacer()

                Button(action: { withAnimation(QMDesign.Animation.quick) { showingSessions.toggle() } }) {
                    Image(systemName: showingSessions ? "chevron.up" : "chevron.down")
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundColor(QMDesign.Colors.textTertiary)
                }
                .buttonStyle(.plain)
            }

            if showingSessions {
                let sortedSessions = contact.sessions.sorted { $0.startTime > $1.startTime }
                if sortedSessions.isEmpty {
                    HStack {
                        Spacer()
                        Text("No sessions yet")
                            .font(QMDesign.Typography.caption)
                            .foregroundColor(QMDesign.Colors.textTertiary)
                        Spacer()
                    }
                    .padding(QMDesign.Spacing.md)
                } else {
                    VStack(spacing: QMDesign.Spacing.xs) {
                        ForEach(sortedSessions.prefix(10)) { session in
                            LinkedSessionRow(session: session)
                        }
                        if sortedSessions.count > 10 {
                            Text("+ \(sortedSessions.count - 10) more sessions")
                                .font(QMDesign.Typography.captionSmall)
                                .foregroundColor(QMDesign.Colors.textTertiary)
                                .padding(.top, QMDesign.Spacing.xs)
                        }
                    }
                }
            }
        }
    }

    // MARK: - Danger Zone

    private var dangerZone: some View {
        VStack(alignment: .leading, spacing: QMDesign.Spacing.sm) {
            Divider()
                .padding(.vertical, QMDesign.Spacing.sm)

            Button(action: onDelete) {
                HStack(spacing: QMDesign.Spacing.xs) {
                    Image(systemName: "trash")
                        .font(.system(size: 12))
                    Text("Delete Contact")
                        .font(QMDesign.Typography.labelSmall)
                }
                .foregroundColor(QMDesign.Colors.error)
                .padding(.horizontal, QMDesign.Spacing.md)
                .padding(.vertical, QMDesign.Spacing.xs)
                .background(
                    Capsule()
                        .fill(QMDesign.Colors.errorLight)
                )
            }
            .buttonStyle(.plain)
        }
    }

    // MARK: - Actions

    private func startEditing() {
        editFirstName = contact.firstName
        editLastName = contact.lastName ?? ""
        editEmail = contact.email ?? ""
        editCompany = contact.company ?? ""
        editRole = contact.role ?? ""
        isEditing = true
    }

    private func saveEdits() {
        let trimmedFirst = editFirstName.trimmingCharacters(in: .whitespaces)
        guard !trimmedFirst.isEmpty else { return }

        contact.firstName = trimmedFirst
        contact.lastName = editLastName.isEmpty ? nil : editLastName.trimmingCharacters(in: .whitespaces)
        contact.email = editEmail.isEmpty ? nil : editEmail.trimmingCharacters(in: .whitespaces)
        contact.company = editCompany.isEmpty ? nil : editCompany.trimmingCharacters(in: .whitespaces)
        contact.role = editRole.isEmpty ? nil : editRole.trimmingCharacters(in: .whitespaces)

        try? modelContext.save()

        // Queue for sync
        if ContactSyncManager.shared.canSync {
            ContactSyncManager.shared.queueContact(contact)
        }

        isEditing = false
    }

    private func addNote() {
        let text = newNoteText.trimmingCharacters(in: .whitespaces)
        guard !text.isEmpty else { return }

        let note = ContactNote(content: text)
        contact.notes.append(note)
        try? modelContext.save()

        // Queue contact for sync (includes notes)
        if ContactSyncManager.shared.canSync {
            ContactSyncManager.shared.queueContact(contact)
        }

        newNoteText = ""
    }

    private func deleteNote(_ note: ContactNote) {
        contact.notes.removeAll { $0.id == note.id }
        modelContext.delete(note)
        try? modelContext.save()
    }

    private func formatDate(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        formatter.timeStyle = .short
        return formatter.string(from: date)
    }
}

// MARK: - Note Row

private struct NoteRow: View {
    let note: ContactNote
    let onDelete: () -> Void

    @State private var isHovered = false

    var body: some View {
        HStack(alignment: .top, spacing: QMDesign.Spacing.sm) {
            Image(systemName: "note.text")
                .font(.system(size: 10))
                .foregroundColor(QMDesign.Colors.accent)
                .padding(.top, 4)

            VStack(alignment: .leading, spacing: 2) {
                Text(note.content)
                    .font(QMDesign.Typography.bodySmall)
                    .foregroundColor(QMDesign.Colors.textPrimary)
                    .textSelection(.enabled)

                Text(note.formattedDate)
                    .font(QMDesign.Typography.captionSmall)
                    .foregroundColor(QMDesign.Colors.textTertiary)
            }

            Spacer()

            if isHovered {
                Button(action: onDelete) {
                    Image(systemName: "trash")
                        .font(.system(size: 10))
                        .foregroundColor(QMDesign.Colors.error)
                }
                .buttonStyle(.plain)
            }
        }
        .padding(QMDesign.Spacing.sm)
        .background(
            RoundedRectangle(cornerRadius: QMDesign.Radius.sm)
                .fill(QMDesign.Colors.surfaceLight)
        )
        .onHover { isHovered = $0 }
    }
}

// MARK: - Linked Session Row

private struct LinkedSessionRow: View {
    let session: Session

    var body: some View {
        HStack(spacing: QMDesign.Spacing.sm) {
            Image(systemName: "waveform")
                .font(.system(size: 10))
                .foregroundColor(QMDesign.Colors.accent)

            VStack(alignment: .leading, spacing: 2) {
                Text(session.title)
                    .font(QMDesign.Typography.bodySmall)
                    .fontWeight(.medium)
                    .foregroundColor(QMDesign.Colors.textPrimary)
                    .lineLimit(1)

                HStack(spacing: QMDesign.Spacing.sm) {
                    Text(session.formattedDate)
                        .font(QMDesign.Typography.captionSmall)
                        .foregroundColor(QMDesign.Colors.textTertiary)

                    Text(session.formattedDuration)
                        .font(QMDesign.Typography.captionSmall)
                        .foregroundColor(QMDesign.Colors.accent)
                }
            }

            Spacer()
        }
        .padding(QMDesign.Spacing.sm)
        .background(
            RoundedRectangle(cornerRadius: QMDesign.Radius.sm)
                .fill(QMDesign.Colors.surfaceLight)
        )
    }
}

// MARK: - Empty States

private struct EmptyContactsView: View {
    let isFiltered: Bool

    var body: some View {
        VStack(spacing: QMDesign.Spacing.md) {
            Image(systemName: isFiltered ? "magnifyingglass" : "person.crop.circle.badge.questionmark")
                .font(.system(size: 32))
                .foregroundStyle(QMDesign.Colors.primaryGradient)

            Text(isFiltered ? "No results found" : "No contacts yet")
                .font(QMDesign.Typography.bodyMedium)
                .foregroundColor(QMDesign.Colors.textPrimary)

            Text(isFiltered ? "Try a different search term" : "Create a contact or start a session to build your Memory Palace")
                .font(QMDesign.Typography.caption)
                .foregroundColor(QMDesign.Colors.textTertiary)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .padding(QMDesign.Spacing.xl)
    }
}

private struct EmptyContactDetailView: View {
    var body: some View {
        VStack(spacing: QMDesign.Spacing.md) {
            Image(systemName: "person.crop.circle.fill")
                .font(.system(size: 40))
                .foregroundStyle(QMDesign.Colors.primaryGradient.opacity(0.5))

            Text("No Contact Selected")
                .font(QMDesign.Typography.titleSmall)
                .foregroundColor(QMDesign.Colors.textPrimary)

            Text("Select a contact to view their details")
                .font(QMDesign.Typography.bodySmall)
                .foregroundColor(QMDesign.Colors.textTertiary)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(QMDesign.Colors.backgroundPrimary)
    }
}

// MARK: - New Contact Sheet

private struct NewContactSheet: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(\.modelContext) private var modelContext

    let onCreated: (Contact) -> Void

    @State private var firstName = ""
    @State private var lastName = ""
    @State private var email = ""
    @State private var company = ""
    @State private var role = ""

    private var canCreate: Bool {
        !firstName.trimmingCharacters(in: .whitespaces).isEmpty
    }

    var body: some View {
        VStack(spacing: 0) {
            // Header
            HStack(spacing: QMDesign.Spacing.md) {
                ZStack {
                    Circle()
                        .fill(QMDesign.Colors.primaryGradient)
                        .frame(width: 40, height: 40)
                    Image(systemName: "person.badge.plus")
                        .font(.system(size: 18, weight: .semibold))
                        .foregroundColor(.white)
                }

                VStack(alignment: .leading, spacing: 2) {
                    Text("New Contact")
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
            .padding(QMDesign.Spacing.md)

            Divider()

            // Form
            ScrollView {
                VStack(spacing: QMDesign.Spacing.md) {
                    formField(title: "First name *", text: $firstName, placeholder: "John")
                    formField(title: "Last name", text: $lastName, placeholder: "Doe")
                    formField(title: "Email", text: $email, placeholder: "john@example.com")
                    formField(title: "Company", text: $company, placeholder: "Acme Inc.")
                    formField(title: "Role", text: $role, placeholder: "Sales Director")
                }
                .padding(QMDesign.Spacing.md)
            }

            Divider()

            // Footer
            HStack {
                Button("Cancel") {
                    dismiss()
                }
                .buttonStyle(.plain)
                .foregroundColor(QMDesign.Colors.textSecondary)

                Spacer()

                Button(action: createContact) {
                    HStack(spacing: QMDesign.Spacing.xs) {
                        Image(systemName: "plus.circle.fill")
                        Text("Create")
                    }
                    .font(QMDesign.Typography.labelSmall)
                    .fontWeight(.semibold)
                    .foregroundColor(.white)
                    .padding(.horizontal, QMDesign.Spacing.lg)
                    .padding(.vertical, QMDesign.Spacing.sm)
                    .background(
                        Capsule()
                            .fill(canCreate ? AnyShapeStyle(QMDesign.Colors.primaryGradient) : AnyShapeStyle(QMDesign.Colors.surfaceMedium))
                    )
                }
                .buttonStyle(.plain)
                .disabled(!canCreate)
            }
            .padding(QMDesign.Spacing.md)
        }
        .frame(width: 420, height: 480)
        .background(QMDesign.Colors.backgroundPrimary)
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

    private func createContact() {
        let contact = Contact(
            firstName: firstName.trimmingCharacters(in: .whitespaces),
            lastName: lastName.isEmpty ? nil : lastName.trimmingCharacters(in: .whitespaces),
            email: email.isEmpty ? nil : email.trimmingCharacters(in: .whitespaces),
            company: company.isEmpty ? nil : company.trimmingCharacters(in: .whitespaces),
            role: role.isEmpty ? nil : role.trimmingCharacters(in: .whitespaces)
        )
        modelContext.insert(contact)
        try? modelContext.save()

        // Sync to server
        if ContactSyncManager.shared.canSync {
            ContactSyncManager.shared.queueContact(contact)
        }

        onCreated(contact)
        dismiss()
    }
}
