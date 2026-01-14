import SwiftUI

struct SettingsView: View {
    @StateObject private var config = ConfigurationManager.shared
    @State private var selectedTab: SettingsTab = .general

    var body: some View {
        TabView(selection: $selectedTab) {
            GeneralSettingsView()
                .tabItem {
                    Label("General", systemImage: "gear")
                }
                .tag(SettingsTab.general)

            APIKeysSettingsView()
                .tabItem {
                    Label("API Keys", systemImage: "key")
                }
                .tag(SettingsTab.apiKeys)

            ModelsSettingsView()
                .tabItem {
                    Label("Models", systemImage: "cpu")
                }
                .tag(SettingsTab.models)

            AudioSettingsView()
                .tabItem {
                    Label("Audio", systemImage: "speaker.wave.2")
                }
                .tag(SettingsTab.audio)

            ShortcutsSettingsView()
                .tabItem {
                    Label("Shortcuts", systemImage: "keyboard")
                }
                .tag(SettingsTab.shortcuts)
        }
        .padding()
        .frame(minWidth: 500, minHeight: 400)
    }
}

enum SettingsTab {
    case general
    case apiKeys
    case models
    case audio
    case shortcuts
}

// MARK: - General Settings

struct GeneralSettingsView: View {
    @StateObject private var config = ConfigurationManager.shared

    var body: some View {
        Form {
            Section("Appearance") {
                Toggle("Enable Undetectability Mode", isOn: $config.isUndetectabilityEnabled)
                    .help("Hide overlay from screen recordings and shares")

                Toggle("Smart Mode", isOn: $config.smartModeEnabled)
                    .help("Enhanced AI reasoning for complex questions")
            }

            Section("Screen Capture") {
                Toggle("Auto-capture Screen", isOn: $config.autoScreenCapture)

                if config.autoScreenCapture {
                    Stepper(
                        value: $config.screenCaptureIntervalSeconds,
                        in: 1...30,
                        step: 1
                    ) {
                        Text("Capture interval: \(Int(config.screenCaptureIntervalSeconds))s")
                    }
                }
            }

            Section("AI Provider") {
                Picker("Preferred Provider", selection: $config.selectedAIProvider) {
                    ForEach(AIProviderType.allCases, id: \.self) { provider in
                        Text(provider.displayName).tag(provider)
                    }
                }
                .pickerStyle(.menu)

                Text("Note: Will automatically fallback to other providers if the preferred one fails.")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
        }
        .formStyle(.grouped)
    }
}

// MARK: - API Keys Settings

struct APIKeysSettingsView: View {
    @State private var deepgramKey = ""
    @State private var assemblyAIKey = ""
    @State private var openAIKey = ""
    @State private var anthropicKey = ""
    @State private var geminiKey = ""

    @State private var showDeepgram = false
    @State private var showAssemblyAI = false
    @State private var showOpenAI = false
    @State private var showAnthropic = false
    @State private var showGemini = false

    @State private var saveMessage = ""

    private let keychain = KeychainManager.shared

    var body: some View {
        Form {
            Section("Speech-to-Text (at least one required)") {
                APIKeyField(
                    title: "Deepgram",
                    key: $deepgramKey,
                    showKey: $showDeepgram,
                    isConfigured: keychain.hasAPIKey(for: .deepgram),
                    onSave: { saveKey(.deepgram, deepgramKey) }
                )

                APIKeyField(
                    title: "AssemblyAI",
                    key: $assemblyAIKey,
                    showKey: $showAssemblyAI,
                    isConfigured: keychain.hasAPIKey(for: .assemblyai),
                    onSave: { saveKey(.assemblyai, assemblyAIKey) }
                )
            }

            Section("AI Providers (at least one required)") {
                APIKeyField(
                    title: "OpenAI",
                    key: $openAIKey,
                    showKey: $showOpenAI,
                    isConfigured: keychain.hasAPIKey(for: .openai),
                    onSave: { saveKey(.openai, openAIKey) }
                )

                APIKeyField(
                    title: "Anthropic",
                    key: $anthropicKey,
                    showKey: $showAnthropic,
                    isConfigured: keychain.hasAPIKey(for: .anthropic),
                    onSave: { saveKey(.anthropic, anthropicKey) }
                )

                APIKeyField(
                    title: "Google Gemini",
                    key: $geminiKey,
                    showKey: $showGemini,
                    isConfigured: keychain.hasAPIKey(for: .gemini),
                    onSave: { saveKey(.gemini, geminiKey) }
                )
            }

            if !saveMessage.isEmpty {
                Section {
                    Text(saveMessage)
                        .foregroundColor(.green)
                }
            }
        }
        .formStyle(.grouped)
        .onAppear(perform: loadKeys)
    }

