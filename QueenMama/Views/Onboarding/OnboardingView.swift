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
                        PermissionsStepView(onContinue: { goToStep(.apiKeys) })
                    case .apiKeys:
                        APIKeysStepView(onContinue: { goToStep(.quickTour) })
                    case .quickTour:
                        QuickTourStepView(onContinue: { goToStep(.ready) })
                    case .ready:
                        ReadyStepView(onComplete: completeOnboarding)
                    }
                }
                .animation(QMDesign.Animation.smooth, value: currentStep)
            }
        }
        .frame(minWidth: 700, minHeight: 650)
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
    case apiKeys = 2
    case quickTour = 3
    case ready = 4

    var title: String {
        switch self {
        case .welcome: return "Welcome"
        case .permissions: return "Permissions"
        case .apiKeys: return "API Keys"
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

            // Permission Cards
            VStack(spacing: QMDesign.Spacing.md) {
                PermissionCard(
                    icon: "mic.fill",
                    title: "Microphone Access",
                    description: "Record your voice during calls and meetings",
                    isGranted: hasMicPermission,
                    onRequest: requestMicrophonePermission
                )

                PermissionCard(
                    icon: "rectangle.dashed.badge.record",
                    title: "Screen Recording",
                    description: "Capture screen for visual context analysis",
                    isGranted: hasScreenPermission,
                    onRequest: requestScreenPermission
                )
            }
            .padding(.horizontal, QMDesign.Spacing.xl)

            // Info
            HStack(alignment: .top, spacing: QMDesign.Spacing.sm) {
                Image(systemName: "info.circle.fill")
                    .foregroundStyle(QMDesign.Colors.primaryGradient)
                Text("You can modify these permissions later in System Preferences.")
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
            .padding(.bottom, QMDesign.Spacing.xxl)
        }
        .padding(.horizontal, QMDesign.Spacing.lg)
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

        // Screen recording is harder to check, just assume false initially
        hasScreenPermission = CGPreflightScreenCaptureAccess()
    }

    private func requestMicrophonePermission() {
        AVCaptureDevice.requestAccess(for: .audio) { granted in
            DispatchQueue.main.async {
                hasMicPermission = granted
            }
        }
    }

    private func requestScreenPermission() {
        // Open System Preferences
        CGRequestScreenCaptureAccess()
        // Note: This just prompts, we need to check again
        DispatchQueue.main.asyncAfter(deadline: .now() + 1) {
            hasScreenPermission = CGPreflightScreenCaptureAccess()
        }
    }
}

import AVFoundation

