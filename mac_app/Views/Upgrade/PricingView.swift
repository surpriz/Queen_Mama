//
//  PricingView.swift
//  QueenMama
//
//  Side-by-side plan comparison for FREE → PRO / ENTERPRISE conversion
//

import SwiftUI

struct PricingView: View {
    @Environment(\.dismiss) private var dismiss
    @ObservedObject private var licenseManager = LicenseManager.shared
    @State private var isLoadingPro = false
    @State private var isLoadingEnterprise = false

    /// Optional context message shown at the top (e.g. "You've reached your daily limit")
    let contextMessage: String?

    init(contextMessage: String? = nil) {
        self.contextMessage = contextMessage
    }

    var body: some View {
        VStack(spacing: QMDesign.Spacing.lg) {
            // Context banner (when triggered by a limit/gate)
            if let message = contextMessage {
                HStack(spacing: QMDesign.Spacing.sm) {
                    Image(systemName: "exclamationmark.circle.fill")
                        .font(.system(size: 14))
                        .foregroundColor(QMDesign.Colors.warning)
                    Text(message)
                        .font(QMDesign.Typography.bodySmall)
                        .foregroundColor(QMDesign.Colors.textSecondary)
                }
                .padding(QMDesign.Spacing.sm)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(
                    RoundedRectangle(cornerRadius: QMDesign.Radius.md)
                        .fill(QMDesign.Colors.warning.opacity(0.1))
                )
            }

            // Header
            VStack(spacing: QMDesign.Spacing.sm) {
                ZStack {
                    Circle()
                        .fill(QMDesign.Colors.primaryGradient)
                        .frame(width: 52, height: 52)
                    Image(systemName: "crown.fill")
                        .font(.system(size: 22))
                        .foregroundColor(.white)
                }

                Text(String(localized: "pricing.title"))
                    .font(QMDesign.Typography.titleMedium)
                    .foregroundColor(QMDesign.Colors.textPrimary)

                Text(String(localized: "pricing.subtitle"))
                    .font(QMDesign.Typography.bodySmall)
                    .foregroundColor(QMDesign.Colors.textTertiary)
            }

            // Plan columns
            HStack(alignment: .top, spacing: QMDesign.Spacing.md) {
                // FREE column
                PlanColumn(
                    planName: String(localized: "pricing.plan.free"),
                    price: String(localized: "pricing.price.free"),
                    priceSubtitle: "",
                    features: freeFeatures,
                    accentColor: QMDesign.Colors.textTertiary,
                    isCurrent: !licenseManager.isPro,
                    isRecommended: false,
                    ctaLabel: String(localized: "pricing.cta.currentPlan"),
                    ctaEnabled: false,
                    isLoading: false,
                    onUpgrade: {}
                )

                // PRO column (recommended)
                PlanColumn(
                    planName: String(localized: "pricing.plan.pro"),
                    price: "$19",
                    priceSubtitle: String(localized: "pricing.price.perMonth"),
                    features: proFeatures,
                    accentColor: QMDesign.Colors.accent,
                    isCurrent: licenseManager.currentLicense.plan == .pro,
                    isRecommended: true,
                    ctaLabel: String(localized: "pricing.cta.upgradePro"),
                    ctaEnabled: !licenseManager.isPro,
                    isLoading: isLoadingPro,
                    onUpgrade: { handleUpgrade(plan: "pro") }
                )

                // ENTERPRISE column
                PlanColumn(
                    planName: String(localized: "pricing.plan.enterprise"),
                    price: "$49",
                    priceSubtitle: String(localized: "pricing.price.perMonth"),
                    features: enterpriseFeatures,
                    accentColor: QMDesign.Colors.warning,
                    isCurrent: licenseManager.isEnterprise,
                    isRecommended: false,
                    ctaLabel: String(localized: "pricing.cta.upgradeEnterprise"),
                    ctaEnabled: !licenseManager.isEnterprise,
                    isLoading: isLoadingEnterprise,
                    onUpgrade: { handleUpgrade(plan: "enterprise") }
                )
            }

            // Dismiss
            Button(action: { dismiss() }) {
                Text(String(localized: "pricing.cta.maybeLater"))
                    .font(QMDesign.Typography.bodySmall)
                    .foregroundColor(QMDesign.Colors.textTertiary)
            }
            .buttonStyle(.plain)
        }
        .padding(QMDesign.Spacing.xl)
        .frame(width: 680)
        .background(
            RoundedRectangle(cornerRadius: QMDesign.Radius.xl)
                .fill(QMDesign.Colors.backgroundSecondary)
                .overlay(
                    RoundedRectangle(cornerRadius: QMDesign.Radius.xl)
                        .stroke(QMDesign.Colors.borderSubtle, lineWidth: 1)
                )
        )
    }

