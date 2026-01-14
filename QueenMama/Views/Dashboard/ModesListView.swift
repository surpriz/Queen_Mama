import SwiftUI
import SwiftData

struct ModesListView: View {
    @Environment(\.modelContext) private var modelContext
    @Query(sort: \Mode.createdAt) private var modes: [Mode]

    @State private var selectedMode: Mode?
    @State private var isEditing = false
    @State private var showingNewModeSheet = false

    var body: some View {
        HSplitView {
            // Mode List
            VStack(spacing: 0) {
                // Header
                HStack {
                    Text("Modes")
                        .font(.headline)

                    Spacer()

                    Button(action: { showingNewModeSheet = true }) {
                        Image(systemName: "plus")
                    }
                    .buttonStyle(.plain)
                }
                .padding()
                .background(Color.gray.opacity(0.1))

                // List
                List(selection: $selectedMode) {
                    // Default Modes
                    Section("Built-in") {
                        ModeRowView(mode: .defaultMode, isSelected: selectedMode?.name == "Default")
                            .onTapGesture { selectDefaultMode(.defaultMode) }
                        ModeRowView(mode: .professionalMode, isSelected: selectedMode?.name == "Professional")
                            .onTapGesture { selectDefaultMode(.professionalMode) }
                        ModeRowView(mode: .interviewMode, isSelected: selectedMode?.name == "Interview")
                            .onTapGesture { selectDefaultMode(.interviewMode) }
                        ModeRowView(mode: .salesMode, isSelected: selectedMode?.name == "Sales")
                            .onTapGesture { selectDefaultMode(.salesMode) }
                    }

                    // Custom Modes
                    if !modes.filter({ !$0.isDefault }).isEmpty {
                        Section("Custom") {
                            ForEach(modes.filter { !$0.isDefault }) { mode in
                                ModeRowView(mode: mode, isSelected: selectedMode?.id == mode.id)
                                    .tag(mode)
                                    .contextMenu {
                                        Button("Edit") {
                                            selectedMode = mode
                                            isEditing = true
                                        }
                                        Button("Duplicate") {
                                            duplicateMode(mode)
                                        }
                                        Divider()
                                        Button("Delete", role: .destructive) {
                                            deleteMode(mode)
                                        }
                                    }
                            }
                        }
                    }
                }
                .listStyle(.inset)
            }
            .frame(minWidth: 250, maxWidth: 300)

            // Mode Detail
            if let mode = selectedMode {
                ModeDetailView(mode: mode, isEditing: $isEditing)
            } else {
                ContentUnavailableView(
                    "No Mode Selected",
                    systemImage: "person.2",
                    description: Text("Select a mode to view or edit its settings")
                )
            }
        }
        .sheet(isPresented: $showingNewModeSheet) {
            NewModeSheet { newMode in
                modelContext.insert(newMode)
                try? modelContext.save()
                selectedMode = newMode
            }
        }
        .onAppear {
            ensureDefaultModesExist()
        }
    }

    private func selectDefaultMode(_ mode: Mode) {
        // For built-in modes, we create a temporary Mode object
        selectedMode = mode
    }

    private func duplicateMode(_ mode: Mode) {
        let newMode = Mode(
            name: "\(mode.name) Copy",
            systemPrompt: mode.systemPrompt,
            attachedFiles: mode.attachedFiles
        )
        modelContext.insert(newMode)
        try? modelContext.save()
    }

    private func deleteMode(_ mode: Mode) {
        if selectedMode?.id == mode.id {
            selectedMode = nil
        }
        modelContext.delete(mode)
        try? modelContext.save()
    }

    private func ensureDefaultModesExist() {
        // Check if we need to create default modes
        if modes.isEmpty {
            let defaultModes = [Mode.defaultMode, Mode.professionalMode, Mode.interviewMode, Mode.salesMode]
            for mode in defaultModes {
                modelContext.insert(mode)
            }
            try? modelContext.save()
        }
    }
}

// MARK: - Mode Row View

struct ModeRowView: View {
    let mode: Mode
    let isSelected: Bool

    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 4) {
                Text(mode.name)
                    .font(.body)
                    .fontWeight(isSelected ? .semibold : .regular)

                Text(mode.systemPrompt.prefix(50) + "...")
                    .font(.caption)
                    .foregroundColor(.secondary)
                    .lineLimit(1)
            }

            Spacer()

            if mode.isDefault {
                Text("Default")
                    .font(.caption2)
                    .foregroundColor(.blue)
                    .padding(.horizontal, 6)
                    .padding(.vertical, 2)
                    .background(Color.blue.opacity(0.1))
                    .clipShape(Capsule())
            }
        }
        .padding(.vertical, 4)
        .contentShape(Rectangle())
    }
}

// MARK: - Mode Detail View

struct ModeDetailView: View {
    let mode: Mode
    @Binding var isEditing: Bool

