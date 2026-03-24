import SwiftUI
import SwiftData

struct ModesListView: View {
    @EnvironmentObject var appState: AppState
    @Environment(\.modelContext) private var modelContext
    @Query(sort: \Mode.createdAt, order: .reverse) private var modes: [Mode]

    @State private var showingNewMode = false
    @State private var selectedBuiltInMode: Mode?

    // Built-in modes
    private let builtInModes: [Mode] = [
        Mode.defaultMode,
        Mode.limitlessMode,
        Mode.professionalMode,
        Mode.interviewMode,
        Mode.salesMode,
        Mode.developerExamMode
    ]

    var body: some View {
        List {
            // Built-in Modes
            Section("Built-in Modes") {
                ForEach(builtInModes, id: \.name) { mode in
                    Button(action: { selectedBuiltInMode = mode }) {
                        ModeRowView(
                            mode: mode,
                            isActive: appState.selectedMode?.name == mode.name,
                            onActivate: { appState.selectedMode = mode }
                        )
                    }
                    .buttonStyle(.plain)
                }
            }

            // Custom Modes
            Section("Custom Modes") {
                if modes.isEmpty {
                    Text("No custom modes yet")
                        .font(QMDesign.Typography.bodySmall)
                        .foregroundColor(QMDesign.Colors.textTertiary)
                } else {
                    ForEach(modes) { mode in
                        NavigationLink(value: mode) {
                            ModeRowView(
                                mode: mode,
                                isActive: appState.selectedMode?.id == mode.id,
                                onActivate: { appState.selectedMode = mode }
                            )
                        }
                        .swipeActions(edge: .trailing) {
                            Button(role: .destructive) {
                                if appState.selectedMode?.id == mode.id {
                                    appState.selectedMode = nil
                                }
                                modelContext.delete(mode)
                                try? modelContext.save()
                            } label: {
                                Label("Delete", systemImage: "trash")
                            }
                        }
                    }
                }
            }
        }
        .navigationTitle("Modes")
        .navigationDestination(for: Mode.self) { mode in
            ModeDetailView(mode: mode)
        }
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button { showingNewMode = true } label: {
                    Image(systemName: "plus.circle.fill")
                        .foregroundStyle(QMDesign.Colors.primaryGradient)
                }
            }
        }
        .sheet(isPresented: $showingNewMode) {
            NewModeSheet()
        }
        .sheet(item: $selectedBuiltInMode) { mode in
            BuiltInModeDetailView(
                mode: mode,
                isActive: appState.selectedMode?.name == mode.name,
                onActivate: {
                    appState.selectedMode = mode
                    selectedBuiltInMode = nil
                }
            )
        }
    }
}

// MARK: - Mode Row View

struct ModeRowView: View {
    let mode: Mode
    let isActive: Bool
    let onActivate: () -> Void

    var body: some View {
        HStack(spacing: QMDesign.Spacing.sm) {
            // Icon
            ZStack {
                Circle()
                    .fill(isActive ? QMDesign.Colors.primaryGradient : LinearGradient(colors: [QMDesign.Colors.surfaceMedium], startPoint: .top, endPoint: .bottom))
                    .frame(width: 40, height: 40)
                Image(systemName: modeIcon)
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundColor(isActive ? .white : QMDesign.Colors.textSecondary)
            }

            VStack(alignment: .leading, spacing: QMDesign.Spacing.xxxs) {
                HStack {
                    Text(mode.name)
                        .font(QMDesign.Typography.headline)
                        .foregroundColor(QMDesign.Colors.textPrimary)

                    if isActive {
                        Text("Active")
                            .font(QMDesign.Typography.captionSmall)
                            .foregroundColor(QMDesign.Colors.success)
                            .padding(.horizontal, 6)
                            .padding(.vertical, 2)
                            .background(Capsule().fill(QMDesign.Colors.successLight))
                    }
                }

                Text(mode.builtInDescription ?? String(mode.systemPrompt.prefix(80)) + (mode.systemPrompt.count > 80 ? "..." : ""))
                    .font(QMDesign.Typography.caption)
                    .foregroundColor(QMDesign.Colors.textTertiary)
                    .lineLimit(2)
            }

            Spacer()

            // Activate button
            Button(action: onActivate) {
                Image(systemName: isActive ? "checkmark.circle.fill" : "circle")
                    .font(.system(size: 22))
                    .foregroundColor(isActive ? QMDesign.Colors.success : QMDesign.Colors.textTertiary)
            }
            .buttonStyle(.plain)
        }
        .padding(.vertical, QMDesign.Spacing.xxs)
    }