    // MARK: - Feature Lists

    private var freeFeatures: [PlanFeature] {
        [
            PlanFeature(name: String(localized: "pricing.feature.aiRequests"), detail: String(localized: "pricing.feature.aiRequests.free"), available: true),
            PlanFeature(name: String(localized: "pricing.feature.customModes"), detail: nil, available: false),
            PlanFeature(name: String(localized: "pricing.feature.cloudSync"), detail: nil, available: false),
            PlanFeature(name: String(localized: "pricing.feature.export"), detail: nil, available: false),
            PlanFeature(name: String(localized: "pricing.feature.smartMode"), detail: nil, available: false),
            PlanFeature(name: String(localized: "pricing.feature.autoAnswer"), detail: nil, available: false),
            PlanFeature(name: String(localized: "pricing.feature.undetectable"), detail: nil, available: false),
            PlanFeature(name: String(localized: "pricing.feature.contextIntel"), detail: nil, available: false),
        ]
    }

    private var proFeatures: [PlanFeature] {
        [
            PlanFeature(name: String(localized: "pricing.feature.aiRequests"), detail: String(localized: "pricing.feature.unlimited"), available: true),
            PlanFeature(name: String(localized: "pricing.feature.customModes"), detail: nil, available: true),
            PlanFeature(name: String(localized: "pricing.feature.cloudSync"), detail: nil, available: true),
            PlanFeature(name: String(localized: "pricing.feature.export"), detail: nil, available: true),
            PlanFeature(name: String(localized: "pricing.feature.smartMode"), detail: nil, available: false),
            PlanFeature(name: String(localized: "pricing.feature.autoAnswer"), detail: nil, available: false),
            PlanFeature(name: String(localized: "pricing.feature.undetectable"), detail: nil, available: false),
            PlanFeature(name: String(localized: "pricing.feature.contextIntel"), detail: nil, available: false),
        ]
    }

    private var enterpriseFeatures: [PlanFeature] {
        [
            PlanFeature(name: String(localized: "pricing.feature.aiRequests"), detail: String(localized: "pricing.feature.unlimited"), available: true),
            PlanFeature(name: String(localized: "pricing.feature.customModes"), detail: nil, available: true),
            PlanFeature(name: String(localized: "pricing.feature.cloudSync"), detail: nil, available: true),
            PlanFeature(name: String(localized: "pricing.feature.export"), detail: nil, available: true),
            PlanFeature(name: String(localized: "pricing.feature.smartMode"), detail: nil, available: true),
            PlanFeature(name: String(localized: "pricing.feature.autoAnswer"), detail: nil, available: true),
            PlanFeature(name: String(localized: "pricing.feature.undetectable"), detail: nil, available: true),
            PlanFeature(name: String(localized: "pricing.feature.contextIntel"), detail: nil, available: true),
        ]
    }

    // MARK: - Upgrade Action

    private func handleUpgrade(plan: String) {
        if plan == "pro" {
            isLoadingPro = true
        } else {
            isLoadingEnterprise = true
        }

        Task {
            do {
                let response = try await AuthAPIClient.shared.generateMagicLink(redirect: "/dashboard/billing")
                if let url = URL(string: response.url) {
                    NSWorkspace.shared.open(url)
                }
            } catch {
                #if DEBUG
                let fallbackUrl = "http://localhost:3000/dashboard/billing"
                #else
                let fallbackUrl = "https://www.queenmama.co/dashboard/billing"
                #endif
                if let url = URL(string: fallbackUrl) {
                    NSWorkspace.shared.open(url)
                }
            }

            await MainActor.run {
                isLoadingPro = false
                isLoadingEnterprise = false
                dismiss()
            }
        }
    }
}

// MARK: - Plan Feature Model

private struct PlanFeature: Identifiable {
    let id = UUID()
    let name: String
    let detail: String?  // Optional detail text (e.g. "1 per day", "Unlimited")
    let available: Bool
}

// MARK: - Plan Column

private struct PlanColumn: View {
    let planName: String
    let price: String
    let priceSubtitle: String
    let features: [PlanFeature]
    let accentColor: Color
    let isCurrent: Bool
    let isRecommended: Bool
    let ctaLabel: String
    let ctaEnabled: Bool
    let isLoading: Bool
    let onUpgrade: () -> Void

    @State private var isHoveringCTA = false

