import SwiftUI

/// Onboarding step for account connection
struct AccountStepView: View {
    let onContinue: () -> Void

    @StateObject private var authManager = AuthenticationManager.shared
    @State private var email = ""
    @State private var password = ""
    @State private var showPassword = false
    @State private var isLoading = false
    @State private var errorMessage = ""
    @State private var showDeviceCode = false
    @State private var deviceCodeResponse: DeviceCodeResponse?
    @State private var isButtonHovered = false

    var body: some View {
        VStack(spacing: QMDesign.Spacing.xl) {
            Spacer()

            // Header
            VStack(spacing: QMDesign.Spacing.md) {
                ZStack {
                    Circle()
                        .fill(QMDesign.Colors.primaryGradient.opacity(0.1))
                        .frame(width: 80, height: 80)
                    Image(systemName: "person.crop.circle.badge.checkmark")
                        .font(.system(size: 32))
                        .foregroundStyle(QMDesign.Colors.primaryGradient)
                }

                Text("Connect Your Account")
                    .font(QMDesign.Typography.titleMedium)
                    .foregroundColor(QMDesign.Colors.textPrimary)

                Text("Sign in to unlock cloud sync, session history, and PRO features.")
                    .font(QMDesign.Typography.bodySmall)
                    .foregroundColor(QMDesign.Colors.textSecondary)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, QMDesign.Spacing.xl)
            }

            // Content
            if showDeviceCode, let response = deviceCodeResponse {
                DeviceCodeDisplayView(
                    response: response,
                    onCancel: cancelDeviceCode
                )
                .padding(.horizontal, QMDesign.Spacing.xl)
            } else if case .authenticated = authManager.authState {
                AuthenticatedView(
                    user: authManager.currentUser,
                    onContinue: onContinue
                )
                .padding(.horizontal, QMDesign.Spacing.xl)
            } else {
                // Login Form
                VStack(spacing: QMDesign.Spacing.md) {
                    // Email field
                    VStack(alignment: .leading, spacing: QMDesign.Spacing.xs) {
                        Text("Email")
                            .font(QMDesign.Typography.caption)
                            .foregroundColor(QMDesign.Colors.textSecondary)

                        TextField("you@example.com", text: $email)
                            .textFieldStyle(.plain)
                            .font(QMDesign.Typography.bodyMedium)
                            .padding(QMDesign.Spacing.sm)
                            .background(
                                RoundedRectangle(cornerRadius: QMDesign.Radius.md)
                                    .fill(QMDesign.Colors.backgroundSecondary)
                            )
                            .textContentType(.emailAddress)
                    }

                    // Password field
                    VStack(alignment: .leading, spacing: QMDesign.Spacing.xs) {
                        Text("Password")
                            .font(QMDesign.Typography.caption)
                            .foregroundColor(QMDesign.Colors.textSecondary)

                        HStack {
                            if showPassword {
                                TextField("Password", text: $password)
                                    .textFieldStyle(.plain)
                            } else {
                                SecureField("Password", text: $password)
                                    .textFieldStyle(.plain)
                            }

                            Button(action: { showPassword.toggle() }) {
                                Image(systemName: showPassword ? "eye.slash" : "eye")
                                    .foregroundColor(QMDesign.Colors.textTertiary)
                            }
                            .buttonStyle(.plain)
                        }
                        .font(QMDesign.Typography.bodyMedium)
                        .padding(QMDesign.Spacing.sm)
                        .background(
                            RoundedRectangle(cornerRadius: QMDesign.Radius.md)
                                .fill(QMDesign.Colors.backgroundSecondary)
                        )
                    }

                    // Error message
                    if !errorMessage.isEmpty {
                        HStack(spacing: QMDesign.Spacing.xs) {
                            Image(systemName: "exclamationmark.circle.fill")
                            Text(errorMessage)
                        }
                        .font(QMDesign.Typography.caption)
                        .foregroundColor(QMDesign.Colors.error)
                        .padding(QMDesign.Spacing.sm)
                        .background(
                            RoundedRectangle(cornerRadius: QMDesign.Radius.sm)
                                .fill(QMDesign.Colors.error.opacity(0.1))
                        )
                    }

                    // Login button
                    Button(action: login) {
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
                                .fill(QMDesign.Colors.primaryGradient)
                        )
                        .foregroundColor(.white)
                    }
                    .buttonStyle(.plain)
                    .disabled(isLoading || email.isEmpty || password.isEmpty)
                    .opacity(email.isEmpty || password.isEmpty ? 0.6 : 1)

                    // Divider
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

                    // Device code button
                    Button(action: startDeviceCodeFlow) {
                        HStack(spacing: QMDesign.Spacing.sm) {
                            Image(systemName: "qrcode")
                            Text("Use Device Code")
                        }
                        .font(QMDesign.Typography.labelSmall)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, QMDesign.Spacing.md)
                        .background(
                            RoundedRectangle(cornerRadius: QMDesign.Radius.md)
                                .fill(QMDesign.Colors.surfaceLight)
                        )
                        .foregroundColor(QMDesign.Colors.textPrimary)
                    }
                    .buttonStyle(.plain)
                    .disabled(isLoading)

                    Text("Use device code if you signed up with Google or GitHub")
                        .font(QMDesign.Typography.captionSmall)
                        .foregroundColor(QMDesign.Colors.textTertiary)
                }
                .padding(QMDesign.Spacing.lg)
                .background(
                    RoundedRectangle(cornerRadius: QMDesign.Radius.lg)
                        .fill(QMDesign.Colors.surfaceLight)
                        .overlay(
                            RoundedRectangle(cornerRadius: QMDesign.Radius.lg)
                                .stroke(QMDesign.Colors.borderSubtle, lineWidth: 1)
                        )
                )
                .padding(.horizontal, QMDesign.Spacing.xl)
            }

            Spacer()

            // Skip option
            if !authManager.isAuthenticated {
                Button(action: onContinue) {
                    Text("Skip for now")
                        .font(QMDesign.Typography.bodySmall)
                        .foregroundColor(QMDesign.Colors.textTertiary)
                }
                .buttonStyle(.plain)
                .padding(.bottom, QMDesign.Spacing.xxl)
            }
        }
        .padding(.horizontal, QMDesign.Spacing.lg)
    }

    // MARK: - Actions

    private func login() {
        isLoading = true
        errorMessage = ""

        Task {
            do {
                try await authManager.loginWithCredentials(email: email, password: password)
            } catch AuthError.oauthUserNeedsDeviceCode {
                errorMessage = "This account uses social login. Please use the device code option."
            } catch {
                errorMessage = error.localizedDescription
            }
            isLoading = false
        }
    }

    private func startDeviceCodeFlow() {
        isLoading = true
        errorMessage = ""

        Task {
            do {
                let response = try await authManager.startDeviceCodeFlow()
                deviceCodeResponse = response
                showDeviceCode = true
            } catch {
                errorMessage = error.localizedDescription
            }
            isLoading = false
        }
    }

    private func cancelDeviceCode() {
        authManager.cancelDeviceCodeFlow()
        showDeviceCode = false
        deviceCodeResponse = nil
    }
}

