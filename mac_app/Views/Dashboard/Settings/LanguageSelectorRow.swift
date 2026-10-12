//
//  LanguageSelectorRow.swift
//  QueenMama
//
//  App language picker, used by Essentials.
//

import SwiftUI

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
