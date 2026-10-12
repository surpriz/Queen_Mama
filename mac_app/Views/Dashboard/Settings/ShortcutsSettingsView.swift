//
//  ShortcutsSettingsView.swift
//  QueenMama
//
//  Advanced › Shortcuts (read-only reference).
//

import SwiftUI

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
