//
//  AutoAnswerSettingsView.swift
//  QueenMama
//
//  Advanced › Auto-Answer.
//

import SwiftUI

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
