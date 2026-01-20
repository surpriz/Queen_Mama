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

/// View shown when user is not authenticated
struct UnauthenticatedOverlay: View {
    @StateObject private var authManager = AuthenticationManager.shared
    @State private var isConnecting = false
    @State private var deviceCodeResponse: DeviceCodeResponse?
    @State private var connectionError: String?
    @State private var showCopied = false

    var body: some View {
        VStack(spacing: QMDesign.Spacing.xl) {
            Spacer()

            // Logo and branding
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

            // Auth prompt
            VStack(spacing: QMDesign.Spacing.lg) {
                VStack(spacing: QMDesign.Spacing.sm) {
                    Image(systemName: "person.crop.circle.badge.xmark")
                        .font(.system(size: 48))
                        .foregroundStyle(QMDesign.Colors.primaryGradient)

                    Text("Sign In Required")
                        .font(QMDesign.Typography.headline)
                        .foregroundColor(QMDesign.Colors.textPrimary)

                    Text("Connect your account to access Queen Mama features including AI assistance, transcription, and more.")
                        .font(QMDesign.Typography.bodySmall)
                        .foregroundColor(QMDesign.Colors.textSecondary)
                        .multilineTextAlignment(.center)
                        .frame(maxWidth: 400)
                }

                if let response = deviceCodeResponse {
                    // Device code display
                    VStack(spacing: QMDesign.Spacing.md) {
                        HStack(spacing: QMDesign.Spacing.sm) {
                            Image(systemName: "safari")
                                .foregroundStyle(QMDesign.Colors.primaryGradient)
                            Text("Browser opened - enter this code:")
                                .font(QMDesign.Typography.caption)
                                .foregroundColor(QMDesign.Colors.textSecondary)
                        }

                        // Code display
                        HStack(spacing: QMDesign.Spacing.xs) {
                            ForEach(Array(response.userCode), id: \.self) { char in
                                AuthGateCodeCharView(char: char)
                            }
                        }

                        // Copy button
                        Button(action: { copyCode(response.userCode) }) {
                            HStack(spacing: QMDesign.Spacing.xs) {
                                Image(systemName: showCopied ? "checkmark" : "doc.on.doc")
                                Text(showCopied ? "Copied!" : "Copy code")
                            }
                            .font(QMDesign.Typography.captionSmall)
                            .foregroundColor(showCopied ? QMDesign.Colors.success : QMDesign.Colors.textSecondary)
                        }
                        .buttonStyle(.plain)

                        // Open link manually
                        Link(destination: URL(string: response.verificationUrl)!) {
                            HStack(spacing: QMDesign.Spacing.xs) {
                                Image(systemName: "arrow.up.right.square")
                                Text("Open link manually")
                            }
                            .font(QMDesign.Typography.captionSmall)
                            .foregroundStyle(QMDesign.Colors.primaryGradient)
                        }

                        HStack(spacing: QMDesign.Spacing.sm) {
                            ProgressView()
                                .scaleEffect(0.7)
                            Text("Waiting for authorization...")
                                .font(QMDesign.Typography.caption)
                                .foregroundColor(QMDesign.Colors.textSecondary)
                        }

                        Button(action: cancelDeviceCode) {
                            Text("Cancel")
                                .font(QMDesign.Typography.bodySmall)
                                .foregroundColor(QMDesign.Colors.textSecondary)
                        }
                        .buttonStyle(.plain)
                    }
                    .padding(QMDesign.Spacing.lg)
                    .background(
                        RoundedRectangle(cornerRadius: QMDesign.Radius.lg)
                            .fill(QMDesign.Colors.surfaceLight)
                    )
                } else {
                    // Error message
                    if let error = connectionError {
                        HStack(spacing: QMDesign.Spacing.xs) {
                            Image(systemName: "exclamationmark.circle.fill")
                            Text(error)
                        }
                        .font(QMDesign.Typography.caption)
                        .foregroundColor(QMDesign.Colors.error)
                        .padding(QMDesign.Spacing.sm)
                        .background(
                            RoundedRectangle(cornerRadius: QMDesign.Radius.sm)
                                .fill(QMDesign.Colors.error.opacity(0.1))
                        )
                    }

                    // Connect button
                    Button(action: startDeviceCodeFlow) {
                        HStack(spacing: QMDesign.Spacing.sm) {
                            if isConnecting {
                                ProgressView()
                                    .scaleEffect(0.8)
                                    .progressViewStyle(CircularProgressViewStyle(tint: .white))
                            } else {
                                Image(systemName: "arrow.up.right.square")
                            }
                            Text(isConnecting ? "Opening browser..." : "Connect Account")
                        }
                        .font(QMDesign.Typography.labelMedium)
                        .foregroundColor(.white)
                        .padding(.horizontal, QMDesign.Spacing.xl)
                        .padding(.vertical, QMDesign.Spacing.md)
                        .background(
                            RoundedRectangle(cornerRadius: QMDesign.Radius.md)
                                .fill(QMDesign.Colors.primaryGradient)
                        )
                    }
                    .buttonStyle(.plain)
                    .disabled(isConnecting)

                    Text("Works with email, Google, or GitHub accounts")
                        .font(QMDesign.Typography.captionSmall)
                        .foregroundColor(QMDesign.Colors.textTertiary)
                }
            }

            Spacer()

            // Free tier info
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
        .onChange(of: authManager.authState) { oldState, newState in
            // Clear device code when authenticated
            if case .authenticated = newState {
                deviceCodeResponse = nil
                isConnecting = false
            }
        }
    }

    private func startDeviceCodeFlow() {
        isConnecting = true
        connectionError = nil

        Task {
            do {
                let response = try await authManager.startDeviceCodeFlow()
                deviceCodeResponse = response

                // Auto-open browser
                if let url = URL(string: response.verificationUrl) {
                    NSWorkspace.shared.open(url)
                }
            } catch {
                connectionError = error.localizedDescription
            }
            isConnecting = false
        }
    }

    private func cancelDeviceCode() {
        authManager.cancelDeviceCodeFlow()
        deviceCodeResponse = nil
    }

    private func copyCode(_ code: String) {
        NSPasteboard.general.clearContents()
        NSPasteboard.general.setString(code, forType: .string)
        showCopied = true

        DispatchQueue.main.asyncAfter(deadline: .now() + 2) {
            showCopied = false
        }
    }
}

// MARK: - Helper Views

private struct AuthGateCodeCharView: View {
    let char: Character

    var body: some View {
        let isDash = char == "-"

        Text(String(char))
            .font(.system(size: 24, weight: .bold, design: .monospaced))
            .foregroundStyle(isDash ? AnyShapeStyle(QMDesign.Colors.textTertiary) : AnyShapeStyle(QMDesign.Colors.primaryGradient))
            .frame(width: isDash ? 16 : 36, height: 44)
            .background(
                Group {
                    if isDash {
                        Color.clear
                    } else {
                        RoundedRectangle(cornerRadius: QMDesign.Radius.sm)
                            .fill(QMDesign.Colors.surfaceLight)
                            .overlay(
                                RoundedRectangle(cornerRadius: QMDesign.Radius.sm)
                                    .stroke(QMDesign.Colors.borderSubtle, lineWidth: 1)
                            )
                    }
                }
            )
    }
}

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
