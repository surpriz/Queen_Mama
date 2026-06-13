import SwiftUI
import StoreKit

/// Native StoreKit 2 paywall. Replaces the previous web/Stripe upgrade flow
/// (App Store rule 3.1.1: digital goods must use in-app purchase).
struct PaywallView: View {
    @Environment(\.dismiss) private var dismiss
    @StateObject private var storeKit = StoreKitService.shared
    @StateObject private var licenseManager = LicenseManager.shared
    @State private var selectedProduct: Product?

    let feature: String?
    let onComplete: (() -> Void)?
    /// When true, always show the full tier/product list even if the account
    /// already has a non-Apple subscription. Used by the DEBUG paywall preview
    /// for App Store review screenshots.
    let previewMode: Bool

    init(feature: String? = nil, previewMode: Bool = false, onComplete: (() -> Void)? = nil) {
        self.feature = feature
        self.previewMode = previewMode
        self.onComplete = onComplete
    }

    var body: some View {
        VStack(spacing: QMDesign.Spacing.xl) {
            header

            if storeKit.hasNonAppleSubscription && !previewMode {
                existingSubscriptionNotice
            } else {
                benefits
                productPicker
                purchaseButton
                footer
            }
        }
        .padding(QMDesign.Spacing.xl)
        .background(
            RoundedRectangle(cornerRadius: QMDesign.Radius.xl)
                .fill(QMDesign.Colors.surfaceMedium)
                .overlay(
                    RoundedRectangle(cornerRadius: QMDesign.Radius.xl)
                        .stroke(QMDesign.Colors.borderSubtle, lineWidth: 1)
                )
        )
        .task {
            await storeKit.loadProducts()
            if selectedProduct == nil {
                selectedProduct = storeKit.products.first
            }
        }
        .onChange(of: storeKit.purchaseState) { _, state in
            if state == .success {
                onComplete?()
                dismiss()
                storeKit.resetPurchaseState()
            }
        }
    }

    // MARK: - Sections

    private var header: some View {
        VStack(spacing: QMDesign.Spacing.md) {
            ZStack {
                Circle()
                    .fill(QMDesign.Colors.primaryGradient)
                    .frame(width: 64, height: 64)

                Image(systemName: "crown.fill")
                    .font(.system(size: 28))
                    .foregroundColor(.white)
            }
            .accessibilityHidden(true)

            Text("Choose your plan")
                .font(QMDesign.Typography.titleMedium)
                .foregroundColor(QMDesign.Colors.textPrimary)

            if let feature = feature {
                Text("\"\(feature)\" requires an upgrade")
                    .font(QMDesign.Typography.bodySmall)
                    .foregroundColor(QMDesign.Colors.textSecondary)
                    .multilineTextAlignment(.center)
            }
        }
    }

    private var benefits: some View {
        VStack(alignment: .leading, spacing: QMDesign.Spacing.md) {
            VStack(alignment: .leading, spacing: QMDesign.Spacing.sm) {
                Text("PRO")
                    .font(QMDesign.Typography.labelSmall)
                    .foregroundStyle(QMDesign.Colors.primaryGradient)
                PaywallBenefitRow(icon: "folder.badge.plus", text: "Create custom AI modes")
                PaywallBenefitRow(icon: "icloud.and.arrow.up", text: "Cloud session sync")
                PaywallBenefitRow(icon: "doc.richtext", text: "Export to Markdown & JSON")
                PaywallBenefitRow(icon: "infinity", text: "Unlimited AI requests")
            }

            Divider().overlay(QMDesign.Colors.borderSubtle)

            VStack(alignment: .leading, spacing: QMDesign.Spacing.sm) {
                Text("ENTERPRISE — everything in Pro, plus:")
                    .font(QMDesign.Typography.labelSmall)
                    .foregroundColor(QMDesign.Colors.accent)
                PaywallBenefitRow(icon: "character.bubble", text: "Live DeepL translation")
                PaywallBenefitRow(icon: "brain.head.profile", text: "Smart Mode")
                PaywallBenefitRow(icon: "bolt.fill", text: "Auto-Answer & proactive suggestions")
                PaywallBenefitRow(icon: "sparkles", text: "Instant buffered responses")
            }
        }
        .padding(QMDesign.Spacing.lg)
        .background(
            RoundedRectangle(cornerRadius: QMDesign.Radius.lg)
                .fill(QMDesign.Colors.surfaceLight)
        )
    }

    @ViewBuilder
    private var productPicker: some View {
        if storeKit.isLoadingProducts {
            ProgressView()
                .padding(.vertical, QMDesign.Spacing.md)
        } else if storeKit.products.isEmpty {
            Text("Subscriptions are unavailable right now. Please try again later.")
                .font(QMDesign.Typography.bodySmall)
                .foregroundColor(QMDesign.Colors.textSecondary)
                .multilineTextAlignment(.center)
        } else {
            VStack(spacing: QMDesign.Spacing.sm) {
                ForEach(storeKit.products, id: \.id) { product in
                    ProductOptionRow(
                        product: product,
                        isSelected: selectedProduct?.id == product.id
                    ) {
                        selectedProduct = product
                    }
                }
            }
        }
    }

