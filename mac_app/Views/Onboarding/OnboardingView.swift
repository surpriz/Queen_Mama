//
//  OnboardingView.swift
//  QueenMama
//
//  Modern onboarding flow for new users
//

import SwiftUI

struct OnboardingView: View {
    @StateObject private var config = ConfigurationManager.shared
    @State private var currentStep: OnboardingStep = .welcome
    @State private var isAnimating = false

    let onComplete: () -> Void

    var body: some View {
        ZStack {
            // Gradient background
            QMDesign.Colors.backgroundPrimary
                .ignoresSafeArea()

            // Subtle gradient overlay
            LinearGradient(
                colors: [
                    QMDesign.Colors.accent.opacity(0.05),
                    Color.clear,
                    QMDesign.Colors.gradientEnd.opacity(0.03)
                ],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
            .ignoresSafeArea()

            VStack(spacing: 0) {
                // Step Indicator
                OnboardingStepIndicator(currentStep: currentStep)
                    .padding(.top, QMDesign.Spacing.lg)
                    .padding(.bottom, QMDesign.Spacing.md)

                // Content - use Group instead of TabView to avoid macOS tab bar
                Group {
                    switch currentStep {
                    case .welcome:
                        WelcomeStepView(onContinue: { goToStep(.permissions) })
                    case .permissions:
                        PermissionsStepView(onContinue: { goToStep(.account) })
                    case .account:
                        // Skip API Keys step - now managed by backend proxy
                        AccountStepView(onContinue: { goToStep(.quickTour) })
                    case .quickTour:
                        QuickTourStepView(onContinue: { goToStep(.ready) })
                    case .ready:
                        ReadyStepView(onComplete: completeOnboarding)
                    }
                }
                .animation(QMDesign.Animation.smooth, value: currentStep)
            }
        }
        .frame(minWidth: 700, minHeight: 720)
    }

    private func goToStep(_ step: OnboardingStep) {
        withAnimation(QMDesign.Animation.smooth) {
            currentStep = step
        }
    }

    private func completeOnboarding() {
        config.hasCompletedOnboarding = true
        onComplete()
    }
}

// MARK: - Onboarding Step

enum OnboardingStep: Int, CaseIterable {
    case welcome = 0
    case permissions = 1
    case account = 2
    case quickTour = 3
    case ready = 4

    var title: String {
        switch self {
        case .welcome: return "Welcome"
        case .permissions: return "Permissions"
        case .account: return "Account"
        case .quickTour: return "Tour"
        case .ready: return "Ready"
        }
    }
}

// MARK: - Step Indicator

struct OnboardingStepIndicator: View {
    let currentStep: OnboardingStep

    var body: some View {
        HStack(spacing: QMDesign.Spacing.md) {
            ForEach(OnboardingStep.allCases, id: \.rawValue) { step in
                HStack(spacing: QMDesign.Spacing.xs) {
                    // Step circle
                    ZStack {
                        Circle()
                            .fill(step.rawValue <= currentStep.rawValue
                                  ? QMDesign.Colors.accent
                                  : QMDesign.Colors.surfaceMedium)
                            .frame(width: 28, height: 28)

                        if step.rawValue < currentStep.rawValue {
                            Image(systemName: "checkmark")
                                .font(.system(size: 12, weight: .bold))
                                .foregroundColor(.white)
                        } else {
                            Text("\(step.rawValue + 1)")
                                .font(QMDesign.Typography.captionSmall)
                                .fontWeight(.semibold)
                                .foregroundColor(step.rawValue <= currentStep.rawValue ? .white : QMDesign.Colors.textTertiary)
                        }
                    }

                    if step != OnboardingStep.allCases.last {
                        // Connector line
                        Rectangle()
                            .fill(step.rawValue < currentStep.rawValue
                                  ? QMDesign.Colors.accent
                                  : QMDesign.Colors.surfaceMedium)
                            .frame(width: 40, height: 2)
                    }
                }
            }
        }
        .padding(.horizontal, QMDesign.Spacing.lg)
    }
}

// MARK: - Welcome Step

struct WelcomeStepView: View {
    let onContinue: () -> Void
    @State private var isAnimating = false
    @State private var isButtonHovered = false

