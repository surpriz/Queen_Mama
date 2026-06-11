//
//  OnboardingView.swift
//  QueenMamaIOS
//
//  Modern onboarding flow for new users
//  Adapted from macOS: removed screen recording/accessibility permissions,
//  keyboard shortcuts tour, NSCursor, and fixed frame constraints.
//  Tour reduced to 4 pages (no shortcuts page on iOS).
//

import SwiftUI
import AVFoundation

struct OnboardingView: View {
    @StateObject private var config = ConfigurationManager.shared
    @StateObject private var authManager = AuthenticationManager.shared
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

                // Content
                Group {
                    switch currentStep {
                    case .welcome:
                        WelcomeStepView(onContinue: { goToStep(.permissions) })
                    case .permissions:
                        PermissionsStepView(onContinue: { goToStep(.account) })
                    case .account:
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
    }

    private func goToStep(_ step: OnboardingStep) {
        var targetStep = step
        // Skip the account step if already authenticated (Keychain persisted after app deletion)
        if step == .account && authManager.isAuthenticated {
            targetStep = .quickTour
        }
        withAnimation(QMDesign.Animation.smooth) {
            currentStep = targetStep
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
                            .frame(width: 24, height: 2)
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
                FeatureRow(icon: "mic.fill", title: "Always Listening", description: "Capture conversations from your microphone")
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
                .shadow(
                    color: QMDesign.Colors.accent.opacity(0.2),
                    radius: 8,
                    y: 4
                )
            }
            .buttonStyle(.plain)
            .padding(.bottom, QMDesign.Spacing.xxl)
        }
        .padding(.horizontal, QMDesign.Spacing.lg)
    }
}

struct FeatureRow: View {
    let icon: String
    let title: LocalizedStringKey
    let description: LocalizedStringKey

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

// MARK: - Permissions Step (iOS: Microphone only)

struct PermissionsStepView: View {
    let onContinue: () -> Void

    @State private var hasMicPermission = false

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

                    Text("Queen Mama needs access to your microphone to provide real-time assistance during calls and meetings.")
                        .font(QMDesign.Typography.bodySmall)
                        .foregroundColor(QMDesign.Colors.textSecondary)
                        .multilineTextAlignment(.center)
                        .padding(.horizontal, QMDesign.Spacing.xl)
                }
                .padding(.top, QMDesign.Spacing.lg)

                // Permission Card - Microphone only on iOS
                VStack(spacing: QMDesign.Spacing.sm) {
                    PermissionCard(
                        icon: "mic.fill",
                        title: "Microphone Access",
                        description: "Record your voice during calls and meetings",
                        isGranted: hasMicPermission,
                        isOptional: false,
                        onRequest: requestMicrophonePermission
                    )
                }
                .padding(.horizontal, QMDesign.Spacing.xl)

                // Info
                HStack(alignment: .top, spacing: QMDesign.Spacing.sm) {
                    Image(systemName: "info.circle.fill")
                        .foregroundStyle(QMDesign.Colors.primaryGradient)
                    Text("You can modify this permission later in Settings > Privacy > Microphone.")
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
                }
                .buttonStyle(.plain)
                .padding(.vertical, QMDesign.Spacing.xl)
            }
            .padding(.horizontal, QMDesign.Spacing.lg)
        }
        .onAppear {
            checkPermissions()
        }
    }

    private func checkPermissions() {
        // Check microphone permission using iOS API
        switch AVAudioApplication.shared.recordPermission {
        case .granted:
            hasMicPermission = true
        default:
            hasMicPermission = false
        }
    }

    private func requestMicrophonePermission() {
        AVAudioApplication.requestRecordPermission { granted in
            DispatchQueue.main.async {
                hasMicPermission = granted
            }
        }
    }
}

struct PermissionCard: View {
    let icon: String
    let title: LocalizedStringKey
    let description: LocalizedStringKey
    let isGranted: Bool
    var isOptional: Bool = false
    let onRequest: () -> Void

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
    }
}