    var body: some View {
        VStack(spacing: QMDesign.Spacing.md) {
            // Plan header
            VStack(spacing: QMDesign.Spacing.xs) {
                if isRecommended {
                    Text(String(localized: "pricing.recommended"))
                        .font(.system(size: 9, weight: .bold))
                        .foregroundColor(.white)
                        .padding(.horizontal, QMDesign.Spacing.xs)
                        .padding(.vertical, 2)
                        .background(
                            Capsule()
                                .fill(QMDesign.Colors.primaryGradient)
                        )
                } else if isCurrent {
                    Text(String(localized: "pricing.cta.currentPlan"))
                        .font(.system(size: 9, weight: .bold))
                        .foregroundColor(QMDesign.Colors.textTertiary)
                        .padding(.horizontal, QMDesign.Spacing.xs)
                        .padding(.vertical, 2)
                        .background(
                            Capsule()
                                .fill(QMDesign.Colors.surfaceMedium)
                        )
                }

                Text(planName)
                    .font(QMDesign.Typography.headline)
                    .foregroundColor(QMDesign.Colors.textPrimary)

                HStack(alignment: .firstTextBaseline, spacing: 2) {
                    Text(price)
                        .font(.system(size: 28, weight: .bold))
                        .foregroundStyle(isRecommended ? AnyShapeStyle(QMDesign.Colors.primaryGradient) : AnyShapeStyle(accentColor))
                    if !priceSubtitle.isEmpty {
                        Text(priceSubtitle)
                            .font(QMDesign.Typography.captionSmall)
                            .foregroundColor(QMDesign.Colors.textTertiary)
                    }
                }
            }

            Divider()

            // Features list
            VStack(alignment: .leading, spacing: QMDesign.Spacing.xs) {
                ForEach(features) { feature in
                    HStack(spacing: QMDesign.Spacing.xs) {
                        if feature.available {
                            Image(systemName: "checkmark")
                                .font(.system(size: 10, weight: .bold))
                                .foregroundColor(QMDesign.Colors.success)
                        } else {
                            Image(systemName: "minus")
                                .font(.system(size: 10, weight: .bold))
                                .foregroundColor(QMDesign.Colors.textDisabled)
                        }

                        VStack(alignment: .leading, spacing: 0) {
                            Text(feature.name)
                                .font(QMDesign.Typography.captionSmall)
                                .foregroundColor(feature.available ? QMDesign.Colors.textSecondary : QMDesign.Colors.textDisabled)
                            if let detail = feature.detail {
                                Text(detail)
                                    .font(.system(size: 9))
                                    .foregroundColor(feature.available ? accentColor : QMDesign.Colors.textDisabled)
                            }
                        }

                        Spacer()
                    }
                }
            }

            Spacer()

            // CTA Button
            if ctaEnabled {
                Button(action: onUpgrade) {
                    HStack(spacing: QMDesign.Spacing.xs) {
                        if isLoading {
                            ProgressView()
                                .scaleEffect(0.7)
                                .progressViewStyle(CircularProgressViewStyle(tint: .white))
                        }
                        Text(isLoading ? String(localized: "pricing.cta.opening") : ctaLabel)
                            .font(QMDesign.Typography.labelSmall)
                    }
                    .foregroundColor(.white)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, QMDesign.Spacing.sm)
                    .background(
                        RoundedRectangle(cornerRadius: QMDesign.Radius.md)
                            .fill(isRecommended ? AnyShapeStyle(QMDesign.Colors.primaryGradient) : AnyShapeStyle(accentColor))
                    )
                    .scaleEffect(isHoveringCTA ? 1.03 : 1.0)
                }
                .buttonStyle(.plain)
                .disabled(isLoading)
                .onHover { isHoveringCTA = $0 }
                .animation(QMDesign.Animation.quick, value: isHoveringCTA)
            } else {
                Text(ctaLabel)
                    .font(QMDesign.Typography.labelSmall)
                    .foregroundColor(QMDesign.Colors.textTertiary)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, QMDesign.Spacing.sm)
                    .background(
                        RoundedRectangle(cornerRadius: QMDesign.Radius.md)
                            .fill(QMDesign.Colors.surfaceLight)
                    )
            }
        }
        .padding(QMDesign.Spacing.md)
        .background(
            RoundedRectangle(cornerRadius: QMDesign.Radius.lg)
                .fill(isRecommended ? QMDesign.Colors.surfaceMedium : QMDesign.Colors.surfaceLight)
                .overlay(
                    RoundedRectangle(cornerRadius: QMDesign.Radius.lg)
                        .stroke(
                            isRecommended ? QMDesign.Colors.accent.opacity(0.4) : QMDesign.Colors.borderSubtle,
                            lineWidth: isRecommended ? 1.5 : 1
                        )
                )
        )
    }
}

// MARK: - Preview

#Preview {
    ZStack {
        Color.black.ignoresSafeArea()
        PricingView(contextMessage: "You've reached your daily AI request limit")
    }
}