    var body: some View {
        VStack(spacing: QMDesign.Spacing.xl) {
            Spacer()

            // Hero Section
            VStack(spacing: QMDesign.Spacing.lg) {
                // Animated Logo
                ZStack {
                    Circle()
                        .fill(QMDesign.Colors.primaryGradient.opacity(0.1))
                        .frame(width: 140, height: 140)
                        .scaleEffect(isAnimating ? 1.1 : 1.0)

                    Circle()
                        .fill(QMDesign.Colors.primaryGradient.opacity(0.2))
                        .frame(width: 100, height: 100)
                        .scaleEffect(isAnimating ? 1.05 : 1.0)

                    Circle()
                        .fill(QMDesign.Colors.primaryGradient)
                        .frame(width: 64, height: 64)

                    Image(systemName: "waveform")
                        .font(.system(size: 28, weight: .bold))
                        .foregroundColor(.white)
                }
                .animation(
                    Animation.easeInOut(duration: 2)
                        .repeatForever(autoreverses: true),
                    value: isAnimating
                )
                .onAppear { isAnimating = true }

                // Title
                VStack(spacing: QMDesign.Spacing.sm) {
                    Text("Welcome to")
                        .font(QMDesign.Typography.titleSmall)
                        .foregroundColor(QMDesign.Colors.textSecondary)

                    Text("Queen Mama")
                        .font(.system(size: 36, weight: .bold))
                        .foregroundStyle(QMDesign.Colors.primaryGradient)
                }
            }

            // Features List
            VStack(spacing: QMDesign.Spacing.md) {
                FeatureRow(icon: "waveform", title: "Real-time Transcription", description: "Live speech-to-text during calls and meetings")
                FeatureRow(icon: "sparkles", title: "AI Assistance", description: "Get contextual suggestions and responses")
                FeatureRow(icon: "eye.slash", title: "Undetectable", description: "Hidden from screen recordings and shares")
            }
            .padding(.horizontal, QMDesign.Spacing.xl)

            Spacer()

            // Continue Button
            Button(action: onContinue) {
                HStack(spacing: QMDesign.Spacing.sm) {
                    Text("Get Started")
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
                .shadow(
                    color: QMDesign.Colors.accent.opacity(isButtonHovered ? 0.4 : 0.2),
                    radius: isButtonHovered ? 16 : 8,
                    y: isButtonHovered ? 8 : 4
                )
            }
            .buttonStyle(.plain)
            .onHover { isButtonHovered = $0 }
            .animation(QMDesign.Animation.smooth, value: isButtonHovered)
            .padding(.bottom, QMDesign.Spacing.xxl)
        }
        .padding(.horizontal, QMDesign.Spacing.lg)
    }
}

struct FeatureRow: View {
    let icon: String
    let title: String
    let description: String

    var body: some View {
        HStack(spacing: QMDesign.Spacing.md) {
            ZStack {
                Circle()
                    .fill(QMDesign.Colors.accent.opacity(0.1))
                    .frame(width: 44, height: 44)
                Image(systemName: icon)
                    .font(.system(size: 18))
                    .foregroundStyle(QMDesign.Colors.primaryGradient)
            }

            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(QMDesign.Typography.bodyMedium)
                    .foregroundColor(QMDesign.Colors.textPrimary)
                Text(description)
                    .font(QMDesign.Typography.caption)
                    .foregroundColor(QMDesign.Colors.textTertiary)
            }

            Spacer()
        }
        .padding(QMDesign.Spacing.md)
        .background(
            RoundedRectangle(cornerRadius: QMDesign.Radius.md)
                .fill(QMDesign.Colors.surfaceLight)
        )
    }
}

// MARK: - Permissions Step

struct PermissionsStepView: View {
    let onContinue: () -> Void

    @State private var hasMicPermission = false
    @State private var hasScreenPermission = false
    @State private var hasAccessibilityPermission = false
    @State private var isButtonHovered = false