// MARK: - Quick Tour Step (Interactive Carousel - 4 pages, no shortcuts on iOS)

struct QuickTourStepView: View {
    let onContinue: () -> Void
    @State private var currentPage = 0

    private let totalPages = 4

    var body: some View {
        VStack(spacing: 0) {
            // Tour Content - Takes available space
            Group {
                switch currentPage {
                case 0: WidgetTourScreen()
                case 1: AIFeaturesTourScreen()
                case 2: DashboardTourScreen()
                case 3: ModesTourScreen()
                default: WidgetTourScreen()
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .animation(QMDesign.Animation.smooth, value: currentPage)

            // Fixed Bottom Navigation Area
            VStack(spacing: QMDesign.Spacing.md) {
                // Page Indicator
                TourPageIndicator(currentPage: currentPage, totalPages: totalPages)

                // Navigation Buttons
                HStack(spacing: QMDesign.Spacing.md) {
                    // Back Button
                    if currentPage > 0 {
                        Button(action: {
                            withAnimation(QMDesign.Animation.smooth) {
                                currentPage -= 1
                            }
                        }) {
                            HStack(spacing: QMDesign.Spacing.xs) {
                                Image(systemName: "arrow.left")
                                    .font(.system(size: 12, weight: .semibold))
                                Text("Back")
                                    .font(QMDesign.Typography.labelMedium)
                            }
                            .padding(.horizontal, QMDesign.Spacing.lg)
                            .padding(.vertical, QMDesign.Spacing.sm)
                            .background(
                                Capsule()
                                    .fill(QMDesign.Colors.surfaceMedium)
                            )
                            .foregroundColor(QMDesign.Colors.textSecondary)
                        }
                        .buttonStyle(.plain)
                    } else {
                        Color.clear.frame(width: 80, height: 36)
                    }

                    Spacer()

                    // Next/Continue Button
                    Button(action: {
                        if currentPage < totalPages - 1 {
                            withAnimation(QMDesign.Animation.smooth) {
                                currentPage += 1
                            }
                        } else {
                            onContinue()
                        }
                    }) {
                        HStack(spacing: QMDesign.Spacing.sm) {
                            Text(currentPage < totalPages - 1 ? "Next" : "Got it!")
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
                    }
                    .buttonStyle(.plain)
                }
                .padding(.horizontal, QMDesign.Spacing.xl)
            }
            .padding(.vertical, QMDesign.Spacing.lg)
            .background(
                // Subtle gradient fade from content
                LinearGradient(
                    colors: [Color.clear, QMDesign.Colors.backgroundPrimary.opacity(0.8)],
                    startPoint: .top,
                    endPoint: .bottom
                )
                .frame(height: 20)
                .offset(y: -20),
                alignment: .top
            )
        }
    }
}

// MARK: - Tour Page Indicator

struct TourPageIndicator: View {
    let currentPage: Int
    let totalPages: Int

    var body: some View {
        HStack(spacing: QMDesign.Spacing.xs) {
            ForEach(0..<totalPages, id: \.self) { index in
                Capsule()
                    .fill(index == currentPage ? QMDesign.Colors.accent : QMDesign.Colors.surfaceMedium)
                    .frame(width: index == currentPage ? 24 : 8, height: 8)
                    .animation(QMDesign.Animation.smooth, value: currentPage)
            }
        }
    }
}

// MARK: - Tour Screen 1: Bottom Sheet (replaces Widget tour for iOS)

struct WidgetTourScreen: View {
    var body: some View {
        ScrollView {
            VStack(spacing: QMDesign.Spacing.lg) {
                // Header
                TourScreenHeader(
                    icon: "rectangle.bottomhalf.inset.filled",
                    title: "The AI Assistant",
                    subtitle: "Your always-available coaching panel"
                )

                // Bottom Sheet Visual Mockup
                VStack(spacing: QMDesign.Spacing.md) {
                    BottomSheetMockup()
                }
                .padding(.horizontal, QMDesign.Spacing.xl)

                // Key Points
                VStack(spacing: QMDesign.Spacing.sm) {
                    TourBulletPoint(icon: "hand.draw.fill", text: "Swipe up to expand, down to minimize")
                    TourBulletPoint(icon: "sparkles", text: "AI suggestions appear in real-time")
                    TourBulletPoint(icon: "text.bubble.fill", text: "Multiple response types: Assist, Say, Follow-up, Recap")
                }
                .padding(.horizontal, QMDesign.Spacing.xl)
            }
            .padding(.top, QMDesign.Spacing.lg)
            .padding(.bottom, QMDesign.Spacing.xxxl)
        }
    }
}

// MARK: - Tour Screen 2: AI Features

struct AIFeaturesTourScreen: View {
    var body: some View {
        ScrollView {
            VStack(spacing: QMDesign.Spacing.lg) {
                // Header
                TourScreenHeader(
                    icon: "sparkles",
                    title: "4 Types of AI Help",
                    subtitle: "Different responses for different needs"
                )

                // Feature Cards
                VStack(spacing: QMDesign.Spacing.md) {
                    AIFeatureCard(
                        icon: "sparkles",
                        iconColor: QMDesign.Colors.accent,
                        title: "Assist",
                        description: "Get contextual suggestions based on the conversation",
                        example: "\"Based on what was discussed, you could mention...\""
                    )

                    AIFeatureCard(
                        icon: "text.bubble.fill",
                        iconColor: QMDesign.Colors.success,
                        title: "What to Say",
                        description: "Direct response suggestions you can use",
                        example: "\"You might say: 'That's a great point, and...'\""
                    )

                    AIFeatureCard(
                        icon: "questionmark.bubble.fill",
                        iconColor: QMDesign.Colors.info,
                        title: "Follow-up Questions",
                        description: "Smart questions to keep the conversation going",
                        example: "\"Ask: 'How does this impact...?'\""
                    )

                    AIFeatureCard(
                        icon: "arrow.counterclockwise",
                        iconColor: QMDesign.Colors.warning,
                        title: "Recap",
                        description: "Summary of key points discussed so far",
                        example: "\"Key points: 1) Budget is $50k, 2) Timeline is Q2...\""
                    )
                }
                .padding(.horizontal, QMDesign.Spacing.xl)
            }
            .padding(.top, QMDesign.Spacing.lg)
            .padding(.bottom, QMDesign.Spacing.xxxl)
        }
    }
}

// MARK: - Tour Screen 3: Dashboard

struct DashboardTourScreen: View {
    var body: some View {
        ScrollView {
            VStack(spacing: QMDesign.Spacing.lg) {
                // Header
                TourScreenHeader(
                    icon: "rectangle.3.group",
                    title: "The Dashboard",
                    subtitle: "Your command center"
                )

                // Features List
                VStack(spacing: QMDesign.Spacing.sm) {
                    TourBulletPoint(icon: "play.circle.fill", text: "Start and stop recording sessions")
                    TourBulletPoint(icon: "clock.fill", text: "View past sessions and transcripts")
                    TourBulletPoint(icon: "square.and.arrow.up", text: "Export transcripts (TXT, JSON, SRT)")
                    TourBulletPoint(icon: "waveform", text: "Monitor live audio levels")
                    TourBulletPoint(icon: "gearshape.fill", text: "Access all settings")
                    TourBulletPoint(icon: "person.2.fill", text: "Manage your contacts")
                }
                .padding(.horizontal, QMDesign.Spacing.xl)
            }
            .padding(.top, QMDesign.Spacing.lg)
            .padding(.bottom, QMDesign.Spacing.xxxl)
        }
    }
}

// MARK: - Tour Screen 4: Modes

struct ModesTourScreen: View {
    var body: some View {
        ScrollView {
            VStack(spacing: QMDesign.Spacing.lg) {
                // Header
                TourScreenHeader(
                    icon: "person.2.fill",
                    title: "AI Modes",
                    subtitle: "Customize AI behavior for different situations"
                )

                // Mode Cards
                VStack(spacing: QMDesign.Spacing.sm) {
                    ModeCard(
                        name: "Default",
                        icon: "star.fill",
                        description: "Balanced, helpful assistance for any situation"
                    )
                    ModeCard(
                        name: "Professional",
                        icon: "briefcase.fill",
                        description: "Formal tone for business meetings"
                    )
                    ModeCard(
                        name: "Interview",
                        icon: "person.badge.clock.fill",
                        description: "Helps prepare answers during job interviews"
                    )
                    ModeCard(
                        name: "Sales",
                        icon: "chart.line.uptrend.xyaxis",
                        description: "Persuasive suggestions for sales calls"
                    )
                }
                .padding(.horizontal, QMDesign.Spacing.xl)

                // Custom Modes Info
                HStack(alignment: .top, spacing: QMDesign.Spacing.sm) {
                    Image(systemName: "plus.circle.fill")
                        .foregroundStyle(QMDesign.Colors.primaryGradient)
                    Text("Create your own custom modes with personalized system prompts in the Dashboard.")
                        .font(QMDesign.Typography.caption)
                        .foregroundColor(QMDesign.Colors.textSecondary)
                }
                .padding(QMDesign.Spacing.md)
                .background(
                    RoundedRectangle(cornerRadius: QMDesign.Radius.md)
                        .fill(QMDesign.Colors.accent.opacity(0.05))
                )
                .padding(.horizontal, QMDesign.Spacing.xl)
            }
            .padding(.top, QMDesign.Spacing.lg)
            .padding(.bottom, QMDesign.Spacing.xxxl)
        }
    }
}

// MARK: - Tour Helper Components

struct TourScreenHeader: View {
    let icon: String
    let title: LocalizedStringKey
    let subtitle: LocalizedStringKey

    var body: some View {
        VStack(spacing: QMDesign.Spacing.md) {
            ZStack {
                Circle()
                    .fill(QMDesign.Colors.primaryGradient.opacity(0.1))
                    .frame(width: 72, height: 72)
                Image(systemName: icon)
                    .font(.system(size: 28))
                    .foregroundStyle(QMDesign.Colors.primaryGradient)
            }

            VStack(spacing: QMDesign.Spacing.xs) {
                Text(title)
                    .font(QMDesign.Typography.titleMedium)
                    .foregroundColor(QMDesign.Colors.textPrimary)

                Text(subtitle)
                    .font(QMDesign.Typography.bodySmall)
                    .foregroundColor(QMDesign.Colors.textSecondary)
            }
        }
        .padding(.bottom, QMDesign.Spacing.sm)
    }
}

struct TourBulletPoint: View {
    let icon: String
    let text: LocalizedStringKey

    var body: some View {
        HStack(spacing: QMDesign.Spacing.sm) {
            Image(systemName: icon)
                .font(.system(size: 14))
                .foregroundStyle(QMDesign.Colors.primaryGradient)
                .frame(width: 20)

            Text(text)
                .font(QMDesign.Typography.bodySmall)
                .foregroundColor(QMDesign.Colors.textSecondary)

            Spacer()
        }
    }
}

struct AIFeatureCard: View {
    let icon: String
    let iconColor: Color
    let title: LocalizedStringKey
    let description: LocalizedStringKey
    let example: LocalizedStringKey

    var body: some View {
        HStack(alignment: .top, spacing: QMDesign.Spacing.md) {
            ZStack {
                Circle()
                    .fill(iconColor.opacity(0.15))
                    .frame(width: 36, height: 36)
                Image(systemName: icon)
                    .font(.system(size: 16))
                    .foregroundColor(iconColor)
            }

            VStack(alignment: .leading, spacing: QMDesign.Spacing.xxs) {
                Text(title)
                    .font(QMDesign.Typography.labelMedium)
                    .foregroundColor(QMDesign.Colors.textPrimary)

                Text(description)
                    .font(QMDesign.Typography.caption)
                    .foregroundColor(QMDesign.Colors.textSecondary)

                Text(example)
                    .font(QMDesign.Typography.captionSmall)
                    .foregroundColor(QMDesign.Colors.textTertiary)
                    .italic()
                    .padding(.top, 2)
            }

            Spacer()
        }
        .padding(QMDesign.Spacing.sm)
        .background(
            RoundedRectangle(cornerRadius: QMDesign.Radius.md)
                .fill(QMDesign.Colors.surfaceLight)
        )
    }
}

struct ModeCard: View {
    let name: String
    let icon: String
    let description: LocalizedStringKey

    var body: some View {
        HStack(spacing: QMDesign.Spacing.md) {
            ZStack {
                Circle()
                    .fill(QMDesign.Colors.primaryGradient.opacity(0.1))
                    .frame(width: 36, height: 36)
                Image(systemName: icon)
                    .font(.system(size: 14))
                    .foregroundStyle(QMDesign.Colors.primaryGradient)
            }

            VStack(alignment: .leading, spacing: 2) {
                Text(name)
                    .font(QMDesign.Typography.labelMedium)
                    .foregroundColor(QMDesign.Colors.textPrimary)

                Text(description)
                    .font(QMDesign.Typography.caption)
                    .foregroundColor(QMDesign.Colors.textTertiary)
            }

            Spacer()
        }
        .padding(QMDesign.Spacing.sm)
        .background(
            RoundedRectangle(cornerRadius: QMDesign.Radius.md)
                .fill(QMDesign.Colors.surfaceLight)
        )
    }
}

// MARK: - Bottom Sheet Mockup (iOS replacement for Widget mockups)

struct BottomSheetMockup: View {
    var body: some View {
        VStack(spacing: 0) {
            // Drag indicator
            RoundedRectangle(cornerRadius: 2.5)
                .fill(QMDesign.Colors.textTertiary.opacity(0.3))
                .frame(width: 40, height: 5)
                .padding(.top, QMDesign.Spacing.sm)

            // Header
            HStack {
                Text("AI Assistant")
                    .font(QMDesign.Typography.labelMedium)
                    .foregroundColor(QMDesign.Colors.textPrimary)

                Spacer()

                Circle()
                    .fill(QMDesign.Colors.success)
                    .frame(width: 8, height: 8)

                Text("Recording...")
                    .font(QMDesign.Typography.captionSmall)
                    .foregroundColor(QMDesign.Colors.textSecondary)
            }
            .padding(.horizontal, QMDesign.Spacing.md)
            .padding(.vertical, QMDesign.Spacing.sm)

            Divider()
                .background(QMDesign.Colors.borderSubtle)

            // Tab Bar
            HStack(spacing: 0) {
                ForEach(["Assist", "Say", "Follow-up", "Recap"], id: \.self) { tab in
                    Text(tab)
                        .font(QMDesign.Typography.captionSmall)
                        .foregroundColor(tab == "Assist" ? QMDesign.Colors.accent : QMDesign.Colors.textTertiary)
                        .padding(.horizontal, QMDesign.Spacing.sm)
                        .padding(.vertical, QMDesign.Spacing.xs)
                        .background(
                            tab == "Assist" ?
                            RoundedRectangle(cornerRadius: QMDesign.Radius.sm)
                                .fill(QMDesign.Colors.accent.opacity(0.1)) : nil
                        )
                }
            }
            .padding(.horizontal, QMDesign.Spacing.sm)
            .padding(.vertical, QMDesign.Spacing.xs)

            Divider()
                .background(QMDesign.Colors.borderSubtle)

            // Content Area
            VStack(alignment: .leading, spacing: QMDesign.Spacing.xs) {
                Text("AI Response")
                    .font(QMDesign.Typography.caption)
                    .foregroundColor(QMDesign.Colors.textSecondary)

                Text("Based on the discussion about project timeline, you might want to mention...")
                    .font(QMDesign.Typography.captionSmall)
                    .foregroundColor(QMDesign.Colors.textTertiary)
                    .lineLimit(2)
            }
            .padding(QMDesign.Spacing.md)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .background(
            RoundedRectangle(cornerRadius: QMDesign.Radius.lg)
                .fill(QMDesign.Colors.backgroundSecondary)
                .overlay(
                    RoundedRectangle(cornerRadius: QMDesign.Radius.lg)
                        .stroke(QMDesign.Colors.borderSubtle, lineWidth: 1)
                )
        )
        .shadow(color: .black.opacity(0.15), radius: 10, y: -5)
    }
}

// MARK: - Ready Step

struct ReadyStepView: View {
    let onComplete: () -> Void

    @State private var isAnimating = false

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
                .shadow(
                    color: QMDesign.Colors.accent.opacity(0.3),
                    radius: 12,
                    y: 6
                )
            }
            .buttonStyle(.plain)
            .padding(.bottom, QMDesign.Spacing.xxl)
        }
        .padding(.horizontal, QMDesign.Spacing.lg)
    }
}

// MARK: - Feature Tour Sheet (Standalone - accessible from Dashboard)

/// A standalone sheet to review the feature tour from the Dashboard
struct FeatureTourSheet: View {
    @Environment(\.dismiss) private var dismiss
    @State private var currentPage = 0

