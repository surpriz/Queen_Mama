//
//  SettingsView.swift
//  QueenMama
//
//  Modern settings view with sidebar navigation and Auto-Answer settings
//

import SwiftUI

struct SettingsView: View {
    @StateObject private var config = ConfigurationManager.shared
    @State private var selectedSection: SettingsSection = .general

    var body: some View {
        HStack(spacing: 0) {
            // Sidebar
            ModernSettingsSidebar(selectedSection: $selectedSection)
                .frame(width: 220)

            Divider()

            // Content
            ScrollView {
                VStack(alignment: .leading, spacing: QMDesign.Spacing.lg) {
                    switch selectedSection {
                    case .general:
                        ModernGeneralSettingsView()
                    case .autoAnswer:
                        ModernAutoAnswerSettingsView()
                    case .apiKeys:
                        ModernAPIKeysSettingsView()
                    case .models:
                        ModernModelsSettingsView()
                    case .audio:
                        ModernAudioSettingsView()
                    case .shortcuts:
                        ModernShortcutsSettingsView()
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(QMDesign.Spacing.lg)
            }
            .frame(maxWidth: .infinity)
            .background(QMDesign.Colors.backgroundPrimary)
        }
    }
}

// MARK: - Settings Section

enum SettingsSection: String, CaseIterable {
    case general = "General"
    case autoAnswer = "Auto-Answer"
    case apiKeys = "API Keys"
    case models = "Models"
    case audio = "Audio"
    case shortcuts = "Shortcuts"

    var icon: String {
        switch self {
        case .general: return "gear"
        case .autoAnswer: return "bolt.fill"
        case .apiKeys: return "key.fill"
        case .models: return "cpu"
        case .audio: return "speaker.wave.2.fill"
        case .shortcuts: return "keyboard"
        }
    }

    var description: String {
        switch self {
        case .general: return "App preferences"
        case .autoAnswer: return "Automatic responses"
        case .apiKeys: return "API configuration"
        case .models: return "AI models"
        case .audio: return "Audio capture"
        case .shortcuts: return "Keyboard shortcuts"
        }
    }
}

// MARK: - Modern Settings Sidebar

struct ModernSettingsSidebar: View {
    @Binding var selectedSection: SettingsSection

    var body: some View {
        VStack(spacing: 0) {
            // Header
            HStack(spacing: QMDesign.Spacing.sm) {
                ZStack {
                    Circle()
                        .fill(QMDesign.Colors.primaryGradient)
                        .frame(width: 32, height: 32)
                    Image(systemName: "gearshape.fill")
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundColor(.white)
                }

                Text("Settings")
                    .font(QMDesign.Typography.headline)
                    .foregroundColor(QMDesign.Colors.textPrimary)

                Spacer()
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

            // Navigation Items
            ScrollView {
                VStack(spacing: QMDesign.Spacing.xxs) {
                    ForEach(SettingsSection.allCases, id: \.self) { section in
                        SettingsSidebarItem(
                            section: section,
                            isSelected: selectedSection == section
                        ) {
                            withAnimation(QMDesign.Animation.quick) {
                                selectedSection = section
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

// MARK: - Settings Sidebar Item

struct SettingsSidebarItem: View {
    let section: SettingsSection
    let isSelected: Bool
    let action: () -> Void

    @State private var isHovered = false

    var body: some View {
        Button(action: action) {
            HStack(spacing: QMDesign.Spacing.sm) {
                // Icon
                Image(systemName: section.icon)
                    .font(.system(size: 14, weight: isSelected ? .semibold : .regular))
                    .foregroundStyle(isSelected ? AnyShapeStyle(QMDesign.Colors.primaryGradient) : AnyShapeStyle(QMDesign.Colors.textSecondary))
                    .frame(width: 24)

                // Labels
                VStack(alignment: .leading, spacing: 1) {
                    Text(section.rawValue)
                        .font(QMDesign.Typography.bodySmall)
                        .fontWeight(isSelected ? .semibold : .regular)
                        .foregroundColor(isSelected ? QMDesign.Colors.textPrimary : QMDesign.Colors.textSecondary)

                    Text(section.description)
                        .font(QMDesign.Typography.captionSmall)
                        .foregroundColor(QMDesign.Colors.textTertiary)
                }

                Spacer()

                // Indicator
                if isSelected {
                    Circle()
                        .fill(QMDesign.Colors.accent)
                        .frame(width: 6, height: 6)
                }
            }
            .padding(.horizontal, QMDesign.Spacing.sm)
            .padding(.vertical, QMDesign.Spacing.xs)
            .background(
                RoundedRectangle(cornerRadius: QMDesign.Radius.md)
                    .fill(
                        isSelected
                            ? QMDesign.Colors.accent.opacity(0.1)
                            : (isHovered ? QMDesign.Colors.surfaceHover : Color.clear)
                    )
            )
        }
        .buttonStyle(.plain)
        .onHover { isHovered = $0 }
    }
}

// MARK: - Settings Card

struct SettingsCard<Content: View>: View {
    let title: String
    let icon: String
    @ViewBuilder let content: Content

    var body: some View {
        VStack(alignment: .leading, spacing: QMDesign.Spacing.md) {
            // Header
            HStack(spacing: QMDesign.Spacing.sm) {
                Image(systemName: icon)
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(QMDesign.Colors.primaryGradient)

                Text(title)
                    .font(QMDesign.Typography.headline)
                    .foregroundColor(QMDesign.Colors.textPrimary)
                    .fixedSize(horizontal: false, vertical: true)
            }

            // Content
            content
        }
        .frame(maxWidth: .infinity, alignment: .leading)
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

// MARK: - Modern General Settings

struct ModernGeneralSettingsView: View {
    @StateObject private var config = ConfigurationManager.shared

    var body: some View {
        VStack(spacing: QMDesign.Spacing.lg) {
            // Header
            SettingsSectionHeader(
                title: "General Settings",
                subtitle: "Configure app behavior and appearance"
            )

            // Appearance Card
            SettingsCard(title: "Appearance", icon: "paintbrush.fill") {
                VStack(spacing: QMDesign.Spacing.md) {
                    ModernToggleRow(
                        title: "Undetectability Mode",
                        description: "Hide overlay from screen recordings and shares",
                        isOn: $config.isUndetectabilityEnabled,
                        icon: "eye.slash"
                    )

                    Divider()
                        .background(QMDesign.Colors.borderSubtle)

                    ModernToggleRow(
                        title: "Smart Mode",
                        description: "Enhanced AI reasoning for complex questions",
                        isOn: $config.smartModeEnabled,
                        icon: "brain"
                    )
                }
            }

            // Screen Capture Card
            SettingsCard(title: "Screen Capture", icon: "camera.fill") {
                VStack(spacing: QMDesign.Spacing.md) {
                    ModernToggleRow(
                        title: "Auto-capture Screen",
                        description: "Automatically capture screen for context",
                        isOn: $config.autoScreenCapture,
                        icon: "rectangle.dashed.badge.record"
                    )

                    if config.autoScreenCapture {
                        HStack {
                            Text("Capture interval")
                                .font(QMDesign.Typography.bodySmall)
                                .foregroundColor(QMDesign.Colors.textSecondary)

                            Spacer()

                            HStack(spacing: QMDesign.Spacing.sm) {
                                Button(action: { config.screenCaptureIntervalSeconds = max(1, config.screenCaptureIntervalSeconds - 1) }) {
                                    Image(systemName: "minus")
                                        .frame(width: 28, height: 28)
                                        .background(QMDesign.Colors.surfaceMedium)
                                        .clipShape(Circle())
                                }
                                .buttonStyle(.plain)

                                Text("\(Int(config.screenCaptureIntervalSeconds))s")
                                    .font(QMDesign.Typography.bodyMedium)
                                    .foregroundColor(QMDesign.Colors.textPrimary)
                                    .frame(minWidth: 40)

                                Button(action: { config.screenCaptureIntervalSeconds = min(30, config.screenCaptureIntervalSeconds + 1) }) {
                                    Image(systemName: "plus")
                                        .frame(width: 28, height: 28)
                                        .background(QMDesign.Colors.surfaceMedium)
                                        .clipShape(Circle())
                                }
                                .buttonStyle(.plain)
                            }
                        }
                        .padding(QMDesign.Spacing.sm)
                        .background(
                            RoundedRectangle(cornerRadius: QMDesign.Radius.md)
                                .fill(QMDesign.Colors.backgroundSecondary)
                        )
                    }
                }
            }

            // AI Provider Card
            SettingsCard(title: "AI Provider", icon: "cpu") {
                VStack(spacing: QMDesign.Spacing.md) {
                    HStack {
                        VStack(alignment: .leading, spacing: 4) {
                            Text("Preferred Provider")
                                .font(QMDesign.Typography.bodySmall)
                                .foregroundColor(QMDesign.Colors.textSecondary)
                            Text("Will fallback to others if unavailable")
                                .font(QMDesign.Typography.captionSmall)
                                .foregroundColor(QMDesign.Colors.textTertiary)
                        }

                        Spacer()

                        Picker("", selection: $config.selectedAIProvider) {
                            ForEach(AIProviderType.allCases, id: \.self) { provider in
                                Text(provider.displayName).tag(provider)
                            }
                        }
                        .pickerStyle(.menu)
                        .frame(width: 150)
                    }
                }
            }
        }
    }
}

// MARK: - Modern Auto-Answer Settings

struct ModernAutoAnswerSettingsView: View {
    @StateObject private var config = ConfigurationManager.shared

    var body: some View {
        VStack(spacing: QMDesign.Spacing.lg) {
            // Header
            SettingsSectionHeader(
                title: "Auto-Answer",
                subtitle: "Configure automatic AI responses"
            )

            // Enable Card
            SettingsCard(title: "Automatic Responses", icon: "bolt.fill") {
                VStack(spacing: QMDesign.Spacing.md) {
                    ModernToggleRow(
                        title: "Enable Auto-Answer",
                        description: "Automatically trigger AI responses based on context",
                        isOn: $config.autoAnswerEnabled,
                        icon: "bolt.circle"
                    )

                    if config.autoAnswerEnabled {
                        // Info box
                        HStack(alignment: .top, spacing: QMDesign.Spacing.sm) {
                            Image(systemName: "info.circle.fill")
                                .foregroundStyle(QMDesign.Colors.primaryGradient)
                            Text("Auto-Answer will trigger when silence is detected after speech, or when a question is recognized.")
                                .font(QMDesign.Typography.caption)
                                .foregroundColor(QMDesign.Colors.textSecondary)
                        }
                        .padding(QMDesign.Spacing.sm)
                        .background(
                            RoundedRectangle(cornerRadius: QMDesign.Radius.md)
                                .fill(QMDesign.Colors.accent.opacity(0.05))
                        )
                    }
                }
            }

            // Triggers Card
            if config.autoAnswerEnabled {
                SettingsCard(title: "Trigger Settings", icon: "slider.horizontal.3") {
                    VStack(spacing: QMDesign.Spacing.lg) {
                        // Silence Threshold
                        VStack(alignment: .leading, spacing: QMDesign.Spacing.sm) {
                            HStack {
                                VStack(alignment: .leading, spacing: 2) {
                                    Text("Silence Threshold")
                                        .font(QMDesign.Typography.bodySmall)
                                        .foregroundColor(QMDesign.Colors.textPrimary)
                                    Text("Time to wait after speech stops")
                                        .font(QMDesign.Typography.captionSmall)
                                        .foregroundColor(QMDesign.Colors.textTertiary)
                                }
                                Spacer()
                                Text(String(format: "%.1fs", config.autoAnswerSilenceThreshold))
                                    .font(QMDesign.Typography.bodyMedium)
                                    .foregroundStyle(QMDesign.Colors.primaryGradient)
                            }

                            Slider(
                                value: $config.autoAnswerSilenceThreshold,
                                in: 1...5,
                                step: 0.5
                            )
                            .tint(QMDesign.Colors.accent)
                        }

                        Divider()
                            .background(QMDesign.Colors.borderSubtle)

                        // Cooldown
                        VStack(alignment: .leading, spacing: QMDesign.Spacing.sm) {
                            HStack {
                                VStack(alignment: .leading, spacing: 2) {
                                    Text("Cooldown Period")
                                        .font(QMDesign.Typography.bodySmall)
                                        .foregroundColor(QMDesign.Colors.textPrimary)
                                    Text("Minimum time between auto-responses")
                                        .font(QMDesign.Typography.captionSmall)
                                        .foregroundColor(QMDesign.Colors.textTertiary)
                                }
                                Spacer()
                                Text(String(format: "%.0fs", config.autoAnswerCooldown))
                                    .font(QMDesign.Typography.bodyMedium)
                                    .foregroundStyle(QMDesign.Colors.primaryGradient)
                            }

                            Slider(
                                value: $config.autoAnswerCooldown,
                                in: 5...30,
                                step: 5
                            )
                            .tint(QMDesign.Colors.accent)
                        }
                    }
                }

                // Response Type Card
                SettingsCard(title: "Response Type", icon: "text.bubble") {
                    VStack(spacing: QMDesign.Spacing.sm) {
                        ForEach(["assist", "whatToSay", "followUp"], id: \.self) { type in
                            ResponseTypeOption(
                                type: type,
                                isSelected: config.autoAnswerResponseType == type
                            ) {
                                config.autoAnswerResponseType = type
                            }
                        }
                    }
                }
            }
        }
    }
}

struct ResponseTypeOption: View {
    let type: String
    let isSelected: Bool
    let action: () -> Void

    @State private var isHovered = false

    var title: String {
        switch type {
        case "assist": return "Assist"
        case "whatToSay": return "What Should I Say"
        case "followUp": return "Follow-up Questions"
        default: return type
        }
    }

    var description: String {
        switch type {
        case "assist": return "General AI assistance based on context"
        case "whatToSay": return "Suggestions for what to say next"
        case "followUp": return "Generate follow-up questions"
        default: return ""
        }
    }

    var icon: String {
        switch type {
        case "assist": return "sparkles"
        case "whatToSay": return "text.bubble"
        case "followUp": return "questionmark.bubble"
        default: return "circle"
        }
    }

    var body: some View {
        Button(action: action) {
            HStack(spacing: QMDesign.Spacing.sm) {
                Image(systemName: icon)
                    .font(.system(size: 14))
                    .foregroundStyle(isSelected ? AnyShapeStyle(QMDesign.Colors.primaryGradient) : AnyShapeStyle(QMDesign.Colors.textSecondary))
                    .frame(width: 24)

                VStack(alignment: .leading, spacing: 2) {
                    Text(title)
                        .font(QMDesign.Typography.bodySmall)
                        .foregroundColor(isSelected ? QMDesign.Colors.textPrimary : QMDesign.Colors.textSecondary)
                    Text(description)
                        .font(QMDesign.Typography.captionSmall)
                        .foregroundColor(QMDesign.Colors.textTertiary)
                }

                Spacer()

                if isSelected {
                    Image(systemName: "checkmark.circle.fill")
                        .foregroundStyle(QMDesign.Colors.primaryGradient)
                }
            }
            .padding(QMDesign.Spacing.sm)
            .background(
                RoundedRectangle(cornerRadius: QMDesign.Radius.md)
                    .fill(isSelected ? QMDesign.Colors.accent.opacity(0.1) : (isHovered ? QMDesign.Colors.surfaceHover : QMDesign.Colors.backgroundSecondary))
                    .overlay(
                        RoundedRectangle(cornerRadius: QMDesign.Radius.md)
                            .stroke(isSelected ? QMDesign.Colors.accent.opacity(0.3) : Color.clear, lineWidth: 1)
                    )
            )
        }
        .buttonStyle(.plain)
        .onHover { isHovered = $0 }
    }
}

// MARK: - Modern API Keys Settings

struct ModernAPIKeysSettingsView: View {
    @State private var deepgramKey = ""
    @State private var assemblyAIKey = ""
    @State private var openAIKey = ""
    @State private var anthropicKey = ""
    @State private var xaiKey = ""
    @State private var geminiKey = ""

    @State private var showDeepgram = false
    @State private var showAssemblyAI = false
    @State private var showOpenAI = false
    @State private var showAnthropic = false
    @State private var showXAI = false
    @State private var showGemini = false

    @State private var saveMessage = ""
    @State private var saveSuccess = true

    private let keychain = KeychainManager.shared

    var body: some View {
        VStack(spacing: QMDesign.Spacing.lg) {
            // Header
            SettingsSectionHeader(
                title: "API Keys",
                subtitle: "Configure your API credentials"
            )

            // Speech-to-Text Card
            SettingsCard(title: "Speech-to-Text", icon: "waveform") {
                VStack(spacing: QMDesign.Spacing.md) {
                    ModernAPIKeyField(
                        title: "Deepgram",
                        subtitle: "Primary transcription provider",
                        key: $deepgramKey,
                        showKey: $showDeepgram,
                        isConfigured: keychain.hasAPIKey(for: .deepgram),
                        onSave: { saveKey(.deepgram, deepgramKey) }
                    )

                    Divider()
                        .background(QMDesign.Colors.borderSubtle)

                    ModernAPIKeyField(
                        title: "AssemblyAI",
                        subtitle: "Fallback transcription provider",
                        key: $assemblyAIKey,
                        showKey: $showAssemblyAI,
                        isConfigured: keychain.hasAPIKey(for: .assemblyai),
                        onSave: { saveKey(.assemblyai, assemblyAIKey) }
                    )
                }
            }

            // AI Providers Card
            SettingsCard(title: "AI Providers", icon: "cpu") {
                VStack(spacing: QMDesign.Spacing.md) {
                    ModernAPIKeyField(
                        title: "OpenAI",
                        subtitle: "GPT-4o mini / o3",
                        key: $openAIKey,
                        showKey: $showOpenAI,
                        isConfigured: keychain.hasAPIKey(for: .openai),
                        onSave: { saveKey(.openai, openAIKey) }
                    )

                    Divider()
                        .background(QMDesign.Colors.borderSubtle)

                    ModernAPIKeyField(
                        title: "Anthropic",
                        subtitle: "Claude Sonnet 4.5",
                        key: $anthropicKey,
                        showKey: $showAnthropic,
                        isConfigured: keychain.hasAPIKey(for: .anthropic),
                        onSave: { saveKey(.anthropic, anthropicKey) }
                    )

                    Divider()
                        .background(QMDesign.Colors.borderSubtle)

                    ModernAPIKeyField(
                        title: "xAI (Grok)",
                        subtitle: "Grok 4.1 Fast",
                        key: $xaiKey,
                        showKey: $showXAI,
                        isConfigured: keychain.hasAPIKey(for: .xai),
                        onSave: { saveKey(.xai, xaiKey) }
                    )

                    Divider()
                        .background(QMDesign.Colors.borderSubtle)

                    ModernAPIKeyField(
                        title: "Google Gemini",
                        subtitle: "Gemini 2.0 Flash (backup)",
                        key: $geminiKey,
                        showKey: $showGemini,
                        isConfigured: keychain.hasAPIKey(for: .gemini),
                        onSave: { saveKey(.gemini, geminiKey) }
                    )
                }
            }

            // Save Message
            if !saveMessage.isEmpty {
                HStack(spacing: QMDesign.Spacing.sm) {
                    Image(systemName: saveSuccess ? "checkmark.circle.fill" : "exclamationmark.circle.fill")
                        .foregroundColor(saveSuccess ? QMDesign.Colors.success : QMDesign.Colors.error)
                    Text(saveMessage)
                        .font(QMDesign.Typography.bodySmall)
                        .foregroundColor(saveSuccess ? QMDesign.Colors.success : QMDesign.Colors.error)
                }
                .padding(QMDesign.Spacing.md)
                .background(
                    RoundedRectangle(cornerRadius: QMDesign.Radius.md)
                        .fill((saveSuccess ? QMDesign.Colors.success : QMDesign.Colors.error).opacity(0.1))
                )
            }
        }
        .onAppear(perform: loadKeys)
    }

    private func loadKeys() {
        deepgramKey = keychain.getAPIKey(for: .deepgram) ?? ""
        assemblyAIKey = keychain.getAPIKey(for: .assemblyai) ?? ""
        openAIKey = keychain.getAPIKey(for: .openai) ?? ""
        anthropicKey = keychain.getAPIKey(for: .anthropic) ?? ""
        xaiKey = keychain.getAPIKey(for: .xai) ?? ""
        geminiKey = keychain.getAPIKey(for: .gemini) ?? ""
    }

    private func saveKey(_ type: KeychainManager.APIKeyType, _ key: String) {
        do {
            if key.isEmpty {
                try keychain.deleteAPIKey(for: type)
            } else {
                try keychain.saveAPIKey(key, for: type)
            }
            saveSuccess = true
            saveMessage = "\(type.displayName) key saved"

            DispatchQueue.main.asyncAfter(deadline: .now() + 2) {
                saveMessage = ""
            }
        } catch {
            saveSuccess = false
            saveMessage = "Error: \(error.localizedDescription)"
        }
    }
}

struct ModernAPIKeyField: View {
    let title: String
    let subtitle: String
    @Binding var key: String
    @Binding var showKey: Bool
    let isConfigured: Bool
    let onSave: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: QMDesign.Spacing.sm) {
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    HStack(spacing: QMDesign.Spacing.xs) {
                        Text(title)
                            .font(QMDesign.Typography.bodyMedium)
                            .foregroundColor(QMDesign.Colors.textPrimary)

                        if isConfigured {
                            Image(systemName: "checkmark.circle.fill")
                                .font(.system(size: 12))
                                .foregroundColor(QMDesign.Colors.success)
                        }
                    }
                    Text(subtitle)
                        .font(QMDesign.Typography.captionSmall)
                        .foregroundColor(QMDesign.Colors.textTertiary)
                }

                Spacer()
            }

            HStack(spacing: QMDesign.Spacing.sm) {
                if showKey {
                    TextField("Enter API Key", text: $key)
                        .textFieldStyle(.plain)
                        .font(QMDesign.Typography.bodySmall)
                        .padding(QMDesign.Spacing.sm)
                        .background(
                            RoundedRectangle(cornerRadius: QMDesign.Radius.md)
                                .fill(QMDesign.Colors.backgroundSecondary)
                        )
                } else {
                    SecureField("Enter API Key", text: $key)
                        .textFieldStyle(.plain)
                        .font(QMDesign.Typography.bodySmall)
                        .padding(QMDesign.Spacing.sm)
                        .background(
                            RoundedRectangle(cornerRadius: QMDesign.Radius.md)
                                .fill(QMDesign.Colors.backgroundSecondary)
                        )
                }

                Button(action: { showKey.toggle() }) {
                    Image(systemName: showKey ? "eye.slash" : "eye")
                        .font(.system(size: 14))
                        .foregroundColor(QMDesign.Colors.textSecondary)
                        .frame(width: 32, height: 32)
                        .background(
                            Circle()
                                .fill(QMDesign.Colors.surfaceMedium)
                        )
                }
                .buttonStyle(.plain)

                Button(action: onSave) {
                    Text("Save")
                        .font(QMDesign.Typography.labelSmall)
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
    }
}

// MARK: - Modern Models Settings

struct ModernModelsSettingsView: View {
    private let keychain = KeychainManager.shared

    var body: some View {
        VStack(spacing: QMDesign.Spacing.lg) {
            // Header
            SettingsSectionHeader(
                title: "AI Models",
                subtitle: "Models used for transcription and AI responses"
            )

            // AI Models Card
            SettingsCard(title: "AI Response Models", icon: "cpu") {
                VStack(spacing: QMDesign.Spacing.md) {
                    ModernModelRow(
                        provider: "OpenAI",
                        model: "gpt-4o",
                        description: "GPT-4o with vision capabilities",
                        isConfigured: keychain.hasAPIKey(for: .openai)
                    )

                    Divider().background(QMDesign.Colors.borderSubtle)

                    ModernModelRow(
                        provider: "Anthropic",
                        model: "claude-sonnet-4-20250514",
                        description: "Claude Sonnet 4 with vision",
                        isConfigured: keychain.hasAPIKey(for: .anthropic)
                    )

                    Divider().background(QMDesign.Colors.borderSubtle)

                    ModernModelRow(
                        provider: "Google Gemini",
                        model: "gemini-2.0-flash",
                        description: "Gemini 2.0 Flash with vision",
                        isConfigured: keychain.hasAPIKey(for: .gemini)
                    )
                }
            }

            // Speech Models Card
            SettingsCard(title: "Speech Recognition", icon: "waveform") {
                VStack(spacing: QMDesign.Spacing.md) {
                    ModernModelRow(
                        provider: "Deepgram",
                        model: "nova-3",
                        description: "Real-time speech recognition",
                        isConfigured: keychain.hasAPIKey(for: .deepgram)
                    )

                    Divider().background(QMDesign.Colors.borderSubtle)

                    ModernModelRow(
                        provider: "AssemblyAI",
                        model: "realtime",
                        description: "Fallback speech recognition",
                        isConfigured: keychain.hasAPIKey(for: .assemblyai)
                    )
                }
            }

            // Fallback Order Card
            SettingsCard(title: "Fallback Order", icon: "arrow.triangle.branch") {
                VStack(alignment: .leading, spacing: QMDesign.Spacing.md) {
                    Text("When a provider fails, Queen Mama automatically tries the next one:")
                        .font(QMDesign.Typography.caption)
                        .foregroundColor(QMDesign.Colors.textSecondary)

                    HStack(spacing: QMDesign.Spacing.sm) {
                        FallbackBadge(name: "OpenAI", number: 1, isConfigured: keychain.hasAPIKey(for: .openai))
                        Image(systemName: "chevron.right")
                            .font(.system(size: 10))
                            .foregroundColor(QMDesign.Colors.textTertiary)
                        FallbackBadge(name: "Anthropic", number: 2, isConfigured: keychain.hasAPIKey(for: .anthropic))
                        Image(systemName: "chevron.right")
                            .font(.system(size: 10))
                            .foregroundColor(QMDesign.Colors.textTertiary)
                        FallbackBadge(name: "Gemini", number: 3, isConfigured: keychain.hasAPIKey(for: .gemini))
                    }
                }
            }
        }
    }
}

struct ModernModelRow: View {
    let provider: String
    let model: String
    let description: String
    let isConfigured: Bool

    var body: some View {
        HStack(spacing: QMDesign.Spacing.md) {
            // Status indicator
            Circle()
                .fill(isConfigured ? QMDesign.Colors.success : QMDesign.Colors.error)
                .frame(width: 8, height: 8)

            VStack(alignment: .leading, spacing: 4) {
                HStack(spacing: QMDesign.Spacing.xs) {
                    Text(provider)
                        .font(QMDesign.Typography.bodyMedium)
                        .foregroundColor(QMDesign.Colors.textPrimary)

                    Text(model)
                        .font(.system(size: 12, design: .monospaced))
                        .foregroundStyle(QMDesign.Colors.primaryGradient)
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(
                            RoundedRectangle(cornerRadius: 4)
                                .fill(QMDesign.Colors.accent.opacity(0.1))
                        )
                }
                Text(description)
                    .font(QMDesign.Typography.caption)
                    .foregroundColor(QMDesign.Colors.textTertiary)
            }

            Spacer()
        }
    }
}

struct FallbackBadge: View {
    let name: String
    let number: Int
    let isConfigured: Bool

    var body: some View {
        HStack(spacing: 4) {
            Text("\(number)")
                .font(QMDesign.Typography.captionSmall)
                .foregroundColor(isConfigured ? .white : QMDesign.Colors.textTertiary)
                .frame(width: 16, height: 16)
                .background(
                    Circle()
                        .fill(isConfigured ? QMDesign.Colors.accent : QMDesign.Colors.surfaceMedium)
                )
            Text(name)
                .font(QMDesign.Typography.caption)
                .foregroundColor(isConfigured ? QMDesign.Colors.textPrimary : QMDesign.Colors.textTertiary)
        }
        .padding(.horizontal, QMDesign.Spacing.sm)
        .padding(.vertical, 4)
        .background(
            RoundedRectangle(cornerRadius: QMDesign.Radius.sm)
                .fill(isConfigured ? QMDesign.Colors.success.opacity(0.1) : QMDesign.Colors.surfaceLight)
        )
    }
}

// MARK: - Modern Audio Settings

struct ModernAudioSettingsView: View {
    @StateObject private var config = ConfigurationManager.shared

    var body: some View {
        VStack(spacing: QMDesign.Spacing.lg) {
            // Header
            SettingsSectionHeader(
                title: "Audio Settings",
                subtitle: "Configure audio capture sources"
            )

            // Audio Sources Card
            SettingsCard(title: "Audio Sources", icon: "speaker.wave.2.fill") {
                VStack(spacing: QMDesign.Spacing.md) {
                    ModernToggleRow(
                        title: "Capture Microphone",
                        description: "Record your voice from the microphone",
                        isOn: $config.captureMicrophone,
                        icon: "mic.fill"
                    )

                    Divider().background(QMDesign.Colors.borderSubtle)

                    ModernToggleRow(
                        title: "Capture System Audio",
                        description: "Record audio from other applications",
                        isOn: $config.captureSystemAudio,
                        icon: "speaker.wave.3.fill"
                    )
                }
            }

            // Info Card
            SettingsCard(title: "Privacy Information", icon: "shield.lefthalf.filled") {
                VStack(alignment: .leading, spacing: QMDesign.Spacing.sm) {
                    InfoRow(icon: "waveform.path", text: "Audio is streamed directly to transcription services")
                    InfoRow(icon: "externaldrive.badge.xmark", text: "Audio is not stored locally on your device")
                    InfoRow(icon: "lock.shield", text: "All transmissions are encrypted")
                }
            }
        }
    }
}

struct InfoRow: View {
    let icon: String
    let text: String

    var body: some View {
        HStack(spacing: QMDesign.Spacing.sm) {
            Image(systemName: icon)
                .font(.system(size: 12))
                .foregroundStyle(QMDesign.Colors.primaryGradient)
                .frame(width: 20)
            Text(text)
                .font(QMDesign.Typography.caption)
                .foregroundColor(QMDesign.Colors.textSecondary)
        }
    }
}

// MARK: - Modern Shortcuts Settings

struct ModernShortcutsSettingsView: View {
    @StateObject private var config = ConfigurationManager.shared

    var body: some View {
        VStack(spacing: QMDesign.Spacing.lg) {
            // Header
            SettingsSectionHeader(
                title: "Keyboard Shortcuts",
                subtitle: "View and customize keyboard shortcuts"
            )

            // Global Shortcuts Card
            SettingsCard(title: "Global Shortcuts", icon: "globe") {
                VStack(spacing: QMDesign.Spacing.md) {
                    ModernShortcutRow(
                        title: "Toggle Widget",
                        description: "Show/hide the overlay widget",
                        shortcut: config.shortcutToggleWidget
                    )

                    Divider().background(QMDesign.Colors.borderSubtle)

                    ModernShortcutRow(
                        title: "Trigger Assist",
                        description: "Get AI assistance based on context",
                        shortcut: config.shortcutAssist
                    )

                    Divider().background(QMDesign.Colors.borderSubtle)

                    ModernShortcutRow(
                        title: "Clear Context",
                        description: "Clear transcript and context",
                        shortcut: config.shortcutClearContext
                    )
                }
            }

            // Widget Shortcuts Card
            SettingsCard(title: "Widget Navigation", icon: "rectangle.3.group") {
                VStack(spacing: QMDesign.Spacing.md) {
                    ModernShortcutRow(
                        title: "Move Widget",
                        description: "Reposition the overlay widget",
                        shortcut: "Cmd + Arrow Keys"
                    )

                    Divider().background(QMDesign.Colors.borderSubtle)

                    ModernShortcutRow(
                        title: "Scroll Responses",
                        description: "Scroll through AI responses",
                        shortcut: "Shift + Cmd + Up/Down"
                    )
                }
            }
        }
    }
}

struct ModernShortcutRow: View {
    let title: String
    let description: String
    let shortcut: String

    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 4) {
                Text(title)
                    .font(QMDesign.Typography.bodyMedium)
                    .foregroundColor(QMDesign.Colors.textPrimary)
                Text(description)
                    .font(QMDesign.Typography.caption)
                    .foregroundColor(QMDesign.Colors.textTertiary)
            }

            Spacer()

            KeyboardShortcutBadge(shortcut: shortcut, size: .medium)
        }
    }
}

// MARK: - Helper Components

struct SettingsSectionHeader: View {
    let title: String
    let subtitle: String

    var body: some View {
        VStack(alignment: .leading, spacing: QMDesign.Spacing.xs) {
            Text(title)
                .font(QMDesign.Typography.titleMedium)
                .foregroundStyle(QMDesign.Colors.primaryGradient)
                .fixedSize(horizontal: false, vertical: true)
            Text(subtitle)
                .font(QMDesign.Typography.bodySmall)
                .foregroundColor(QMDesign.Colors.textSecondary)
                .fixedSize(horizontal: false, vertical: true)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

struct ModernToggleRow: View {
    let title: String
    let description: String
    @Binding var isOn: Bool
    let icon: String

    var body: some View {
        HStack(spacing: QMDesign.Spacing.md) {
            Image(systemName: icon)
                .font(.system(size: 16))
                .foregroundStyle(isOn ? AnyShapeStyle(QMDesign.Colors.primaryGradient) : AnyShapeStyle(QMDesign.Colors.textSecondary))
                .frame(width: 24)

            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(QMDesign.Typography.bodyMedium)
                    .foregroundColor(QMDesign.Colors.textPrimary)
                    .fixedSize(horizontal: false, vertical: true)
                Text(description)
                    .font(QMDesign.Typography.caption)
                    .foregroundColor(QMDesign.Colors.textTertiary)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .frame(maxWidth: .infinity, alignment: .leading)

            Toggle("", isOn: $isOn)
                .toggleStyle(.switch)
                .tint(QMDesign.Colors.accent)
                .labelsHidden()
        }
    }
}

// MARK: - Legacy Support

enum SettingsTab {
    case general
    case apiKeys
    case models
    case audio
    case shortcuts
}

typealias GeneralSettingsView = ModernGeneralSettingsView
typealias APIKeysSettingsView = ModernAPIKeysSettingsView
typealias ModelsSettingsView = ModernModelsSettingsView
typealias AudioSettingsView = ModernAudioSettingsView
typealias ShortcutsSettingsView = ModernShortcutsSettingsView