// MARK: - Device Code Display

private struct DeviceCodeDisplayView: View {
    let response: DeviceCodeResponse
    let onCancel: () -> Void

    @StateObject private var authManager = AuthenticationManager.shared
    @State private var timeRemaining: Int

    init(response: DeviceCodeResponse, onCancel: @escaping () -> Void) {
        self.response = response
        self.onCancel = onCancel
        self._timeRemaining = State(initialValue: response.expiresIn)
    }

    var body: some View {
        VStack(spacing: QMDesign.Spacing.lg) {
            Text("Enter this code on")
                .font(QMDesign.Typography.bodySmall)
                .foregroundColor(QMDesign.Colors.textSecondary)

            Link(destination: URL(string: response.verificationUrl)!) {
                Text(response.verificationUrl)
                    .font(QMDesign.Typography.bodySmall)
                    .foregroundStyle(QMDesign.Colors.primaryGradient)
            }

            // Code display
            HStack(spacing: QMDesign.Spacing.sm) {
                ForEach(Array(response.userCode), id: \.self) { char in
                    Text(String(char))
                        .font(.system(size: 32, weight: .bold, design: .monospaced))
                        .foregroundStyle(char == "-" ? AnyShapeStyle(QMDesign.Colors.textTertiary) : AnyShapeStyle(QMDesign.Colors.primaryGradient))
                        .frame(width: char == "-" ? 20 : 44, height: 56)
                        .background(
                            char == "-" ? Color.clear :
                            RoundedRectangle(cornerRadius: QMDesign.Radius.md)
                                .fill(QMDesign.Colors.surfaceLight)
                        )
                }
            }

            // Status
            if case .authenticated = authManager.authState {
                HStack(spacing: QMDesign.Spacing.sm) {
                    Image(systemName: "checkmark.circle.fill")
                        .foregroundColor(QMDesign.Colors.success)
                    Text("Connected!")
                        .foregroundColor(QMDesign.Colors.success)
                }
                .font(QMDesign.Typography.bodyMedium)
            } else {
                HStack(spacing: QMDesign.Spacing.sm) {
                    ProgressView()
                        .scaleEffect(0.8)
                    Text("Waiting for authorization...")
                        .foregroundColor(QMDesign.Colors.textSecondary)
                }
                .font(QMDesign.Typography.caption)

                Text("Expires in \(timeRemaining / 60):\(String(format: "%02d", timeRemaining % 60))")
                    .font(QMDesign.Typography.captionSmall)
                    .foregroundColor(QMDesign.Colors.textTertiary)
            }

            Button(action: onCancel) {
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
        .onReceive(Timer.publish(every: 1, on: .main, in: .common).autoconnect()) { _ in
            if timeRemaining > 0 {
                timeRemaining -= 1
            }
        }
    }
}

// MARK: - Authenticated View

private struct AuthenticatedView: View {
    let user: AuthUser?
    let onContinue: () -> Void

    @State private var isButtonHovered = false

    var body: some View {
        VStack(spacing: QMDesign.Spacing.lg) {
            // Success icon
            ZStack {
                Circle()
                    .fill(QMDesign.Colors.success.opacity(0.1))
                    .frame(width: 64, height: 64)
                Image(systemName: "checkmark.circle.fill")
                    .font(.system(size: 32))
                    .foregroundColor(QMDesign.Colors.success)
            }

            Text("Connected!")
                .font(QMDesign.Typography.titleSmall)
                .foregroundColor(QMDesign.Colors.textPrimary)

            if let user = user {
                VStack(spacing: QMDesign.Spacing.xs) {
                    Text(user.displayName)
                        .font(QMDesign.Typography.bodyMedium)
                        .foregroundColor(QMDesign.Colors.textPrimary)
                    Text(user.email)
                        .font(QMDesign.Typography.caption)
                        .foregroundColor(QMDesign.Colors.textSecondary)
                }
            }

            Button(action: onContinue) {
                HStack(spacing: QMDesign.Spacing.sm) {
                    Text("Continue")
                        .font(QMDesign.Typography.labelMedium)
                    Image(systemName: "arrow.right")
                        .font(.system(size: 14, weight: .semibold))
                }
                .padding(.horizontal, QMDesign.Spacing.xl)
                .padding(.vertical, QMDesign.Spacing.md)
                .background(
                    Capsule()
                        .fill(QMDesign.Colors.primaryGradient)
                )
                .foregroundColor(.white)
                .scaleEffect(isButtonHovered ? 1.05 : 1.0)
            }
            .buttonStyle(.plain)
            .onHover { isButtonHovered = $0 }
            .animation(QMDesign.Animation.smooth, value: isButtonHovered)
        }
        .padding(QMDesign.Spacing.xl)
        .background(
            RoundedRectangle(cornerRadius: QMDesign.Radius.lg)
                .fill(QMDesign.Colors.surfaceLight)
        )
    }
}
