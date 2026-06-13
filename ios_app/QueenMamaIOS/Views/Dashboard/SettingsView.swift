import SwiftUI

struct SettingsView: View {
    @EnvironmentObject var appState: AppState
    @ObservedObject private var config = ConfigurationManager.shared
    @ObservedObject private var authManager = AuthenticationManager.shared
    @ObservedObject private var licenseManager = LicenseManager.shared
    @Environment(\.openURL) private var openURL
    @State private var showManageSubscriptions = false
    @State private var showPaywall = false
    #if DEBUG
    @State private var showPaywallPreview = false
    #endif

    var body: some View {
        Form {
            // Account Section
            Section("Account") {
                if authManager.isAuthenticated, let user = authManager.currentUser {
                    HStack {
                        ZStack {
                            Circle()
                                .fill(QMDesign.Colors.primaryGradient)
                                .frame(width: 44, height: 44)
                            Text(String((user.name ?? "U").prefix(1)).uppercased())
                                .font(QMDesign.Typography.labelLarge)
                                .foregroundColor(.white)
                        }
                        VStack(alignment: .leading, spacing: QMDesign.Spacing.xxxs) {
                            Text(user.name ?? "User")
                                .font(QMDesign.Typography.headline)
                            Text(user.email)
                                .font(QMDesign.Typography.caption)
                                .foregroundColor(QMDesign.Colors.textSecondary)
                        }
                    }

                    // Plan
                    HStack {
                        Text("Plan")
                        Spacer()
                        Text(licenseManager.currentLicense.plan.rawValue)
                            .foregroundColor(QMDesign.Colors.accent)
                    }

                    // Subscription management — provider-dependent:
                    // Apple → native StoreKit manage sheet; Stripe → informational
                    // only (no purchase/upgrade link: App Store rule 3.1.1);
                    // Free → native paywall.
                    if licenseManager.currentLicense.provider?.uppercased() == "APPLE" {
                        Button {
                            showManageSubscriptions = true
                        } label: {
                            Label("Manage Subscription", systemImage: "creditcard")
                        }
                    } else if licenseManager.currentLicense.plan == .free {
                        Button {
                            showPaywall = true
                        } label: {
                            Label("Upgrade to PRO", systemImage: "crown")
                        }
                    } else {
                        VStack(alignment: .leading, spacing: QMDesign.Spacing.xxxs) {
                            Label("Subscription", systemImage: "creditcard")
                            Text("Managed on queenmama.co")
                                .font(QMDesign.Typography.caption)
                                .foregroundColor(QMDesign.Colors.textSecondary)
                        }
                    }

                    // Sign Out
                    Button(role: .destructive) {
                        Task { await authManager.logout() }
                    } label: {
                        Label("Sign Out", systemImage: "rectangle.portrait.and.arrow.right")
                    }
                } else {
                    Text("Not signed in")
                        .foregroundColor(QMDesign.Colors.textSecondary)
                }
            }

            // General Section
            Section("General") {
                Toggle("Smart Mode", isOn: $config.smartModeEnabled)
                    .tint(QMDesign.Colors.accent)

                Toggle("Auto-Answer", isOn: Binding(
                    get: { config.autoAnswerEnabled },
                    set: { config.autoAnswerEnabled = $0 }
                ))
                .tint(QMDesign.Colors.autoAnswer)

                if config.autoAnswerEnabled {
                    HStack {
                        Text("Cooldown")
                        Spacer()
                        Picker("", selection: $config.autoAnswerCooldown) {
                            Text("5s").tag(5.0)
                            Text("10s").tag(10.0)
                            Text("15s").tag(15.0)
                            Text("30s").tag(30.0)
                        }
                        .pickerStyle(.segmented)
                        .frame(maxWidth: 220)
                    }
                }
            }

            // Audio Section
            Section("Audio") {
                HStack {
                    Text("Transcription Language")
                    Spacer()
                    Text("Automatic")
                        .foregroundColor(QMDesign.Colors.textSecondary)
                }
                Text("Detected automatically, including multilingual meetings.")
                    .font(QMDesign.Typography.caption)
                    .foregroundColor(QMDesign.Colors.textTertiary)

                HStack {
                    Text("Sample Rate")
                    Spacer()
                    Text("16 kHz")
                        .foregroundColor(QMDesign.Colors.textSecondary)
                }
            }

            // Sync Section
            Section("Sync") {
                Toggle("Session Sync", isOn: .constant(licenseManager.isFeatureAvailable(.sessionSync)))
                    .tint(QMDesign.Colors.accent)
                    .disabled(!licenseManager.isFeatureAvailable(.sessionSync))

                if !licenseManager.isFeatureAvailable(.sessionSync) {
                    Text("Session sync requires PRO subscription")
                        .font(QMDesign.Typography.caption)
                        .foregroundColor(QMDesign.Colors.textTertiary)
                }
            }

            // Proactive Mode (Enterprise)
            Section("Proactive Mode") {
                Toggle("Proactive Suggestions", isOn: $config.proactiveEnabled)
                    .tint(QMDesign.Colors.accent)
                    .disabled(!licenseManager.isFeatureAvailable(.proactiveSuggestions))

                if config.proactiveEnabled {
                    HStack {
                        Text("Sensitivity")
                        Slider(value: $config.proactiveSensitivity, in: 0...1)
                            .tint(QMDesign.Colors.accent)
                    }

                    Stepper("Cooldown: \(config.proactiveCooldown)s", value: $config.proactiveCooldown, in: 10...120, step: 10)
                }

                if !licenseManager.isFeatureAvailable(.proactiveSuggestions) {
                    Text("Proactive suggestions require Enterprise subscription")
                        .font(QMDesign.Typography.caption)
                        .foregroundColor(QMDesign.Colors.textTertiary)
                }
            }

            // Live Translation (Enterprise)
            Section("Live Translation") {
                NavigationLink {
                    TranslationSettingsView()
                } label: {
                    HStack {
                        Label(String(localized: "settings.translation.title"), systemImage: "character.bubble")
                        Spacer()
                        if !licenseManager.isFeatureAvailable(.liveTranslation) {
                            ProBadge(size: .small)
                        } else if config.translationEnabled {
                            Text(config.translationTargetLanguage)
                                .font(QMDesign.Typography.caption)
                                .foregroundColor(QMDesign.Colors.textSecondary)
                        }
                    }
                }
            }

            // About Section
            Section("About") {
                HStack {
                    Text("Version")
                    Spacer()
                    Text(Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "1.0.0")
                        .foregroundColor(QMDesign.Colors.textSecondary)
                }

                HStack {
                    Text("Build")
                    Spacer()
                    Text(Bundle.main.object(forInfoDictionaryKey: "CFBundleVersion") as? String ?? "1")
                        .foregroundColor(QMDesign.Colors.textSecondary)
                }

                Button {
                    if let url = URL(string: "https://queenmama.featurebase.app") {
                        openURL(url)
                    }
                } label: {
                    Label("Give Feedback", systemImage: "bubble.left.and.bubble.right")
                }

                Button {
                    if let url = URL(string: "\(AppEnvironment.current.apiBaseURL)/privacy") {
                        openURL(url)
                    }
                } label: {
                    Label("Privacy Policy", systemImage: "lock.shield")
                }
            }

            #if DEBUG
            // Debug-only: force the full paywall (all tiers) regardless of the
            // current plan, for taking App Store review screenshots. Enable the
            // QueenMama.storekit configuration in the Run scheme so the 4
            // products load locally without depending on App Store Connect.
            Section("Debug") {
                Button {
                    showPaywallPreview = true
                } label: {
                    Label("Preview Paywall (all tiers)", systemImage: "rectangle.stack.badge.person.crop")
                }
            }
            #endif
        }
        .navigationTitle("Settings")
        .manageSubscriptionsSheet(isPresented: $showManageSubscriptions)
        .sheet(isPresented: $showPaywall) {
            PaywallView()
                .presentationDetents([.large])
        }
        #if DEBUG
        .sheet(isPresented: $showPaywallPreview) {
            PaywallView(previewMode: true)
                .presentationDetents([.large])
        }
        #endif
    }
}
