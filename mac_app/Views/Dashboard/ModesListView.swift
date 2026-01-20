//
//  ModesListView.swift
//  QueenMama
//
//  Modern modes list with gradient accents and consistent design system
//

import SwiftUI
import SwiftData

struct ModesListView: View {
    @Environment(\.modelContext) private var modelContext
    @EnvironmentObject var appState: AppState
    @Query(sort: \Mode.createdAt) private var modes: [Mode]

    @State private var selectedMode: Mode?
    @State private var isEditing = false
    @State private var showingNewModeSheet = false

    var body: some View {
        HStack(spacing: 0) {
            // Mode List Sidebar
            ModernModesSidebar(
                modes: modes,
                selectedMode: $selectedMode,
                activeMode: appState.selectedMode,
                showingNewModeSheet: $showingNewModeSheet,
                onSelect: { mode in
                    selectedMode = mode
                    isEditing = false
                },
                onActivate: { mode in
                    appState.selectedMode = mode
                },
                onDelete: deleteMode,
                onDuplicate: duplicateMode
            )
            .frame(width: 280)

            Divider()

            // Mode Detail
            if let mode = selectedMode {
                ModernModeDetailView(
                    mode: mode,
                    isEditing: $isEditing,
                    isActive: appState.selectedMode?.name == mode.name,
                    onActivate: {
                        appState.selectedMode = mode
                    }
                )
                .frame(maxWidth: .infinity)
            } else {
                ModernEmptyModeView()
                    .frame(maxWidth: .infinity)
            }
        }
        .sheet(isPresented: $showingNewModeSheet) {
            ModernNewModeSheet { newMode in
                modelContext.insert(newMode)
                try? modelContext.save()
                selectedMode = newMode
            }
        }
        .onAppear {
            ensureDefaultModesExist()
            // Set default mode if none selected
            if appState.selectedMode == nil {
                appState.selectedMode = .defaultMode
            }
        }
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
        if modes.isEmpty {
            let defaultModes = [Mode.defaultMode, Mode.professionalMode, Mode.interviewMode, Mode.salesMode]
            for mode in defaultModes {
                modelContext.insert(mode)
            }
            try? modelContext.save()
        }
    }
}

// MARK: - Modern Modes Sidebar

struct ModernModesSidebar: View {
    let modes: [Mode]
    @Binding var selectedMode: Mode?
    let activeMode: Mode?
    @Binding var showingNewModeSheet: Bool
    let onSelect: (Mode) -> Void
    let onActivate: (Mode) -> Void
    let onDelete: (Mode) -> Void
    let onDuplicate: (Mode) -> Void

