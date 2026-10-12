//
//  UpdatesSettingsView.swift
//  QueenMama
//
//  Advanced › Updates.
//

import SwiftUI

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
