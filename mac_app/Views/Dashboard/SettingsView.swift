//
//  SettingsView.swift
//  QueenMama
//
//  Modern settings view with sidebar navigation and Auto-Answer settings
//

import SwiftUI
import AVFoundation

struct SettingsView: View {
    @StateObject private var config = ConfigurationManager.shared
    @State private var selectedSection: SettingsSection = .account

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
                    case .account:
                        ModernAccountSettingsView()
                    case .general:
                        ModernGeneralSettingsView()
                    case .autoAnswer:
                        ModernAutoAnswerSettingsView()
                    case .audio:
                        ModernAudioSettingsView()
                    case .sync:
                        ModernSyncSettingsView()
                    case .shortcuts:
                        ModernShortcutsSettingsView()
                    case .updates:
                        ModernUpdatesSettingsView()
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
    case account = "Account"
    case general = "General"
    case autoAnswer = "Auto-Answer"
    case audio = "Audio"
    case sync = "Sync"
    case shortcuts = "Shortcuts"
    case updates = "Updates"

    var icon: String {
        switch self {
        case .account: return "person.crop.circle"
        case .general: return "gear"
        case .autoAnswer: return "bolt.fill"
        case .audio: return "speaker.wave.2.fill"
        case .sync: return "arrow.triangle.2.circlepath"
        case .shortcuts: return "keyboard"
        case .updates: return "arrow.down.circle"
        }
    }

