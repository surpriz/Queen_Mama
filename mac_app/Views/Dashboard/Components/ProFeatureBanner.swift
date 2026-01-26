import SwiftUI

/// Inline banner for PRO-only features
@MainActor
struct ProFeatureBanner: View {
    let feature: String
    let description: String?
    let compact: Bool

    @State private var showUpgradeSheet = false

    init(feature: String, description: String? = nil, compact: Bool = false) {
        self.feature = feature
        self.description = description
        self.compact = compact
    }

    var body: some View {
        if compact {
            compactBanner
        } else {
            fullBanner
        }
    }

    private var compactBanner: some View {
        Button(action: { showUpgradeSheet = true }) {
            HStack(spacing: QMDesign.Spacing.xs) {
                Image(systemName: "crown.fill")
                    .font(.system(size: 10))
                    .foregroundStyle(QMDesign.Colors.primaryGradient)

                Text("PRO")
                    .font(.system(size: 10, weight: .bold))
                    .foregroundStyle(QMDesign.Colors.primaryGradient)
            }
            .padding(.horizontal, QMDesign.Spacing.xs)
            .padding(.vertical, 2)
            .background(
                Capsule()
                    .fill(QMDesign.Colors.accent.opacity(0.1))
                    .overlay(
                        Capsule()
                            .stroke(QMDesign.Colors.accent.opacity(0.3), lineWidth: 1)
                    )
            )
        }
        .buttonStyle(.plain)
        .sheet(isPresented: $showUpgradeSheet) {
            UpgradePromptView(feature: feature)
        }
    }

    private var fullBanner: some View {
        Button(action: { showUpgradeSheet = true }) {
            HStack(spacing: QMDesign.Spacing.md) {
                // Icon
                ZStack {
                    Circle()
                        .fill(QMDesign.Colors.accent.opacity(0.1))
                        .frame(width: 36, height: 36)

                    Image(systemName: "crown.fill")
                        .font(.system(size: 14))
                        .foregroundStyle(QMDesign.Colors.primaryGradient)
                }

                // Text
                VStack(alignment: .leading, spacing: 2) {
                    HStack(spacing: QMDesign.Spacing.xs) {
                        Text(feature)
                            .font(QMDesign.Typography.bodySmall)
                            .fontWeight(.medium)
                            .foregroundColor(QMDesign.Colors.textPrimary)

                        Text("PRO")
                            .font(.system(size: 9, weight: .bold))
                            .foregroundColor(.white)
                            .padding(.horizontal, 4)
                            .padding(.vertical, 1)
                            .background(
                                Capsule()
                                    .fill(QMDesign.Colors.primaryGradient)
                            )
                    }

                    if let description = description {
                        Text(description)
                            .font(QMDesign.Typography.captionSmall)
                            .foregroundColor(QMDesign.Colors.textTertiary)
                    }
                }

                Spacer()

                // Arrow
                Image(systemName: "chevron.right")
                    .font(.system(size: 12))
                    .foregroundColor(QMDesign.Colors.textTertiary)
            }
            .padding(QMDesign.Spacing.md)
            .background(
                RoundedRectangle(cornerRadius: QMDesign.Radius.md)
                    .fill(QMDesign.Colors.accent.opacity(0.05))
                    .overlay(
                        RoundedRectangle(cornerRadius: QMDesign.Radius.md)
                            .stroke(QMDesign.Colors.accent.opacity(0.2), lineWidth: 1)
                    )
            )
        }
        .buttonStyle(.plain)
        .sheet(isPresented: $showUpgradeSheet) {
            UpgradePromptView(feature: feature)
        }
    }
}

// MARK: - Usage Limit Banner

/// Banner showing remaining uses for a rate-limited feature
struct UsageLimitBanner: View {
    let feature: String
    let used: Int
    let limit: Int

    @State private var showUpgradeSheet = false

    var remaining: Int {
        max(0, limit - used)
    }

    var progress: Double {
        Double(used) / Double(limit)
    }

    var body: some View {
        VStack(spacing: QMDesign.Spacing.sm) {
            HStack {
                Text(feature)
                    .font(QMDesign.Typography.bodySmall)
                    .foregroundColor(QMDesign.Colors.textSecondary)

                Spacer()

                Text("\(remaining) / \(limit) remaining")
                    .font(QMDesign.Typography.captionSmall)
                    .foregroundColor(remaining == 0 ? QMDesign.Colors.error : QMDesign.Colors.textTertiary)
            }

            // Progress bar
            GeometryReader { geometry in
                ZStack(alignment: .leading) {
                    RoundedRectangle(cornerRadius: 2)
                        .fill(QMDesign.Colors.surfaceMedium)
                        .frame(height: 4)

                    RoundedRectangle(cornerRadius: 2)
                        .fill(remaining == 0 ? QMDesign.Colors.error : QMDesign.Colors.accent)
                        .frame(width: geometry.size.width * CGFloat(progress), height: 4)
                }
            }
            .frame(height: 4)

            if remaining == 0 {
                Button(action: { showUpgradeSheet = true }) {
                    HStack(spacing: QMDesign.Spacing.xs) {
                        Image(systemName: "crown.fill")
                            .font(.system(size: 10))
                        Text("Upgrade for unlimited")
                            .font(QMDesign.Typography.captionSmall)
                    }
                    .foregroundStyle(QMDesign.Colors.primaryGradient)
                }
                .buttonStyle(.plain)
            }
        }
        .padding(QMDesign.Spacing.sm)
        .background(
            RoundedRectangle(cornerRadius: QMDesign.Radius.md)
                .fill(QMDesign.Colors.surfaceLight)
        )
        .sheet(isPresented: $showUpgradeSheet) {
            UpgradePromptView(feature: feature)
        }
    }
}