    private func loadKeys() {
        deepgramKey = keychain.getAPIKey(for: .deepgram) ?? ""
        assemblyAIKey = keychain.getAPIKey(for: .assemblyai) ?? ""
        openAIKey = keychain.getAPIKey(for: .openai) ?? ""
        anthropicKey = keychain.getAPIKey(for: .anthropic) ?? ""
        geminiKey = keychain.getAPIKey(for: .gemini) ?? ""
    }

    private func saveKey(_ type: KeychainManager.APIKeyType, _ key: String) {
        do {
            if key.isEmpty {
                try keychain.deleteAPIKey(for: type)
            } else {
                try keychain.saveAPIKey(key, for: type)
            }
            saveMessage = "\(type.displayName) key saved successfully"

            DispatchQueue.main.asyncAfter(deadline: .now() + 2) {
                saveMessage = ""
            }
        } catch {
            saveMessage = "Error: \(error.localizedDescription)"
        }
    }
}

struct APIKeyField: View {
    let title: String
    @Binding var key: String
    @Binding var showKey: Bool
    let isConfigured: Bool
    let onSave: () -> Void

    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 4) {
                HStack {
                    Text(title)
                    if isConfigured {
                        Image(systemName: "checkmark.circle.fill")
                            .foregroundColor(.green)
                            .font(.caption)
                    }
                }

                HStack {
                    if showKey {
                        TextField("API Key", text: $key)
                            .textFieldStyle(.roundedBorder)
                    } else {
                        SecureField("API Key", text: $key)
                            .textFieldStyle(.roundedBorder)
                    }

                    Button(action: { showKey.toggle() }) {
                        Image(systemName: showKey ? "eye.slash" : "eye")
                    }
                    .buttonStyle(.plain)
                }
            }

            Button("Save", action: onSave)
        }
    }
}

// MARK: - Audio Settings

struct AudioSettingsView: View {
    @StateObject private var config = ConfigurationManager.shared

    var body: some View {
        Form {
            Section("Audio Sources") {
                Toggle("Capture Microphone", isOn: $config.captureMicrophone)
                    .help("Capture your voice from the microphone")

                Toggle("Capture System Audio", isOn: $config.captureSystemAudio)
                    .help("Capture audio from other applications (requires macOS 14.2+)")
            }

            Section("Info") {
                Text("Queen Mama captures audio and sends it to Deepgram for real-time transcription.")
                    .font(.caption)
                    .foregroundColor(.secondary)

                Text("Audio is streamed directly and not stored locally.")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
        }
        .formStyle(.grouped)
    }
}

// MARK: - Models Settings

struct ModelsSettingsView: View {
    private let keychain = KeychainManager.shared

