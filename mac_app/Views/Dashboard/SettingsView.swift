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

    var localizedName: String {
        switch self {
        case .account: return String(localized: "settings.section.account")
        case .general: return String(localized: "settings.section.general")
        case .autoAnswer: return String(localized: "settings.section.autoAnswer")
        case .audio: return String(localized: "settings.section.audio")
        case .sync: return String(localized: "settings.section.sync")
        case .shortcuts: return String(localized: "settings.section.shortcuts")
        case .updates: return String(localized: "settings.section.updates")
        }
    }

    var localizedDescription: String {
        switch self {
        case .account: return String(localized: "settings.section.account.description")
        case .general: return String(localized: "settings.section.general.description")
        case .autoAnswer: return String(localized: "settings.section.autoAnswer.description")
        case .audio: return String(localized: "settings.section.audio.description")
        case .sync: return String(localized: "settings.section.sync.description")
        case .shortcuts: return String(localized: "settings.section.shortcuts.description")
        case .updates: return String(localized: "settings.section.updates.description")
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

                Text(String(localized: "settings.sidebar.title"))
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

            // Feedback button
            Button {
                if let url = URL(string: "https://queenmama.featurebase.app") {
                    NSWorkspace.shared.open(url)
                }
            } label: {
                HStack(spacing: QMDesign.Spacing.sm) {
                    Image(systemName: "bubble.left.and.bubble.right")
                        .font(.system(size: 14))
                        .foregroundColor(QMDesign.Colors.textSecondary)
                        .frame(width: 24)

                    Text(String(localized: "settings.feedback.giveFeedback"))
                        .font(QMDesign.Typography.bodySmall)
                        .foregroundColor(QMDesign.Colors.textSecondary)

                    Spacer()

                    Image(systemName: "arrow.up.right")
                        .font(.system(size: 10))
                        .foregroundColor(QMDesign.Colors.textTertiary)
                }
                .padding(.horizontal, QMDesign.Spacing.sm)
                .padding(.vertical, QMDesign.Spacing.xs)
                .background(
                    RoundedRectangle(cornerRadius: QMDesign.Radius.md)
                        .fill(Color.clear)
                )
            }
            .buttonStyle(.plain)
            .padding(.horizontal, QMDesign.Spacing.sm)

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
                    Text(section.localizedName)
                        .font(QMDesign.Typography.bodySmall)
                        .fontWeight(isSelected ? .semibold : .regular)
                        .foregroundColor(isSelected ? QMDesign.Colors.textPrimary : QMDesign.Colors.textSecondary)

                    Text(section.localizedDescription)
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
                title: String(localized: "settings.general.title"),
                subtitle: String(localized: "settings.general.subtitle")
            )

            // Appearance Card
            SettingsCard(title: String(localized: "settings.general.appearance"), icon: "paintbrush.fill") {
                VStack(spacing: QMDesign.Spacing.md) {
                    // Undetectable Mode (Enterprise only)
                    LicenseGatedToggleRow(
                        title: String(localized: "settings.general.undetectabilityMode"),
                        description: String(localized: "settings.general.undetectabilityMode.description"),
                        isOn: $config.isUndetectabilityEnabled,
                        icon: "eye.slash",
                        feature: .undetectable,
                        requiredTier: "Enterprise"
                    )

                    Divider()
                        .background(QMDesign.Colors.borderSubtle)

                    // Smart Mode (Enterprise only)
                    LicenseGatedToggleRow(
                        title: String(localized: "settings.general.smartMode"),
                        description: String(localized: "settings.general.smartMode.description"),
                        isOn: $config.smartModeEnabled,
                        icon: "brain",
                        feature: .smartMode,
                        requiredTier: "Enterprise"
                    )
                }
            }

            // Language Card
            SettingsCard(title: String(localized: "settings.general.language"), icon: "globe") {
                LanguageSelectorRow()
            }

            // Screen Capture Card
            SettingsCard(title: String(localized: "settings.general.screenCapture"), icon: "camera.fill") {
                VStack(spacing: QMDesign.Spacing.md) {
                    ModernToggleRow(
                        title: String(localized: "settings.general.autoCaptureScreen"),
                        description: String(localized: "settings.general.autoCaptureScreen.description"),
                        isOn: $config.autoScreenCapture,
                        icon: "rectangle.dashed.badge.record"
                    )

                    if config.autoScreenCapture {
                        HStack {
                            Text(String(localized: "settings.general.captureInterval"))
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

                    Divider()
                        .background(QMDesign.Colors.borderSubtle)

                    // Display Selection
                    DisplaySelectorRow()
                }
            }

            // Meeting Detection Card
            SettingsCard(title: String(localized: "settings.general.meetingDetection"), icon: "video.fill") {
                ModernToggleRow(
                    title: String(localized: "settings.general.meetingReminders"),
                    description: String(localized: "settings.general.meetingReminders.description"),
                    isOn: $config.meetingDetectionEnabled,
                    icon: "bell.badge"
                )
            }

        }
    }
}

