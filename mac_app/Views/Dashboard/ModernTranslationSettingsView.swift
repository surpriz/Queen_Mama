import SwiftUI

struct ModernTranslationSettingsView: View {
    @StateObject private var config = ConfigurationManager.shared
    @StateObject private var proxyConfig = ProxyConfigManager.shared
    @State private var testStatus: TestStatus = .idle
    @State private var testMessage: String = ""

    enum TestStatus {
        case idle, running, success, failure
    }

    var body: some View {
        VStack(spacing: QMDesign.Spacing.lg) {
            SettingsSectionHeader(
                title: String(localized: "settings.translation.title"),
                subtitle: String(localized: "settings.translation.subtitle")
            )

            // General Card
            SettingsCard(title: String(localized: "settings.translation.general"), icon: "character.bubble") {
                VStack(spacing: QMDesign.Spacing.md) {
                    LicenseGatedToggleRow(
                        title: String(localized: "settings.translation.enable"),
                        description: String(localized: "settings.translation.enable.description") + " " + String(localized: "settings.general.betaNotice"),
                        isOn: $config.translationEnabled,
                        icon: "globe",
                        feature: .liveTranslation,
                        requiredTier: "Enterprise",
                        isBeta: true
                    )

                    Divider()
                        .background(QMDesign.Colors.borderSubtle)

                    LicenseGatedToggleRow(
                        title: String(localized: "settings.translation.showInOverlay"),
                        description: String(localized: "settings.translation.showInOverlay.description"),
                        isOn: $config.translationShowInOverlay,
                        icon: "macwindow",
                        feature: .liveTranslation,
                        requiredTier: "Enterprise"
                    )
                }
            }

            // Languages Card
            SettingsCard(title: String(localized: "settings.translation.languages"), icon: "globe") {
                VStack(spacing: QMDesign.Spacing.md) {
                    HStack {
                        Image(systemName: "arrow.up.right")
                            .font(.system(size: 14))
                            .foregroundColor(QMDesign.Colors.textSecondary)
                            .frame(width: 20)

                        Text(String(localized: "settings.translation.sourceLanguage"))
                            .font(QMDesign.Typography.bodySmall)
                            .foregroundColor(QMDesign.Colors.textSecondary)

                        Spacer()

                        Picker("", selection: $config.translationSourceLanguage) {
                            Text(String(localized: "settings.translation.sourceLanguage.auto"))
                                .tag("auto")
                            ForEach(DeepLLanguage.allCases) { lang in
                                Text("\(lang.flag) \(lang.displayName)").tag(lang.rawValue)
                            }
                        }
                        .pickerStyle(.menu)
                        .frame(maxWidth: 220)
                    }

                    Divider()
                        .background(QMDesign.Colors.borderSubtle)

                    HStack {
                        Image(systemName: "arrow.down.left")
                            .font(.system(size: 14))
                            .foregroundColor(QMDesign.Colors.textSecondary)
                            .frame(width: 20)

                        Text(String(localized: "settings.translation.targetLanguage"))
                            .font(QMDesign.Typography.bodySmall)
                            .foregroundColor(QMDesign.Colors.textSecondary)

                        Spacer()

                        Picker("", selection: $config.translationTargetLanguage) {
                            ForEach(DeepLLanguage.allCases) { lang in
                                Text("\(lang.flag) \(lang.displayName)").tag(lang.rawValue)
                            }
                        }
                        .pickerStyle(.menu)
                        .frame(maxWidth: 220)
                    }
                }
            }

            // Provider Card
            SettingsCard(title: String(localized: "settings.translation.provider"), icon: "shield.fill") {
                VStack(alignment: .leading, spacing: QMDesign.Spacing.md) {
                    HStack {
                        Image(systemName: proxyConfig.isTranslationEnabled ? "checkmark.circle.fill" : "exclamationmark.circle")
                            .foregroundColor(proxyConfig.isTranslationEnabled ? QMDesign.Colors.accent : QMDesign.Colors.textTertiary)
                            .frame(width: 20)

                        VStack(alignment: .leading, spacing: 2) {
                            Text(String(localized: "settings.translation.provider.status"))
                                .font(QMDesign.Typography.bodySmall)
                                .foregroundColor(QMDesign.Colors.textPrimary)
                            Text(proxyConfig.isTranslationEnabled
                                 ? String(localized: "settings.translation.provider.proxyActive")
                                 : String(localized: "settings.translation.provider.notConfigured"))
                                .font(QMDesign.Typography.caption)
                                .foregroundColor(QMDesign.Colors.textTertiary)
                        }

                        Spacer()
                    }

                    if proxyConfig.isTranslationEnabled {
                        Button(action: runTestTranslation) {
                            HStack(spacing: QMDesign.Spacing.xs) {
                                if testStatus == .running {
                                    ProgressView()
                                        .scaleEffect(0.6)
                                }
                                Text(String(localized: "settings.translation.test"))
                                    .font(QMDesign.Typography.bodySmall)
                            }
                            .padding(.horizontal, QMDesign.Spacing.md)
                            .padding(.vertical, QMDesign.Spacing.xs)
                            .background(
                                RoundedRectangle(cornerRadius: QMDesign.Radius.md)
                                    .fill(QMDesign.Colors.surfaceMedium)
                            )
                        }
                        .buttonStyle(.plain)
                        .disabled(testStatus == .running)

                        if !testMessage.isEmpty {
                            Text(testMessage)
                                .font(QMDesign.Typography.caption)
                                .foregroundColor(testStatus == .success ? QMDesign.Colors.accent : QMDesign.Colors.textTertiary)
                        }
                    }
                }
            }
        }
    }

    private func runTestTranslation() {
        testStatus = .running
        testMessage = ""
        let provider = ProxyTranslationProvider()
        let target = config.translationTargetLanguage
        let sample = "Bonjour comment allez-vous"
        Task { @MainActor in
            do {
                let start = Date()
                let result = try await provider.translate(text: sample, sourceLang: nil, targetLang: target, context: nil)
                let ms = Int(Date().timeIntervalSince(start) * 1000)
                testStatus = .success
                testMessage = String(format: String(localized: "settings.translation.test.success"), ms) + " — " + result.translatedText
            } catch {
                testStatus = .failure
                testMessage = error.localizedDescription
            }
        }
    }
}
