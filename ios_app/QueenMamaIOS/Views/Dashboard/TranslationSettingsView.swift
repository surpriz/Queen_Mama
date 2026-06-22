import SwiftUI

/// iOS live-translation settings. Mirrors macOS ModernTranslationSettingsView,
/// adapted to a native Form layout. Gated behind the Enterprise `.liveTranslation`
/// feature using the shared ProFeatureBanner upgrade pattern.
struct TranslationSettingsView: View {
    @ObservedObject private var config = ConfigurationManager.shared
    @ObservedObject private var proxyConfig = ProxyConfigManager.shared
    @ObservedObject private var licenseManager = LicenseManager.shared

    @State private var testStatus: TestStatus = .idle
    @State private var testMessage: String = ""

    enum TestStatus {
        case idle, running, success, failure
    }

    private var isAvailable: Bool {
        licenseManager.isFeatureAvailable(.liveTranslation)
    }

    var body: some View {
        Form {
            if !isAvailable {
                Section {
                    ProFeatureBanner(
                        feature: String(localized: "Live Translation"),
                        description: String(localized: "settings.translation.enable.description")
                    )
                    .listRowInsets(EdgeInsets())
                    .listRowBackground(Color.clear)
                }
            }

            // General
            Section {
                Toggle(String(localized: "settings.translation.enable"), isOn: $config.translationEnabled)
                    .tint(QMDesign.Colors.accent)
                    .disabled(!isAvailable)

                Text(String(localized: "settings.translation.enable.description") + " " + String(localized: "settings.general.betaNotice"))
                    .font(QMDesign.Typography.caption)
                    .foregroundColor(QMDesign.Colors.textTertiary)
            } header: {
                Text(String(localized: "settings.translation.general"))
            }

            // Languages
            Section {
                Picker(String(localized: "settings.translation.sourceLanguage"), selection: $config.translationSourceLanguage) {
                    Text(String(localized: "settings.translation.sourceLanguage.auto")).tag("auto")
                    ForEach(DeepLLanguage.allCases) { lang in
                        Text("\(lang.flag) \(lang.displayName)").tag(lang.rawValue)
                    }
                }
                .disabled(!isAvailable)

                Picker(String(localized: "settings.translation.targetLanguage"), selection: $config.translationTargetLanguage) {
                    ForEach(DeepLLanguage.allCases) { lang in
                        Text("\(lang.flag) \(lang.displayName)").tag(lang.rawValue)
                    }
                }
                .disabled(!isAvailable)
            } header: {
                Text(String(localized: "settings.translation.languages"))
            }

            // Provider status
            Section {
                HStack {
                    Image(systemName: proxyConfig.isTranslationEnabled ? "checkmark.circle.fill" : "exclamationmark.circle")
                        .foregroundColor(proxyConfig.isTranslationEnabled ? QMDesign.Colors.accent : QMDesign.Colors.textTertiary)
                    VStack(alignment: .leading, spacing: 2) {
                        Text(String(localized: "settings.translation.provider.status"))
                        Text(proxyConfig.isTranslationEnabled
                             ? String(localized: "settings.translation.provider.proxyActive")
                             : String(localized: "settings.translation.provider.notConfigured"))
                            .font(QMDesign.Typography.caption)
                            .foregroundColor(QMDesign.Colors.textTertiary)
                    }
                }

                if proxyConfig.isTranslationEnabled && isAvailable {
                    Button(action: runTestTranslation) {
                        HStack(spacing: QMDesign.Spacing.xs) {
                            if testStatus == .running {
                                ProgressView().scaleEffect(0.7)
                            }
                            Text(String(localized: "settings.translation.test"))
                        }
                    }
                    .disabled(testStatus == .running)

                    if !testMessage.isEmpty {
                        Text(testMessage)
                            .font(QMDesign.Typography.caption)
                            .foregroundColor(testStatus == .success ? QMDesign.Colors.accent : QMDesign.Colors.textTertiary)
                    }
                }
            } header: {
                Text(String(localized: "settings.translation.provider"))
            }
        }
        .navigationTitle(String(localized: "settings.translation.title"))
        .navigationBarTitleDisplayMode(.inline)
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