// MARK: - Display Selector Row

struct DisplaySelectorRow: View {
    @StateObject private var config = ConfigurationManager.shared
    @State private var displays: [ScreenCaptureService.DisplayInfo] = []
    @State private var isLoading = true

    var body: some View {
        VStack(alignment: .leading, spacing: QMDesign.Spacing.sm) {
            HStack(spacing: QMDesign.Spacing.sm) {
                Image(systemName: "display")
                    .font(.system(size: 14))
                    .foregroundColor(QMDesign.Colors.textSecondary)
                    .frame(width: 24)

                VStack(alignment: .leading, spacing: 2) {
                    Text(String(localized: "settings.general.captureDisplay"))
                        .font(QMDesign.Typography.bodySmall)
                        .foregroundColor(QMDesign.Colors.textPrimary)
                    Text(String(localized: "settings.general.captureDisplay.description"))
                        .font(QMDesign.Typography.captionSmall)
                        .foregroundColor(QMDesign.Colors.textTertiary)
                }

                Spacer()
            }

            if isLoading {
                HStack(spacing: QMDesign.Spacing.xs) {
                    ProgressView()
                        .scaleEffect(0.7)
                    Text(String(localized: "settings.general.detectingDisplays"))
                        .font(QMDesign.Typography.caption)
                        .foregroundColor(QMDesign.Colors.textTertiary)
                }
                .padding(QMDesign.Spacing.sm)
            } else if displays.isEmpty {
                HStack(spacing: QMDesign.Spacing.xs) {
                    Image(systemName: "exclamationmark.triangle")
                        .foregroundColor(QMDesign.Colors.warning)
                    Text(String(localized: "settings.general.noDisplaysAvailable"))
                        .font(QMDesign.Typography.caption)
                        .foregroundColor(QMDesign.Colors.warning)
                }
                .padding(QMDesign.Spacing.sm)
            } else {
                VStack(spacing: QMDesign.Spacing.xs) {
                    ForEach(displays) { display in
                        DisplayOptionRow(
                            display: display,
                            isSelected: isDisplaySelected(display),
                            onSelect: { selectDisplay(display) }
                        )
                    }
                }
            }
        }
        .task {
            await loadDisplays()
        }
    }

    private func loadDisplays() async {
        let screenService = ScreenCaptureService()
        displays = await screenService.getAvailableDisplays()
        isLoading = false
    }

    private func isDisplaySelected(_ display: ScreenCaptureService.DisplayInfo) -> Bool {
        if config.selectedDisplayID == 0 {
            // Primary display (first one) is selected
            return display.id == displays.first?.id
        }
        return display.id == config.selectedDisplayID
    }

    private func selectDisplay(_ display: ScreenCaptureService.DisplayInfo) {
        // Store 0 for primary display, otherwise store the ID
        if display.id == displays.first?.id {
            config.selectedDisplayID = 0
        } else {
            config.selectedDisplayID = display.id
        }
    }
}

// MARK: - Display Option Row

struct DisplayOptionRow: View {
    let display: ScreenCaptureService.DisplayInfo
    let isSelected: Bool
    let onSelect: () -> Void

