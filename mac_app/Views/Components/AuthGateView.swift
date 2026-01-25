//
//  AuthGateView.swift
//  QueenMama
//
//  A wrapper view that shows login prompt for unauthenticated users
//

import SwiftUI

/// Wraps content to show authentication prompt for unauthenticated users
struct AuthGateView<Content: View>: View {
    @StateObject private var authManager = AuthenticationManager.shared

    let content: () -> Content

    init(@ViewBuilder content: @escaping () -> Content) {
        self.content = content
    }

    var body: some View {
        if authManager.isAuthenticated {
            content()
        } else {
            UnauthenticatedOverlay()
        }
    }
}

/// View shown when user is not authenticated - uses new SignInChoiceView
struct UnauthenticatedOverlay: View {
    var body: some View {
        VStack(spacing: QMDesign.Spacing.xl) {
            // Logo and branding at top
            VStack(spacing: QMDesign.Spacing.md) {
                ZStack {
                    Circle()
                        .fill(QMDesign.Colors.primaryGradient)
                        .frame(width: 80, height: 80)
                    Image(systemName: "waveform")
                        .font(.system(size: 36, weight: .bold))
                        .foregroundColor(.white)
                }

                Text("Queen Mama")
                    .font(QMDesign.Typography.titleLarge)
                    .foregroundStyle(QMDesign.Colors.primaryGradient)

                Text("Your AI Interview Coach")
                    .font(QMDesign.Typography.bodyMedium)
                    .foregroundColor(QMDesign.Colors.textSecondary)
            }
            .padding(.top, QMDesign.Spacing.xxl)

            // Sign-in options
            SignInChoiceView(
                onAuthenticated: {},
                allowSkip: false
            )

            // Free tier info at bottom
            VStack(spacing: QMDesign.Spacing.sm) {
                Text("Free tier includes:")
                    .font(QMDesign.Typography.caption)
                    .foregroundColor(QMDesign.Colors.textSecondary)

                HStack(spacing: QMDesign.Spacing.lg) {
                    FeatureBadge(icon: "sparkles", text: "50 AI requests/day")
                    FeatureBadge(icon: "waveform", text: "Live transcription")
                    FeatureBadge(icon: "camera", text: "Screen capture")
                }
            }
            .padding(.bottom, QMDesign.Spacing.lg)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(QMDesign.Colors.backgroundPrimary)
    }
}

// MARK: - Helper Views

private struct FeatureBadge: View {
    let icon: String
    let text: String

    var body: some View {
        HStack(spacing: QMDesign.Spacing.xs) {
            Image(systemName: icon)
                .font(.system(size: 12))
                .foregroundStyle(QMDesign.Colors.primaryGradient)
            Text(text)
                .font(QMDesign.Typography.captionSmall)
                .foregroundColor(QMDesign.Colors.textSecondary)
        }
        .padding(.horizontal, QMDesign.Spacing.sm)
        .padding(.vertical, QMDesign.Spacing.xs)
        .background(
            Capsule()
                .fill(QMDesign.Colors.surfaceLight)
        )
    }
}
