//
//  AccountSettingsView.swift
//  QueenMama
//
//  Advanced › Account: sign in, device code, subscription.
//

import SwiftUI

// MARK: - Modern Account Settings

struct ModernAccountSettingsView: View {
    @StateObject private var authManager = AuthenticationManager.shared
    @StateObject private var licenseManager = LicenseManager.shared

    @State private var showLogoutConfirmation = false
    @State private var showUpgradeSheet = false
    @State private var showConvertAccountSheet = false
    @State private var isConnecting = false
    @State private var deviceCodeResponse: DeviceCodeResponse?
    @State private var connectionError: String?
    @State private var showCopied = false

    var body: some View {
        VStack(spacing: QMDesign.Spacing.lg) {
            // Header
            SettingsSectionHeader(
                title: String(localized: "settings.account.title"),
                subtitle: String(localized: "settings.account.subtitle")
            )

            if authManager.isAuthenticated, let user = authManager.currentUser {
                // Guest conversion prompt (anonymous accounts)
                if user.isGuest {
                    SettingsCard(title: String(localized: "settings.account.guestTitle"), icon: "person.crop.circle.badge.exclamationmark") {
                        VStack(alignment: .leading, spacing: QMDesign.Spacing.md) {
                            Text(String(localized: "settings.account.guestBody"))
                                .font(QMDesign.Typography.bodySmall)
                                .foregroundColor(QMDesign.Colors.textSecondary)
                                .fixedSize(horizontal: false, vertical: true)
                            Button(action: { showConvertAccountSheet = true }) {
                                HStack(spacing: QMDesign.Spacing.sm) {
                                    Image(systemName: "person.badge.plus")
                                    Text(String(localized: "settings.account.createAccount"))
                                }
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, QMDesign.Spacing.md)
                                .background(
                                    RoundedRectangle(cornerRadius: QMDesign.Radius.md)
                                        .fill(QMDesign.Colors.primaryGradient)
                                )
                                .foregroundColor(.white)
                            }
                            .buttonStyle(.plain)
                        }
                    }
                    .sheet(isPresented: $showConvertAccountSheet) {
                        UpgradeAccountView()
                    }
                }

                // Connected Account Card
                SettingsCard(title: String(localized: "settings.account.connectedAccount"), icon: "person.crop.circle.fill") {
                    VStack(spacing: QMDesign.Spacing.md) {
                        HStack(spacing: QMDesign.Spacing.md) {
                            // Avatar
                            ZStack {
                                Circle()
                                    .fill(QMDesign.Colors.primaryGradient)
                                    .frame(width: 48, height: 48)
                                Text(String(user.displayName.prefix(1)).uppercased())
                                    .font(.system(size: 20, weight: .bold))
                                    .foregroundColor(.white)
                            }

                            VStack(alignment: .leading, spacing: 2) {
                                Text(user.displayName)
                                    .font(QMDesign.Typography.bodyMedium)
                                    .foregroundColor(QMDesign.Colors.textPrimary)
                                HStack(spacing: QMDesign.Spacing.xs) {
                                    Text(user.email)
                                        .font(QMDesign.Typography.caption)
                                        .foregroundColor(QMDesign.Colors.textSecondary)
                                    if let method = user.authMethodLabel {
                                        Text(String(localized: "settings.account.via \(method)"))
                                            .font(QMDesign.Typography.captionSmall)
                                            .foregroundColor(QMDesign.Colors.textTertiary)
                                            .padding(.horizontal, 6)
                                            .padding(.vertical, 2)
                                            .background(
                                                Capsule()
                                                    .fill(QMDesign.Colors.surfaceLight)
                                            )
                                    }
                                }
                            }

                            Spacer()

                            // Status badge
                            HStack(spacing: 4) {
                                Circle()
                                    .fill(QMDesign.Colors.success)
                                    .frame(width: 8, height: 8)
                                Text(String(localized: "settings.account.connected"))
                                    .font(QMDesign.Typography.captionSmall)
                                    .foregroundColor(QMDesign.Colors.success)
                            }
                        }

                        Divider()
                            .background(QMDesign.Colors.borderSubtle)

                        // Sign out button
                        Button(action: { showLogoutConfirmation = true }) {
                            HStack {
                                Image(systemName: "rectangle.portrait.and.arrow.right")
                                Text(String(localized: "settings.account.signOut"))
                            }
                            .font(QMDesign.Typography.bodySmall)
                            .foregroundColor(QMDesign.Colors.error)
                        }
                        .buttonStyle(.plain)
                    }
                }

                // Subscription Card
                SettingsCard(title: String(localized: "settings.account.subscription"), icon: "crown.fill") {
                    VStack(spacing: QMDesign.Spacing.md) {
                        HStack {
                            VStack(alignment: .leading, spacing: 4) {
                                HStack(spacing: QMDesign.Spacing.sm) {
                                    Text(licenseManager.currentLicense.plan.rawValue)
                                        .font(QMDesign.Typography.headline)
                                        .foregroundStyle(licenseManager.isPro ? AnyShapeStyle(QMDesign.Colors.primaryGradient) : AnyShapeStyle(QMDesign.Colors.textPrimary))

                                    if licenseManager.isTrialing, let days = licenseManager.trialDaysRemaining {
                                        Text(String(localized: "settings.account.daysLeft \(days)"))
                                            .font(QMDesign.Typography.captionSmall)
                                            .foregroundColor(QMDesign.Colors.warning)
                                            .padding(.horizontal, 6)
                                            .padding(.vertical, 2)
                                            .background(
                                                Capsule()
                                                    .fill(QMDesign.Colors.warning.opacity(0.1))
                                            )
                                    }
                                }

                                Text(licenseManager.isPro ? String(localized: "settings.account.allFeaturesUnlocked") : String(localized: "settings.account.upgradeForAccess"))
                                    .font(QMDesign.Typography.caption)
                                    .foregroundColor(QMDesign.Colors.textSecondary)
                            }

                            Spacer()

                            if !licenseManager.isPro {
                                Button(action: { showUpgradeSheet = true }) {
                                    Text(String(localized: "settings.account.upgrade"))
                                        .font(QMDesign.Typography.labelSmall)
                                        .foregroundColor(.white)
                                        .padding(.horizontal, QMDesign.Spacing.md)
                                        .padding(.vertical, QMDesign.Spacing.sm)
                                        .background(
                                            Capsule()
                                                .fill(QMDesign.Colors.primaryGradient)
                                        )
                                }
                                .buttonStyle(.plain)
                            }
                        }

                        // Usage stats for free users
                        if !licenseManager.isPro {
                            Divider()
                                .background(QMDesign.Colors.borderSubtle)

                            VStack(spacing: QMDesign.Spacing.sm) {
                                if let remaining = licenseManager.remainingUses(for: .smartMode) {
                                    UsageLimitBanner(
                                        feature: String(localized: "settings.account.smartMode"),
                                        used: licenseManager.smartModeUsedToday,
                                        limit: licenseManager.currentLicense.features.smartModeLimit ?? 5
                                    )
                                }
                            }
                        }
                    }
                }
            } else if let response = deviceCodeResponse {
                // Device Code Display Card
                SettingsCard(title: String(localized: "settings.account.enterCode"), icon: "number.circle.fill") {
                    VStack(spacing: QMDesign.Spacing.md) {
                        HStack(spacing: QMDesign.Spacing.sm) {
                            Image(systemName: "safari")
                                .foregroundStyle(QMDesign.Colors.primaryGradient)
                            Text(String(localized: "settings.account.browserOpenedEnterCode"))
                                .font(QMDesign.Typography.caption)
                                .foregroundColor(QMDesign.Colors.textSecondary)
                        }

                        // Code display
                        VStack(spacing: QMDesign.Spacing.sm) {
                            HStack(spacing: QMDesign.Spacing.xs) {
                                ForEach(Array(response.userCode), id: \.self) { char in
                                    SettingsCodeCharView(char: char)
                                }
                            }

                            // Copy button
                            Button(action: { copyCode(response.userCode) }) {
                                HStack(spacing: QMDesign.Spacing.xs) {
                                    Image(systemName: showCopied ? "checkmark" : "doc.on.doc")
                                    Text(showCopied ? String(localized: "settings.account.copied") : String(localized: "settings.account.copyCode"))
                                }
                                .font(QMDesign.Typography.captionSmall)
                                .foregroundColor(showCopied ? QMDesign.Colors.success : QMDesign.Colors.textSecondary)
                            }
                            .buttonStyle(.plain)
                        }

                        // Open link manually
                        if let verificationURL = URL(string: response.verificationUrl) {
                            Link(destination: verificationURL) {
                                HStack(spacing: QMDesign.Spacing.xs) {
                                    Image(systemName: "arrow.up.right.square")
                                    Text(String(localized: "settings.account.openLinkManually"))
                                }
                                .font(QMDesign.Typography.captionSmall)
                                .foregroundStyle(QMDesign.Colors.primaryGradient)
                            }
                        }

                        HStack(spacing: QMDesign.Spacing.sm) {
                            ProgressView()
                                .scaleEffect(0.7)
                            Text(String(localized: "settings.account.waitingForAuthorization"))
                                .font(QMDesign.Typography.caption)
                                .foregroundColor(QMDesign.Colors.textSecondary)
                        }

                        Button(action: cancelDeviceCode) {
                            Text(String(localized: "settings.account.cancel"))
                                .font(QMDesign.Typography.bodySmall)
                                .foregroundColor(QMDesign.Colors.textSecondary)
                        }
                        .buttonStyle(.plain)
                    }
                }
            } else {
                // Not Connected Card
                SettingsCard(title: String(localized: "settings.account.notConnected"), icon: "person.crop.circle.badge.xmark") {
                    VStack(spacing: QMDesign.Spacing.md) {
                        Text(String(localized: "settings.account.signInPrompt"))
                            .font(QMDesign.Typography.bodySmall)
                            .foregroundColor(QMDesign.Colors.textSecondary)

                        // Error message
                        if let error = connectionError {
                            HStack(spacing: QMDesign.Spacing.xs) {
                                Image(systemName: "exclamationmark.circle.fill")
                                Text(error)
                            }
                            .font(QMDesign.Typography.caption)
                            .foregroundColor(QMDesign.Colors.error)
                            .padding(QMDesign.Spacing.sm)
                            .frame(maxWidth: .infinity)
                            .background(
                                RoundedRectangle(cornerRadius: QMDesign.Radius.sm)
                                    .fill(QMDesign.Colors.error.opacity(0.1))
                            )
                        }

                        Button(action: startDeviceCodeFlow) {
                            HStack(spacing: QMDesign.Spacing.sm) {
                                if isConnecting {
                                    ProgressView()
                                        .scaleEffect(0.8)
                                        .progressViewStyle(CircularProgressViewStyle(tint: .white))
                                } else {
                                    Image(systemName: "arrow.up.right.square")
                                }
                                Text(isConnecting ? String(localized: "settings.account.openingBrowser") : String(localized: "settings.account.connectAccount"))
                            }
                            .font(QMDesign.Typography.labelMedium)
                            .foregroundColor(.white)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, QMDesign.Spacing.md)
                            .background(
                                RoundedRectangle(cornerRadius: QMDesign.Radius.md)
                                    .fill(QMDesign.Colors.primaryGradient)
                            )
                        }
                        .buttonStyle(.plain)
                        .disabled(isConnecting)

                        Text(String(localized: "settings.account.worksWithProviders"))
                            .font(QMDesign.Typography.captionSmall)
                            .foregroundColor(QMDesign.Colors.textTertiary)
                    }
                }
            }
        }
        .alert(String(localized: "settings.account.signOut"), isPresented: $showLogoutConfirmation) {
            Button(String(localized: "settings.account.cancel"), role: .cancel) { }
            Button(String(localized: "settings.account.signOut"), role: .destructive) {
                Task {
                    await authManager.logout()
                }
            }
        } message: {
            Text(String(localized: "settings.account.signOutConfirmation"))
        }
        .sheet(isPresented: $showUpgradeSheet) {
            UpgradePromptView()
        }
        .onChange(of: authManager.authState) { oldState, newState in
            // Clear device code when authenticated
            if case .authenticated = newState {
                deviceCodeResponse = nil
                isConnecting = false
            }
        }
    }

    private func startDeviceCodeFlow() {
        isConnecting = true
        connectionError = nil

        Task {
            do {
                let response = try await authManager.startDeviceCodeFlow()
                deviceCodeResponse = response

                // Auto-open browser
                if let url = URL(string: response.verificationUrl) {
                    NSWorkspace.shared.open(url)
                }
            } catch {
                connectionError = AuthError.friendlyMessage(from: error)
            }
            isConnecting = false
        }
    }

    private func cancelDeviceCode() {
        authManager.cancelDeviceCodeFlow()
        deviceCodeResponse = nil
    }

    private func copyCode(_ code: String) {
        NSPasteboard.general.clearContents()
        NSPasteboard.general.setString(code, forType: .string)
        showCopied = true

        // Reset after 2 seconds
        DispatchQueue.main.asyncAfter(deadline: .now() + 2) {
            showCopied = false
        }
    }
}

// MARK: - Settings Code Character View

private struct SettingsCodeCharView: View {
    let char: Character

    var body: some View {
        let isDash = char == "-"

        Text(String(char))
            .font(.system(size: 20, weight: .bold, design: .monospaced))
            .foregroundStyle(isDash ? AnyShapeStyle(QMDesign.Colors.textTertiary) : AnyShapeStyle(QMDesign.Colors.primaryGradient))
            .frame(width: isDash ? 12 : 28, height: 36)
            .background(
                Group {
                    if isDash {
                        Color.clear
                    } else {
                        RoundedRectangle(cornerRadius: QMDesign.Radius.sm)
                            .fill(QMDesign.Colors.surfaceLight)
                    }
                }
            )
    }
}