    var body: some View {
        VStack(spacing: 0) {
            // Header
            HStack(spacing: QMDesign.Spacing.sm) {
                ZStack {
                    Circle()
                        .fill(QMDesign.Colors.primaryGradient)
                        .frame(width: 32, height: 32)
                    Image(systemName: QMDesign.Icons.modes)
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundColor(.white)
                }

                Text("Modes")
                    .font(QMDesign.Typography.headline)
                    .foregroundColor(QMDesign.Colors.textPrimary)

                Spacer()

                Button(action: { showingNewModeSheet = true }) {
                    Image(systemName: "plus")
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundColor(.white)
                        .frame(width: 28, height: 28)
                        .background(
                            Circle()
                                .fill(QMDesign.Colors.primaryGradient)
                        )
                }
                .buttonStyle(.plain)
                .help("Create new mode")
            }
            .padding(QMDesign.Spacing.md)
            .background(
                Rectangle()
                    .fill(QMDesign.Colors.surfaceLight)
                    .overlay(
                        Rectangle()
                            .fill(QMDesign.Colors.primaryGradient)
                            .frame(height: 2),
                        alignment: .bottom
                    )
            )

            // Mode List
            ScrollView {
                VStack(spacing: QMDesign.Spacing.sm) {
                    // Built-in Section
                    ModernModeSection(title: "BUILT-IN") {
                        ModernModeRow(
                            mode: .defaultMode,
                            isSelected: selectedMode?.name == "Default",
                            isActive: activeMode?.name == "Default",
                            onSelect: { onSelect(.defaultMode) },
                            onActivate: { onActivate(.defaultMode) }
                        )
                        ModernModeRow(
                            mode: .professionalMode,
                            isSelected: selectedMode?.name == "Professional",
                            isActive: activeMode?.name == "Professional",
                            onSelect: { onSelect(.professionalMode) },
                            onActivate: { onActivate(.professionalMode) }
                        )
                        ModernModeRow(
                            mode: .interviewMode,
                            isSelected: selectedMode?.name == "Interview",
                            isActive: activeMode?.name == "Interview",
                            onSelect: { onSelect(.interviewMode) },
                            onActivate: { onActivate(.interviewMode) }
                        )
                        ModernModeRow(
                            mode: .salesMode,
                            isSelected: selectedMode?.name == "Sales",
                            isActive: activeMode?.name == "Sales",
                            onSelect: { onSelect(.salesMode) },
                            onActivate: { onActivate(.salesMode) }
                        )
                    }

                    // Custom Section
                    let customModes = modes.filter { !$0.isDefault }
                    if !customModes.isEmpty {
                        ModernModeSection(title: "CUSTOM") {
                            ForEach(customModes) { mode in
                                ModernModeRow(
                                    mode: mode,
                                    isSelected: selectedMode?.id == mode.id,
                                    isActive: activeMode?.id == mode.id,
                                    isCustom: true,
                                    onSelect: { onSelect(mode) },
                                    onActivate: { onActivate(mode) },
                                    onEdit: { onSelect(mode) },
                                    onDuplicate: { onDuplicate(mode) },
                                    onDelete: { onDelete(mode) }
                                )
                            }
                        }
                    }
                }
                .padding(QMDesign.Spacing.sm)
            }

            Spacer()
        }
        .background(QMDesign.Colors.backgroundSecondary)
    }
}

// MARK: - Modern Mode Section

struct ModernModeSection<Content: View>: View {
    let title: String
    @ViewBuilder let content: Content

    var body: some View {
        VStack(alignment: .leading, spacing: QMDesign.Spacing.xs) {
            Text(title)
                .qmSectionHeader()
                .padding(.horizontal, QMDesign.Spacing.xs)

            content
        }
    }
}

// MARK: - Modern Mode Row

struct ModernModeRow: View {
    let mode: Mode
    let isSelected: Bool
    var isActive: Bool = false
    var isCustom: Bool = false
    let onSelect: () -> Void
    var onActivate: (() -> Void)? = nil
    var onEdit: (() -> Void)? = nil
    var onDuplicate: (() -> Void)? = nil
    var onDelete: (() -> Void)? = nil

    @State private var isHovered = false