    var body: some View {
        ScrollView {
            VStack(spacing: QMDesign.Spacing.lg) {
                // Header
                VStack(spacing: QMDesign.Spacing.md) {
                    ZStack {
                        Circle()
                            .fill(QMDesign.Colors.primaryGradient.opacity(0.1))
                            .frame(width: 80, height: 80)
                        Image(systemName: "shield.checkered")
                            .font(.system(size: 32))
                            .foregroundStyle(QMDesign.Colors.primaryGradient)
                    }

                    Text("Permissions Required")
                        .font(QMDesign.Typography.titleMedium)
                        .foregroundColor(QMDesign.Colors.textPrimary)

                    Text("Queen Mama needs access to your microphone and screen to provide real-time assistance.")
                        .font(QMDesign.Typography.bodySmall)
                        .foregroundColor(QMDesign.Colors.textSecondary)
                        .multilineTextAlignment(.center)
                        .padding(.horizontal, QMDesign.Spacing.xl)
                }
                .padding(.top, QMDesign.Spacing.lg)

                // Permission Cards
                VStack(spacing: QMDesign.Spacing.sm) {
                    PermissionCard(
                        icon: "mic.fill",
                        title: "Microphone Access",
                        description: "Record your voice during calls and meetings",
                        isGranted: hasMicPermission,
                        isOptional: false,
                        onRequest: requestMicrophonePermission
                    )

                    PermissionCard(
                        icon: "rectangle.dashed.badge.record",
                        title: "Screen Recording",
                        description: "Capture screen for visual context analysis",
                        isGranted: hasScreenPermission,
                        isOptional: false,
                        onRequest: requestScreenPermission
                    )

                    PermissionCard(
                        icon: "keyboard",
                        title: "Accessibility",
                        description: "Enable global keyboard shortcuts (optional)",
                        isGranted: hasAccessibilityPermission,
                        isOptional: true,
                        onRequest: requestAccessibilityPermission
                    )
                }
                .padding(.horizontal, QMDesign.Spacing.xl)

                // Info
                HStack(alignment: .top, spacing: QMDesign.Spacing.sm) {
                    Image(systemName: "info.circle.fill")
                        .foregroundStyle(QMDesign.Colors.primaryGradient)
                    Text("You can modify these permissions later in System Settings.")
                        .font(QMDesign.Typography.caption)
                        .foregroundColor(QMDesign.Colors.textTertiary)
                }
                .padding(QMDesign.Spacing.md)
                .background(
                    RoundedRectangle(cornerRadius: QMDesign.Radius.md)
                        .fill(QMDesign.Colors.accent.opacity(0.05))
                )
                .padding(.horizontal, QMDesign.Spacing.xl)

                // Continue Button
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
                .padding(.vertical, QMDesign.Spacing.xl)
            }
            .padding(.horizontal, QMDesign.Spacing.lg)
        }
        .onAppear {
            checkPermissions()
        }
    }

    private func checkPermissions() {
        // Check microphone
        switch AVCaptureDevice.authorizationStatus(for: .audio) {
        case .authorized:
            hasMicPermission = true
        default:
            hasMicPermission = false
        }

        // Screen recording
        hasScreenPermission = CGPreflightScreenCaptureAccess()

        // Accessibility - check if trusted
        hasAccessibilityPermission = AXIsProcessTrusted()
    }

    private func requestMicrophonePermission() {
        AVCaptureDevice.requestAccess(for: .audio) { granted in
            DispatchQueue.main.async {
                hasMicPermission = granted
            }
        }
    }

    private func requestScreenPermission() {
        CGRequestScreenCaptureAccess()
        DispatchQueue.main.asyncAfter(deadline: .now() + 1) {
            hasScreenPermission = CGPreflightScreenCaptureAccess()
        }
    }

    private func requestAccessibilityPermission() {
        // Open System Settings to Accessibility
        let options: NSDictionary = [kAXTrustedCheckOptionPrompt.takeRetainedValue(): true]
        let _ = AXIsProcessTrustedWithOptions(options)
        // Check again after a delay
        DispatchQueue.main.asyncAfter(deadline: .now() + 2) {
            hasAccessibilityPermission = AXIsProcessTrusted()
        }
    }
}

import AVFoundation

struct PermissionCard: View {
    let icon: String
    let title: String
    let description: String
    let isGranted: Bool
    var isOptional: Bool = false
    let onRequest: () -> Void

