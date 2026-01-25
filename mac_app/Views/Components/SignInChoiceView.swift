import SwiftUI

/// Main sign-in choice view with Google, Email, and Create Account options
struct SignInChoiceView: View {
    let onAuthenticated: () -> Void
    var allowSkip: Bool = false
    var onSkip: (() -> Void)?

    @StateObject private var authManager = AuthenticationManager.shared
    @State private var showEmailSignIn = false
    @State private var showRegistrationForm = false
    @State private var isGoogleLoading = false
    @State private var errorMessage = ""
    @State private var isGoogleButtonHovered = false

    var body: some View {
        VStack(spacing: QMDesign.Spacing.xl) {
            Spacer()

            // Header
            headerSection

            // Content based on navigation state
            if showEmailSignIn {
                EmailSignInView(
                    onAuthenticated: onAuthenticated,
                    onBack: { showEmailSignIn = false },
                    onSwitchToGoogle: {
                        showEmailSignIn = false
                        signInWithGoogle()
                    }
                )
                .transition(.move(edge: .trailing).combined(with: .opacity))
            } else if showRegistrationForm {
                RegistrationFormView(showRegistrationForm: $showRegistrationForm)
                    .transition(.move(edge: .trailing).combined(with: .opacity))
            } else {
                mainSignInOptions
                    .transition(.move(edge: .leading).combined(with: .opacity))
            }

            Spacer()

            // Skip option
            if allowSkip && !showEmailSignIn && !showRegistrationForm {
                skipButton
            }
        }
        .padding(.horizontal, QMDesign.Spacing.lg)
        .animation(QMDesign.Animation.smooth, value: showEmailSignIn)
        .animation(QMDesign.Animation.smooth, value: showRegistrationForm)
        .onChange(of: authManager.authState) { oldState, newState in
            if case .authenticated = newState {
                onAuthenticated()
            }
        }
    }

    // MARK: - Header

    private var headerSection: some View {
        VStack(spacing: QMDesign.Spacing.md) {
            ZStack {
                Circle()
                    .fill(QMDesign.Colors.primaryGradient.opacity(0.1))
                    .frame(width: 80, height: 80)
                Image(systemName: "person.crop.circle.badge.checkmark")
                    .font(.system(size: 32))
                    .foregroundStyle(QMDesign.Colors.primaryGradient)
            }

            Text(showRegistrationForm ? "Create Account" : "Welcome to Queen Mama")
                .font(QMDesign.Typography.titleMedium)
                .foregroundColor(QMDesign.Colors.textPrimary)

            Text(showRegistrationForm
                 ? "Create your account to get started"
                 : "Sign in to unlock cloud sync, session history, and PRO features.")
                .font(QMDesign.Typography.bodySmall)
                .foregroundColor(QMDesign.Colors.textSecondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, QMDesign.Spacing.xl)
        }
    }

    // MARK: - Main Sign-In Options

    private var mainSignInOptions: some View {
        VStack(spacing: QMDesign.Spacing.lg) {
            // Error message
            if !errorMessage.isEmpty {
                errorMessageView
            }

            // Google Sign-In button (Primary)
            googleSignInButton

            // Divider
            dividerView

            // Secondary options
            VStack(spacing: QMDesign.Spacing.md) {
                // Sign in with Email
                Button(action: { showEmailSignIn = true }) {
                    HStack(spacing: QMDesign.Spacing.sm) {
                        Image(systemName: "envelope.fill")
                            .font(.system(size: 16))
                        Text("Sign in with Email")
                            .font(QMDesign.Typography.labelMedium)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, QMDesign.Spacing.md)
                    .background(
                        RoundedRectangle(cornerRadius: QMDesign.Radius.md)
                            .fill(QMDesign.Colors.surfaceLight)
                            .overlay(
                                RoundedRectangle(cornerRadius: QMDesign.Radius.md)
                                    .stroke(QMDesign.Colors.borderSubtle, lineWidth: 1)
                            )
                    )
                    .foregroundColor(QMDesign.Colors.textPrimary)
                }
                .buttonStyle(.plain)

                // Create Account
                Button(action: { showRegistrationForm = true }) {
                    HStack(spacing: QMDesign.Spacing.sm) {
                        Image(systemName: "person.badge.plus")
                            .font(.system(size: 16))
                        Text("Create Account")
                            .font(QMDesign.Typography.labelMedium)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, QMDesign.Spacing.md)
                    .background(
                        RoundedRectangle(cornerRadius: QMDesign.Radius.md)
                            .fill(QMDesign.Colors.surfaceLight)
                            .overlay(
                                RoundedRectangle(cornerRadius: QMDesign.Radius.md)
                                    .stroke(QMDesign.Colors.borderSubtle, lineWidth: 1)
                            )
                    )
                    .foregroundColor(QMDesign.Colors.textPrimary)
                }
                .buttonStyle(.plain)
            }
        }
        .padding(.horizontal, QMDesign.Spacing.xl)
    }