    var body: some View {
        Button(action: onSelect) {
            HStack(spacing: QMDesign.Spacing.sm) {
                // Icon with gradient when selected or active
                ZStack {
                    if isActive {
                        Circle()
                            .fill(QMDesign.Colors.success)
                            .frame(width: 32, height: 32)
                    } else if isSelected {
                        Circle()
                            .fill(QMDesign.Colors.primaryGradient)
                            .frame(width: 32, height: 32)
                    } else {
                        Circle()
                            .fill(QMDesign.Colors.surfaceMedium)
                            .frame(width: 32, height: 32)
                    }

                    Image(systemName: iconForMode(mode.name))
                        .font(.system(size: 14, weight: (isSelected || isActive) ? .semibold : .regular))
                        .foregroundColor((isSelected || isActive) ? .white : QMDesign.Colors.textSecondary)
                }

                // Labels
                VStack(alignment: .leading, spacing: 2) {
                    HStack(spacing: QMDesign.Spacing.xs) {
                        Text(mode.name)
                            .font(QMDesign.Typography.bodySmall)
                            .fontWeight(isSelected ? .semibold : .regular)
                            .foregroundColor(isSelected ? QMDesign.Colors.textPrimary : QMDesign.Colors.textSecondary)

                        // Active badge (replaces Default badge)
                        if isActive {
                            Text("Active")
                                .font(QMDesign.Typography.captionSmall)
                                .foregroundColor(.white)
                                .padding(.horizontal, 6)
                                .padding(.vertical, 2)
                                .background(
                                    Capsule()
                                        .fill(QMDesign.Colors.success)
                                )
                        }
                    }

                    Text(String(mode.systemPrompt.prefix(40)) + "...")
                        .font(QMDesign.Typography.captionSmall)
                        .foregroundColor(QMDesign.Colors.textTertiary)
                        .lineLimit(1)
                }

                Spacer()

                // Indicator
                if isSelected {
                    Image(systemName: "chevron.right")
                        .font(.system(size: 10, weight: .semibold))
                        .foregroundColor(QMDesign.Colors.accent)
                }
            }
            .padding(.horizontal, QMDesign.Spacing.sm)
            .padding(.vertical, QMDesign.Spacing.xs)
            .background(
                RoundedRectangle(cornerRadius: QMDesign.Radius.md)
                    .fill(
                        isActive
                            ? QMDesign.Colors.success.opacity(0.1)
                            : (isSelected
                                ? QMDesign.Colors.accent.opacity(0.1)
                                : (isHovered ? QMDesign.Colors.surfaceHover : Color.clear))
                    )
            )
            .overlay(
                RoundedRectangle(cornerRadius: QMDesign.Radius.md)
                    .stroke(
                        isActive ? QMDesign.Colors.success.opacity(0.3) : (isSelected ? QMDesign.Colors.accent.opacity(0.3) : Color.clear),
                        lineWidth: 1
                    )
            )
        }
        .buttonStyle(.plain)
        .onHover { isHovered = $0 }
        .animation(QMDesign.Animation.quick, value: isHovered)
        .animation(QMDesign.Animation.quick, value: isSelected)
        .animation(QMDesign.Animation.quick, value: isActive)
        .contextMenu {
            if let onActivate = onActivate, !isActive {
                Button("Set as Active") { onActivate() }
                Divider()
            }
            if isCustom {
                if let onEdit = onEdit {
                    Button("Edit") { onEdit() }
                }
                if let onDuplicate = onDuplicate {
                    Button("Duplicate") { onDuplicate() }
                }
                Divider()
                if let onDelete = onDelete {
                    Button("Delete", role: .destructive) { onDelete() }
                }
            }
        }
    }

    private func iconForMode(_ name: String) -> String {
        switch name.lowercased() {
        case "default": return "sparkles"
        case "professional": return "briefcase"
        case "interview": return "person.fill.questionmark"
        case "sales": return "chart.line.uptrend.xyaxis"
        default: return "person.crop.circle"
        }
    }
}

// MARK: - Modern Mode Detail View

struct ModernModeDetailView: View {
    let mode: Mode
    @Binding var isEditing: Bool
    var isActive: Bool = false
    var onActivate: (() -> Void)? = nil

    @State private var editedName: String = ""
    @State private var editedPrompt: String = ""

    var body: some View {
        ScrollView {
            VStack(spacing: QMDesign.Spacing.lg) {
                // Header
                ModernModeDetailHeader(
                    mode: mode,
                    isEditing: $isEditing,
                    editedName: $editedName,
                    isActive: isActive,
                    onSave: saveChanges,
                    onActivate: onActivate
                )

                // System Prompt Card
                ModernModePromptCard(
                    mode: mode,
                    isEditing: isEditing,
                    editedPrompt: $editedPrompt
                )

                // Attached Files Card
                ModernModeFilesCard(
                    mode: mode,
                    isEditing: isEditing
                )
            }
            .padding(QMDesign.Spacing.lg)
        }
        .background(QMDesign.Colors.backgroundPrimary)
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
}

// MARK: - Modern Mode Detail Header

struct ModernModeDetailHeader: View {
    let mode: Mode
    @Binding var isEditing: Bool
    @Binding var editedName: String
    var isActive: Bool = false
    let onSave: () -> Void
    var onActivate: (() -> Void)? = nil

