//
//  FreeWelcomeBannerView.swift
//  QueenMama
//
//  Persistent dashboard banner for FREE plan users showing limitations and upgrade path
//

import SwiftUI

struct FreeWelcomeBannerView: View {
    @ObservedObject private var licenseManager = LicenseManager.shared
    @AppStorage("freeWelcomeBannerDismissed") private var isDismissed = false
    @State private var showPricingSheet = false
    @State private var isHoveringCTA = false

    var body: some View {
        if !isDismissed && !licenseManager.isPro && !licenseManager.isValidating {
            VStack(spacing: 0) {
                HStack(spacing: QMDesign.Spacing.md) {
                    // Icon
                    ZStack {
                        Circle()
                            .fill(QMDesign.Colors.accent.opacity(0.15))
                            .frame(width: 36, height: 36)
                        Image(systemName: "sparkles")
                            .font(.system(size: 16))
                            .foregroundStyle(QMDesign.Colors.primaryGradient)
                    }

                    // Message
                    VStack(alignment: .leading, spacing: 2) {
                        Text(String(localized: "free.banner.title"))
                            .font(QMDesign.Typography.bodySmall)
                            .fontWeight(.semibold)
                            .foregroundColor(QMDesign.Colors.textPrimary)

                        Text(String(localized: "free.banner.subtitle"))
                            .font(QMDesign.Typography.captionSmall)
                            .foregroundColor(QMDesign.Colors.textSecondary)
                    }

                    Spacer()

                    // CTA
                    Button(action: { showPricingSheet = true }) {
                        HStack(spacing: QMDesign.Spacing.xs) {
                            Image(systemName: "crown.fill")
                                .font(.system(size: 11))
                            Text(String(localized: "free.banner.cta"))
                                .font(QMDesign.Typography.labelSmall)
                        }
                        .foregroundColor(.white)
                        .padding(.horizontal, QMDesign.Spacing.md)
                        .padding(.vertical, QMDesign.Spacing.xs)
                        .background(
                            Capsule()
                                .fill(QMDesign.Colors.primaryGradient)
                        )
                        .scaleEffect(isHoveringCTA ? 1.05 : 1.0)
                    }
                    .buttonStyle(.plain)
                    .onHover { isHoveringCTA = $0 }
                    .animation(QMDesign.Animation.quick, value: isHoveringCTA)

                    // Dismiss
                    Button(action: { withAnimation(QMDesign.Animation.standard) { isDismissed = true } }) {
                        Image(systemName: "xmark")
                            .font(.system(size: 10, weight: .semibold))
                            .foregroundColor(QMDesign.Colors.textTertiary)
                            .frame(width: 20, height: 20)
                    }
                    .buttonStyle(.plain)
                    .help(String(localized: "free.banner.dismiss"))
                }
                .padding(.horizontal, QMDesign.Spacing.lg)
                .padding(.vertical, QMDesign.Spacing.md)
                .background(
                    Rectangle()
                        .fill(QMDesign.Colors.accent.opacity(0.06))
                )
                .overlay(
                    Rectangle()
                        .frame(height: 1)
                        .foregroundColor(QMDesign.Colors.accent.opacity(0.15)),
                    alignment: .bottom
                )
            }
            .transition(.move(edge: .top).combined(with: .opacity))
            .sheet(isPresented: $showPricingSheet) {
                PricingView()
            }
        }
    }
}

// MARK: - Preview

#Preview {
    VStack(spacing: 0) {
        FreeWelcomeBannerView()
        Spacer()
    }
    .frame(width: 600, height: 400)
    .background(QMDesign.Colors.backgroundPrimary)
}