    @State private var isHovered = false

    var body: some View {
        HStack(spacing: QMDesign.Spacing.md) {
            // Icon
            ZStack {
                Circle()
                    .fill(isGranted ? QMDesign.Colors.success.opacity(0.1) : QMDesign.Colors.surfaceLight)
                    .frame(width: 48, height: 48)
                Image(systemName: icon)
                    .font(.system(size: 20))
                    .foregroundColor(isGranted ? QMDesign.Colors.success : QMDesign.Colors.textSecondary)
            }

            // Info
            VStack(alignment: .leading, spacing: 4) {
                HStack(spacing: QMDesign.Spacing.xs) {
                    Text(title)
                        .font(QMDesign.Typography.bodyMedium)
                        .foregroundColor(QMDesign.Colors.textPrimary)

                    if isGranted {
                        Image(systemName: "checkmark.circle.fill")
                            .font(.system(size: 14))
                            .foregroundColor(QMDesign.Colors.success)
                    }

                    if isOptional && !isGranted {
                        Text("Optional")
                            .font(QMDesign.Typography.captionSmall)
                            .foregroundColor(QMDesign.Colors.textTertiary)
                            .padding(.horizontal, 6)
                            .padding(.vertical, 2)
                            .background(
                                Capsule()
                                    .fill(QMDesign.Colors.surfaceMedium)
                            )
                    }
                }
                Text(description)
                    .font(QMDesign.Typography.caption)
                    .foregroundColor(QMDesign.Colors.textTertiary)
            }

            Spacer()

            // Request button
            if !isGranted {
                Button(action: onRequest) {
                    Text("Grant")
                        .font(QMDesign.Typography.labelSmall)
                        .foregroundColor(isOptional ? QMDesign.Colors.textPrimary : .white)
                        .padding(.horizontal, QMDesign.Spacing.md)
                        .padding(.vertical, QMDesign.Spacing.sm)
                        .background(
                            Capsule()
                                .fill(isOptional ? AnyShapeStyle(QMDesign.Colors.surfaceMedium) : AnyShapeStyle(QMDesign.Colors.primaryGradient))
                        )
                }
                .buttonStyle(.plain)
            }
        }
        .padding(QMDesign.Spacing.md)
        .background(
            RoundedRectangle(cornerRadius: QMDesign.Radius.lg)
                .fill(QMDesign.Colors.surfaceLight)
                .overlay(
                    RoundedRectangle(cornerRadius: QMDesign.Radius.lg)
                        .stroke(isGranted ? QMDesign.Colors.success.opacity(0.3) : QMDesign.Colors.borderSubtle, lineWidth: 1)
                )
        )
        .onHover { isHovered = $0 }
    }
}

// MARK: - Quick Tour Step

struct QuickTourStepView: View {
    let onContinue: () -> Void
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
                    Image(systemName: "lightbulb.fill")
                        .font(.system(size: 32))
                        .foregroundStyle(QMDesign.Colors.primaryGradient)
                }

                Text("Quick Tour")
                    .font(QMDesign.Typography.titleMedium)
                    .foregroundColor(QMDesign.Colors.textPrimary)
            }

            // Tips
            VStack(spacing: QMDesign.Spacing.md) {
                TourTipCard(
                    icon: "command",
                    shortcut: "Cmd+Shift+S",
                    title: "Start Session",
                    description: "Begin recording and transcription"
                )

                TourTipCard(
                    icon: "option",
                    shortcut: "Cmd+\\",
                    title: "Toggle Widget",
                    description: "Show or hide the overlay widget"
                )

                TourTipCard(
                    icon: "return",
                    shortcut: "Cmd+Enter",
                    title: "Ask AI",
                    description: "Get assistance based on current context"
                )

                TourTipCard(
                    icon: "r.circle",
                    shortcut: "Cmd+R",
                    title: "Clear Context",
                    description: "Reset transcript and context"
                )
            }
            .padding(.horizontal, QMDesign.Spacing.xl)

            Spacer()

            // Continue Button
            Button(action: onContinue) {
                HStack(spacing: QMDesign.Spacing.sm) {
                    Text("Got it!")
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
            .padding(.bottom, QMDesign.Spacing.xxl)
        }
        .padding(.horizontal, QMDesign.Spacing.lg)
    }
}