    var body: some View {
        HStack(spacing: QMDesign.Spacing.md) {
            // Icon
            ZStack {
                if isActive {
                    Circle()
                        .fill(QMDesign.Colors.success)
                        .frame(width: 48, height: 48)
                } else {
                    Circle()
                        .fill(QMDesign.Colors.primaryGradient)
                        .frame(width: 48, height: 48)
                }
                Image(systemName: iconForMode(mode.name))
                    .font(.system(size: 22, weight: .semibold))
                    .foregroundColor(.white)
            }

            // Title
            VStack(alignment: .leading, spacing: 4) {
                HStack(spacing: QMDesign.Spacing.sm) {
                    if isEditing {
                        TextField("Mode Name", text: $editedName)
                            .font(QMDesign.Typography.titleMedium)
                            .textFieldStyle(.plain)
                            .padding(QMDesign.Spacing.sm)
                            .background(
                                RoundedRectangle(cornerRadius: QMDesign.Radius.md)
                                    .fill(QMDesign.Colors.surfaceLight)
                            )
                    } else {
                        Text(mode.name)
                            .font(QMDesign.Typography.titleMedium)
                            .foregroundStyle(isActive ? AnyShapeStyle(QMDesign.Colors.success) : AnyShapeStyle(QMDesign.Colors.primaryGradient))
                    }

                    if isActive {
                        Text("Active")
                            .font(QMDesign.Typography.captionSmall)
                            .foregroundColor(.white)
                            .padding(.horizontal, 8)
                            .padding(.vertical, 3)
                            .background(
                                Capsule()
                                    .fill(QMDesign.Colors.success)
                            )
                    }
                }

                Text(mode.isDefault ? "Built-in mode" : "Custom mode")
                    .font(QMDesign.Typography.caption)
                    .foregroundColor(QMDesign.Colors.textTertiary)
            }

            Spacer()

            // Activate Button
            if !isActive, let onActivate = onActivate {
                Button(action: onActivate) {
                    HStack(spacing: QMDesign.Spacing.xs) {
                        Image(systemName: "bolt.fill")
                            .font(.system(size: 12, weight: .semibold))
                        Text("Activate")
                            .font(QMDesign.Typography.labelSmall)
                    }
                    .foregroundColor(.white)
                    .padding(.horizontal, QMDesign.Spacing.md)
                    .padding(.vertical, QMDesign.Spacing.sm)
                    .background(
                        Capsule()
                            .fill(QMDesign.Colors.success)
                    )
                }
                .buttonStyle(.plain)
            }

            // Edit/Save Button
            if !mode.isDefault {
                Button(action: {
                    if isEditing {
                        onSave()
                    }
                    isEditing.toggle()
                }) {
                    HStack(spacing: QMDesign.Spacing.xs) {
                        Image(systemName: isEditing ? "checkmark" : "pencil")
                            .font(.system(size: 12, weight: .semibold))
                        Text(isEditing ? "Save" : "Edit")
                            .font(QMDesign.Typography.labelSmall)
                    }
                    .foregroundColor(.white)
                    .padding(.horizontal, QMDesign.Spacing.md)
                    .padding(.vertical, QMDesign.Spacing.sm)
                    .background(
                        Capsule()
                            .fill(QMDesign.Colors.primaryGradient)
                    )
                }
                .buttonStyle(.plain)
            }
        }
        .padding(QMDesign.Spacing.lg)
        .background(
            RoundedRectangle(cornerRadius: QMDesign.Radius.lg)
                .fill(QMDesign.Colors.surfaceLight)
                .overlay(
                    RoundedRectangle(cornerRadius: QMDesign.Radius.lg)
                        .stroke(QMDesign.Colors.borderSubtle, lineWidth: 1)
                )
        )
    }

    private func iconForMode(_ name: String) -> String {
        switch name.lowercased() {
        case "default": return "sparkles"
        case "professional": return "briefcase"
        case "interview": return "person.fill.questionmark"
        case "sales": return "chart.line.uptrend.xyaxis"
        default: return "person.crop.circle"
        }
    }
}

// MARK: - Modern Mode Prompt Card

struct ModernModePromptCard: View {
    let mode: Mode
    let isEditing: Bool
    @Binding var editedPrompt: String