    @State private var isHovered = false

    var body: some View {
        Button(action: onSelect) {
            HStack(spacing: QMDesign.Spacing.sm) {
                Image(systemName: "display")
                    .font(.system(size: 12))
                    .foregroundColor(isSelected ? .white : QMDesign.Colors.textSecondary)
                    .frame(width: 28, height: 28)
                    .background(
                        RoundedRectangle(cornerRadius: QMDesign.Radius.sm)
                            .fill(isSelected ? QMDesign.Colors.accent : QMDesign.Colors.surfaceMedium)
                    )

                VStack(alignment: .leading, spacing: 2) {
                    Text(display.name)
                        .font(QMDesign.Typography.bodySmall)
                        .foregroundColor(isSelected ? QMDesign.Colors.textPrimary : QMDesign.Colors.textSecondary)

                    Text(display.resolution)
                        .font(QMDesign.Typography.captionSmall)
                        .foregroundColor(QMDesign.Colors.textTertiary)
                }

                Spacer()

                if isSelected {
                    Image(systemName: "checkmark.circle.fill")
                        .font(.system(size: 16))
                        .foregroundColor(QMDesign.Colors.accent)
                }
            }
            .padding(QMDesign.Spacing.sm)
            .background(
                RoundedRectangle(cornerRadius: QMDesign.Radius.md)
                    .fill(isSelected ? QMDesign.Colors.accent.opacity(0.1) : (isHovered ? QMDesign.Colors.surfaceHover : QMDesign.Colors.backgroundSecondary))
            )
            .overlay(
                RoundedRectangle(cornerRadius: QMDesign.Radius.md)
                    .stroke(isSelected ? QMDesign.Colors.accent.opacity(0.3) : Color.clear, lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
        .onHover { isHovered = $0 }
    }
}

// MARK: - Language Selector Row

struct LanguageSelectorRow: View {
    @StateObject private var config = ConfigurationManager.shared
    @State private var showRestartAlert = false

    private let languages: [(code: String, label: String, icon: String)] = [
        ("system", String(localized: "settings.general.language.system"), "gear"),
        ("en", "English", "e.circle"),
        ("fr", "Français", "f.circle"),
    ]

    var body: some View {
        VStack(alignment: .leading, spacing: QMDesign.Spacing.sm) {
            HStack(spacing: QMDesign.Spacing.sm) {
                Image(systemName: "globe")
                    .font(.system(size: 14))
                    .foregroundColor(QMDesign.Colors.textSecondary)
                    .frame(width: 24)

                VStack(alignment: .leading, spacing: 2) {
                    Text(String(localized: "settings.general.language.title"))
                        .font(QMDesign.Typography.bodySmall)
                        .foregroundColor(QMDesign.Colors.textPrimary)
                    Text(String(localized: "settings.general.language.description"))
                        .font(QMDesign.Typography.captionSmall)
                        .foregroundColor(QMDesign.Colors.textTertiary)
                }

                Spacer()
            }

            VStack(spacing: QMDesign.Spacing.xs) {
                ForEach(languages, id: \.code) { lang in
                    LanguageOptionRow(
                        label: lang.label,
                        icon: lang.icon,
                        isSelected: config.appLanguage == lang.code,
                        onSelect: {
                            if config.appLanguage != lang.code {
                                config.appLanguage = lang.code
                                ConfigurationManager.applyLanguageOverride(lang.code)
                                showRestartAlert = true
                            }
                        }
                    )
                }
            }
        }
        .alert(String(localized: "settings.general.language.restartTitle"), isPresented: $showRestartAlert) {
            Button(String(localized: "settings.general.language.restartNow")) {
                config.relaunchApp()
            }
            Button(String(localized: "settings.general.language.restartLater"), role: .cancel) {}
        } message: {
            Text(String(localized: "settings.general.language.restartMessage"))
        }
    }
}

struct LanguageOptionRow: View {
    let label: String
    let icon: String
    let isSelected: Bool
    let onSelect: () -> Void

    @State private var isHovered = false

    var body: some View {
        Button(action: onSelect) {
            HStack(spacing: QMDesign.Spacing.sm) {
                Image(systemName: icon)
                    .font(.system(size: 12))
                    .foregroundColor(isSelected ? .white : QMDesign.Colors.textSecondary)
                    .frame(width: 28, height: 28)
                    .background(
                        RoundedRectangle(cornerRadius: QMDesign.Radius.sm)
                            .fill(isSelected ? QMDesign.Colors.accent : QMDesign.Colors.surfaceMedium)
                    )

                Text(label)
                    .font(QMDesign.Typography.bodySmall)
                    .foregroundColor(isSelected ? QMDesign.Colors.textPrimary : QMDesign.Colors.textSecondary)

                Spacer()

                if isSelected {
                    Image(systemName: "checkmark.circle.fill")
                        .font(.system(size: 16))
                        .foregroundColor(QMDesign.Colors.accent)
                }
            }
            .padding(QMDesign.Spacing.sm)
            .background(
                RoundedRectangle(cornerRadius: QMDesign.Radius.md)
                    .fill(isSelected ? QMDesign.Colors.accent.opacity(0.1) : (isHovered ? QMDesign.Colors.surfaceHover : QMDesign.Colors.backgroundSecondary))
            )
            .overlay(
                RoundedRectangle(cornerRadius: QMDesign.Radius.md)
                    .stroke(isSelected ? QMDesign.Colors.accent.opacity(0.3) : Color.clear, lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
        .onHover { isHovered = $0 }
    }
}

// MARK: - Modern Auto-Answer Settings

struct ModernAutoAnswerSettingsView: View {
    @StateObject private var config = ConfigurationManager.shared

    var body: some View {
        VStack(spacing: QMDesign.Spacing.lg) {
            // Header
            SettingsSectionHeader(
                title: String(localized: "settings.autoAnswer.title"),
                subtitle: String(localized: "settings.autoAnswer.subtitle")
            )

            // Enable Card (Enterprise only)
            SettingsCard(title: String(localized: "settings.autoAnswer.automaticResponses"), icon: "bolt.fill") {
                VStack(spacing: QMDesign.Spacing.md) {
                    LicenseGatedToggleRow(
                        title: String(localized: "settings.autoAnswer.enableAutoAnswer"),
                        description: String(localized: "settings.autoAnswer.enableAutoAnswer.description"),
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
                            Text(String(localized: "settings.autoAnswer.infoText"))
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
                SettingsCard(title: String(localized: "settings.autoAnswer.triggerSettings"), icon: "slider.horizontal.3") {
                    VStack(spacing: QMDesign.Spacing.lg) {
                        // Silence Threshold
                        VStack(alignment: .leading, spacing: QMDesign.Spacing.sm) {
                            HStack {
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(String(localized: "settings.autoAnswer.silenceThreshold"))
                                        .font(QMDesign.Typography.bodySmall)
                                        .foregroundColor(QMDesign.Colors.textPrimary)
                                    Text(String(localized: "settings.autoAnswer.silenceThreshold.description"))
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
                                    Text(String(localized: "settings.autoAnswer.cooldownPeriod"))
                                        .font(QMDesign.Typography.bodySmall)
                                        .foregroundColor(QMDesign.Colors.textPrimary)
                                    Text(String(localized: "settings.autoAnswer.cooldownPeriod.description"))
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
                SettingsCard(title: String(localized: "settings.autoAnswer.responseType"), icon: "text.bubble") {
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
        case "assist": return String(localized: "settings.autoAnswer.responseType.assist")
        case "whatToSay": return String(localized: "settings.autoAnswer.responseType.whatToSay")
        case "followUp": return String(localized: "settings.autoAnswer.responseType.followUp")
        default: return type
        }
    }

    var description: String {
        switch type {
        case "assist": return String(localized: "settings.autoAnswer.responseType.assist.description")
        case "whatToSay": return String(localized: "settings.autoAnswer.responseType.whatToSay.description")
        case "followUp": return String(localized: "settings.autoAnswer.responseType.followUp.description")
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
                title: String(localized: "settings.audio.title"),
                subtitle: String(localized: "settings.audio.subtitle")
            )

            // Audio Sources Card
            SettingsCard(title: String(localized: "settings.audio.audioSources"), icon: "speaker.wave.2.fill") {
                VStack(spacing: QMDesign.Spacing.md) {
                    ModernToggleRow(
                        title: String(localized: "settings.audio.captureMicrophone"),
                        description: String(localized: "settings.audio.captureMicrophone.description"),
                        isOn: $config.captureMicrophone,
                        icon: "mic.fill"
                    )

                    Divider().background(QMDesign.Colors.borderSubtle)

                    ModernToggleRow(
                        title: String(localized: "settings.audio.captureSystemAudio"),
                        description: String(localized: "settings.audio.captureSystemAudio.description"),
                        isOn: $config.captureSystemAudio,
                        icon: "speaker.wave.3.fill"
                    )
                }
            }

            // Audio Test Card
            SettingsCard(title: String(localized: "settings.audio.audioTest"), icon: "waveform.circle.fill") {
                VStack(spacing: QMDesign.Spacing.md) {
                    // Microphone Test
                    AudioTestRow(
                        title: String(localized: "settings.audio.microphone"),
                        description: String(localized: "settings.audio.microphone.testDescription"),
                        icon: "mic.fill",
                        level: audioTestManager.microphoneLevel,
                        isTesting: audioTestManager.isMicrophoneTesting,
                        permissionStatus: audioTestManager.microphonePermissionStatus,
                        onTest: { audioTestManager.toggleMicrophoneTest() }
                    )

                    Divider().background(QMDesign.Colors.borderSubtle)

                    // System Audio Test
                    AudioTestRow(
                        title: String(localized: "settings.audio.systemAudio"),
                        description: String(localized: "settings.audio.systemAudio.testDescription"),
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
                        Text(String(localized: "settings.audio.testInstructions"))
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
            SettingsCard(title: String(localized: "settings.audio.privacyInformation"), icon: "shield.lefthalf.filled") {
                VStack(alignment: .leading, spacing: QMDesign.Spacing.sm) {
                    InfoRow(icon: "waveform.path", text: String(localized: "settings.audio.privacy.streamedDirectly"))
                    InfoRow(icon: "externaldrive.badge.xmark", text: String(localized: "settings.audio.privacy.notStored"))
                    InfoRow(icon: "lock.shield", text: String(localized: "settings.audio.privacy.encrypted"))
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
                            Text(String(localized: "settings.audio.grantAccess"))
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
                            Text(isTesting ? String(localized: "settings.audio.stop") : String(localized: "settings.audio.test"))
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
            guard let self else { return }
            Task { @MainActor [weak self] in
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
                title: String(localized: "settings.shortcuts.title"),
                subtitle: String(localized: "settings.shortcuts.subtitle")
            )

            // Global Shortcuts Card
            SettingsCard(title: String(localized: "settings.shortcuts.globalShortcuts"), icon: "globe") {
                VStack(spacing: QMDesign.Spacing.md) {
                    ModernShortcutRow(
                        title: String(localized: "settings.shortcuts.toggleWidget"),
                        description: String(localized: "settings.shortcuts.toggleWidget.description"),
                        shortcut: config.shortcutToggleWidget
                    )

                    Divider().background(QMDesign.Colors.borderSubtle)

                    ModernShortcutRow(
                        title: String(localized: "settings.shortcuts.triggerAssist"),
                        description: String(localized: "settings.shortcuts.triggerAssist.description"),
                        shortcut: config.shortcutAssist
                    )

                    Divider().background(QMDesign.Colors.borderSubtle)

                    ModernShortcutRow(
                        title: String(localized: "settings.shortcuts.clearContext"),
                        description: String(localized: "settings.shortcuts.clearContext.description"),
                        shortcut: config.shortcutClearContext
                    )
                }
            }

            // Widget Shortcuts Card
            SettingsCard(title: String(localized: "settings.shortcuts.widgetNavigation"), icon: "rectangle.3.group") {
                VStack(spacing: QMDesign.Spacing.md) {
                    ModernShortcutRow(
                        title: String(localized: "settings.shortcuts.moveWidget"),
                        description: String(localized: "settings.shortcuts.moveWidget.description"),
                        shortcut: "Cmd + Arrow Keys"
                    )

                    Divider().background(QMDesign.Colors.borderSubtle)

                    ModernShortcutRow(
                        title: String(localized: "settings.shortcuts.scrollResponses"),
                        description: String(localized: "settings.shortcuts.scrollResponses.description"),
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
                title: String(localized: "settings.account.title"),
                subtitle: String(localized: "settings.account.subtitle")
            )

            if authManager.isAuthenticated, let user = authManager.currentUser {
                // Connected Account Card
                SettingsCard(title: String(localized: "settings.account.connectedAccount"), icon: "person.crop.circle.fill") {
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
                                HStack(spacing: QMDesign.Spacing.xs) {
                                    Text(user.email)
                                        .font(QMDesign.Typography.caption)
                                        .foregroundColor(QMDesign.Colors.textSecondary)
                                    if let method = user.authMethodLabel {
                                        Text(String(localized: "settings.account.via \(method)"))
                                            .font(QMDesign.Typography.captionSmall)
                                            .foregroundColor(QMDesign.Colors.textTertiary)
                                            .padding(.horizontal, 6)
                                            .padding(.vertical, 2)
                                            .background(
                                                Capsule()
                                                    .fill(QMDesign.Colors.surfaceLight)
                                            )
                                    }
                                }
                            }

                            Spacer()

                            // Status badge
                            HStack(spacing: 4) {
                                Circle()
                                    .fill(QMDesign.Colors.success)
                                    .frame(width: 8, height: 8)
                                Text(String(localized: "settings.account.connected"))
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
                                Text(String(localized: "settings.account.signOut"))
                            }
                            .font(QMDesign.Typography.bodySmall)
                            .foregroundColor(QMDesign.Colors.error)
                        }
                        .buttonStyle(.plain)
                    }
                }

                // Subscription Card
                SettingsCard(title: String(localized: "settings.account.subscription"), icon: "crown.fill") {
                    VStack(spacing: QMDesign.Spacing.md) {
                        HStack {
                            VStack(alignment: .leading, spacing: 4) {
                                HStack(spacing: QMDesign.Spacing.sm) {
                                    Text(licenseManager.currentLicense.plan.rawValue)
                                        .font(QMDesign.Typography.headline)
                                        .foregroundStyle(licenseManager.isPro ? AnyShapeStyle(QMDesign.Colors.primaryGradient) : AnyShapeStyle(QMDesign.Colors.textPrimary))

                                    if licenseManager.isTrialing, let days = licenseManager.trialDaysRemaining {
                                        Text(String(localized: "settings.account.daysLeft \(days)"))
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

                                Text(licenseManager.isPro ? String(localized: "settings.account.allFeaturesUnlocked") : String(localized: "settings.account.upgradeForAccess"))
                                    .font(QMDesign.Typography.caption)
                                    .foregroundColor(QMDesign.Colors.textSecondary)
                            }

                            Spacer()

                            if !licenseManager.isPro {
                                Button(action: { showUpgradeSheet = true }) {
                                    Text(String(localized: "settings.account.upgrade"))
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
                                        feature: String(localized: "settings.account.smartMode"),
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
                SettingsCard(title: String(localized: "settings.account.enterCode"), icon: "number.circle.fill") {
                    VStack(spacing: QMDesign.Spacing.md) {
                        HStack(spacing: QMDesign.Spacing.sm) {
                            Image(systemName: "safari")
                                .foregroundStyle(QMDesign.Colors.primaryGradient)
                            Text(String(localized: "settings.account.browserOpenedEnterCode"))
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
                                    Text(showCopied ? String(localized: "settings.account.copied") : String(localized: "settings.account.copyCode"))
                                }
                                .font(QMDesign.Typography.captionSmall)
                                .foregroundColor(showCopied ? QMDesign.Colors.success : QMDesign.Colors.textSecondary)
                            }
                            .buttonStyle(.plain)
                        }

                        // Open link manually
                        if let verificationURL = URL(string: response.verificationUrl) {
                            Link(destination: verificationURL) {
                                HStack(spacing: QMDesign.Spacing.xs) {
                                    Image(systemName: "arrow.up.right.square")
                                    Text(String(localized: "settings.account.openLinkManually"))
                                }
                                .font(QMDesign.Typography.captionSmall)
                                .foregroundStyle(QMDesign.Colors.primaryGradient)
                            }
                        }

                        HStack(spacing: QMDesign.Spacing.sm) {
                            ProgressView()
                                .scaleEffect(0.7)
                            Text(String(localized: "settings.account.waitingForAuthorization"))
                                .font(QMDesign.Typography.caption)
                                .foregroundColor(QMDesign.Colors.textSecondary)
                        }

                        Button(action: cancelDeviceCode) {
                            Text(String(localized: "settings.account.cancel"))
                                .font(QMDesign.Typography.bodySmall)
                                .foregroundColor(QMDesign.Colors.textSecondary)
                        }
                        .buttonStyle(.plain)
                    }
                }
            } else {
                // Not Connected Card
                SettingsCard(title: String(localized: "settings.account.notConnected"), icon: "person.crop.circle.badge.xmark") {
                    VStack(spacing: QMDesign.Spacing.md) {
                        Text(String(localized: "settings.account.signInPrompt"))
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
                                Text(isConnecting ? String(localized: "settings.account.openingBrowser") : String(localized: "settings.account.connectAccount"))
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

                        Text(String(localized: "settings.account.worksWithProviders"))
                            .font(QMDesign.Typography.captionSmall)
                            .foregroundColor(QMDesign.Colors.textTertiary)
                    }
                }
            }
        }
        .alert(String(localized: "settings.account.signOut"), isPresented: $showLogoutConfirmation) {
            Button(String(localized: "settings.account.cancel"), role: .cancel) { }
            Button(String(localized: "settings.account.signOut"), role: .destructive) {
                Task {
                    await authManager.logout()
                }
            }
        } message: {
            Text(String(localized: "settings.account.signOutConfirmation"))
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
                connectionError = AuthError.friendlyMessage(from: error)
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
                title: String(localized: "settings.sync.title"),
                subtitle: String(localized: "settings.sync.subtitle")
            )

            if !authManager.isAuthenticated {
                // Not signed in - direct to Account section
                SettingsCard(title: String(localized: "settings.sync.signInRequired"), icon: "person.crop.circle.badge.xmark") {
                    VStack(spacing: QMDesign.Spacing.md) {
                        Text(String(localized: "settings.sync.connectAccountPrompt"))
                            .font(QMDesign.Typography.bodySmall)
                            .foregroundColor(QMDesign.Colors.textSecondary)
                            .multilineTextAlignment(.center)

                        HStack(spacing: QMDesign.Spacing.xs) {
                            Image(systemName: "arrow.left")
                            Text(String(localized: "settings.sync.goToAccount"))
                        }
                        .font(QMDesign.Typography.caption)
                        .foregroundStyle(QMDesign.Colors.primaryGradient)
                    }
                }
            } else if !licenseManager.isFeatureAvailable(.sessionSync) {
                // PRO required
                ProFeatureBanner(
                    feature: String(localized: "settings.sync.sessionSync"),
                    description: String(localized: "settings.sync.sessionSync.description")
                )
            } else {
                // Sync Status Card
                SettingsCard(title: String(localized: "settings.sync.syncStatus"), icon: "arrow.triangle.2.circlepath") {
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
                                    Text(String(localized: "settings.sync.lastSync")) + Text(" ") + Text(lastSync, style: .relative)
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
                                Text(String(localized: "settings.sync.pendingSync \(syncManager.pendingCount)"))
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
                                Text(String(localized: "settings.sync.syncNow"))
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
                SettingsCard(title: String(localized: "settings.sync.viewOnDashboard"), icon: "globe") {
                    VStack(spacing: QMDesign.Spacing.md) {
                        Text(String(localized: "settings.sync.viewOnDashboard.description"))
                            .font(QMDesign.Typography.bodySmall)
                            .foregroundColor(QMDesign.Colors.textSecondary)

                        Button(action: openDashboard) {
                            HStack(spacing: QMDesign.Spacing.sm) {
                                Text(String(localized: "settings.sync.openDashboard"))
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
            return String(localized: "settings.sync.status.syncing")
        } else if syncManager.isOffline {
            return String(localized: "settings.sync.status.offline")
        } else if syncManager.pendingCount > 0 {
            return String(localized: "settings.sync.status.pending")
        } else {
            return String(localized: "settings.sync.status.upToDate")
        }
    }

    private func syncNow() {
        Task {
            await syncManager.syncNow()
        }
    }

    private func openDashboard() {
        Task {
            do {
                let response = try await AuthAPIClient.shared.generateMagicLink(redirect: "/dashboard/sessions")
                if let url = URL(string: response.url) {
                    NSWorkspace.shared.open(url)
                }
            } catch {
                // Fallback to plain URL if magic link generation fails
                NSWorkspace.shared.open(URLConfigManager.shared.dashboardSessionsURL)
            }
        }
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
                title: String(localized: "settings.updates.title"),
                subtitle: String(localized: "settings.updates.subtitle")
            )

            // Version Info Card
            SettingsCard(title: String(localized: "settings.updates.versionInformation"), icon: "info.circle.fill") {
                VStack(spacing: QMDesign.Spacing.md) {
                    HStack {
                        VStack(alignment: .leading, spacing: 4) {
                            Text(String(localized: "settings.updates.currentVersion"))
                                .font(QMDesign.Typography.bodySmall)
                                .foregroundColor(QMDesign.Colors.textSecondary)
                            Text("\(updater.currentVersion) (\(updater.currentBuild))")
                                .font(QMDesign.Typography.bodyMedium)
                                .foregroundStyle(QMDesign.Colors.primaryGradient)
                        }

                        Spacer()

                        if let lastCheck = updater.lastUpdateCheckDate {
                            VStack(alignment: .trailing, spacing: 4) {
                                Text(String(localized: "settings.updates.lastChecked"))
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
                            Text(String(localized: "settings.updates.checkForUpdates"))
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
            SettingsCard(title: String(localized: "settings.updates.updatePreferences"), icon: "gearshape.2.fill") {
                VStack(spacing: QMDesign.Spacing.md) {
                    ModernToggleRow(
                        title: String(localized: "settings.updates.checkAutomatically"),
                        description: String(localized: "settings.updates.checkAutomatically.description"),
                        isOn: $updater.automaticallyChecksForUpdates,
                        icon: "clock.arrow.2.circlepath"
                    )

                    Divider()
                        .background(QMDesign.Colors.borderSubtle)

                    ModernToggleRow(
                        title: String(localized: "settings.updates.downloadAutomatically"),
                        description: String(localized: "settings.updates.downloadAutomatically.description"),
                        isOn: $updater.automaticallyDownloadsUpdates,
                        icon: "arrow.down.to.line"
                    )
                    .disabled(!updater.automaticallyChecksForUpdates)
                    .opacity(updater.automaticallyChecksForUpdates ? 1 : 0.5)
                }
            }

            // Changelog Card
            SettingsCard(title: String(localized: "settings.updates.whatsNew"), icon: "sparkles") {
                VStack(spacing: QMDesign.Spacing.md) {
                    Text(String(localized: "settings.updates.whatsNew.description"))
                        .font(QMDesign.Typography.bodySmall)
                        .foregroundColor(QMDesign.Colors.textSecondary)

                    Button(action: openChangelog) {
                        HStack(spacing: QMDesign.Spacing.sm) {
                            Text(String(localized: "settings.updates.viewChangelog"))
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