    private var modeIcon: String {
        switch mode.name {
        case "Default": return "sparkles"
        case "Limitless": return "brain"
        case "Professional": return "briefcase.fill"
        case "Interview": return "person.2.fill"
        case "Sales": return "chart.line.uptrend.xyaxis"
        case "Developer Exam": return "chevron.left.forwardslash.chevron.right"
        default: return "brain.head.profile"
        }
    }
}

// MARK: - Built-in Mode Detail View (read-only)

struct BuiltInModeDetailView: View {
    let mode: Mode
    let isActive: Bool
    let onActivate: () -> Void
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            List {
                if let description = mode.builtInDescription {
                    Section("About this mode") {
                        Text(description)
                            .font(QMDesign.Typography.bodyMedium)
                            .foregroundColor(QMDesign.Colors.textPrimary)
                    }
                }
            }
            .navigationTitle(mode.name)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Close") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button(isActive ? "Active" : "Activate") {
                        onActivate()
                    }
                    .disabled(isActive)
                    .foregroundColor(isActive ? QMDesign.Colors.textTertiary : QMDesign.Colors.accent)
                }
            }
        }
    }
}

// MARK: - Mode Detail View (editable, custom modes)

struct ModeDetailView: View {
    @Bindable var mode: Mode
    @Environment(\.modelContext) private var modelContext

    var body: some View {
        Form {
            Section("Mode Name") {
                TextField("Name", text: $mode.name)
            }

            Section("System Prompt") {
                TextEditor(text: $mode.systemPrompt)
                    .frame(minHeight: 200)
                    .font(QMDesign.Typography.bodyMedium)
            }

            if !mode.attachedFiles.isEmpty {
                Section("Attached Files (\(mode.attachedFiles.count))") {
                    ForEach(mode.attachedFiles, id: \.id) { file in
                        HStack {
                            Image(systemName: "doc.fill")
                                .foregroundColor(QMDesign.Colors.accent)
                            Text(file.name)
                                .font(QMDesign.Typography.bodySmall)
                        }
                    }
                }
            }
        }
        .navigationTitle(mode.name)
        .navigationBarTitleDisplayMode(.inline)
        .onChange(of: mode.name) { _ in
            try? modelContext.save()
        }
        .onChange(of: mode.systemPrompt) { _ in
            try? modelContext.save()
        }
    }
}

// MARK: - New Mode Sheet

struct NewModeSheet: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(\.modelContext) private var modelContext

    @State private var name = ""
    @State private var systemPrompt = ""

    var body: some View {
        NavigationStack {
            Form {
                Section("Mode Name") {
                    TextField("e.g., Consultant, Teacher, etc.", text: $name)
                }
                Section("System Prompt") {
                    TextEditor(text: $systemPrompt)
                        .frame(minHeight: 150)
                        .font(QMDesign.Typography.bodyMedium)

                    Text("Describe how the AI should behave in this mode. Be specific about tone, format, and focus areas.")
                        .font(QMDesign.Typography.caption)
                        .foregroundColor(QMDesign.Colors.textTertiary)
                }
            }
            .navigationTitle("New Mode")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Create") {
                        let mode = Mode(name: name, systemPrompt: systemPrompt)
                        modelContext.insert(mode)
                        try? modelContext.save()
                        dismiss()
                    }
                    .disabled(name.isEmpty || systemPrompt.isEmpty)
                }
            }
        }
    }
}