    var body: some View {
        VStack(alignment: .leading, spacing: QMDesign.Spacing.md) {
            // Header
            HStack(spacing: QMDesign.Spacing.sm) {
                Image(systemName: "text.alignleft")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(QMDesign.Colors.primaryGradient)

                Text("System Prompt")
                    .font(QMDesign.Typography.headline)
                    .foregroundColor(QMDesign.Colors.textPrimary)

                Spacer()

                if !isEditing {
                    Button(action: {
                        NSPasteboard.general.clearContents()
                        NSPasteboard.general.setString(mode.systemPrompt, forType: .string)
                    }) {
                        HStack(spacing: 4) {
                            Image(systemName: "doc.on.doc")
                                .font(.system(size: 11))
                            Text("Copy")
                                .font(QMDesign.Typography.captionSmall)
                        }
                        .foregroundColor(QMDesign.Colors.textSecondary)
                        .padding(.horizontal, QMDesign.Spacing.sm)
                        .padding(.vertical, 4)
                        .background(
                            Capsule()
                                .fill(QMDesign.Colors.surfaceMedium)
                        )
                    }
                    .buttonStyle(.plain)
                }
            }

            // Content
            if isEditing {
                TextEditor(text: $editedPrompt)
                    .font(QMDesign.Typography.bodySmall)
                    .foregroundColor(QMDesign.Colors.textPrimary)
                    .scrollContentBackground(.hidden)
                    .frame(minHeight: 200)
                    .padding(QMDesign.Spacing.sm)
                    .background(
                        RoundedRectangle(cornerRadius: QMDesign.Radius.md)
                            .fill(QMDesign.Colors.backgroundSecondary)
                    )
            } else {
                Text(mode.systemPrompt)
                    .font(QMDesign.Typography.bodySmall)
                    .foregroundColor(QMDesign.Colors.textSecondary)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(QMDesign.Spacing.md)
                    .background(
                        RoundedRectangle(cornerRadius: QMDesign.Radius.md)
                            .fill(QMDesign.Colors.backgroundSecondary)
                    )
            }
        }
        .padding(QMDesign.Spacing.lg)
        .background(
            RoundedRectangle(cornerRadius: QMDesign.Radius.lg)
                .fill(QMDesign.Colors.surfaceLight)
                .overlay(
                    RoundedRectangle(cornerRadius: QMDesign.Radius.lg)
                        .stroke(QMDesign.Colors.borderSubtle, lineWidth: 1)
                )
        )
    }
}

// MARK: - Modern Mode Files Card

struct ModernModeFilesCard: View {
    let mode: Mode
    let isEditing: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: QMDesign.Spacing.md) {
            // Header
            HStack(spacing: QMDesign.Spacing.sm) {
                Image(systemName: "paperclip")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(QMDesign.Colors.primaryGradient)

                Text("Attached Files")
                    .font(QMDesign.Typography.headline)
                    .foregroundColor(QMDesign.Colors.textPrimary)

                Spacer()

                if isEditing {
                    Button(action: addFile) {
                        HStack(spacing: 4) {
                            Image(systemName: "plus")
                                .font(.system(size: 11, weight: .semibold))
                            Text("Add File")
                                .font(QMDesign.Typography.captionSmall)
                        }
                        .foregroundColor(.white)
                        .padding(.horizontal, QMDesign.Spacing.sm)
                        .padding(.vertical, 4)
                        .background(
                            Capsule()
                                .fill(QMDesign.Colors.primaryGradient)
                        )
                    }
                    .buttonStyle(.plain)
                }
            }

            // Content
            if mode.attachedFiles.isEmpty {
                HStack {
                    Spacer()
                    VStack(spacing: QMDesign.Spacing.sm) {
                        Image(systemName: "doc.badge.plus")
                            .font(.system(size: 32))
                            .foregroundColor(QMDesign.Colors.textTertiary)
                        Text("No files attached")
                            .font(QMDesign.Typography.caption)
                            .foregroundColor(QMDesign.Colors.textTertiary)
                        if isEditing {
                            Text("Click \"Add File\" to attach documents")
                                .font(QMDesign.Typography.captionSmall)
                                .foregroundColor(QMDesign.Colors.textTertiary)
                        }
                    }
                    Spacer()
                }
                .padding(QMDesign.Spacing.xl)
                .background(
                    RoundedRectangle(cornerRadius: QMDesign.Radius.md)
                        .fill(QMDesign.Colors.backgroundSecondary)
                        .overlay(
                            RoundedRectangle(cornerRadius: QMDesign.Radius.md)
                                .stroke(QMDesign.Colors.borderSubtle, style: StrokeStyle(lineWidth: 1, dash: [5]))
                        )
                )
            } else {
                VStack(spacing: QMDesign.Spacing.sm) {
                    ForEach(mode.attachedFiles, id: \.id) { file in
                        ModernAttachedFileRow(file: file, isEditing: isEditing) {
                            // Remove file action
                        }
                    }
                }
            }
        }
        .padding(QMDesign.Spacing.lg)
        .background(
            RoundedRectangle(cornerRadius: QMDesign.Radius.lg)
                .fill(QMDesign.Colors.surfaceLight)
                .overlay(
                    RoundedRectangle(cornerRadius: QMDesign.Radius.lg)
                        .stroke(QMDesign.Colors.borderSubtle, lineWidth: 1)
                )
        )
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

// MARK: - Modern Attached File Row

struct ModernAttachedFileRow: View {
    let file: AttachedFile
    let isEditing: Bool
    let onRemove: () -> Void

