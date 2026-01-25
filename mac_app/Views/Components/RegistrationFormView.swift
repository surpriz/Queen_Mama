//
//  RegistrationFormView.swift
//  QueenMama
//
//  Registration form for creating a new account directly in the app
//

import SwiftUI

struct RegistrationFormView: View {
    @StateObject private var authManager = AuthenticationManager.shared
    @Binding var showRegistrationForm: Bool

    @State private var name = ""
    @State private var email = ""
    @State private var password = ""
    @State private var confirmPassword = ""
    @State private var isRegistering = false
    @State private var registrationError: String?
    @State private var showPassword = false
    @State private var showConfirmPassword = false

    var body: some View {
        VStack(spacing: QMDesign.Spacing.xl) {
            // Header
            VStack(spacing: QMDesign.Spacing.sm) {
                ZStack {
                    Circle()
                        .fill(QMDesign.Colors.primaryGradient)
                        .frame(width: 64, height: 64)
                    Image(systemName: "person.badge.plus")
                        .font(.system(size: 28, weight: .bold))
                        .foregroundColor(.white)
                }

                Text("Create Account")
                    .font(QMDesign.Typography.titleSmall)
                    .foregroundColor(QMDesign.Colors.textPrimary)

                Text("Sign up to start using Queen Mama")
                    .font(QMDesign.Typography.bodySmall)
                    .foregroundColor(QMDesign.Colors.textSecondary)
            }

            // Form
            VStack(spacing: QMDesign.Spacing.md) {
                // Name field
                VStack(alignment: .leading, spacing: QMDesign.Spacing.xs) {
                    Text("Name")
                        .font(QMDesign.Typography.labelSmall)
                        .foregroundColor(QMDesign.Colors.textSecondary)

                    TextField("Your name", text: $name)
                        .textFieldStyle(.plain)
                        .font(QMDesign.Typography.bodyMedium)
                        .foregroundColor(QMDesign.Colors.textPrimary)
                        .qmInputField()
                }

                // Email field
                VStack(alignment: .leading, spacing: QMDesign.Spacing.xs) {
                    Text("Email")
                        .font(QMDesign.Typography.labelSmall)
                        .foregroundColor(QMDesign.Colors.textSecondary)

                    TextField("your@email.com", text: $email)
                        .textFieldStyle(.plain)
                        .font(QMDesign.Typography.bodyMedium)
                        .foregroundColor(QMDesign.Colors.textPrimary)
                        .textContentType(.emailAddress)
                        .qmInputField()
                }

                // Password field
                VStack(alignment: .leading, spacing: QMDesign.Spacing.xs) {
                    Text("Password")
                        .font(QMDesign.Typography.labelSmall)
                        .foregroundColor(QMDesign.Colors.textSecondary)

                    HStack {
                        if showPassword {
                            TextField("Create a password", text: $password)
                                .textFieldStyle(.plain)
                        } else {
                            SecureField("Create a password", text: $password)
                                .textFieldStyle(.plain)
                        }

                        Button(action: { showPassword.toggle() }) {
                            Image(systemName: showPassword ? "eye.slash" : "eye")
                                .font(.system(size: 14))
                                .foregroundColor(QMDesign.Colors.textTertiary)
                        }
                        .buttonStyle(.plain)
                    }
                    .font(QMDesign.Typography.bodyMedium)
                    .foregroundColor(QMDesign.Colors.textPrimary)
                    .qmInputField()

                    // Password requirements checklist
                    PasswordRequirementsView(password: password)
                }

                // Confirm Password field
                VStack(alignment: .leading, spacing: QMDesign.Spacing.xs) {
                    Text("Confirm Password")
                        .font(QMDesign.Typography.labelSmall)
                        .foregroundColor(QMDesign.Colors.textSecondary)

                    HStack {
                        if showConfirmPassword {
                            TextField("Confirm your password", text: $confirmPassword)
                                .textFieldStyle(.plain)
                        } else {
                            SecureField("Confirm your password", text: $confirmPassword)
                                .textFieldStyle(.plain)
                        }

                        Button(action: { showConfirmPassword.toggle() }) {
                            Image(systemName: showConfirmPassword ? "eye.slash" : "eye")
                                .font(.system(size: 14))
                                .foregroundColor(QMDesign.Colors.textTertiary)
                        }
                        .buttonStyle(.plain)
                    }
                    .font(QMDesign.Typography.bodyMedium)
                    .foregroundColor(QMDesign.Colors.textPrimary)
                    .qmInputField()

                    // Password match indicator
                    if !confirmPassword.isEmpty {
                        HStack(spacing: QMDesign.Spacing.xxs) {
                            Image(systemName: passwordsMatch ? "checkmark.circle.fill" : "xmark.circle.fill")
                            Text(passwordsMatch ? "Passwords match" : "Passwords do not match")
                        }
                        .font(QMDesign.Typography.captionSmall)
                        .foregroundColor(passwordsMatch ? QMDesign.Colors.success : QMDesign.Colors.error)
                    }
                }

                // Error message
                if let error = registrationError {
                    HStack(spacing: QMDesign.Spacing.xs) {
                        Image(systemName: "exclamationmark.circle.fill")
                        Text(error)
                    }
                    .font(QMDesign.Typography.caption)
                    .foregroundColor(QMDesign.Colors.error)
                    .padding(QMDesign.Spacing.sm)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(
                        RoundedRectangle(cornerRadius: QMDesign.Radius.sm)
                            .fill(QMDesign.Colors.error.opacity(0.1))
                    )
                }

                // Create Account button
                Button(action: register) {
                    HStack(spacing: QMDesign.Spacing.sm) {
                        if isRegistering {
                            ProgressView()
                                .scaleEffect(0.8)
                                .progressViewStyle(CircularProgressViewStyle(tint: .white))
                        } else {
                            Image(systemName: "person.badge.plus")
                        }
                        Text(isRegistering ? "Creating account..." : "Create Account")
                    }
                    .font(QMDesign.Typography.labelMedium)
                    .foregroundColor(.white)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, QMDesign.Spacing.md)
                    .background(
                        RoundedRectangle(cornerRadius: QMDesign.Radius.md)
                            .fill(canSubmit ? QMDesign.Colors.primaryGradient : LinearGradient(
                                colors: [QMDesign.Colors.textTertiary, QMDesign.Colors.textTertiary],
                                startPoint: .topLeading,
                                endPoint: .bottomTrailing
                            ))
                    )
                }
                .buttonStyle(.plain)
                .disabled(!canSubmit || isRegistering)
            }
            .frame(maxWidth: 320)

            // Sign in link
            Button(action: { showRegistrationForm = false }) {
                HStack(spacing: QMDesign.Spacing.xxs) {
                    Text("Already have an account?")
                        .foregroundColor(QMDesign.Colors.textSecondary)
                    Text("Sign in")
                        .foregroundStyle(QMDesign.Colors.primaryGradient)
                }
                .font(QMDesign.Typography.bodySmall)
            }
            .buttonStyle(.plain)
        }
        .padding(QMDesign.Spacing.xl)
    }

    // MARK: - Validation

    private var isNameValid: Bool {
        name.trimmingCharacters(in: .whitespaces).count >= 2
    }

    private var isEmailValid: Bool {
        let emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        return email.wholeMatch(of: emailRegex) != nil
    }

    private var passwordsMatch: Bool {
        !password.isEmpty && password == confirmPassword
    }

    private var isPasswordValid: Bool {
        let requirements = PasswordRequirements(password: password)
        return requirements.meetsAllRequirements
    }

    private var canSubmit: Bool {
        isNameValid && isEmailValid && isPasswordValid && passwordsMatch
    }

    // MARK: - Actions

    private func register() {
        isRegistering = true
        registrationError = nil

        Task {
            do {
                try await authManager.registerWithCredentials(
                    name: name.trimmingCharacters(in: .whitespaces),
                    email: email.trimmingCharacters(in: .whitespaces).lowercased(),
                    password: password
                )
                // Success - authManager will update state and AuthGateView will show main content
            } catch let error as AuthError {
                registrationError = error.errorDescription
            } catch {
                registrationError = "Registration failed. Please try again."
            }
            isRegistering = false
        }
    }
}