struct TourTipCard: View {
    let icon: String
    let shortcut: String
    let title: String
    let description: String

    var body: some View {
        HStack(spacing: QMDesign.Spacing.md) {
            KeyboardShortcutBadge(shortcut: shortcut, size: .medium)

            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(QMDesign.Typography.bodyMedium)
                    .foregroundColor(QMDesign.Colors.textPrimary)
                Text(description)
                    .font(QMDesign.Typography.caption)
                    .foregroundColor(QMDesign.Colors.textTertiary)
            }

            Spacer()
        }
        .padding(QMDesign.Spacing.md)
        .background(
            RoundedRectangle(cornerRadius: QMDesign.Radius.md)
                .fill(QMDesign.Colors.surfaceLight)
        )
    }
}

// MARK: - Ready Step

struct ReadyStepView: View {
    let onComplete: () -> Void

    @State private var isAnimating = false
    @State private var isButtonHovered = false

    var body: some View {
        VStack(spacing: QMDesign.Spacing.xl) {
            Spacer()

            // Celebration Animation
            ZStack {
                // Particles
                ForEach(0..<8, id: \.self) { index in
                    Circle()
                        .fill(QMDesign.Colors.accent.opacity(0.5))
                        .frame(width: 8, height: 8)
                        .offset(
                            x: isAnimating ? CGFloat.random(in: -60...60) : 0,
                            y: isAnimating ? CGFloat.random(in: -60...60) : 0
                        )
                        .opacity(isAnimating ? 0 : 1)
                }

                Circle()
                    .fill(QMDesign.Colors.primaryGradient.opacity(0.1))
                    .frame(width: 140, height: 140)
                    .scaleEffect(isAnimating ? 1.2 : 1.0)

                Circle()
                    .fill(QMDesign.Colors.primaryGradient.opacity(0.2))
                    .frame(width: 100, height: 100)

                Circle()
                    .fill(QMDesign.Colors.primaryGradient)
                    .frame(width: 64, height: 64)

                Image(systemName: "checkmark")
                    .font(.system(size: 28, weight: .bold))
                    .foregroundColor(.white)
            }
            .animation(
                Animation.easeOut(duration: 1.5)
                    .repeatForever(autoreverses: true),
                value: isAnimating
            )
            .onAppear { isAnimating = true }

            // Text
            VStack(spacing: QMDesign.Spacing.md) {
                Text("You're All Set!")
                    .font(.system(size: 32, weight: .bold))
                    .foregroundStyle(QMDesign.Colors.primaryGradient)

                Text("Queen Mama is ready to assist you during your calls, meetings, and interviews.")
                    .font(QMDesign.Typography.bodyMedium)
                    .foregroundColor(QMDesign.Colors.textSecondary)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, QMDesign.Spacing.xl)
            }

            Spacer()

            // Start Button
            Button(action: onComplete) {
                HStack(spacing: QMDesign.Spacing.sm) {
                    Image(systemName: "play.fill")
                        .font(.system(size: 14, weight: .semibold))
                    Text("Start First Session")
                        .font(QMDesign.Typography.labelMedium)
                }
                .padding(.horizontal, QMDesign.Spacing.xl)
                .padding(.vertical, QMDesign.Spacing.md)
                .background(
                    Capsule()
                        .fill(QMDesign.Colors.primaryGradient)
                )
                .foregroundColor(.white)
                .scaleEffect(isButtonHovered ? 1.05 : 1.0)
                .shadow(
                    color: QMDesign.Colors.accent.opacity(isButtonHovered ? 0.5 : 0.3),
                    radius: isButtonHovered ? 20 : 12,
                    y: isButtonHovered ? 10 : 6
                )
            }
            .buttonStyle(.plain)
            .onHover { isButtonHovered = $0 }
            .animation(QMDesign.Animation.smooth, value: isButtonHovered)
            .padding(.bottom, QMDesign.Spacing.xxl)
        }
        .padding(.horizontal, QMDesign.Spacing.lg)
    }
}