    @State private var isHovered = false

    var body: some View {
        HStack(spacing: QMDesign.Spacing.sm) {
            // Icon
            ZStack {
                RoundedRectangle(cornerRadius: QMDesign.Radius.sm)
                    .fill(QMDesign.Colors.accent.opacity(0.1))
                    .frame(width: 36, height: 36)
                Image(systemName: iconForFileType(file.type))
                    .font(.system(size: 16))
                    .foregroundStyle(QMDesign.Colors.primaryGradient)
            }

            // File info
            VStack(alignment: .leading, spacing: 2) {
                Text(file.name)
                    .font(QMDesign.Typography.bodySmall)
                    .foregroundColor(QMDesign.Colors.textPrimary)
                Text(file.path)
                    .font(QMDesign.Typography.captionSmall)
                    .foregroundColor(QMDesign.Colors.textTertiary)
                    .lineLimit(1)
            }

            Spacer()

            // Remove button
            if isEditing {
                Button(action: onRemove) {
                    Image(systemName: "xmark.circle.fill")
                        .font(.system(size: 18))
                        .foregroundColor(QMDesign.Colors.error)
                }
                .buttonStyle(.plain)
            }
        }
        .padding(QMDesign.Spacing.sm)
        .background(
            RoundedRectangle(cornerRadius: QMDesign.Radius.md)
                .fill(isHovered ? QMDesign.Colors.surfaceHover : QMDesign.Colors.backgroundSecondary)
        )
        .onHover { isHovered = $0 }
    }

