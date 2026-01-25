import SwiftUI

/// Intelligent email sign-in flow that checks email first and routes to appropriate auth method
struct EmailSignInView: View {
    let onAuthenticated: () -> Void
    let onBack: () -> Void
    let onSwitchToGoogle: () -> Void

    @StateObject private var authManager = AuthenticationManager.shared
    @FocusState private var focusedField: Field?

    enum Field {
        case email, password
    }

    enum ViewState {
        case enterEmail
        case enterPassword
        case useGoogle(email: String)
        case noAccount(email: String)
    }

    @State private var viewState: ViewState = .enterEmail
    @State private var email = ""
    @State private var password = ""
    @State private var isLoading = false
    @State private var errorMessage = ""

    var body: some View {
        VStack(spacing: QMDesign.Spacing.lg) {
            // Back button
            HStack {
                Button(action: onBack) {
                    HStack(spacing: QMDesign.Spacing.xs) {
                        Image(systemName: "chevron.left")
                        Text("Back")
                    }
                    .font(QMDesign.Typography.bodySmall)
                    .foregroundColor(QMDesign.Colors.textSecondary)
                }
                .buttonStyle(.plain)
                Spacer()
            }

            // Content based on view state
            switch viewState {
            case .enterEmail:
                enterEmailView
            case .enterPassword:
                enterPasswordView
            case .useGoogle(let email):
                useGoogleView(email: email)
            case .noAccount(let email):
                noAccountView(email: email)
            }
        }
        .padding(.horizontal, QMDesign.Spacing.xl)
        .onChange(of: authManager.authState) { oldState, newState in
            if case .authenticated = newState {
                onAuthenticated()
            }
        }
    }

    // MARK: - Enter Email View

    private var enterEmailView: some View {
        VStack(spacing: QMDesign.Spacing.lg) {
            VStack(spacing: QMDesign.Spacing.sm) {
                Text("Sign in with Email")
                    .font(QMDesign.Typography.titleSmall)
                    .foregroundColor(QMDesign.Colors.textPrimary)

                Text("Enter your email to continue")
                    .font(QMDesign.Typography.bodySmall)
                    .foregroundColor(QMDesign.Colors.textSecondary)
            }

            // Email field
            VStack(alignment: .leading, spacing: QMDesign.Spacing.xs) {
                Text("Email")
                    .font(QMDesign.Typography.labelSmall)
                    .foregroundColor(QMDesign.Colors.textSecondary)

                TextField("you@example.com", text: $email)
                    .textFieldStyle(.plain)
                    .font(QMDesign.Typography.bodyMedium)
                    .padding(QMDesign.Spacing.md)
                    .background(
                        RoundedRectangle(cornerRadius: QMDesign.Radius.md)
                            .fill(QMDesign.Colors.surfaceLight)
                            .overlay(
                                RoundedRectangle(cornerRadius: QMDesign.Radius.md)
                                    .stroke(QMDesign.Colors.borderSubtle, lineWidth: 1)
                            )
                    )
                    .focused($focusedField, equals: .email)
                    .textContentType(.emailAddress)
                    .onSubmit { checkEmail() }
            }

            // Error message
            if !errorMessage.isEmpty {
                errorMessageView
            }

            // Continue button
            Button(action: checkEmail) {
                HStack(spacing: QMDesign.Spacing.sm) {
                    if isLoading {
                        ProgressView()
                            .scaleEffect(0.8)
                            .progressViewStyle(CircularProgressViewStyle(tint: .white))
                    }
                    Text(isLoading ? "Checking..." : "Continue")
                        .font(QMDesign.Typography.labelMedium)
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, QMDesign.Spacing.md)
                .background(
                    RoundedRectangle(cornerRadius: QMDesign.Radius.md)
                        .fill(email.isValidEmail ? AnyShapeStyle(QMDesign.Colors.primaryGradient) : AnyShapeStyle(QMDesign.Colors.surfaceLight))
                )
                .foregroundColor(email.isValidEmail ? .white : QMDesign.Colors.textTertiary)
            }
            .buttonStyle(.plain)
            .disabled(isLoading || !email.isValidEmail)
        }
        .onAppear {
            focusedField = .email
        }
    }