// MARK: - Password Requirements

struct PasswordRequirements {
    let password: String

    var hasMinLength: Bool { password.count >= 8 }
    var hasUppercase: Bool { password.range(of: "[A-Z]", options: .regularExpression) != nil }
    var hasLowercase: Bool { password.range(of: "[a-z]", options: .regularExpression) != nil }
    var hasNumber: Bool { password.range(of: "[0-9]", options: .regularExpression) != nil }

    var meetsAllRequirements: Bool {
        hasMinLength && hasUppercase && hasLowercase && hasNumber
    }
}

struct PasswordRequirementsView: View {
    let password: String

    private var requirements: PasswordRequirements {
        PasswordRequirements(password: password)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: QMDesign.Spacing.xxs) {
            RequirementRow(met: requirements.hasMinLength, text: "8+ characters")
            RequirementRow(met: requirements.hasUppercase, text: "1 uppercase letter")
            RequirementRow(met: requirements.hasLowercase, text: "1 lowercase letter")
            RequirementRow(met: requirements.hasNumber, text: "1 number")
        }
        .padding(.top, QMDesign.Spacing.xxs)
    }
}

private struct RequirementRow: View {
    let met: Bool
    let text: String

    var body: some View {
        HStack(spacing: QMDesign.Spacing.xxs) {
            Image(systemName: met ? "checkmark.circle.fill" : "circle")
                .font(.system(size: 10))
                .foregroundColor(met ? QMDesign.Colors.success : QMDesign.Colors.textTertiary)
            Text(text)
                .font(QMDesign.Typography.captionSmall)
                .foregroundColor(met ? QMDesign.Colors.success : QMDesign.Colors.textTertiary)
        }
    }
}

#Preview("Registration Form") {
    RegistrationFormView(showRegistrationForm: .constant(true))
        .frame(width: 500, height: 700)
        .background(QMDesign.Colors.backgroundPrimary)
}
