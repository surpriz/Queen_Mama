import SwiftUI

/// Modal view prompting user to upgrade to PRO
struct UpgradePromptView: View {
    @Environment(\.dismiss) private var dismiss
    @StateObject private var licenseManager = LicenseManager.shared

    let feature: String?
    let onUpgrade: (() -> Void)?

    init(feature: String? = nil, onUpgrade: (() -> Void)? = nil) {
        self.feature = feature
        self.onUpgrade = onUpgrade
    }

    var body: some View {
        VStack(spacing: QMDesign.Spacing.xl) {
            // Header
            VStack(spacing: QMDesign.Spacing.md) {
                // Icon
                ZStack {
                    Circle()
                        .fill(QMDesign.Colors.primaryGradient)
                        .frame(width: 64, height: 64)

                    Image(systemName: "crown.fill")
                        .font(.system(size: 28))
                        .foregroundColor(.white)
                }

                Text("Upgrade to PRO")
                    .font(QMDesign.Typography.titleMedium)
                    .foregroundColor(QMDesign.Colors.textPrimary)

                if let feature = feature {
                    Text("\"\(feature)\" requires a PRO subscription")
                        .font(QMDesign.Typography.bodySmall)
                        .foregroundColor(QMDesign.Colors.textSecondary)
                        .multilineTextAlignment(.center)
                }
            }

            // Benefits
            VStack(alignment: .leading, spacing: QMDesign.Spacing.sm) {
                ProBenefitRow(icon: "sparkles", text: "Unlimited Smart Mode")
                ProBenefitRow(icon: "folder.badge.plus", text: "Create custom AI modes")
                ProBenefitRow(icon: "bolt.fill", text: "Auto-Answer feature")
                ProBenefitRow(icon: "doc.richtext", text: "Export to Markdown & JSON")
                ProBenefitRow(icon: "icloud.and.arrow.up", text: "Cloud session sync")
                ProBenefitRow(icon: "infinity", text: "Unlimited AI requests")
            }
            .padding(QMDesign.Spacing.lg)
            .background(
                RoundedRectangle(cornerRadius: QMDesign.Radius.lg)
                    .fill(QMDesign.Colors.surfaceLight)
            )

            // Price
            VStack(spacing: QMDesign.Spacing.xs) {
                HStack(alignment: .firstTextBaseline, spacing: 2) {
                    Text("$19")
                        .font(.system(size: 36, weight: .bold))
                        .foregroundStyle(QMDesign.Colors.primaryGradient)
                    Text("/month")
                        .font(QMDesign.Typography.bodySmall)
                        .foregroundColor(QMDesign.Colors.textSecondary)
                }

                Text("14-day free trial included")
                    .font(QMDesign.Typography.caption)
                    .foregroundColor(QMDesign.Colors.textTertiary)
            }

            // Actions
            VStack(spacing: QMDesign.Spacing.sm) {
                Button(action: handleUpgrade) {
                    HStack(spacing: QMDesign.Spacing.sm) {
                        Text("Upgrade Now")
                            .font(QMDesign.Typography.labelMedium)
                        Image(systemName: "arrow.right")
                            .font(.system(size: 14, weight: .semibold))
                    }
                    .foregroundColor(.white)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, QMDesign.Spacing.md)
                    .background(
                        RoundedRectangle(cornerRadius: QMDesign.Radius.lg)
                            .fill(QMDesign.Colors.primaryGradient)
                    )
                }
                .buttonStyle(.plain)

                Button(action: { dismiss() }) {
                    Text("Maybe Later")
                        .font(QMDesign.Typography.bodySmall)
                        .foregroundColor(QMDesign.Colors.textSecondary)
                }
                .buttonStyle(.plain)
            }
        }
        .padding(QMDesign.Spacing.xl)
        .frame(width: 380)
        .background(
            RoundedRectangle(cornerRadius: QMDesign.Radius.xl)
                .fill(QMDesign.Colors.surfaceMedium)
                .overlay(
                    RoundedRectangle(cornerRadius: QMDesign.Radius.xl)
                        .stroke(QMDesign.Colors.borderSubtle, lineWidth: 1)
                )
        )
    }

    private func handleUpgrade() {
        // Open billing page in browser
        if let url = URL(string: "https://queenmama.app/dashboard/billing") {
            NSWorkspace.shared.open(url)
        }
        onUpgrade?()
        dismiss()
    }
}

// MARK: - Benefit Row

private struct ProBenefitRow: View {
    let icon: String
    let text: String

    var body: some View {
        HStack(spacing: QMDesign.Spacing.sm) {
            Image(systemName: icon)
                .font(.system(size: 14))
                .foregroundStyle(QMDesign.Colors.primaryGradient)
                .frame(width: 24)

            Text(text)
                .font(QMDesign.Typography.bodySmall)
                .foregroundColor(QMDesign.Colors.textPrimary)

            Spacer()

            Image(systemName: "checkmark")
                .font(.system(size: 12, weight: .semibold))
                .foregroundColor(QMDesign.Colors.success)
        }
    }
}

// MARK: - Preview

#Preview {
    ZStack {
        Color.black.ignoresSafeArea()
        UpgradePromptView(feature: "Auto-Answer")
    }
}
