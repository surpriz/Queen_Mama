import SwiftUI

/// Onboarding step for account connection - Device code flow or Registration
struct AccountStepView: View {
    let onContinue: () -> Void

    @StateObject private var authManager = AuthenticationManager.shared
    @State private var isLoading = false
    @State private var errorMessage = ""
    @State private var deviceCodeResponse: DeviceCodeResponse?
    @State private var isButtonHovered = false
    @State private var showRegistrationForm = false

    var body: some View {
        if showRegistrationForm {
            // Registration form
            ScrollView {
                VStack(spacing: QMDesign.Spacing.lg) {
                    RegistrationFormView(showRegistrationForm: $showRegistrationForm)

                    // Skip option
                    Button(action: onContinue) {
                        Text("Skip for now")
                            .font(QMDesign.Typography.bodySmall)
                            .foregroundColor(QMDesign.Colors.textTertiary)
                    }
                    .buttonStyle(.plain)
                    .padding(.bottom, QMDesign.Spacing.lg)
                }
            }
            .onChange(of: authManager.authState) { oldState, newState in
                if case .authenticated = newState {
                    // Auto-continue when registration succeeds
                    onContinue()
                }
            }
        } else {
            // Device code flow
            deviceCodeFlowView
        }
    }

    private var deviceCodeFlowView: some View {
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

            // Content based on auth state
            if case .authenticated = authManager.authState {
                AuthenticatedView(
                    user: authManager.currentUser,
                    onContinue: onContinue
                )
                .padding(.horizontal, QMDesign.Spacing.xl)
            } else if let response = deviceCodeResponse {
                DeviceCodeDisplayView(
                    response: response,
                    onCancel: cancelDeviceCode
                )
                .padding(.horizontal, QMDesign.Spacing.xl)
            } else {
                // Connect button + Create account link
                VStack(spacing: QMDesign.Spacing.md) {
                    ConnectAccountView(
                        isLoading: isLoading,
                        errorMessage: errorMessage,
                        onConnect: startDeviceCodeFlow
                    )

                    // Create account link
                    Button(action: { showRegistrationForm = true }) {
                        HStack(spacing: QMDesign.Spacing.xxs) {
                            Text("Don't have an account?")
                                .foregroundColor(QMDesign.Colors.textSecondary)
                            Text("Create one")
                                .foregroundStyle(QMDesign.Colors.primaryGradient)
                        }
                        .font(QMDesign.Typography.bodySmall)
                    }
                    .buttonStyle(.plain)
                }
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
        .onChange(of: authManager.authState) { oldState, newState in
            if case .authenticated = newState {
                deviceCodeResponse = nil
                isLoading = false
            }
        }
    }

    // MARK: - Actions

    private func startDeviceCodeFlow() {
        isLoading = true
        errorMessage = ""

        Task {
            do {
                let response = try await authManager.startDeviceCodeFlow()
                deviceCodeResponse = response

                // Auto-open browser to authorization page
                if let url = URL(string: response.verificationUrl) {
                    NSWorkspace.shared.open(url)
                }
            } catch {
                errorMessage = error.localizedDescription
            }
            isLoading = false
        }
    }

    private func cancelDeviceCode() {
        authManager.cancelDeviceCodeFlow()
        deviceCodeResponse = nil
    }
}

// MARK: - Connect Account View

private struct ConnectAccountView: View {
    let isLoading: Bool
    let errorMessage: String
    let onConnect: () -> Void

    @State private var isButtonHovered = false