    // MARK: - Enter Password View

    private var enterPasswordView: some View {
        VStack(spacing: QMDesign.Spacing.lg) {
            VStack(spacing: QMDesign.Spacing.sm) {
                Text("Enter Password")
                    .font(QMDesign.Typography.titleSmall)
                    .foregroundColor(QMDesign.Colors.textPrimary)

                Text(email)
                    .font(QMDesign.Typography.bodySmall)
                    .foregroundColor(QMDesign.Colors.textSecondary)

                Button(action: { viewState = .enterEmail }) {
                    Text("Change email")
                        .font(QMDesign.Typography.caption)
                        .foregroundStyle(QMDesign.Colors.primaryGradient)
                }
                .buttonStyle(.plain)
            }

            // Password field
            VStack(alignment: .leading, spacing: QMDesign.Spacing.xs) {
                Text("Password")
                    .font(QMDesign.Typography.labelSmall)
                    .foregroundColor(QMDesign.Colors.textSecondary)

                SecureField("Enter your password", text: $password)
                    .textFieldStyle(.plain)
                    .font(QMDesign.Typography.bodyMedium)
                    .padding(QMDesign.Spacing.md)
                    .background(
                        RoundedRectangle(cornerRadius: QMDesign.Radius.md)
                            .fill(QMDesign.Colors.surfaceLight)
                            .overlay(
                                RoundedRectangle(cornerRadius: QMDesign.Radius.md)
                                    .stroke(QMDesign.Colors.borderSubtle, lineWidth: 1)
                            )
                    )
                    .focused($focusedField, equals: .password)
                    .onSubmit { signIn() }
            }

            // Error message
            if !errorMessage.isEmpty {
                errorMessageView
            }

            // Sign in button
            Button(action: signIn) {
                HStack(spacing: QMDesign.Spacing.sm) {
                    if isLoading {
                        ProgressView()
                            .scaleEffect(0.8)
                            .progressViewStyle(CircularProgressViewStyle(tint: .white))
                    }
                    Text(isLoading ? "Signing in..." : "Sign In")
                        .font(QMDesign.Typography.labelMedium)
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, QMDesign.Spacing.md)
                .background(
                    RoundedRectangle(cornerRadius: QMDesign.Radius.md)
                        .fill(!password.isEmpty ? AnyShapeStyle(QMDesign.Colors.primaryGradient) : AnyShapeStyle(QMDesign.Colors.surfaceLight))
                )
                .foregroundColor(!password.isEmpty ? .white : QMDesign.Colors.textTertiary)
            }
            .buttonStyle(.plain)
            .disabled(isLoading || password.isEmpty)

            // Forgot password link
            Button(action: forgotPassword) {
                Text("Forgot password?")
                    .font(QMDesign.Typography.caption)
                    .foregroundStyle(QMDesign.Colors.primaryGradient)
            }
            .buttonStyle(.plain)
        }
        .onAppear {
            focusedField = .password
        }
    }

    // MARK: - Use Google View

    private func useGoogleView(email: String) -> some View {
        VStack(spacing: QMDesign.Spacing.lg) {
            // Icon
            ZStack {
                Circle()
                    .fill(QMDesign.Colors.primaryGradient.opacity(0.1))
                    .frame(width: 64, height: 64)
                Image(systemName: "g.circle.fill")
                    .font(.system(size: 28))
                    .foregroundStyle(QMDesign.Colors.primaryGradient)
            }

            VStack(spacing: QMDesign.Spacing.sm) {
                Text("Use Google Sign-In")
                    .font(QMDesign.Typography.titleSmall)
                    .foregroundColor(QMDesign.Colors.textPrimary)

                Text("The account for **\(email)** uses Google Sign-In.")
                    .font(QMDesign.Typography.bodySmall)
                    .foregroundColor(QMDesign.Colors.textSecondary)
                    .multilineTextAlignment(.center)
            }

            // Sign in with Google button
            Button(action: onSwitchToGoogle) {
                HStack(spacing: QMDesign.Spacing.md) {
                    Image(systemName: "g.circle.fill")
                        .font(.system(size: 20))
                    Text("Continue with Google")
                        .font(QMDesign.Typography.labelMedium)
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, QMDesign.Spacing.md)
                .background(
                    RoundedRectangle(cornerRadius: QMDesign.Radius.md)
                        .fill(QMDesign.Colors.primaryGradient)
                )
                .foregroundColor(.white)
            }
            .buttonStyle(.plain)

            // Try different email
            Button(action: { viewState = .enterEmail }) {
                Text("Use a different email")
                    .font(QMDesign.Typography.caption)
                    .foregroundStyle(QMDesign.Colors.primaryGradient)
            }
            .buttonStyle(.plain)
        }
    }