    var description: String {
        switch self {
        case .account: return "Manage your account"
        case .general: return "App preferences"
        case .autoAnswer: return "Automatic responses"
        case .audio: return "Audio capture"
        case .sync: return "Cloud sync settings"
        case .shortcuts: return "Keyboard shortcuts"
        case .updates: return "Check for updates"
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

            // Version info at bottom
            VStack(spacing: QMDesign.Spacing.xxs) {
                Divider()
                    .background(QMDesign.Colors.borderSubtle)

                HStack {
                    Text("Queen Mama")
                        .font(QMDesign.Typography.captionSmall)
                        .foregroundColor(QMDesign.Colors.textTertiary)

                    Spacer()

                    Text("v\(Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "?") (\(Bundle.main.infoDictionary?["CFBundleVersion"] as? String ?? "?"))")
                        .font(QMDesign.Typography.captionSmall)
                        .foregroundColor(QMDesign.Colors.textTertiary)
                }
                .padding(.horizontal, QMDesign.Spacing.md)
                .padding(.vertical, QMDesign.Spacing.sm)
            }
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
                    // Undetectable Mode (Enterprise only)
                    LicenseGatedToggleRow(
                        title: "Undetectability Mode",
                        description: "Hide overlay from screen recordings and shares",
                        isOn: $config.isUndetectabilityEnabled,
                        icon: "eye.slash",
                        feature: .undetectable,
                        requiredTier: "Enterprise"
                    )

                    Divider()
                        .background(QMDesign.Colors.borderSubtle)

                    // Smart Mode (Enterprise only)
                    LicenseGatedToggleRow(
                        title: "Smart Mode",
                        description: "Enhanced AI reasoning for complex questions",
                        isOn: $config.smartModeEnabled,
                        icon: "brain",
                        feature: .smartMode,
                        requiredTier: "Enterprise"
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

            // Enable Card (Enterprise only)
            SettingsCard(title: "Automatic Responses", icon: "bolt.fill") {
                VStack(spacing: QMDesign.Spacing.md) {
                    LicenseGatedToggleRow(
                        title: "Enable Auto-Answer",
                        description: "Automatically trigger AI responses based on context",
                        isOn: $config.autoAnswerEnabled,
                        icon: "bolt.circle",
                        feature: .autoAnswer,
                        requiredTier: "Enterprise"
                    )

                    if config.autoAnswerEnabled && LicenseManager.shared.isFeatureAvailable(.autoAnswer) {
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


// MARK: - Modern Audio Settings

struct ModernAudioSettingsView: View {
    @StateObject private var config = ConfigurationManager.shared
    @StateObject private var audioTestManager = AudioTestManager()

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

            // Audio Test Card
            SettingsCard(title: "Audio Test", icon: "waveform.circle.fill") {
                VStack(spacing: QMDesign.Spacing.md) {
                    // Microphone Test
                    AudioTestRow(
                        title: "Microphone",
                        description: "Test your microphone input",
                        icon: "mic.fill",
                        level: audioTestManager.microphoneLevel,
                        isTesting: audioTestManager.isMicrophoneTesting,
                        permissionStatus: audioTestManager.microphonePermissionStatus,
                        onTest: { audioTestManager.toggleMicrophoneTest() }
                    )

                    Divider().background(QMDesign.Colors.borderSubtle)

                    // System Audio Test
                    AudioTestRow(
                        title: "System Audio",
                        description: "Test audio from other apps",
                        icon: "speaker.wave.3.fill",
                        level: audioTestManager.systemAudioLevel,
                        isTesting: audioTestManager.isSystemAudioTesting,
                        permissionStatus: audioTestManager.screenCapturePermissionStatus,
                        onTest: { audioTestManager.toggleSystemAudioTest() }
                    )

                    // Instructions
                    HStack(alignment: .top, spacing: QMDesign.Spacing.sm) {
                        Image(systemName: "info.circle.fill")
                            .foregroundStyle(QMDesign.Colors.primaryGradient)
                            .font(.system(size: 14))
                        Text("Speak into your microphone or play audio to see the level meters respond.")
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

            // Info Card
            SettingsCard(title: "Privacy Information", icon: "shield.lefthalf.filled") {
                VStack(alignment: .leading, spacing: QMDesign.Spacing.sm) {
                    InfoRow(icon: "waveform.path", text: "Audio is streamed directly to transcription services")
                    InfoRow(icon: "externaldrive.badge.xmark", text: "Audio is not stored locally on your device")
                    InfoRow(icon: "lock.shield", text: "All transmissions are encrypted")
                }
            }
        }
        .onDisappear {
            // Stop any ongoing tests when leaving the view
            audioTestManager.stopAllTests()
        }
    }
}

// MARK: - Audio Test Row

struct AudioTestRow: View {
    let title: String
    let description: String
    let icon: String
    let level: Float
    let isTesting: Bool
    let permissionStatus: AudioTestPermissionStatus
    let onTest: () -> Void

    var body: some View {
        VStack(spacing: QMDesign.Spacing.sm) {
            HStack(spacing: QMDesign.Spacing.md) {
                // Icon
                Image(systemName: icon)
                    .font(.system(size: 16))
                    .foregroundStyle(isTesting ? AnyShapeStyle(QMDesign.Colors.primaryGradient) : AnyShapeStyle(QMDesign.Colors.textSecondary))
                    .frame(width: 24)

                // Labels
                VStack(alignment: .leading, spacing: 2) {
                    Text(title)
                        .font(QMDesign.Typography.bodyMedium)
                        .foregroundColor(QMDesign.Colors.textPrimary)
                    Text(description)
                        .font(QMDesign.Typography.caption)
                        .foregroundColor(QMDesign.Colors.textTertiary)
                }

                Spacer()

                // Test Button or Permission Warning
                if permissionStatus == .denied {
                    Button(action: openSystemPreferences) {
                        HStack(spacing: 4) {
                            Image(systemName: "exclamationmark.triangle.fill")
                            Text("Grant Access")
                        }
                        .font(QMDesign.Typography.captionSmall)
                        .foregroundColor(QMDesign.Colors.warning)
                        .padding(.horizontal, QMDesign.Spacing.sm)
                        .padding(.vertical, 6)
                        .background(
                            RoundedRectangle(cornerRadius: QMDesign.Radius.sm)
                                .fill(QMDesign.Colors.warning.opacity(0.1))
                        )
                    }
                    .buttonStyle(.plain)
                } else {
                    Button(action: onTest) {
                        HStack(spacing: 4) {
                            Image(systemName: isTesting ? "stop.fill" : "play.fill")
                            Text(isTesting ? "Stop" : "Test")
                        }
                        .font(QMDesign.Typography.captionSmall)
                        .foregroundColor(isTesting ? QMDesign.Colors.error : .white)
                        .padding(.horizontal, QMDesign.Spacing.sm)
                        .padding(.vertical, 6)
                        .background(
                            RoundedRectangle(cornerRadius: QMDesign.Radius.sm)
                                .fill(isTesting ? AnyShapeStyle(QMDesign.Colors.error.opacity(0.1)) : AnyShapeStyle(QMDesign.Colors.primaryGradient))
                        )
                    }
                    .buttonStyle(.plain)
                }
            }

            // Level Meter (only show when testing)
            if isTesting {
                AudioLevelMeter(level: level)
                    .transition(.opacity.combined(with: .scale(scale: 0.95)))
            }
        }
        .animation(QMDesign.Animation.quick, value: isTesting)
    }

    private func openSystemPreferences() {
        NSWorkspace.shared.open(URL(string: "x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone")!)
    }
}

// MARK: - Audio Level Meter

struct AudioLevelMeter: View {
    let level: Float
    private let segmentCount = 20

    var body: some View {
        GeometryReader { geometry in
            HStack(spacing: 2) {
                ForEach(0..<segmentCount, id: \.self) { index in
                    let threshold = Float(index) / Float(segmentCount)
                    let isActive = level > threshold

                    RoundedRectangle(cornerRadius: 2)
                        .fill(segmentColor(for: index, isActive: isActive))
                        .frame(width: (geometry.size.width - CGFloat(segmentCount - 1) * 2) / CGFloat(segmentCount))
                }
            }
        }
        .frame(height: 8)
        .padding(.horizontal, QMDesign.Spacing.sm)
        .padding(.vertical, QMDesign.Spacing.xs)
        .background(
            RoundedRectangle(cornerRadius: QMDesign.Radius.sm)
                .fill(QMDesign.Colors.backgroundSecondary)
        )
    }

    private func segmentColor(for index: Int, isActive: Bool) -> Color {
        guard isActive else {
            return QMDesign.Colors.surfaceMedium
        }

        let position = Float(index) / Float(segmentCount)
        if position < 0.6 {
            return QMDesign.Colors.success
        } else if position < 0.8 {
            return QMDesign.Colors.warning
        } else {
            return QMDesign.Colors.error
        }
    }
}

// MARK: - Audio Test Manager

enum AudioTestPermissionStatus {
    case granted
    case denied
    case notDetermined
}

@MainActor
class AudioTestManager: ObservableObject {
    @Published var microphoneLevel: Float = 0.0
    @Published var systemAudioLevel: Float = 0.0
    @Published var isMicrophoneTesting = false
    @Published var isSystemAudioTesting = false
    @Published var microphonePermissionStatus: AudioTestPermissionStatus = .notDetermined
    @Published var screenCapturePermissionStatus: AudioTestPermissionStatus = .notDetermined

    private var audioEngine: AVAudioEngine?
    private var levelUpdateTimer: Timer?

    init() {
        checkPermissions()
    }

    func checkPermissions() {
        // Check microphone permission
        let micStatus = AVCaptureDevice.authorizationStatus(for: .audio)
        switch micStatus {
        case .authorized:
            microphonePermissionStatus = .granted
        case .denied, .restricted:
            microphonePermissionStatus = .denied
        case .notDetermined:
            microphonePermissionStatus = .notDetermined
        @unknown default:
            microphonePermissionStatus = .notDetermined
        }

        // For system audio, we need screen capture permission (ScreenCaptureKit)
        // This is always shown as granted for now since checking requires async call
        screenCapturePermissionStatus = .granted
    }

    func toggleMicrophoneTest() {
        if isMicrophoneTesting {
            stopMicrophoneTest()
        } else {
            startMicrophoneTest()
        }
    }

    func toggleSystemAudioTest() {
        if isSystemAudioTesting {
            stopSystemAudioTest()
        } else {
            startSystemAudioTest()
        }
    }

    private func startMicrophoneTest() {
        // Request permission if needed
        if microphonePermissionStatus == .notDetermined {
            Task {
                let granted = await AVCaptureDevice.requestAccess(for: .audio)
                microphonePermissionStatus = granted ? .granted : .denied
                if granted {
                    startMicrophoneCapture()
                }
            }
        } else if microphonePermissionStatus == .granted {
            startMicrophoneCapture()
        }
    }

    private func startMicrophoneCapture() {
        audioEngine = AVAudioEngine()
        guard let audioEngine = audioEngine else { return }

        let inputNode = audioEngine.inputNode
        let inputFormat = inputNode.outputFormat(forBus: 0)

        inputNode.installTap(onBus: 0, bufferSize: 1024, format: inputFormat) { [weak self] buffer, _ in
            self?.processAudioBuffer(buffer, isMicrophone: true)
        }

        do {
            try audioEngine.start()
            isMicrophoneTesting = true
        } catch {
            print("[AudioTest] Failed to start microphone test: \(error)")
        }
    }

    private func stopMicrophoneTest() {
        audioEngine?.inputNode.removeTap(onBus: 0)
        audioEngine?.stop()
        audioEngine = nil
        isMicrophoneTesting = false
        microphoneLevel = 0
    }

    private func startSystemAudioTest() {
        // System audio capture requires ScreenCaptureKit which is more complex
        // For now, simulate with a placeholder that shows the UI works
        isSystemAudioTesting = true

        // Start a timer to show some visual feedback
        levelUpdateTimer = Timer.scheduledTimer(withTimeInterval: 0.1, repeats: true) { [weak self] _ in
            Task { @MainActor in
                // Show a low-level indicator to show it's "listening"
                self?.systemAudioLevel = 0.05
            }
        }
    }

    private func stopSystemAudioTest() {
        levelUpdateTimer?.invalidate()
        levelUpdateTimer = nil
        isSystemAudioTesting = false
        systemAudioLevel = 0
    }

    func stopAllTests() {
        stopMicrophoneTest()
        stopSystemAudioTest()
    }

    private func processAudioBuffer(_ buffer: AVAudioPCMBuffer, isMicrophone: Bool) {
        guard let channelData = buffer.floatChannelData else { return }

        let channelDataValue = channelData.pointee
        let channelDataValueArray = stride(
            from: 0,
            to: Int(buffer.frameLength),
            by: buffer.stride
        ).map { channelDataValue[$0] }

        let rms = sqrt(channelDataValueArray.map { $0 * $0 }.reduce(0, +) / Float(buffer.frameLength))
        let avgPower = 20 * log10(rms)
        let meterLevel = scalePower(avgPower)

        DispatchQueue.main.async { [weak self] in
            if isMicrophone {
                self?.microphoneLevel = meterLevel
            } else {
                self?.systemAudioLevel = meterLevel
            }
        }
    }

    private func scalePower(_ power: Float) -> Float {
        let minDb: Float = -80
        let maxDb: Float = 0

        if power < minDb {
            return 0
        } else if power >= maxDb {
            return 1
        } else {
            return (power - minDb) / (maxDb - minDb)
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

// MARK: - Modern Account Settings

struct ModernAccountSettingsView: View {
    @StateObject private var authManager = AuthenticationManager.shared
    @StateObject private var licenseManager = LicenseManager.shared

    @State private var showLogoutConfirmation = false
    @State private var showUpgradeSheet = false
    @State private var isConnecting = false
    @State private var deviceCodeResponse: DeviceCodeResponse?
    @State private var connectionError: String?
    @State private var showCopied = false

    var body: some View {
        VStack(spacing: QMDesign.Spacing.lg) {
            // Header
            SettingsSectionHeader(
                title: "Account",
                subtitle: "Manage your Queen Mama account"
            )

            if authManager.isAuthenticated, let user = authManager.currentUser {
                // Connected Account Card
                SettingsCard(title: "Connected Account", icon: "person.crop.circle.fill") {
                    VStack(spacing: QMDesign.Spacing.md) {
                        HStack(spacing: QMDesign.Spacing.md) {
                            // Avatar
                            ZStack {
                                Circle()
                                    .fill(QMDesign.Colors.primaryGradient)
                                    .frame(width: 48, height: 48)
                                Text(String(user.displayName.prefix(1)).uppercased())
                                    .font(.system(size: 20, weight: .bold))
                                    .foregroundColor(.white)
                            }

                            VStack(alignment: .leading, spacing: 2) {
                                Text(user.displayName)
                                    .font(QMDesign.Typography.bodyMedium)
                                    .foregroundColor(QMDesign.Colors.textPrimary)
                                Text(user.email)
                                    .font(QMDesign.Typography.caption)
                                    .foregroundColor(QMDesign.Colors.textSecondary)
                            }

                            Spacer()

                            // Status badge
                            HStack(spacing: 4) {
                                Circle()
                                    .fill(QMDesign.Colors.success)
                                    .frame(width: 8, height: 8)
                                Text("Connected")
                                    .font(QMDesign.Typography.captionSmall)
                                    .foregroundColor(QMDesign.Colors.success)
                            }
                        }

                        Divider()
                            .background(QMDesign.Colors.borderSubtle)

                        // Sign out button
                        Button(action: { showLogoutConfirmation = true }) {
                            HStack {
                                Image(systemName: "rectangle.portrait.and.arrow.right")
                                Text("Sign Out")
                            }
                            .font(QMDesign.Typography.bodySmall)
                            .foregroundColor(QMDesign.Colors.error)
                        }
                        .buttonStyle(.plain)
                    }
                }

                // Subscription Card
                SettingsCard(title: "Subscription", icon: "crown.fill") {
                    VStack(spacing: QMDesign.Spacing.md) {
                        HStack {
                            VStack(alignment: .leading, spacing: 4) {
                                HStack(spacing: QMDesign.Spacing.sm) {
                                    Text(licenseManager.currentLicense.plan.rawValue)
                                        .font(QMDesign.Typography.headline)
                                        .foregroundStyle(licenseManager.isPro ? AnyShapeStyle(QMDesign.Colors.primaryGradient) : AnyShapeStyle(QMDesign.Colors.textPrimary))

                                    if licenseManager.isTrialing, let days = licenseManager.trialDaysRemaining {
                                        Text("\(days) days left")
                                            .font(QMDesign.Typography.captionSmall)
                                            .foregroundColor(QMDesign.Colors.warning)
                                            .padding(.horizontal, 6)
                                            .padding(.vertical, 2)
                                            .background(
                                                Capsule()
                                                    .fill(QMDesign.Colors.warning.opacity(0.1))
                                            )
                                    }
                                }

                                Text(licenseManager.isPro ? "All features unlocked" : "Upgrade for unlimited access")
                                    .font(QMDesign.Typography.caption)
                                    .foregroundColor(QMDesign.Colors.textSecondary)
                            }

                            Spacer()

                            if !licenseManager.isPro {
                                Button(action: { showUpgradeSheet = true }) {
                                    Text("Upgrade")
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

                        // Usage stats for free users
                        if !licenseManager.isPro {
                            Divider()
                                .background(QMDesign.Colors.borderSubtle)

                            VStack(spacing: QMDesign.Spacing.sm) {
                                if let remaining = licenseManager.remainingUses(for: .smartMode) {
                                    UsageLimitBanner(
                                        feature: "Smart Mode",
                                        used: licenseManager.smartModeUsedToday,
                                        limit: licenseManager.currentLicense.features.smartModeLimit ?? 5
                                    )
                                }
                            }
                        }
                    }
                }
            } else if let response = deviceCodeResponse {
                // Device Code Display Card
                SettingsCard(title: "Enter Code", icon: "number.circle.fill") {
                    VStack(spacing: QMDesign.Spacing.md) {
                        HStack(spacing: QMDesign.Spacing.sm) {
                            Image(systemName: "safari")
                                .foregroundStyle(QMDesign.Colors.primaryGradient)
                            Text("Browser opened - enter this code:")
                                .font(QMDesign.Typography.caption)
                                .foregroundColor(QMDesign.Colors.textSecondary)
                        }

                        // Code display
                        VStack(spacing: QMDesign.Spacing.sm) {
                            HStack(spacing: QMDesign.Spacing.xs) {
                                ForEach(Array(response.userCode), id: \.self) { char in
                                    SettingsCodeCharView(char: char)
                                }
                            }

                            // Copy button
                            Button(action: { copyCode(response.userCode) }) {
                                HStack(spacing: QMDesign.Spacing.xs) {
                                    Image(systemName: showCopied ? "checkmark" : "doc.on.doc")
                                    Text(showCopied ? "Copied!" : "Copy code")
                                }
                                .font(QMDesign.Typography.captionSmall)
                                .foregroundColor(showCopied ? QMDesign.Colors.success : QMDesign.Colors.textSecondary)
                            }
                            .buttonStyle(.plain)
                        }

                        // Open link manually
                        Link(destination: URL(string: response.verificationUrl)!) {
                            HStack(spacing: QMDesign.Spacing.xs) {
                                Image(systemName: "arrow.up.right.square")
                                Text("Open link manually")
                            }
                            .font(QMDesign.Typography.captionSmall)
                            .foregroundStyle(QMDesign.Colors.primaryGradient)
                        }

                        HStack(spacing: QMDesign.Spacing.sm) {
                            ProgressView()
                                .scaleEffect(0.7)
                            Text("Waiting for authorization...")
                                .font(QMDesign.Typography.caption)
                                .foregroundColor(QMDesign.Colors.textSecondary)
                        }

                        Button(action: cancelDeviceCode) {
                            Text("Cancel")
                                .font(QMDesign.Typography.bodySmall)
                                .foregroundColor(QMDesign.Colors.textSecondary)
                        }
                        .buttonStyle(.plain)
                    }
                }
            } else {
                // Not Connected Card
                SettingsCard(title: "Not Connected", icon: "person.crop.circle.badge.xmark") {
                    VStack(spacing: QMDesign.Spacing.md) {
                        Text("Sign in to unlock cloud sync, session history, and PRO features.")
                            .font(QMDesign.Typography.bodySmall)
                            .foregroundColor(QMDesign.Colors.textSecondary)

                        // Error message
                        if let error = connectionError {
                            HStack(spacing: QMDesign.Spacing.xs) {
                                Image(systemName: "exclamationmark.circle.fill")
                                Text(error)
                            }
                            .font(QMDesign.Typography.caption)
                            .foregroundColor(QMDesign.Colors.error)
                            .padding(QMDesign.Spacing.sm)
                            .frame(maxWidth: .infinity)
                            .background(
                                RoundedRectangle(cornerRadius: QMDesign.Radius.sm)
                                    .fill(QMDesign.Colors.error.opacity(0.1))
                            )
                        }

                        Button(action: startDeviceCodeFlow) {
                            HStack(spacing: QMDesign.Spacing.sm) {
                                if isConnecting {
                                    ProgressView()
                                        .scaleEffect(0.8)
                                        .progressViewStyle(CircularProgressViewStyle(tint: .white))
                                } else {
                                    Image(systemName: "arrow.up.right.square")
                                }
                                Text(isConnecting ? "Opening browser..." : "Connect Account")
                            }
                            .font(QMDesign.Typography.labelMedium)
                            .foregroundColor(.white)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, QMDesign.Spacing.md)
                            .background(
                                RoundedRectangle(cornerRadius: QMDesign.Radius.md)
                                    .fill(QMDesign.Colors.primaryGradient)
                            )
                        }
                        .buttonStyle(.plain)
                        .disabled(isConnecting)

                        Text("Works with email, Google, or GitHub accounts")
                            .font(QMDesign.Typography.captionSmall)
                            .foregroundColor(QMDesign.Colors.textTertiary)
                    }
                }
            }
        }
        .alert("Sign Out", isPresented: $showLogoutConfirmation) {
            Button("Cancel", role: .cancel) { }
            Button("Sign Out", role: .destructive) {
                Task {
                    await authManager.logout()
                }
            }
        } message: {
            Text("Are you sure you want to sign out?")
        }
        .sheet(isPresented: $showUpgradeSheet) {
            UpgradePromptView()
        }
        .onChange(of: authManager.authState) { oldState, newState in
            // Clear device code when authenticated
            if case .authenticated = newState {
                deviceCodeResponse = nil
                isConnecting = false
            }
        }
    }

    private func startDeviceCodeFlow() {
        isConnecting = true
        connectionError = nil

        Task {
            do {
                let response = try await authManager.startDeviceCodeFlow()
                deviceCodeResponse = response

                // Auto-open browser
                if let url = URL(string: response.verificationUrl) {
                    NSWorkspace.shared.open(url)
                }
            } catch {
                connectionError = error.localizedDescription
            }
            isConnecting = false
        }
    }

    private func cancelDeviceCode() {
        authManager.cancelDeviceCodeFlow()
        deviceCodeResponse = nil
    }

    private func copyCode(_ code: String) {
        NSPasteboard.general.clearContents()
        NSPasteboard.general.setString(code, forType: .string)
        showCopied = true

        // Reset after 2 seconds
        DispatchQueue.main.asyncAfter(deadline: .now() + 2) {
            showCopied = false
        }
    }
}

// MARK: - Settings Code Character View

private struct SettingsCodeCharView: View {
    let char: Character

    var body: some View {
        let isDash = char == "-"

        Text(String(char))
            .font(.system(size: 20, weight: .bold, design: .monospaced))
            .foregroundStyle(isDash ? AnyShapeStyle(QMDesign.Colors.textTertiary) : AnyShapeStyle(QMDesign.Colors.primaryGradient))
            .frame(width: isDash ? 12 : 28, height: 36)
            .background(
                Group {
                    if isDash {
                        Color.clear
                    } else {
                        RoundedRectangle(cornerRadius: QMDesign.Radius.sm)
                            .fill(QMDesign.Colors.surfaceLight)
                    }
                }
            )
    }
}

// MARK: - Modern Sync Settings

struct ModernSyncSettingsView: View {
    @StateObject private var authManager = AuthenticationManager.shared
    @StateObject private var licenseManager = LicenseManager.shared
    @StateObject private var syncManager = SyncManager.shared

    var body: some View {
        VStack(spacing: QMDesign.Spacing.lg) {
            // Header
            SettingsSectionHeader(
                title: "Cloud Sync",
                subtitle: "Sync sessions to your Queen Mama dashboard"
            )

            if !authManager.isAuthenticated {
                // Not signed in - direct to Account section
                SettingsCard(title: "Sign In Required", icon: "person.crop.circle.badge.xmark") {
                    VStack(spacing: QMDesign.Spacing.md) {
                        Text("Connect your account in the Account section to enable session sync.")
                            .font(QMDesign.Typography.bodySmall)
                            .foregroundColor(QMDesign.Colors.textSecondary)
                            .multilineTextAlignment(.center)

                        HStack(spacing: QMDesign.Spacing.xs) {
                            Image(systemName: "arrow.left")
                            Text("Go to Account section")
                        }
                        .font(QMDesign.Typography.caption)
                        .foregroundStyle(QMDesign.Colors.primaryGradient)
                    }
                }
            } else if !licenseManager.isFeatureAvailable(.sessionSync) {
                // PRO required
                ProFeatureBanner(
                    feature: "Session Sync",
                    description: "Sync sessions to view on your dashboard"
                )
            } else {
                // Sync Status Card
                SettingsCard(title: "Sync Status", icon: "arrow.triangle.2.circlepath") {
                    VStack(spacing: QMDesign.Spacing.md) {
                        // Status row
                        HStack {
                            VStack(alignment: .leading, spacing: 4) {
                                HStack(spacing: QMDesign.Spacing.sm) {
                                    Circle()
                                        .fill(syncManager.isSyncing ? QMDesign.Colors.warning : (syncManager.isOffline ? QMDesign.Colors.error : QMDesign.Colors.success))
                                        .frame(width: 8, height: 8)

                                    Text(statusText)
                                        .font(QMDesign.Typography.bodyMedium)
                                        .foregroundColor(QMDesign.Colors.textPrimary)
                                }

                                if let lastSync = syncManager.lastSyncAt {
                                    Text("Last sync: \(lastSync, style: .relative) ago")
                                        .font(QMDesign.Typography.caption)
                                        .foregroundColor(QMDesign.Colors.textTertiary)
                                }
                            }

                            Spacer()

                            if syncManager.isSyncing {
                                ProgressView()
                                    .scaleEffect(0.8)
                            }
                        }

                        // Pending count
                        if syncManager.pendingCount > 0 {
                            HStack {
                                Image(systemName: "clock.arrow.circlepath")
                                    .foregroundStyle(QMDesign.Colors.primaryGradient)
                                Text("\(syncManager.pendingCount) session(s) pending sync")
                                    .font(QMDesign.Typography.caption)
                                    .foregroundColor(QMDesign.Colors.textSecondary)
                                Spacer()
                            }
                            .padding(QMDesign.Spacing.sm)
                            .background(
                                RoundedRectangle(cornerRadius: QMDesign.Radius.md)
                                    .fill(QMDesign.Colors.accent.opacity(0.05))
                            )
                        }

                        // Error message
                        if let error = syncManager.lastError {
                            HStack(alignment: .top, spacing: QMDesign.Spacing.sm) {
                                Image(systemName: "exclamationmark.triangle.fill")
                                    .foregroundColor(QMDesign.Colors.error)
                                Text(error)
                                    .font(QMDesign.Typography.caption)
                                    .foregroundColor(QMDesign.Colors.error)
                            }
                            .padding(QMDesign.Spacing.sm)
                            .background(
                                RoundedRectangle(cornerRadius: QMDesign.Radius.md)
                                    .fill(QMDesign.Colors.error.opacity(0.1))
                            )
                        }

                        Divider()
                            .background(QMDesign.Colors.borderSubtle)

                        // Sync button
                        Button(action: syncNow) {
                            HStack(spacing: QMDesign.Spacing.sm) {
                                Image(systemName: "arrow.triangle.2.circlepath")
                                Text("Sync Now")
                            }
                            .font(QMDesign.Typography.labelSmall)
                            .foregroundColor(.white)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, QMDesign.Spacing.sm)
                            .background(
                                RoundedRectangle(cornerRadius: QMDesign.Radius.md)
                                    .fill(QMDesign.Colors.primaryGradient)
                            )
                        }
                        .buttonStyle(.plain)
                        .disabled(syncManager.isSyncing)
                    }
                }

                // Dashboard Link
                SettingsCard(title: "View on Dashboard", icon: "globe") {
                    VStack(spacing: QMDesign.Spacing.md) {
                        Text("View and manage all your synced sessions on the web dashboard.")
                            .font(QMDesign.Typography.bodySmall)
                            .foregroundColor(QMDesign.Colors.textSecondary)

                        Button(action: openDashboard) {
                            HStack(spacing: QMDesign.Spacing.sm) {
                                Text("Open Dashboard")
                                Image(systemName: "arrow.up.right")
                            }
                            .font(QMDesign.Typography.labelSmall)
                            .foregroundColor(QMDesign.Colors.textPrimary)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, QMDesign.Spacing.sm)
                            .background(
                                RoundedRectangle(cornerRadius: QMDesign.Radius.md)
                                    .fill(QMDesign.Colors.surfaceLight)
                            )
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
        }
    }

    private var statusText: String {
        if syncManager.isSyncing {
            return "Syncing..."
        } else if syncManager.isOffline {
            return "Offline"
        } else if syncManager.pendingCount > 0 {
            return "Pending"
        } else {
            return "Up to date"
        }
    }

    private func syncNow() {
        Task {
            await syncManager.syncNow()
        }
    }

    private func openDashboard() {
        NSWorkspace.shared.open(URLConfigManager.shared.dashboardSessionsURL)
    }
}

// MARK: - Legacy Support

enum SettingsTab {
    case general
    case audio
    case shortcuts
}

typealias GeneralSettingsView = ModernGeneralSettingsView
typealias AudioSettingsView = ModernAudioSettingsView
typealias ShortcutsSettingsView = ModernShortcutsSettingsView

// MARK: - License Gated Toggle Row

/// A toggle row that shows a lock icon and disables the toggle if the feature requires a higher tier
@MainActor
struct LicenseGatedToggleRow: View {
    let title: String
    let description: String
    @Binding var isOn: Bool
    let icon: String
    let feature: Feature
    let requiredTier: String

    private var isAvailable: Bool {
        LicenseManager.shared.isFeatureAvailable(feature)
    }

    var body: some View {
        HStack(spacing: QMDesign.Spacing.md) {
            Image(systemName: icon)
                .font(.system(size: 16))
                .foregroundStyle(isOn && isAvailable ? AnyShapeStyle(QMDesign.Colors.primaryGradient) : AnyShapeStyle(QMDesign.Colors.textSecondary))
                .frame(width: 24)

            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: QMDesign.Spacing.xs) {
                    Text(title)
                        .font(QMDesign.Typography.bodyMedium)
                        .foregroundColor(QMDesign.Colors.textPrimary)
                        .fixedSize(horizontal: false, vertical: true)

                    if !isAvailable {
                        HStack(spacing: 2) {
                            Image(systemName: "lock.fill")
                                .font(.system(size: 10))
                            Text(requiredTier)
                                .font(QMDesign.Typography.captionSmall)
                        }
                        .foregroundColor(QMDesign.Colors.accent)
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(
                            Capsule()
                                .fill(QMDesign.Colors.accent.opacity(0.1))
                        )
                    }
                }

                Text(description)
                    .font(QMDesign.Typography.caption)
                    .foregroundColor(QMDesign.Colors.textTertiary)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .frame(maxWidth: .infinity, alignment: .leading)

            if isAvailable {
                Toggle("", isOn: $isOn)
                    .toggleStyle(.switch)
                    .tint(QMDesign.Colors.accent)
                    .labelsHidden()
            } else {
                Toggle("", isOn: .constant(false))
                    .toggleStyle(.switch)
                    .tint(QMDesign.Colors.accent)
                    .labelsHidden()
                    .disabled(true)
                    .opacity(0.5)
            }
        }
    }
}

// MARK: - Modern Updates Settings

struct ModernUpdatesSettingsView: View {
    @ObservedObject private var updater = UpdaterManager.shared

    var body: some View {
        VStack(spacing: QMDesign.Spacing.lg) {
            // Header
            SettingsSectionHeader(
                title: "Updates",
                subtitle: "Keep Queen Mama up to date"
            )

            // Version Info Card
            SettingsCard(title: "Version Information", icon: "info.circle.fill") {
                VStack(spacing: QMDesign.Spacing.md) {
                    HStack {
                        VStack(alignment: .leading, spacing: 4) {
                            Text("Current Version")
                                .font(QMDesign.Typography.bodySmall)
                                .foregroundColor(QMDesign.Colors.textSecondary)
                            Text("\(updater.currentVersion) (\(updater.currentBuild))")
                                .font(QMDesign.Typography.bodyMedium)
                                .foregroundStyle(QMDesign.Colors.primaryGradient)
                        }

                        Spacer()

                        if let lastCheck = updater.lastUpdateCheckDate {
                            VStack(alignment: .trailing, spacing: 4) {
                                Text("Last Checked")
                                    .font(QMDesign.Typography.bodySmall)
                                    .foregroundColor(QMDesign.Colors.textSecondary)
                                Text(lastCheck, style: .relative)
                                    .font(QMDesign.Typography.caption)
                                    .foregroundColor(QMDesign.Colors.textTertiary)
                            }
                        }
                    }

                    Divider()
                        .background(QMDesign.Colors.borderSubtle)

                    // Check for updates button
                    Button(action: { updater.checkForUpdates() }) {
                        HStack(spacing: QMDesign.Spacing.sm) {
                            Image(systemName: "arrow.down.circle")
                            Text("Check for Updates")
                        }
                        .font(QMDesign.Typography.labelSmall)
                        .foregroundColor(.white)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, QMDesign.Spacing.sm)
                        .background(
                            RoundedRectangle(cornerRadius: QMDesign.Radius.md)
                                .fill(QMDesign.Colors.primaryGradient)
                        )
                    }
                    .buttonStyle(.plain)
                    .disabled(!updater.canCheckForUpdates)
                }
            }

            // Update Settings Card
            SettingsCard(title: "Update Preferences", icon: "gearshape.2.fill") {
                VStack(spacing: QMDesign.Spacing.md) {
                    ModernToggleRow(
                        title: "Check Automatically",
                        description: "Check for updates daily in the background",
                        isOn: $updater.automaticallyChecksForUpdates,
                        icon: "clock.arrow.2.circlepath"
                    )

                    Divider()
                        .background(QMDesign.Colors.borderSubtle)

                    ModernToggleRow(
                        title: "Download Automatically",
                        description: "Download updates automatically when available",
                        isOn: $updater.automaticallyDownloadsUpdates,
                        icon: "arrow.down.to.line"
                    )
                    .disabled(!updater.automaticallyChecksForUpdates)
                    .opacity(updater.automaticallyChecksForUpdates ? 1 : 0.5)
                }
            }

            // Changelog Card
            SettingsCard(title: "What's New", icon: "sparkles") {
                VStack(spacing: QMDesign.Spacing.md) {
                    Text("Stay up to date with the latest features and improvements.")
                        .font(QMDesign.Typography.bodySmall)
                        .foregroundColor(QMDesign.Colors.textSecondary)

                    Button(action: openChangelog) {
                        HStack(spacing: QMDesign.Spacing.sm) {
                            Text("View Changelog")
                            Image(systemName: "arrow.up.right")
                        }
                        .font(QMDesign.Typography.labelSmall)
                        .foregroundColor(QMDesign.Colors.textPrimary)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, QMDesign.Spacing.sm)
                        .background(
                            RoundedRectangle(cornerRadius: QMDesign.Radius.md)
                                .fill(QMDesign.Colors.surfaceLight)
                        )
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }

    private func openChangelog() {
        NSWorkspace.shared.open(URLConfigManager.shared.changelogURL)
    }
}