    var body: some View {
        VStack(spacing: QMDesign.Spacing.lg) {
            // Icon
            ZStack {
                Circle()
                    .fill(QMDesign.Colors.surfaceLight)
                    .frame(width: 64, height: 64)
                Image(systemName: "link.badge.plus")
                    .font(.system(size: 28))
                    .foregroundStyle(QMDesign.Colors.primaryGradient)
            }

            VStack(spacing: QMDesign.Spacing.sm) {
                Text("Quick & Secure")
                    .font(QMDesign.Typography.labelMedium)
                    .foregroundColor(QMDesign.Colors.textPrimary)

                Text("Your browser will open to complete sign in.\nWorks with email, Google, or GitHub accounts.")
                    .font(QMDesign.Typography.caption)
                    .foregroundColor(QMDesign.Colors.textSecondary)
                    .multilineTextAlignment(.center)
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

            // Connect button
            Button(action: onConnect) {
                HStack(spacing: QMDesign.Spacing.sm) {
                    if isLoading {
                        ProgressView()
                            .scaleEffect(0.8)
                            .progressViewStyle(CircularProgressViewStyle(tint: .white))
                    } else {
                        Image(systemName: "arrow.up.right.square")
                    }
                    Text(isLoading ? "Opening browser..." : "Connect Account")
                        .font(QMDesign.Typography.labelMedium)
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, QMDesign.Spacing.md)
                .background(
                    RoundedRectangle(cornerRadius: QMDesign.Radius.md)
                        .fill(QMDesign.Colors.primaryGradient)
                )
                .foregroundColor(.white)
                .scaleEffect(isButtonHovered ? 1.02 : 1.0)
            }
            .buttonStyle(.plain)
            .disabled(isLoading)
            .onHover { isButtonHovered = $0 }
            .animation(QMDesign.Animation.smooth, value: isButtonHovered)
        }
        .padding(QMDesign.Spacing.xl)
        .background(
            RoundedRectangle(cornerRadius: QMDesign.Radius.lg)
                .fill(QMDesign.Colors.surfaceLight)
                .overlay(
                    RoundedRectangle(cornerRadius: QMDesign.Radius.lg)
                        .stroke(QMDesign.Colors.borderSubtle, lineWidth: 1)
                )
        )
    }
}

// MARK: - Device Code Display

private struct DeviceCodeDisplayView: View {
    let response: DeviceCodeResponse
    let onCancel: () -> Void

    @StateObject private var authManager = AuthenticationManager.shared
    @State private var timeRemaining: Int
    @State private var showCopied = false

    init(response: DeviceCodeResponse, onCancel: @escaping () -> Void) {
        self.response = response
        self.onCancel = onCancel
        self._timeRemaining = State(initialValue: response.expiresIn)
    }

    var body: some View {
        VStack(spacing: QMDesign.Spacing.lg) {
            // Browser opened indicator
            HStack(spacing: QMDesign.Spacing.sm) {
                Image(systemName: "safari")
                    .foregroundStyle(QMDesign.Colors.primaryGradient)
                Text("Browser opened")
                    .foregroundColor(QMDesign.Colors.textSecondary)
            }
            .font(QMDesign.Typography.caption)

            Text("Enter this code:")
                .font(QMDesign.Typography.bodySmall)
                .foregroundColor(QMDesign.Colors.textSecondary)

            // Code display with copy button
            VStack(spacing: QMDesign.Spacing.sm) {
                HStack(spacing: QMDesign.Spacing.sm) {
                    ForEach(Array(response.userCode), id: \.self) { char in
                        CodeCharView(char: char)
                    }
                }

                // Copy button
                Button(action: copyCode) {
                    HStack(spacing: QMDesign.Spacing.xs) {
                        Image(systemName: showCopied ? "checkmark" : "doc.on.doc")
                        Text(showCopied ? "Copied!" : "Copy code")
                    }
                    .font(QMDesign.Typography.caption)
                    .foregroundColor(showCopied ? QMDesign.Colors.success : QMDesign.Colors.textSecondary)
                    .padding(.horizontal, QMDesign.Spacing.md)
                    .padding(.vertical, QMDesign.Spacing.xs)
                    .background(
                        Capsule()
                            .fill(showCopied ? QMDesign.Colors.success.opacity(0.1) : QMDesign.Colors.surfaceLight)
                    )
                }
                .buttonStyle(.plain)
            }

            // Clickable link as backup
            Link(destination: URL(string: response.verificationUrl)!) {
                HStack(spacing: QMDesign.Spacing.xs) {
                    Image(systemName: "arrow.up.right.square")
                    Text("Open link manually")
                }
                .font(QMDesign.Typography.captionSmall)
                .foregroundStyle(QMDesign.Colors.primaryGradient)
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

    private func copyCode() {
        NSPasteboard.general.clearContents()
        NSPasteboard.general.setString(response.userCode, forType: .string)
        showCopied = true

        // Reset after 2 seconds
        DispatchQueue.main.asyncAfter(deadline: .now() + 2) {
            showCopied = false
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

// MARK: - Code Character View

private struct CodeCharView: View {
    let char: Character

    var body: some View {
        let isDash = char == "-"

        Text(String(char))
            .font(.system(size: 32, weight: .bold, design: .monospaced))
            .foregroundStyle(isDash ? AnyShapeStyle(QMDesign.Colors.textTertiary) : AnyShapeStyle(QMDesign.Colors.primaryGradient))
            .frame(width: isDash ? 20 : 44, height: 56)
            .background(
                Group {
                    if isDash {
                        Color.clear
                    } else {
                        RoundedRectangle(cornerRadius: QMDesign.Radius.md)
                            .fill(QMDesign.Colors.surfaceLight)
                    }
                }
            )
    }
}