// MARK: - PRO Badge

/// Small badge indicating a PRO feature
struct ProBadge: View {
    let size: BadgeSize

    enum BadgeSize {
        case small
        case medium

        var fontSize: CGFloat {
            switch self {
            case .small: return 8
            case .medium: return 10
            }
        }

        var padding: CGFloat {
            switch self {
            case .small: return 3
            case .medium: return 4
            }
        }
    }

    init(size: BadgeSize = .small) {
        self.size = size
    }

    var body: some View {
        Text("PRO")
            .font(.system(size: size.fontSize, weight: .bold))
            .foregroundColor(.white)
            .padding(.horizontal, size.padding)
            .padding(.vertical, 1)
            .background(
                Capsule()
                    .fill(QMDesign.Colors.primaryGradient)
            )
    }
}

// MARK: - Feature Gated View Modifier

extension View {
    /// Applies feature gating to a view - shows PRO badge if not available
    @MainActor
    func featureGated(_ feature: Feature, licenseManager: LicenseManager = .shared) -> some View {
        modifier(FeatureGatedModifier(feature: feature, licenseManager: licenseManager))
    }
}

@MainActor
private struct FeatureGatedModifier: ViewModifier {
    let feature: Feature
    @ObservedObject var licenseManager: LicenseManager

    @State private var showUpgradeSheet = false

    func body(content: Content) -> some View {
        let access = licenseManager.canUse(feature)

        switch access {
        case .allowed:
            content

        case .requiresPro, .requiresAuth:
            content
                .overlay(alignment: .topTrailing) {
                    ProBadge(size: .small)
                        .padding(4)
                }
                .opacity(0.6)
                .onTapGesture {
                    showUpgradeSheet = true
                }
                .sheet(isPresented: $showUpgradeSheet) {
                    UpgradePromptView(feature: featureName)
                }

        case .requiresEnterprise:
            content
                .overlay(alignment: .topTrailing) {
                    Text("ENT")
                        .font(.system(size: 8, weight: .bold))
                        .foregroundColor(.white)
                        .padding(.horizontal, 4)
                        .padding(.vertical, 2)
                        .background(
                            Capsule()
                                .fill(QMDesign.Colors.primaryGradient)
                        )
                        .padding(4)
                }
                .opacity(0.6)
                .onTapGesture {
                    showUpgradeSheet = true
                }
                .sheet(isPresented: $showUpgradeSheet) {
                    UpgradePromptView(feature: featureName)
                }

        case .blocked:
            content
                .overlay(alignment: .topTrailing) {
                    Image(systemName: "lock.fill")
                        .font(.system(size: 10))
                        .foregroundColor(.white)
                        .padding(6)
                        .background(Circle().fill(QMDesign.Colors.error))
                        .padding(4)
                }
                .opacity(0.4)

        case .limitReached(let used, let limit):
            content
                .overlay(alignment: .topTrailing) {
                    Text("\(limit - used)")
                        .font(.system(size: 10, weight: .bold))
                        .foregroundColor(.white)
                        .padding(4)
                        .background(Circle().fill(QMDesign.Colors.warning))
                        .padding(4)
                }
        }
    }

    private var featureName: String {
        switch feature {
        case .smartMode: return "Smart Mode"
        case .customModes: return "Custom Modes"
        case .exportMarkdown: return "Markdown Export"
        case .exportJson: return "JSON Export"
        case .autoAnswer: return "Auto-Answer"
        case .sessionSync: return "Session Sync"
        case .aiRequest: return "AI Requests"
        case .undetectable: return "Undetectable Mode"
        case .screenshot: return "Screenshot"
        case .sessionStart: return "Session Start"
        case .knowledgeBase: return "Knowledge Base"
        }
    }
}

// MARK: - Previews

#Preview("Full Banner") {
    VStack(spacing: 20) {
        ProFeatureBanner(
            feature: "Auto-Answer",
            description: "Automatically respond to questions"
        )

        ProFeatureBanner(feature: "Custom Modes", compact: true)

        UsageLimitBanner(feature: "Smart Mode", used: 4, limit: 5)
        UsageLimitBanner(feature: "Smart Mode", used: 5, limit: 5)
    }
    .padding()
    .background(QMDesign.Colors.backgroundPrimary)
}