struct PermissionCard: View {
    let icon: String
    let title: String
    let description: String
    let isGranted: Bool
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
                HStack {
                    Text(title)
                        .font(QMDesign.Typography.bodyMedium)
                        .foregroundColor(QMDesign.Colors.textPrimary)

                    if isGranted {
                        Image(systemName: "checkmark.circle.fill")
                            .font(.system(size: 14))
                            .foregroundColor(QMDesign.Colors.success)
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
                        .foregroundColor(.white)
                        .padding(.horizontal, QMDesign.Spacing.md)
                        .padding(.vertical, QMDesign.Spacing.sm)
                        .background(
                            Capsule()
                                .fill(QMDesign.Colors.primaryGradient)
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

// MARK: - API Keys Step

struct APIKeysStepView: View {
    let onContinue: () -> Void

    @State private var deepgramKey = ""
    @State private var openAIKey = ""
    @State private var showDeepgram = false
    @State private var showOpenAI = false
    @State private var isButtonHovered = false

    private let keychain = KeychainManager.shared

    var body: some View {
        VStack(spacing: QMDesign.Spacing.xl) {
            Spacer()

            // Header
            VStack(spacing: QMDesign.Spacing.md) {
                ZStack {
                    Circle()
                        .fill(QMDesign.Colors.primaryGradient.opacity(0.1))
                        .frame(width: 80, height: 80)
                    Image(systemName: "key.fill")
                        .font(.system(size: 32))
                        .foregroundStyle(QMDesign.Colors.primaryGradient)
                }

                Text("Configure API Keys")
                    .font(QMDesign.Typography.titleMedium)
                    .foregroundColor(QMDesign.Colors.textPrimary)

                Text("Queen Mama needs API keys to connect to transcription and AI services.")
                    .font(QMDesign.Typography.bodySmall)
                    .foregroundColor(QMDesign.Colors.textSecondary)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, QMDesign.Spacing.xl)
            }

            // API Key Fields
            VStack(spacing: QMDesign.Spacing.md) {
                OnboardingAPIKeyField(
                    title: "Deepgram API Key",
                    subtitle: "For speech-to-text transcription",
                    key: $deepgramKey,
                    showKey: $showDeepgram,
                    isConfigured: keychain.hasAPIKey(for: .deepgram),
                    onSave: { saveKey(.deepgram, deepgramKey) }
                )

                OnboardingAPIKeyField(
                    title: "OpenAI API Key",
                    subtitle: "For AI-powered responses",
                    key: $openAIKey,
                    showKey: $showOpenAI,
                    isConfigured: keychain.hasAPIKey(for: .openai),
                    onSave: { saveKey(.openai, openAIKey) }
                )
            }
            .padding(.horizontal, QMDesign.Spacing.xl)

            // Skip option
            Text("You can configure these later in Settings")
                .font(QMDesign.Typography.caption)
                .foregroundColor(QMDesign.Colors.textTertiary)

            Spacer()

            // Continue Button
            HStack(spacing: QMDesign.Spacing.md) {
                Button(action: onContinue) {
                    Text("Skip for now")
                        .font(QMDesign.Typography.labelSmall)
                        .foregroundColor(QMDesign.Colors.textSecondary)
                        .padding(.horizontal, QMDesign.Spacing.lg)
                        .padding(.vertical, QMDesign.Spacing.md)
                        .background(
                            Capsule()
                                .fill(QMDesign.Colors.surfaceLight)
                        )
                }
                .buttonStyle(.plain)

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
            .padding(.bottom, QMDesign.Spacing.xxl)
        }
        .padding(.horizontal, QMDesign.Spacing.lg)
        .onAppear {
            loadKeys()
        }
    }

    private func loadKeys() {
        deepgramKey = keychain.getAPIKey(for: .deepgram) ?? ""
        openAIKey = keychain.getAPIKey(for: .openai) ?? ""
    }

    private func saveKey(_ type: KeychainManager.APIKeyType, _ key: String) {
        guard !key.isEmpty else { return }
        try? keychain.saveAPIKey(key, for: type)
    }
}

struct OnboardingAPIKeyField: View {
    let title: String
    let subtitle: String
    @Binding var key: String
    @Binding var showKey: Bool
    let isConfigured: Bool
    let onSave: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: QMDesign.Spacing.sm) {
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    HStack(spacing: QMDesign.Spacing.xs) {
                        Text(title)
                            .font(QMDesign.Typography.bodyMedium)
                            .foregroundColor(QMDesign.Colors.textPrimary)
                        if isConfigured {
                            Image(systemName: "checkmark.circle.fill")
                                .font(.system(size: 12))
                                .foregroundColor(QMDesign.Colors.success)
                        }
                    }
                    Text(subtitle)
                        .font(QMDesign.Typography.captionSmall)
                        .foregroundColor(QMDesign.Colors.textTertiary)
                }
                Spacer()
            }

            HStack(spacing: QMDesign.Spacing.sm) {
                Group {
                    if showKey {
                        TextField("Enter API Key", text: $key)
                    } else {
                        SecureField("Enter API Key", text: $key)
                    }
                }
                .textFieldStyle(.plain)
                .font(QMDesign.Typography.bodySmall)
                .padding(QMDesign.Spacing.sm)
                .background(
                    RoundedRectangle(cornerRadius: QMDesign.Radius.md)
                        .fill(QMDesign.Colors.backgroundSecondary)
                )

                Button(action: { showKey.toggle() }) {
                    Image(systemName: showKey ? "eye.slash" : "eye")
                        .font(.system(size: 14))
                        .foregroundColor(QMDesign.Colors.textSecondary)
                        .frame(width: 32, height: 32)
                        .background(Circle().fill(QMDesign.Colors.surfaceMedium))
                }
                .buttonStyle(.plain)

                Button(action: onSave) {
                    Text("Save")
                        .font(QMDesign.Typography.labelSmall)
                        .foregroundColor(.white)
                        .padding(.horizontal, QMDesign.Spacing.md)
                        .padding(.vertical, QMDesign.Spacing.sm)
                        .background(Capsule().fill(QMDesign.Colors.primaryGradient))
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
                        .stroke(QMDesign.Colors.borderSubtle, lineWidth: 1)
                )
        )
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
