//
//  SettingsView.swift
//  QueenMama
//
//  Settings root: Essentials by default, Advanced (sidebar) on demand.
//  Section views live in Views/Dashboard/Settings/.
//

import SwiftUI

struct SettingsView: View {
    @AppStorage("settings_level_advanced") private var showAdvanced = false
    @State private var selectedSection: SettingsSection = .account

    var body: some View {
        Group {
            if showAdvanced {
                advanced
            } else {
                EssentialSettingsView(onShowAdvanced: { section in
                    if let section { selectedSection = section }
                    withAnimation(QMDesign.Animation.quick) { showAdvanced = true }
                })
            }
        }
        .onReceive(NotificationCenter.default.publisher(for: .openSettingsSection)) { note in
            if let section = note.object as? SettingsSection {
                selectedSection = section
                showAdvanced = true
            }
        }
    }

    private var advanced: some View {
        HStack(spacing: 0) {
            ModernSettingsSidebar(selectedSection: $selectedSection, onBack: {
                withAnimation(QMDesign.Animation.quick) { showAdvanced = false }
            })
            .frame(width: 220)

            Divider()

            ScrollView {
                VStack(alignment: .leading, spacing: QMDesign.Spacing.lg) {
                    switch selectedSection {
                    case .account:
                        ModernAccountSettingsView()
                    case .intelligence:
                        ModernIntelligenceSettingsView()
                    case .autoAnswer:
                        ModernAutoAnswerSettingsView()
                    case .audio:
                        ModernAudioSettingsView()
                    case .screenCapture:
                        ModernScreenCaptureSettingsView()
                    case .meetingCost:
                        ModernMeetingCostSettingsView()
                    case .translation:
                        ModernTranslationSettingsView()
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

// MARK: - Settings Section (Advanced)

enum SettingsSection: String, CaseIterable {
    case account = "Account"
    case intelligence = "Intelligence"
    case autoAnswer = "Auto-Answer"
    case audio = "Audio"
    case screenCapture = "Screen Capture"
    case meetingCost = "Meeting Cost"
    case translation = "Translation"
    case sync = "Sync"
    case shortcuts = "Shortcuts"
    case updates = "Updates"

    var icon: String {
        switch self {
        case .account: return "person.crop.circle"
        case .intelligence: return "brain.head.profile"
        case .autoAnswer: return "bolt.fill"
        case .audio: return "speaker.wave.2.fill"
        case .screenCapture: return "camera.fill"
        case .meetingCost: return "eurosign.circle.fill"
        case .translation: return "character.bubble"
        case .sync: return "arrow.triangle.2.circlepath"
        case .shortcuts: return "keyboard"
        case .updates: return "arrow.down.circle"
        }
    }

    var localizedName: String {
        switch self {
        case .account: return String(localized: "settings.section.account")
        case .intelligence: return String(localized: "settings.section.intelligence")
        case .autoAnswer: return String(localized: "settings.section.autoAnswer")
        case .audio: return String(localized: "settings.section.audio")
        case .screenCapture: return String(localized: "settings.section.screenCapture")
        case .meetingCost: return String(localized: "settings.section.meetingCost")
        case .translation: return String(localized: "settings.section.translation")
        case .sync: return String(localized: "settings.section.sync")
        case .shortcuts: return String(localized: "settings.section.shortcuts")
        case .updates: return String(localized: "settings.section.updates")
        }
    }

    var localizedDescription: String {
        switch self {
        case .account: return String(localized: "settings.section.account.description")
        case .intelligence: return String(localized: "settings.section.intelligence.description")
        case .autoAnswer: return String(localized: "settings.section.autoAnswer.description")
        case .audio: return String(localized: "settings.section.audio.description")
        case .screenCapture: return String(localized: "settings.section.screenCapture.description")
        case .meetingCost: return String(localized: "settings.section.meetingCost.description")
        case .translation: return String(localized: "settings.section.translation.description")
        case .sync: return String(localized: "settings.section.sync.description")
        case .shortcuts: return String(localized: "settings.section.shortcuts.description")
        case .updates: return String(localized: "settings.section.updates.description")
        }
    }
}

// MARK: - Modern Settings Sidebar

struct ModernSettingsSidebar: View {
    @Binding var selectedSection: SettingsSection
    let onBack: () -> Void

    var body: some View {
        VStack(spacing: 0) {
            // Back to Essentials
            Button(action: onBack) {
                HStack(spacing: QMDesign.Spacing.xs) {
                    Image(systemName: "chevron.left")
                        .font(.system(size: 11, weight: .semibold))
                    Text(String(localized: "settings.essentials.back"))
                        .font(QMDesign.Typography.bodySmall)
                        .fontWeight(.semibold)
                    Spacer()
                }
                .foregroundColor(QMDesign.Colors.accent)
                .padding(QMDesign.Spacing.md)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
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
    var isBeta: Bool = false

    var body: some View {
        HStack(spacing: QMDesign.Spacing.md) {
            Image(systemName: icon)
                .font(.system(size: 16))
                .foregroundStyle(isOn ? AnyShapeStyle(QMDesign.Colors.primaryGradient) : AnyShapeStyle(QMDesign.Colors.textSecondary))
                .frame(width: 24)

            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: QMDesign.Spacing.xs) {
                    Text(title)
                        .font(QMDesign.Typography.bodyMedium)
                        .foregroundColor(QMDesign.Colors.textPrimary)
                        .fixedSize(horizontal: false, vertical: true)

                    if isBeta {
                        BetaBadge()
                    }
                }
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

struct BetaBadge: View {
    var body: some View {
        Text("BETA")
            .font(.system(size: 9, weight: .bold))
            .foregroundColor(QMDesign.Colors.accent)
            .padding(.horizontal, 6)
            .padding(.vertical, 2)
            .background(
                Capsule()
                    .fill(QMDesign.Colors.accent.opacity(0.15))
            )
            .overlay(
                Capsule()
                    .stroke(QMDesign.Colors.accent.opacity(0.4), lineWidth: 0.5)
            )
    }
}


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
    var isBeta: Bool = false

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

                    if isBeta {
                        BetaBadge()
                    }

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