    private let totalPages = 4

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                // Tour Content
                Group {
                    switch currentPage {
                    case 0: WidgetTourScreen()
                    case 1: AIFeaturesTourScreen()
                    case 2: DashboardTourScreen()
                    case 3: ModesTourScreen()
                    default: WidgetTourScreen()
                    }
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .animation(QMDesign.Animation.smooth, value: currentPage)

                // Fixed Bottom Navigation
                VStack(spacing: QMDesign.Spacing.md) {
                    TourPageIndicator(currentPage: currentPage, totalPages: totalPages)

                    HStack(spacing: QMDesign.Spacing.md) {
                        // Back Button
                        if currentPage > 0 {
                            Button(action: {
                                withAnimation(QMDesign.Animation.smooth) {
                                    currentPage -= 1
                                }
                            }) {
                                HStack(spacing: QMDesign.Spacing.xs) {
                                    Image(systemName: "arrow.left")
                                        .font(.system(size: 12, weight: .semibold))
                                    Text("Back")
                                        .font(QMDesign.Typography.labelMedium)
                                }
                                .padding(.horizontal, QMDesign.Spacing.lg)
                                .padding(.vertical, QMDesign.Spacing.sm)
                                .background(
                                    Capsule()
                                        .fill(QMDesign.Colors.surfaceMedium)
                                )
                                .foregroundColor(QMDesign.Colors.textSecondary)
                            }
                            .buttonStyle(.plain)
                        } else {
                            Color.clear.frame(width: 80, height: 36)
                        }

                        Spacer()

                        // Next/Done Button
                        Button(action: {
                            if currentPage < totalPages - 1 {
                                withAnimation(QMDesign.Animation.smooth) {
                                    currentPage += 1
                                }
                            } else {
                                dismiss()
                            }
                        }) {
                            HStack(spacing: QMDesign.Spacing.sm) {
                                Text(currentPage < totalPages - 1 ? "Next" : "Done")
                                    .font(QMDesign.Typography.labelMedium)
                                Image(systemName: currentPage < totalPages - 1 ? "arrow.right" : "checkmark")
                                    .font(.system(size: 14, weight: .semibold))
                            }
                            .padding(.horizontal, QMDesign.Spacing.xl)
                            .padding(.vertical, QMDesign.Spacing.md)
                            .background(
                                Capsule()
                                    .fill(QMDesign.Colors.primaryGradient)
                            )
                            .foregroundColor(.white)
                        }
                        .buttonStyle(.plain)
                    }
                    .padding(.horizontal, QMDesign.Spacing.xl)
                }
                .padding(.vertical, QMDesign.Spacing.lg)
            }
            .navigationTitle("Feature Tour")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(action: { dismiss() }) {
                        Image(systemName: "xmark.circle.fill")
                            .font(.system(size: 20))
                            .foregroundColor(QMDesign.Colors.textTertiary)
                    }
                }
            }
        }
    }
}