    private var purchaseButton: some View {
        VStack(spacing: QMDesign.Spacing.sm) {
            if case .failed(let message) = storeKit.purchaseState {
                Text(message)
                    .font(QMDesign.Typography.caption)
                    .foregroundColor(QMDesign.Colors.error)
                    .multilineTextAlignment(.center)
            }

            Button {
                guard let product = selectedProduct else { return }
                Task { await storeKit.purchase(product) }
            } label: {
                HStack(spacing: QMDesign.Spacing.sm) {
                    if storeKit.purchaseState == .purchasing {
                        ProgressView()
                            .scaleEffect(0.8)
                            .progressViewStyle(CircularProgressViewStyle(tint: .white))
                    }
                    Text(storeKit.purchaseState == .purchasing ? "Processing..." : "Subscribe")
                        .font(QMDesign.Typography.labelMedium)
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
            .disabled(storeKit.purchaseState == .purchasing || selectedProduct == nil)
            .accessibilityLabel("Subscribe to PRO")

            Button(action: { dismiss() }) {
                Text("Maybe Later")
                    .font(QMDesign.Typography.bodySmall)
                    .foregroundColor(QMDesign.Colors.textSecondary)
            }
            .buttonStyle(.plain)
        }
    }

    private var footer: some View {
        VStack(spacing: QMDesign.Spacing.xs) {
            Button {
                Task { await storeKit.restorePurchases() }
            } label: {
                Text("Restore Purchases")
                    .font(QMDesign.Typography.caption)
                    .foregroundColor(QMDesign.Colors.textSecondary)
            }
            .buttonStyle(.plain)
            .disabled(storeKit.purchaseState == .purchasing)

            HStack(spacing: QMDesign.Spacing.md) {
                Link("Terms of Use", destination: URL(string: "https://www.queenmama.co/terms")!)
                Link("Privacy Policy", destination: URL(string: "https://www.queenmama.co/privacy")!)
            }
            .font(QMDesign.Typography.caption)
            .foregroundColor(QMDesign.Colors.textTertiary)

            Text("Auto-renews until cancelled. Manage in App Store settings.")
                .font(QMDesign.Typography.caption)
                .foregroundColor(QMDesign.Colors.textTertiary)
                .multilineTextAlignment(.center)
        }
    }

    private var existingSubscriptionNotice: some View {
        VStack(spacing: QMDesign.Spacing.md) {
            Image(systemName: "checkmark.seal.fill")
                .font(.system(size: 32))
                .foregroundColor(QMDesign.Colors.success)
                .accessibilityHidden(true)

            Text("You already have an active \(licenseManager.currentLicense.plan.rawValue) subscription with this account. It is managed on queenmama.co.")
                .font(QMDesign.Typography.bodySmall)
                .foregroundColor(QMDesign.Colors.textSecondary)
                .multilineTextAlignment(.center)

            Button(action: { dismiss() }) {
                Text("OK")
                    .font(QMDesign.Typography.labelMedium)
                    .foregroundColor(.white)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, QMDesign.Spacing.md)
                    .background(
                        RoundedRectangle(cornerRadius: QMDesign.Radius.lg)
                            .fill(QMDesign.Colors.primaryGradient)
                    )
            }
            .buttonStyle(.plain)
        }
    }
}

// MARK: - Product Option Row

private struct ProductOptionRow: View {
    let product: Product
    let isSelected: Bool
    let onTap: () -> Void

    private var periodLabel: String {
        guard let period = product.subscription?.subscriptionPeriod else { return "" }
        switch period.unit {
        case .month: return String(localized: "/month")
        case .year: return String(localized: "/year")
        case .week: return String(localized: "/week")
        case .day: return String(localized: "/day")
        @unknown default: return ""
        }
    }

    var body: some View {
        Button(action: onTap) {
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text(product.displayName)
                        .font(QMDesign.Typography.labelMedium)
                        .foregroundColor(QMDesign.Colors.textPrimary)
                }

                Spacer()

                HStack(alignment: .firstTextBaseline, spacing: 2) {
                    Text(product.displayPrice)
                        .font(QMDesign.Typography.labelMedium)
                        .foregroundStyle(QMDesign.Colors.primaryGradient)
                    Text(periodLabel)
                        .font(QMDesign.Typography.caption)
                        .foregroundColor(QMDesign.Colors.textSecondary)
                }

                Image(systemName: isSelected ? "checkmark.circle.fill" : "circle")
                    .foregroundColor(isSelected ? QMDesign.Colors.accent : QMDesign.Colors.textTertiary)
            }
            .padding(QMDesign.Spacing.md)
            .background(
                RoundedRectangle(cornerRadius: QMDesign.Radius.lg)
                    .fill(QMDesign.Colors.surfaceLight)
                    .overlay(
                        RoundedRectangle(cornerRadius: QMDesign.Radius.lg)
                            .stroke(isSelected ? QMDesign.Colors.accent : QMDesign.Colors.borderSubtle, lineWidth: 1)
                    )
            )
        }
        .buttonStyle(.plain)
        .accessibilityLabel("\(product.displayName), \(product.displayPrice)\(periodLabel)")
        .accessibilityAddTraits(isSelected ? .isSelected : [])
    }
}

// MARK: - Benefit Row

private struct PaywallBenefitRow: View {
    let icon: String
    let text: LocalizedStringKey

    var body: some View {
        HStack(spacing: QMDesign.Spacing.sm) {
            Image(systemName: icon)
                .font(.system(size: 14))
                .foregroundStyle(QMDesign.Colors.primaryGradient)
                .frame(width: 24)
                .accessibilityHidden(true)

            Text(text)
                .font(QMDesign.Typography.bodySmall)
                .foregroundColor(QMDesign.Colors.textPrimary)

            Spacer()

            Image(systemName: "checkmark")
                .font(.system(size: 12, weight: .semibold))
                .foregroundColor(QMDesign.Colors.success)
                .accessibilityHidden(true)
        }
    }
}
