import SwiftUI

/// Modal view prompting user to upgrade — wraps PricingView for backward compatibility
struct UpgradePromptView: View {
    let feature: String?
    let onUpgrade: (() -> Void)?

    init(feature: String? = nil, onUpgrade: (() -> Void)? = nil) {
        self.feature = feature
        self.onUpgrade = onUpgrade
    }

    var body: some View {
        PricingView(
            contextMessage: feature.map {
                String(localized: "upgrade.feature.requiresPro.\($0)")
            }
        )
    }
}
