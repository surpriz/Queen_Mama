//
//  SyncSettingsView.swift
//  QueenMama
//
//  Advanced › Sync.
//

import SwiftUI

// MARK: - Modern Sync Settings

struct ModernSyncSettingsView: View {
    @StateObject private var authManager = AuthenticationManager.shared
    @StateObject private var licenseManager = LicenseManager.shared
    @StateObject private var syncManager = SyncManager.shared

    var body: some View {
        VStack(spacing: QMDesign.Spacing.lg) {
            // Header
            SettingsSectionHeader(
                title: String(localized: "settings.sync.title"),
                subtitle: String(localized: "settings.sync.subtitle")
            )

            if !authManager.isAuthenticated {
                // Not signed in - direct to Account section
                SettingsCard(title: String(localized: "settings.sync.signInRequired"), icon: "person.crop.circle.badge.xmark") {
                    VStack(spacing: QMDesign.Spacing.md) {
                        Text(String(localized: "settings.sync.connectAccountPrompt"))
                            .font(QMDesign.Typography.bodySmall)
                            .foregroundColor(QMDesign.Colors.textSecondary)
                            .multilineTextAlignment(.center)

                        HStack(spacing: QMDesign.Spacing.xs) {
                            Image(systemName: "arrow.left")
                            Text(String(localized: "settings.sync.goToAccount"))
                        }
                        .font(QMDesign.Typography.caption)
                        .foregroundStyle(QMDesign.Colors.primaryGradient)
                    }
                }
            } else if !licenseManager.isFeatureAvailable(.sessionSync) {
                // PRO required
                ProFeatureBanner(
                    feature: String(localized: "settings.sync.sessionSync"),
                    description: String(localized: "settings.sync.sessionSync.description")
                )
            } else {
                // Sync Status Card
                SettingsCard(title: String(localized: "settings.sync.syncStatus"), icon: "arrow.triangle.2.circlepath") {
                    VStack(spacing: QMDesign.Spacing.md) {
                        // Status row
                        HStack {
                            VStack(alignment: .leading, spacing: 4) {
                                HStack(spacing: QMDesign.Spacing.sm) {
                                    Circle()
                                        .fill(syncManager.isSyncing ? QMDesign.Colors.warning : (syncManager.isOffline ? QMDesign.Colors.error : QMDesign.Colors.success))
                                        .frame(width: 8, height: 8)

                                    Text(statusText)
                                        .font(QMDesign.Typography.bodyMedium)
                                        .foregroundColor(QMDesign.Colors.textPrimary)
                                }

                                if let lastSync = syncManager.lastSyncAt {
                                    Text(String(localized: "settings.sync.lastSync")) + Text(" ") + Text(lastSync, style: .relative)
                                        .font(QMDesign.Typography.caption)
                                        .foregroundColor(QMDesign.Colors.textTertiary)
                                }
                            }

                            Spacer()

                            if syncManager.isSyncing {
                                ProgressView()
                                    .scaleEffect(0.8)
                            }
                        }

                        // Pending count
                        if syncManager.pendingCount > 0 {
                            HStack {
                                Image(systemName: "clock.arrow.circlepath")
                                    .foregroundStyle(QMDesign.Colors.primaryGradient)
                                Text(String(localized: "settings.sync.pendingSync \(syncManager.pendingCount)"))
                                    .font(QMDesign.Typography.caption)
                                    .foregroundColor(QMDesign.Colors.textSecondary)
                                Spacer()
                            }
                            .padding(QMDesign.Spacing.sm)
                            .background(
                                RoundedRectangle(cornerRadius: QMDesign.Radius.md)
                                    .fill(QMDesign.Colors.accent.opacity(0.05))
                            )
                        }

                        // Error message
                        if let error = syncManager.lastError {
                            HStack(alignment: .top, spacing: QMDesign.Spacing.sm) {
                                Image(systemName: "exclamationmark.triangle.fill")
                                    .foregroundColor(QMDesign.Colors.error)
                                Text(error)
                                    .font(QMDesign.Typography.caption)
                                    .foregroundColor(QMDesign.Colors.error)
                            }
                            .padding(QMDesign.Spacing.sm)
                            .background(
                                RoundedRectangle(cornerRadius: QMDesign.Radius.md)
                                    .fill(QMDesign.Colors.error.opacity(0.1))
                            )
                        }

                        Divider()
                            .background(QMDesign.Colors.borderSubtle)

                        // Sync button
                        Button(action: syncNow) {
                            HStack(spacing: QMDesign.Spacing.sm) {
                                Image(systemName: "arrow.triangle.2.circlepath")
                                Text(String(localized: "settings.sync.syncNow"))
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
                        .disabled(syncManager.isSyncing)
                    }
                }

                // Dashboard Link
                SettingsCard(title: String(localized: "settings.sync.viewOnDashboard"), icon: "globe") {
                    VStack(spacing: QMDesign.Spacing.md) {
                        Text(String(localized: "settings.sync.viewOnDashboard.description"))
                            .font(QMDesign.Typography.bodySmall)
                            .foregroundColor(QMDesign.Colors.textSecondary)

                        Button(action: openDashboard) {
                            HStack(spacing: QMDesign.Spacing.sm) {
                                Text(String(localized: "settings.sync.openDashboard"))
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
    }

    private var statusText: String {
        if syncManager.isSyncing {
            return String(localized: "settings.sync.status.syncing")
        } else if syncManager.isOffline {
            return String(localized: "settings.sync.status.offline")
        } else if syncManager.pendingCount > 0 {
            return String(localized: "settings.sync.status.pending")
        } else {
            return String(localized: "settings.sync.status.upToDate")
        }
    }

    private func syncNow() {
        Task {
            await syncManager.syncNow()
        }
    }

    private func openDashboard() {
        Task {
            do {
                let response = try await AuthAPIClient.shared.generateMagicLink(redirect: "/dashboard/sessions")
                if let url = URL(string: response.url) {
                    NSWorkspace.shared.open(url)
                }
            } catch {
                // Fallback to plain URL if magic link generation fails
                NSWorkspace.shared.open(URLConfigManager.shared.dashboardSessionsURL)
            }
        }
    }
}
