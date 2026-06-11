import SwiftUI

/// Modal view prompting user to upgrade to PRO.
/// Thin wrapper around the native StoreKit paywall — the previous web/Stripe
/// flow violated App Store rule 3.1.1 (digital goods must use in-app purchase).
struct UpgradePromptView: View {
    let feature: String?
    let onUpgrade: (() -> Void)?

    init(feature: String? = nil, onUpgrade: (() -> Void)? = nil) {
        self.feature = feature
        self.onUpgrade = onUpgrade
    }

    var body: some View {
        PaywallView(feature: feature, onComplete: onUpgrade)
    }
}