    // MARK: - Google Sign-In Button

    private var googleSignInButton: some View {
        Button(action: signInWithGoogle) {
            HStack(spacing: QMDesign.Spacing.md) {
                if isGoogleLoading {
                    ProgressView()
                        .scaleEffect(0.8)
                        .progressViewStyle(CircularProgressViewStyle(tint: .white))
                } else {
                    // Google logo
                    Image(systemName: "g.circle.fill")
                        .font(.system(size: 20))
                }
                Text(isGoogleLoading ? "Signing in..." : "Continue with Google")
                    .font(QMDesign.Typography.labelMedium)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, QMDesign.Spacing.md)
            .background(
                RoundedRectangle(cornerRadius: QMDesign.Radius.md)
                    .fill(QMDesign.Colors.primaryGradient)
            )
            .foregroundColor(.white)
            .scaleEffect(isGoogleButtonHovered ? 1.02 : 1.0)
        }
        .buttonStyle(.plain)
        .disabled(isGoogleLoading)
        .onHover { isGoogleButtonHovered = $0 }
        .animation(QMDesign.Animation.smooth, value: isGoogleButtonHovered)
    }

    private var dividerView: some View {
        HStack(spacing: QMDesign.Spacing.md) {
            Rectangle()
                .fill(QMDesign.Colors.borderSubtle)
                .frame(height: 1)
            Text("or")
                .font(QMDesign.Typography.caption)
                .foregroundColor(QMDesign.Colors.textTertiary)
            Rectangle()
                .fill(QMDesign.Colors.borderSubtle)
                .frame(height: 1)
        }
    }

    private var errorMessageView: some View {
        HStack(spacing: QMDesign.Spacing.xs) {
            Image(systemName: "exclamationmark.circle.fill")
            Text(errorMessage)
        }
        .font(QMDesign.Typography.caption)
        .foregroundColor(QMDesign.Colors.error)
        .padding(QMDesign.Spacing.sm)
        .frame(maxWidth: .infinity)
        .background(
            RoundedRectangle(cornerRadius: QMDesign.Radius.sm)
                .fill(QMDesign.Colors.error.opacity(0.1))
        )
    }

    private var skipButton: some View {
        Button(action: { onSkip?() }) {
            Text("Skip for now")
                .font(QMDesign.Typography.bodySmall)
                .foregroundColor(QMDesign.Colors.textTertiary)
        }
        .buttonStyle(.plain)
        .padding(.bottom, QMDesign.Spacing.xxl)
    }

    // MARK: - Actions

    private func signInWithGoogle() {
        isGoogleLoading = true
        errorMessage = ""

        Task {
            do {
                try await authManager.loginWithGoogle()
                // Success handled by onChange of authState
            } catch let error as GoogleAuthError where error == .userCancelled {
                // User cancelled - just reset state
                errorMessage = ""
            } catch let error as AuthError {
                switch error {
                case .credentialsAccountExists:
                    errorMessage = "This email uses password login. Please sign in with email instead."
                default:
                    errorMessage = error.localizedDescription
                }
            } catch {
                errorMessage = error.localizedDescription
            }
            isGoogleLoading = false
        }
    }
}

#Preview {
    SignInChoiceView(
        onAuthenticated: {},
        allowSkip: true,
        onSkip: {}
    )
    .frame(width: 400, height: 600)
    .background(QMDesign.Colors.backgroundPrimary)
}