    // MARK: - No Account View

    private func noAccountView(email: String) -> some View {
        VStack(spacing: QMDesign.Spacing.lg) {
            // Icon
            ZStack {
                Circle()
                    .fill(QMDesign.Colors.warning.opacity(0.1))
                    .frame(width: 64, height: 64)
                Image(systemName: "person.crop.circle.badge.questionmark")
                    .font(.system(size: 28))
                    .foregroundColor(QMDesign.Colors.warning)
            }

            VStack(spacing: QMDesign.Spacing.sm) {
                Text("No Account Found")
                    .font(QMDesign.Typography.titleSmall)
                    .foregroundColor(QMDesign.Colors.textPrimary)

                Text("We couldn't find an account for **\(email)**.")
                    .font(QMDesign.Typography.bodySmall)
                    .foregroundColor(QMDesign.Colors.textSecondary)
                    .multilineTextAlignment(.center)
            }

            // Create account button
            Button(action: { /* Navigate to registration with pre-filled email */ }) {
                HStack(spacing: QMDesign.Spacing.sm) {
                    Image(systemName: "person.badge.plus")
                    Text("Create Account")
                        .font(QMDesign.Typography.labelMedium)
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, QMDesign.Spacing.md)
                .background(
                    RoundedRectangle(cornerRadius: QMDesign.Radius.md)
                        .fill(QMDesign.Colors.primaryGradient)
                )
                .foregroundColor(.white)
            }
            .buttonStyle(.plain)

            // Try different email
            Button(action: { viewState = .enterEmail }) {
                Text("Try a different email")
                    .font(QMDesign.Typography.caption)
                    .foregroundStyle(QMDesign.Colors.primaryGradient)
            }
            .buttonStyle(.plain)
        }
    }

    // MARK: - Error Message View

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

    // MARK: - Actions

    private func checkEmail() {
        guard email.isValidEmail else { return }

        isLoading = true
        errorMessage = ""

        Task {
            do {
                let response = try await authManager.checkEmailAuthMethod(email)

                if !response.exists {
                    viewState = .noAccount(email: email)
                } else if response.authMethod == "google" {
                    viewState = .useGoogle(email: email)
                } else {
                    viewState = .enterPassword
                }
            } catch {
                errorMessage = "Failed to check email. Please try again."
            }
            isLoading = false
        }
    }

    private func signIn() {
        guard !password.isEmpty else { return }

        isLoading = true
        errorMessage = ""

        Task {
            do {
                try await authManager.loginWithCredentials(email: email, password: password)
                // Success handled by onChange of authState
            } catch let error as AuthError {
                switch error {
                case .oauthUserNeedsGoogle, .oauthUserNeedsDeviceCode:
                    viewState = .useGoogle(email: email)
                case .invalidCredentials:
                    errorMessage = "Invalid password. Please try again."
                default:
                    errorMessage = error.localizedDescription
                }
            } catch {
                errorMessage = error.localizedDescription
            }
            isLoading = false
        }
    }

    private func forgotPassword() {
        // Open password reset page
        if let url = URL(string: "https://www.queenmama.co/forgot-password?email=\(email.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? "")") {
            NSWorkspace.shared.open(url)
        }
    }
}

// MARK: - String Extension

private extension String {
    var isValidEmail: Bool {
        let emailRegex = #"^[A-Z0-9a-z._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,64}$"#
        return range(of: emailRegex, options: .regularExpression) != nil
    }
}

#Preview {
    EmailSignInView(
        onAuthenticated: {},
        onBack: {},
        onSwitchToGoogle: {}
    )
    .frame(width: 400, height: 500)
    .background(QMDesign.Colors.backgroundPrimary)
}
