import SwiftUI

/// Lightweight login screen for known users whose token has expired.
/// Shows sign-in options without skip, preserving local data.
struct ReauthenticationView: View {
    let onAuthenticated: () -> Void

    @StateObject private var authManager = AuthenticationManager.shared

    var body: some View {
        ZStack {
            QMDesign.Colors.backgroundPrimary
                .ignoresSafeArea()

            VStack(spacing: QMDesign.Spacing.xl) {
                Spacer()

                // Header
                VStack(spacing: QMDesign.Spacing.md) {
                    ZStack {
                        Circle()
                            .fill(QMDesign.Colors.warning.opacity(0.1))
                            .frame(width: 80, height: 80)
                        Image(systemName: "arrow.triangle.2.circlepath")
                            .font(.system(size: 36, weight: .medium))
                            .foregroundStyle(QMDesign.Colors.warning)
                    }

                    Text(String(localized: "auth.reauth.title"))
                        .font(QMDesign.Typography.titleMedium)
                        .foregroundColor(QMDesign.Colors.textPrimary)

                    Text(String(localized: "auth.reauth.subtitle"))
                        .font(QMDesign.Typography.bodySmall)
                        .foregroundColor(QMDesign.Colors.textSecondary)
                        .multilineTextAlignment(.center)
                        .padding(.horizontal, QMDesign.Spacing.xl)
                }

                // Sign-in options (reuse existing component, no skip allowed)
                SignInChoiceView(
                    onAuthenticated: onAuthenticated,
                    allowSkip: false
                )

                // Reassurance footer
                HStack(alignment: .top, spacing: QMDesign.Spacing.sm) {
                    Image(systemName: "info.circle.fill")
                        .foregroundStyle(QMDesign.Colors.primaryGradient)
                    Text(String(localized: "auth.reauth.dataPreserved"))
                        .font(QMDesign.Typography.caption)
                        .foregroundColor(QMDesign.Colors.textTertiary)
                }
                .padding(QMDesign.Spacing.md)
                .background(
                    RoundedRectangle(cornerRadius: QMDesign.Radius.md)
                        .fill(QMDesign.Colors.accent.opacity(0.05))
                )
                .padding(.horizontal, QMDesign.Spacing.xl)

                Spacer()
            }
            .padding(.horizontal, QMDesign.Spacing.lg)
        }
        .frame(minWidth: 400, minHeight: 500)
    }
}