    @State private var editedName: String = ""
    @State private var editedPrompt: String = ""

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                // Header
                HStack {
                    if isEditing {
                        TextField("Mode Name", text: $editedName)
                            .font(.title)
                            .textFieldStyle(.roundedBorder)
                    } else {
                        Text(mode.name)
                            .font(.title)
                            .fontWeight(.bold)
                    }

                    Spacer()

                    if !mode.isDefault {
                        Button(isEditing ? "Save" : "Edit") {
                            if isEditing {
                                saveChanges()
                            }
                            isEditing.toggle()
                        }
                        .buttonStyle(.borderedProminent)
                    }
                }

                Divider()

                // System Prompt
                VStack(alignment: .leading, spacing: 8) {
                    Text("System Prompt")
                        .font(.headline)

                    if isEditing {
                        TextEditor(text: $editedPrompt)
                            .font(.body)
                            .frame(minHeight: 200)
                            .padding(8)
                            .background(Color.gray.opacity(0.1))
                            .clipShape(RoundedRectangle(cornerRadius: 8))
                    } else {
                        Text(mode.systemPrompt)
                            .font(.body)
                            .padding()
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .background(Color.gray.opacity(0.1))
                            .clipShape(RoundedRectangle(cornerRadius: 8))
                    }
                }

                // Attached Files
                VStack(alignment: .leading, spacing: 8) {
                    HStack {
                        Text("Attached Files")
                            .font(.headline)

                        Spacer()

                        if isEditing {
                            Button(action: addFile) {
                                Label("Add File", systemImage: "plus")
                            }
                        }
                    }

                    if mode.attachedFiles.isEmpty {
                        Text("No files attached")
                            .font(.caption)
                            .foregroundColor(.secondary)
                            .padding()
                            .frame(maxWidth: .infinity)
                            .background(Color.gray.opacity(0.1))
                            .clipShape(RoundedRectangle(cornerRadius: 8))
                    } else {
                        ForEach(mode.attachedFiles, id: \.id) { file in
                            AttachedFileRow(file: file, isEditing: isEditing) {
                                // Remove file action
                            }
                        }
                    }
                }
            }
            .padding()
        }
        .onChange(of: mode.id) {
            loadMode()
        }
        .onAppear {
            loadMode()
        }
    }

    private func loadMode() {
        editedName = mode.name
        editedPrompt = mode.systemPrompt
    }

    private func saveChanges() {
        mode.name = editedName
        mode.systemPrompt = editedPrompt
    }

    private func addFile() {
        let openPanel = NSOpenPanel()
        openPanel.allowedContentTypes = [.pdf, .plainText, .rtf]
        openPanel.allowsMultipleSelection = false

        if openPanel.runModal() == .OK, let url = openPanel.url {
            let file = AttachedFile(
                name: url.lastPathComponent,
                path: url.path,
                type: .document
            )
            mode.attachedFiles.append(file)
        }
    }
}

// MARK: - Attached File Row

struct AttachedFileRow: View {
    let file: AttachedFile
    let isEditing: Bool
    let onRemove: () -> Void

    var body: some View {
        HStack {
            Image(systemName: iconForFileType(file.type))
                .foregroundColor(.blue)

            VStack(alignment: .leading, spacing: 2) {
                Text(file.name)
                    .font(.body)
                Text(file.path)
                    .font(.caption)
                    .foregroundColor(.secondary)
                    .lineLimit(1)
            }

            Spacer()

            if isEditing {
                Button(action: onRemove) {
                    Image(systemName: "xmark.circle.fill")
                        .foregroundColor(.red)
                }
                .buttonStyle(.plain)
            }
        }
        .padding(8)
        .background(Color.gray.opacity(0.1))
        .clipShape(RoundedRectangle(cornerRadius: 8))
    }

    private func iconForFileType(_ type: AttachedFile.FileType) -> String {
        switch type {
        case .resume: return "doc.text"
        case .pitchDeck: return "doc.richtext"
        case .document: return "doc"
        case .other: return "doc.fill"
        }
    }
}

// MARK: - New Mode Sheet

struct NewModeSheet: View {
    @Environment(\.dismiss) private var dismiss

    @State private var name = ""
    @State private var systemPrompt = ""

    let onCreate: (Mode) -> Void

    var body: some View {
        VStack(spacing: 20) {
            Text("Create New Mode")
                .font(.title2)
                .fontWeight(.bold)

            Form {
                TextField("Name", text: $name)

                Section("System Prompt") {
                    TextEditor(text: $systemPrompt)
                        .frame(minHeight: 150)
                }
            }
            .formStyle(.grouped)

            HStack {
                Button("Cancel") {
                    dismiss()
                }
                .keyboardShortcut(.cancelAction)

                Spacer()

                Button("Create") {
                    let mode = Mode(name: name, systemPrompt: systemPrompt)
                    onCreate(mode)
                    dismiss()
                }
                .buttonStyle(.borderedProminent)
                .disabled(name.isEmpty || systemPrompt.isEmpty)
                .keyboardShortcut(.defaultAction)
            }
        }
        .padding()
        .frame(width: 500, height: 400)
    }
}
