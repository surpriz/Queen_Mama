//
//  EssentialSettingsView.swift
//  QueenMama
//
//  Settings › Essentials: the six settings that matter. Everything else is under Advanced.
//

import SwiftUI

struct EssentialSettingsView: View {
    @StateObject private var config = ConfigurationManager.shared
    /// Switch to Advanced, optionally landing on a section.
    let onShowAdvanced: (SettingsSection?) -> Void

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: QMDesign.Spacing.lg) {
                SettingsSectionHeader(
                    title: String(localized: "settings.essentials.title"),
                    subtitle: String(localized: "settings.essentials.subtitle")
                )

                EssentialAccountCard(onManage: { onShowAdvanced(.account) })

                SettingsCard(title: String(localized: "settings.essentials.capture"), icon: "waveform") {
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

                        Divider().background(QMDesign.Colors.borderSubtle)

                        ModernToggleRow(
                            title: String(localized: "settings.general.autoCaptureScreen"),
                            description: String(localized: "settings.general.autoCaptureScreen.description"),
                            isOn: $config.autoScreenCapture,
                            icon: "rectangle.dashed.badge.record"
                        )
                    }
                }

                SettingsCard(title: String(localized: "settings.essentials.behaviour"), icon: "sparkles") {
                    VStack(spacing: QMDesign.Spacing.md) {
                        ModernToggleRow(
                            title: String(localized: "settings.general.meetingReminders"),
                            description: String(localized: "settings.general.meetingReminders.description"),
                            isOn: $config.meetingDetectionEnabled,
                            icon: "bell.badge"
                        )

                        Divider().background(QMDesign.Colors.borderSubtle)

                        LicenseGatedToggleRow(
                            title: String(localized: "settings.general.undetectabilityMode"),
                            description: String(localized: "settings.general.undetectabilityMode.description"),
                            isOn: $config.isUndetectabilityEnabled,
                            icon: "eye.slash",
                            feature: .undetectable,
                            requiredTier: "Enterprise"
                        )
                    }
                }

                SettingsCard(title: String(localized: "settings.general.language"), icon: "globe") {
                    LanguageSelectorRow()
                }

                footer
            }
            .frame(maxWidth: 560)
            .padding(QMDesign.Spacing.lg)
            .frame(maxWidth: .infinity)
        }
        .background(QMDesign.Colors.backgroundPrimary)
    }

    private var footer: some View {
        HStack(spacing: QMDesign.Spacing.md) {
            Button(action: { onShowAdvanced(nil) }) {
                HStack(spacing: QMDesign.Spacing.xs) {
                    Image(systemName: "slider.horizontal.3")
                        .font(.system(size: 12))
                    Text(String(localized: "settings.essentials.advanced"))
                        .font(QMDesign.Typography.labelMedium)
                }
                .qmPillButton(isActive: true)
            }
            .buttonStyle(.plain)

            Spacer()

            Button(String(localized: "settings.feedback.giveFeedback")) {
                if let url = URL(string: "https://queenmama.featurebase.app") {
                    NSWorkspace.shared.open(url)
                }
            }
            .buttonStyle(.link)
            .font(QMDesign.Typography.caption)

            Text("v\(Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "?")")
                .font(QMDesign.Typography.captionSmall)
                .foregroundColor(QMDesign.Colors.textTertiary)
        }
        .padding(.top, QMDesign.Spacing.sm)
    }
}

// MARK: - Compact Account Card

private struct EssentialAccountCard: View {
    @ObservedObject private var authManager = AuthenticationManager.shared
    @ObservedObject private var licenseManager = LicenseManager.shared
    let onManage: () -> Void

    private var isSignedIn: Bool { authManager.isAuthenticated && authManager.currentUser != nil }

    private var title: String {
        guard isSignedIn, let user = authManager.currentUser else {
            return String(localized: "settings.account.notConnected")
        }
        return user.isGuest ? String(localized: "settings.essentials.guest") : user.displayName
    }

    private var subtitle: String {
        guard isSignedIn, let user = authManager.currentUser else {
            return String(localized: "dashboard.license.tapToSignIn")
        }
        let plan = licenseManager.isPro ? licenseManager.currentLicense.plan.rawValue : "FREE"
        return user.isGuest ? plan : "\(user.email) · \(plan)"
    }

    private var initial: String {
        guard isSignedIn, let user = authManager.currentUser else { return "?" }
        return String(user.displayName.prefix(1)).uppercased()
    }

    var body: some View {
        SettingsCard(title: String(localized: "settings.section.account"), icon: "person.crop.circle") {
            HStack(spacing: QMDesign.Spacing.md) {
                ZStack {
                    Circle()
                        .fill(isSignedIn ? AnyShapeStyle(QMDesign.Colors.primaryGradient) : AnyShapeStyle(QMDesign.Colors.surfaceMedium))
                        .frame(width: 40, height: 40)
                    Text(initial)
                        .font(.system(size: 16, weight: .bold))
                        .foregroundColor(.white)
                }

                VStack(alignment: .leading, spacing: 2) {
                    Text(title)
                        .font(QMDesign.Typography.bodyMedium)
                        .foregroundColor(QMDesign.Colors.textPrimary)
                    Text(subtitle)
                        .font(QMDesign.Typography.caption)
                        .foregroundColor(QMDesign.Colors.textSecondary)
                        .lineLimit(1)
                }

                Spacer()

                Button(action: onManage) {
                    Text(String(localized: "settings.essentials.manageAccount"))
                        .font(QMDesign.Typography.labelSmall)
                        .qmPillButton()
                }
                .buttonStyle(.plain)
            }
        }
    }
}
