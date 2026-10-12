//
//  IntelligenceSettingsView.swift
//  QueenMama
//
//  Advanced › Intelligence: how the AI thinks and what it sees.
//

import SwiftUI

struct ModernIntelligenceSettingsView: View {
    @StateObject private var config = ConfigurationManager.shared

    var body: some View {
        VStack(spacing: QMDesign.Spacing.lg) {
            SettingsSectionHeader(
                title: String(localized: "settings.intelligence.title"),
                subtitle: String(localized: "settings.intelligence.subtitle")
            )

            SettingsCard(title: String(localized: "settings.intelligence.card"), icon: "brain.head.profile") {
                VStack(spacing: QMDesign.Spacing.md) {
                    // Smart Mode (Enterprise only)
                    LicenseGatedToggleRow(
                        title: String(localized: "settings.general.smartMode"),
                        description: String(localized: "settings.general.smartMode.description"),
                        isOn: $config.smartModeEnabled,
                        icon: "brain",
                        feature: .smartMode,
                        requiredTier: "Enterprise"
                    )

                    Divider()
                        .background(QMDesign.Colors.borderSubtle)

                    // Context Intelligence (Enterprise only)
                    LicenseGatedToggleRow(
                        title: String(localized: "settings.general.contextIntelligence"),
                        description: String(localized: "settings.general.contextIntelligence.description"),
                        isOn: $config.knowledgeEnabled,
                        icon: "sparkles",
                        feature: .knowledgeBase,
                        requiredTier: "Enterprise"
                    )

                    Divider()
                        .background(QMDesign.Colors.borderSubtle)

                    // AI Model (Standard mode only — Smart Mode keeps its own model)
                    AIModelSelectorRow()

                    Divider()
                        .background(QMDesign.Colors.borderSubtle)

                    // Instant Responses / Buffered Pre-Generation (Enterprise only, Beta)
                    LicenseGatedToggleRow(
                        title: String(localized: "settings.general.instantResponses"),
                        description: String(localized: "settings.general.instantResponses.description") + " " + String(localized: "settings.general.betaNotice"),
                        isOn: $config.bufferedPreGenEnabled,
                        icon: "bolt.fill",
                        feature: .bufferedPreGen,
                        requiredTier: "Enterprise",
                        isBeta: true
                    )

                    Divider()
                        .background(QMDesign.Colors.borderSubtle)

                    // Live Transcript in Overlay (Beta)
                    ModernToggleRow(
                        title: String(localized: "settings.general.showTranscriptInOverlay"),
                        description: String(localized: "settings.general.showTranscriptInOverlay.description") + " " + String(localized: "settings.general.betaNotice"),
                        isOn: $config.showTranscriptInOverlay,
                        icon: "text.bubble",
                        isBeta: true
                    )

                    Divider()
                        .background(QMDesign.Colors.borderSubtle)

                    // Decode button in Overlay
                    ModernToggleRow(
                        title: String(localized: "settings.general.showDecodeInOverlay"),
                        description: String(localized: "settings.general.showDecodeInOverlay.description"),
                        isOn: $config.showDecodeInOverlay,
                        icon: "character.book.closed"
                    )
                }
            }
        }
    }
}

// MARK: - AI Model Selector Row

struct AIModelSelectorRow: View {
    @StateObject private var config = ConfigurationManager.shared
    @State private var isExpanded = false

    private var selectedChoice: AIModelChoice {
        AIModelChoice(rawValue: config.selectedAIModel) ?? .auto
    }

    var body: some View {
        VStack(alignment: .leading, spacing: QMDesign.Spacing.sm) {
            HStack(spacing: QMDesign.Spacing.sm) {
                Image(systemName: "cpu")
                    .font(.system(size: 14))
                    .foregroundColor(QMDesign.Colors.textSecondary)
                    .frame(width: 24)

                VStack(alignment: .leading, spacing: 2) {
                    Text(String(localized: "settings.general.aiModel.title"))
                        .font(QMDesign.Typography.bodySmall)
                        .foregroundColor(QMDesign.Colors.textPrimary)
                    Text(String(localized: "settings.general.aiModel.description"))
                        .font(QMDesign.Typography.captionSmall)
                        .foregroundColor(QMDesign.Colors.textTertiary)
                }

                Spacer()

                Button {
                    withAnimation(.easeInOut(duration: 0.2)) { isExpanded.toggle() }
                } label: {
                    HStack(spacing: 4) {
                        Text(selectedChoice.displayName)
                            .font(QMDesign.Typography.bodySmall)
                            .foregroundColor(QMDesign.Colors.textPrimary)
                        Image(systemName: isExpanded ? "chevron.up" : "chevron.down")
                            .font(.system(size: 10))
                            .foregroundColor(QMDesign.Colors.textSecondary)
                    }
                    .padding(.horizontal, QMDesign.Spacing.sm)
                    .padding(.vertical, 6)
                    .background(
                        RoundedRectangle(cornerRadius: QMDesign.Radius.sm)
                            .fill(QMDesign.Colors.surfaceMedium)
                    )
                }
                .buttonStyle(.plain)
            }

            if isExpanded {
                VStack(spacing: QMDesign.Spacing.xs) {
                    ForEach(AIModelChoice.allCases) { choice in
                        AIModelOptionRow(
                            label: choice.displayName,
                            subtitle: choice.subtitle,
                            icon: choice.iconName,
                            isSelected: selectedChoice == choice,
                            onSelect: {
                                config.selectedAIModel = choice.rawValue
                            }
                        )
                    }
                }
            }
        }
    }
}

struct AIModelOptionRow: View {
    let label: String
    let subtitle: String
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

                VStack(alignment: .leading, spacing: 2) {
                    Text(label)
                        .font(QMDesign.Typography.bodySmall)
                        .foregroundColor(isSelected ? QMDesign.Colors.textPrimary : QMDesign.Colors.textSecondary)
                    Text(subtitle)
                        .font(QMDesign.Typography.captionSmall)
                        .foregroundColor(QMDesign.Colors.textTertiary)
                        .lineLimit(2)
                        .fixedSize(horizontal: false, vertical: true)
                }

                Spacer()

                if isSelected {
                    Image(systemName: "checkmark.circle.fill")
                        .font(.system(size: 16))
                        .foregroundColor(QMDesign.Colors.accent)
                }
            }
            .padding(.horizontal, QMDesign.Spacing.sm)
            .padding(.vertical, QMDesign.Spacing.xs)
            .background(
                RoundedRectangle(cornerRadius: QMDesign.Radius.md)
                    .fill(isHovered ? QMDesign.Colors.surfaceMedium.opacity(0.5) : Color.clear)
            )
        }
        .buttonStyle(.plain)
        .onHover { isHovered = $0 }
    }
}