    var body: some View {
        Form {
            Section("AI Models Currently Used") {
                ModelRow(
                    provider: "OpenAI",
                    model: "gpt-4o",
                    description: "GPT-4o with vision capabilities",
                    isConfigured: keychain.hasAPIKey(for: .openai)
                )

                ModelRow(
                    provider: "Anthropic",
                    model: "claude-sonnet-4-20250514",
                    description: "Claude Sonnet 4 with vision capabilities",
                    isConfigured: keychain.hasAPIKey(for: .anthropic)
                )

                ModelRow(
                    provider: "Google Gemini",
                    model: "gemini-2.0-flash",
                    description: "Gemini 2.0 Flash with vision capabilities",
                    isConfigured: keychain.hasAPIKey(for: .gemini)
                )
            }

            Section("Speech-to-Text") {
                ModelRow(
                    provider: "Deepgram",
                    model: "nova-3",
                    description: "Real-time speech recognition (multi-language)",
                    isConfigured: keychain.hasAPIKey(for: .deepgram)
                )

                ModelRow(
                    provider: "AssemblyAI",
                    model: "realtime",
                    description: "Real-time speech recognition (multi-language, fallback)",
                    isConfigured: keychain.hasAPIKey(for: .assemblyai)
                )
            }

            Section("Fallback Order") {
                Text("When a provider fails, Queen Mama automatically tries the next one:")
                    .font(.caption)
                    .foregroundColor(.secondary)

                HStack(spacing: 8) {
                    ProviderBadge(name: "1. OpenAI", isConfigured: keychain.hasAPIKey(for: .openai))
                    Image(systemName: "arrow.right")
                        .foregroundColor(.secondary)
                    ProviderBadge(name: "2. Anthropic", isConfigured: keychain.hasAPIKey(for: .anthropic))
                    Image(systemName: "arrow.right")
                        .foregroundColor(.secondary)
                    ProviderBadge(name: "3. Gemini", isConfigured: keychain.hasAPIKey(for: .gemini))
                }
            }
        }
        .formStyle(.grouped)
    }
}

struct ModelRow: View {
    let provider: String
    let model: String
    let description: String
    let isConfigured: Bool

    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 4) {
                HStack {
                    Text(provider)
                        .fontWeight(.medium)
                    if isConfigured {
                        Image(systemName: "checkmark.circle.fill")
                            .foregroundColor(.green)
                            .font(.caption)
                    } else {
                        Image(systemName: "xmark.circle.fill")
                            .foregroundColor(.red)
                            .font(.caption)
                    }
                }
                Text(model)
                    .font(.system(.body, design: .monospaced))
                    .foregroundColor(.blue)
                Text(description)
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
            Spacer()
        }
    }
}

struct ProviderBadge: View {
    let name: String
    let isConfigured: Bool

    var body: some View {
        Text(name)
            .font(.caption)
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .background(isConfigured ? Color.green.opacity(0.2) : Color.gray.opacity(0.2))
            .foregroundColor(isConfigured ? .green : .secondary)
            .clipShape(RoundedRectangle(cornerRadius: 4))
    }
}

// MARK: - Shortcuts Settings

struct ShortcutsSettingsView: View {
    @StateObject private var config = ConfigurationManager.shared

    var body: some View {
        Form {
            Section("Global Shortcuts") {
                ShortcutRow(
                    title: "Toggle Widget",
                    shortcut: config.shortcutToggleWidget,
                    description: "Show/hide the overlay widget"
                )

                ShortcutRow(
                    title: "Trigger Assist",
                    shortcut: config.shortcutAssist,
                    description: "Get AI assistance based on current context"
                )

                ShortcutRow(
                    title: "Clear Context",
                    shortcut: config.shortcutClearContext,
                    description: "Clear the current transcript and context"
                )
            }

            Section("Widget Shortcuts") {
                ShortcutRow(
                    title: "Move Widget",
                    shortcut: "Cmd + Arrow Keys",
                    description: "Reposition the overlay widget"
                )

                ShortcutRow(
                    title: "Scroll Responses",
                    shortcut: "Shift + Cmd + Up/Down",
                    description: "Scroll through AI responses"
                )
            }
        }
        .formStyle(.grouped)
    }
}

struct ShortcutRow: View {
    let title: String
    let shortcut: String
    let description: String

    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 4) {
                Text(title)
                    .font(.body)
                Text(description)
                    .font(.caption)
                    .foregroundColor(.secondary)
            }

            Spacer()

            Text(shortcut)
                .font(.system(.body, design: .monospaced))
                .padding(.horizontal, 8)
                .padding(.vertical, 4)
                .background(Color.gray.opacity(0.2))
                .clipShape(RoundedRectangle(cornerRadius: 4))
        }
    }
}