    private func iconForFileType(_ type: AttachedFile.FileType) -> String {
        switch type {
        case .resume: return "doc.text.fill"
        case .pitchDeck: return "doc.richtext.fill"
        case .document: return "doc.fill"
        case .other: return "doc.fill"
        }
    }
}

// MARK: - Modern Empty Mode View

struct ModernEmptyModeView: View {
    var body: some View {
        VStack(spacing: QMDesign.Spacing.lg) {
            ZStack {
                Circle()
                    .fill(QMDesign.Colors.surfaceLight)
                    .frame(width: 80, height: 80)
                Image(systemName: "person.2")
                    .font(.system(size: 32))
                    .foregroundStyle(QMDesign.Colors.primaryGradient)
            }

            VStack(spacing: QMDesign.Spacing.sm) {
                Text("No Mode Selected")
                    .font(QMDesign.Typography.titleSmall)
                    .foregroundColor(QMDesign.Colors.textPrimary)
                Text("Select a mode from the sidebar to view or edit its settings")
                    .font(QMDesign.Typography.bodySmall)
                    .foregroundColor(QMDesign.Colors.textSecondary)
                    .multilineTextAlignment(.center)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(QMDesign.Colors.backgroundPrimary)
    }
}

// MARK: - Modern New Mode Sheet

struct ModernNewModeSheet: View {
    @Environment(\.dismiss) private var dismiss

    @State private var name = ""
    @State private var systemPrompt = ""

    let onCreate: (Mode) -> Void

    var body: some View {
        VStack(spacing: 0) {
            // Header
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    Text("Create New Mode")
                        .font(QMDesign.Typography.titleMedium)
                        .foregroundStyle(QMDesign.Colors.primaryGradient)
                    Text("Define a custom AI personality")
                        .font(QMDesign.Typography.caption)
                        .foregroundColor(QMDesign.Colors.textSecondary)
                }

                Spacer()

                Button(action: { dismiss() }) {
                    Image(systemName: "xmark.circle.fill")
                        .font(.system(size: 24))
                        .foregroundColor(QMDesign.Colors.textTertiary)
                }
                .buttonStyle(.plain)
            }
            .padding(QMDesign.Spacing.lg)
            .background(QMDesign.Colors.surfaceLight)

            // Form
            ScrollView {
                VStack(spacing: QMDesign.Spacing.lg) {
                    // Name Field
                    VStack(alignment: .leading, spacing: QMDesign.Spacing.sm) {
                        Text("Name")
                            .font(QMDesign.Typography.labelMedium)
                            .foregroundColor(QMDesign.Colors.textPrimary)

                        TextField("e.g., Technical Expert", text: $name)
                            .textFieldStyle(.plain)
                            .font(QMDesign.Typography.bodyMedium)
                            .padding(QMDesign.Spacing.md)
                            .background(
                                RoundedRectangle(cornerRadius: QMDesign.Radius.md)
                                    .fill(QMDesign.Colors.backgroundSecondary)
                            )
                    }

                    // System Prompt Field
                    VStack(alignment: .leading, spacing: QMDesign.Spacing.sm) {
                        Text("System Prompt")
                            .font(QMDesign.Typography.labelMedium)
                            .foregroundColor(QMDesign.Colors.textPrimary)

                        TextEditor(text: $systemPrompt)
                            .font(QMDesign.Typography.bodySmall)
                            .scrollContentBackground(.hidden)
                            .frame(minHeight: 150)
                            .padding(QMDesign.Spacing.sm)
                            .background(
                                RoundedRectangle(cornerRadius: QMDesign.Radius.md)
                                    .fill(QMDesign.Colors.backgroundSecondary)
                            )

                        Text("Define how the AI should behave, its tone, expertise, and response style.")
                            .font(QMDesign.Typography.captionSmall)
                            .foregroundColor(QMDesign.Colors.textTertiary)
                    }
                }
                .padding(QMDesign.Spacing.lg)
            }

            // Footer
            HStack {
                Button("Cancel") {
                    dismiss()
                }
                .buttonStyle(.plain)
                .foregroundColor(QMDesign.Colors.textSecondary)
                .keyboardShortcut(.cancelAction)

                Spacer()

                Button(action: {
                    let mode = Mode(name: name, systemPrompt: systemPrompt)
                    onCreate(mode)
                    dismiss()
                }) {
                    HStack(spacing: QMDesign.Spacing.xs) {
                        Image(systemName: "plus.circle.fill")
                            .font(.system(size: 14))
                        Text("Create Mode")
                            .font(QMDesign.Typography.labelMedium)
                    }
                    .foregroundColor(.white)
                    .padding(.horizontal, QMDesign.Spacing.lg)
                    .padding(.vertical, QMDesign.Spacing.sm)
                    .background(
                        Capsule()
                            .fill(name.isEmpty || systemPrompt.isEmpty
                                ? AnyShapeStyle(QMDesign.Colors.surfaceMedium)
                                : AnyShapeStyle(QMDesign.Colors.primaryGradient))
                    )
                }
                .buttonStyle(.plain)
                .disabled(name.isEmpty || systemPrompt.isEmpty)
                .keyboardShortcut(.defaultAction)
            }
            .padding(QMDesign.Spacing.lg)
            .background(QMDesign.Colors.surfaceLight)
        }
        .frame(width: 500, height: 450)
        .background(QMDesign.Colors.backgroundPrimary)
    }
}
