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
        case .welcome: return String(localized: "onboarding.step.welcome")
        case .permissions: return String(localized: "onboarding.step.permissions")
        case .account: return String(localized: "onboarding.step.account")
        case .quickTour: return String(localized: "onboarding.step.tour")
        case .ready: return String(localized: "onboarding.step.ready")
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
                    Text(String(localized: "onboarding.welcome.title"))
                        .font(QMDesign.Typography.titleSmall)
                        .foregroundColor(QMDesign.Colors.textSecondary)

                    Text("Queen Mama")
                        .font(.system(size: 36, weight: .bold))
                        .foregroundStyle(QMDesign.Colors.primaryGradient)
                }
            }

            // Features List
            VStack(spacing: QMDesign.Spacing.md) {
                FeatureRow(icon: "waveform", title: String(localized: "onboarding.welcome.feature.transcription.title"), description: String(localized: "onboarding.welcome.feature.transcription.description"))
                FeatureRow(icon: "sparkles", title: String(localized: "onboarding.welcome.feature.ai.title"), description: String(localized: "onboarding.welcome.feature.ai.description"))
                FeatureRow(icon: "eye.slash", title: String(localized: "onboarding.welcome.feature.undetectable.title"), description: String(localized: "onboarding.welcome.feature.undetectable.description"))
            }
            .padding(.horizontal, QMDesign.Spacing.xl)

            Spacer()

            // Continue Button
            Button(action: onContinue) {
                HStack(spacing: QMDesign.Spacing.sm) {
                    Text(String(localized: "onboarding.welcome.button.getStarted"))
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

                    Text(String(localized: "onboarding.permissions.title"))
                        .font(QMDesign.Typography.titleMedium)
                        .foregroundColor(QMDesign.Colors.textPrimary)

                    Text(String(localized: "onboarding.permissions.subtitle"))
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
                        title: String(localized: "onboarding.permissions.microphone.title"),
                        description: String(localized: "onboarding.permissions.microphone.description"),
                        isGranted: hasMicPermission,
                        isOptional: false,
                        onRequest: requestMicrophonePermission
                    )

                    PermissionCard(
                        icon: "rectangle.dashed.badge.record",
                        title: String(localized: "onboarding.permissions.screenRecording.title"),
                        description: String(localized: "onboarding.permissions.screenRecording.description"),
                        isGranted: hasScreenPermission,
                        isOptional: false,
                        onRequest: requestScreenPermission
                    )

                    PermissionCard(
                        icon: "keyboard",
                        title: String(localized: "onboarding.permissions.accessibility.title"),
                        description: String(localized: "onboarding.permissions.accessibility.description"),
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
                    Text(String(localized: "onboarding.permissions.info"))
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
                        Text(String(localized: "onboarding.button.continue"))
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
                        Text(String(localized: "onboarding.permissions.optional"))
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
                    Text(String(localized: "onboarding.permissions.button.grant"))
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

// MARK: - Quick Tour Step (Interactive Carousel)

struct QuickTourStepView: View {
    let onContinue: () -> Void
    @State private var currentPage = 0
    @State private var isButtonHovered = false

    private let totalPages = 5

    var body: some View {
        VStack(spacing: 0) {
            // Tour Content - Takes available space
            Group {
                switch currentPage {
                case 0: WidgetTourScreen()
                case 1: AIFeaturesTourScreen()
                case 2: DashboardTourScreen()
                case 3: ModesTourScreen()
                case 4: ShortcutsTourScreen()
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
                        Button(action: { currentPage -= 1 }) {
                            HStack(spacing: QMDesign.Spacing.xs) {
                                Image(systemName: "arrow.left")
                                    .font(.system(size: 12, weight: .semibold))
                                Text(String(localized: "onboarding.button.back"))
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
                        // Invisible placeholder to keep layout consistent
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
                            Text(currentPage < totalPages - 1 ? String(localized: "onboarding.button.next") : String(localized: "onboarding.button.gotIt"))
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

// MARK: - Tour Screen 1: Widget

struct WidgetTourScreen: View {
    var body: some View {
        ScrollView {
            VStack(spacing: QMDesign.Spacing.lg) {
                // Header
                TourScreenHeader(
                    icon: "rectangle.on.rectangle",
                    title: String(localized: "onboarding.features.widget.title"),
                    subtitle: String(localized: "onboarding.features.widget.subtitle")
                )

                // Widget Visual Mockup
                VStack(spacing: QMDesign.Spacing.md) {
                    // Collapsed Widget Mockup
                    VStack(alignment: .leading, spacing: QMDesign.Spacing.xs) {
                        Text(String(localized: "onboarding.features.widget.collapsedMode"))
                            .font(QMDesign.Typography.caption)
                            .foregroundColor(QMDesign.Colors.textTertiary)

                        WidgetMockupCollapsed()
                    }

                    Image(systemName: "arrow.down")
                        .font(.system(size: 16))
                        .foregroundColor(QMDesign.Colors.textTertiary)

                    // Expanded Widget Mockup
                    VStack(alignment: .leading, spacing: QMDesign.Spacing.xs) {
                        Text(String(localized: "onboarding.features.widget.expandedMode"))
                            .font(QMDesign.Typography.caption)
                            .foregroundColor(QMDesign.Colors.textTertiary)

                        WidgetMockupExpanded()
                    }
                }
                .padding(.horizontal, QMDesign.Spacing.xl)

                // Key Points
                VStack(spacing: QMDesign.Spacing.sm) {
                    TourBulletPoint(icon: "eye.slash.fill", text: String(localized: "onboarding.features.widget.bullet.invisible"))
                    TourBulletPoint(icon: "pin.fill", text: String(localized: "onboarding.features.widget.bullet.alwaysOnTop"))
                    TourBulletPoint(icon: "arrow.up.and.down.and.arrow.left.and.right", text: String(localized: "onboarding.features.widget.bullet.draggable"))
                }
                .padding(.horizontal, QMDesign.Spacing.xl)

                // Shortcut
                HStack {
                    Text(String(localized: "onboarding.features.widget.toggleWith"))
                        .font(QMDesign.Typography.bodySmall)
                        .foregroundColor(QMDesign.Colors.textSecondary)
                    KeyboardShortcutBadge(shortcut: "Cmd+\\")
                }
                .padding(.top, QMDesign.Spacing.sm)
            }
            .padding(.top, QMDesign.Spacing.lg)
            .padding(.bottom, QMDesign.Spacing.xxxl) // Extra space for fixed nav
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
                    title: String(localized: "onboarding.features.aiHelp.title"),
                    subtitle: String(localized: "onboarding.features.aiHelp.subtitle")
                )

                // Feature Cards
                VStack(spacing: QMDesign.Spacing.md) {
                    AIFeatureCard(
                        icon: "sparkles",
                        iconColor: QMDesign.Colors.accent,
                        title: String(localized: "onboarding.features.aiHelp.assist.title"),
                        description: String(localized: "onboarding.features.aiHelp.assist.description"),
                        example: String(localized: "onboarding.features.aiHelp.assist.example")
                    )

                    AIFeatureCard(
                        icon: "text.bubble.fill",
                        iconColor: QMDesign.Colors.success,
                        title: String(localized: "onboarding.features.aiHelp.whatToSay.title"),
                        description: String(localized: "onboarding.features.aiHelp.whatToSay.description"),
                        example: String(localized: "onboarding.features.aiHelp.whatToSay.example")
                    )

                    AIFeatureCard(
                        icon: "questionmark.bubble.fill",
                        iconColor: QMDesign.Colors.info,
                        title: String(localized: "onboarding.features.aiHelp.followUp.title"),
                        description: String(localized: "onboarding.features.aiHelp.followUp.description"),
                        example: String(localized: "onboarding.features.aiHelp.followUp.example")
                    )

                    AIFeatureCard(
                        icon: "arrow.counterclockwise",
                        iconColor: QMDesign.Colors.warning,
                        title: String(localized: "onboarding.features.aiHelp.recap.title"),
                        description: String(localized: "onboarding.features.aiHelp.recap.description"),
                        example: String(localized: "onboarding.features.aiHelp.recap.example")
                    )
                }
                .padding(.horizontal, QMDesign.Spacing.xl)

                // Shortcut
                HStack {
                    Text(String(localized: "onboarding.features.aiHelp.triggerWith"))
                        .font(QMDesign.Typography.bodySmall)
                        .foregroundColor(QMDesign.Colors.textSecondary)
                    KeyboardShortcutBadge(shortcut: "Cmd+Enter")
                }
                .padding(.top, QMDesign.Spacing.sm)
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
                    title: String(localized: "onboarding.features.dashboard.title"),
                    subtitle: String(localized: "onboarding.features.dashboard.subtitle")
                )

                // Dashboard Mockup
                DashboardMockup()
                    .padding(.horizontal, QMDesign.Spacing.xl)

                // Features List
                VStack(spacing: QMDesign.Spacing.sm) {
                    TourBulletPoint(icon: "play.circle.fill", text: String(localized: "onboarding.features.dashboard.bullet.startStop"))
                    TourBulletPoint(icon: "clock.fill", text: String(localized: "onboarding.features.dashboard.bullet.viewPast"))
                    TourBulletPoint(icon: "square.and.arrow.up", text: String(localized: "onboarding.features.dashboard.bullet.export"))
                    TourBulletPoint(icon: "waveform", text: String(localized: "onboarding.features.dashboard.bullet.monitor"))
                    TourBulletPoint(icon: "gearshape.fill", text: String(localized: "onboarding.features.dashboard.bullet.settings"))
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
                    title: String(localized: "onboarding.features.modes.title"),
                    subtitle: String(localized: "onboarding.features.modes.subtitle")
                )

                // Mode Cards
                VStack(spacing: QMDesign.Spacing.sm) {
                    ModeCard(
                        name: String(localized: "onboarding.features.modes.default.name"),
                        icon: "star.fill",
                        description: String(localized: "onboarding.features.modes.default.description")
                    )
                    ModeCard(
                        name: String(localized: "onboarding.features.modes.professional.name"),
                        icon: "briefcase.fill",
                        description: String(localized: "onboarding.features.modes.professional.description")
                    )
                    ModeCard(
                        name: String(localized: "onboarding.features.modes.interview.name"),
                        icon: "person.badge.clock.fill",
                        description: String(localized: "onboarding.features.modes.interview.description")
                    )
                    ModeCard(
                        name: String(localized: "onboarding.features.modes.sales.name"),
                        icon: "chart.line.uptrend.xyaxis",
                        description: String(localized: "onboarding.features.modes.sales.description")
                    )
                }
                .padding(.horizontal, QMDesign.Spacing.xl)

                // Custom Modes Info
                HStack(alignment: .top, spacing: QMDesign.Spacing.sm) {
                    Image(systemName: "plus.circle.fill")
                        .foregroundStyle(QMDesign.Colors.primaryGradient)
                    Text(String(localized: "onboarding.features.modes.customInfo"))
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

// MARK: - Tour Screen 5: Shortcuts

struct ShortcutsTourScreen: View {
    var body: some View {
        ScrollView {
            VStack(spacing: QMDesign.Spacing.lg) {
                // Header
                TourScreenHeader(
                    icon: "keyboard",
                    title: String(localized: "onboarding.features.shortcuts.title"),
                    subtitle: String(localized: "onboarding.features.shortcuts.subtitle")
                )

                // Shortcuts Grid
                VStack(spacing: QMDesign.Spacing.md) {
                    TourTipCard(
                        icon: "command",
                        shortcut: "Cmd+Shift+S",
                        title: String(localized: "onboarding.features.shortcuts.startStop.title"),
                        description: String(localized: "onboarding.features.shortcuts.startStop.description")
                    )

                    TourTipCard(
                        icon: "option",
                        shortcut: "Cmd+\\",
                        title: String(localized: "onboarding.features.shortcuts.toggleWidget.title"),
                        description: String(localized: "onboarding.features.shortcuts.toggleWidget.description")
                    )

                    TourTipCard(
                        icon: "return",
                        shortcut: "Cmd+Enter",
                        title: String(localized: "onboarding.features.shortcuts.askAI.title"),
                        description: String(localized: "onboarding.features.shortcuts.askAI.description")
                    )

                    TourTipCard(
                        icon: "r.circle",
                        shortcut: "Cmd+R",
                        title: String(localized: "onboarding.features.shortcuts.clearContext.title"),
                        description: String(localized: "onboarding.features.shortcuts.clearContext.description")
                    )

                    TourTipCard(
                        icon: "arrow.up.arrow.down",
                        shortcut: "Cmd+Arrows",
                        title: String(localized: "onboarding.features.shortcuts.moveWidget.title"),
                        description: String(localized: "onboarding.features.shortcuts.moveWidget.description")
                    )
                }
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
    let title: String
    let subtitle: String

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
    let text: String

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
    let title: String
    let description: String
    let example: String

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
    let description: String

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

// MARK: - Widget Mockups

struct WidgetMockupCollapsed: View {
    var body: some View {
        HStack(spacing: QMDesign.Spacing.sm) {
            // Status indicator
            Circle()
                .fill(QMDesign.Colors.success)
                .frame(width: 8, height: 8)

            // Waveform placeholder
            HStack(spacing: 2) {
                ForEach(0..<8, id: \.self) { i in
                    RoundedRectangle(cornerRadius: 1)
                        .fill(QMDesign.Colors.accent.opacity(0.6))
                        .frame(width: 3, height: CGFloat.random(in: 8...16))
                }
            }

            Spacer()

            // Mode badge
            Text(String(localized: "onboarding.features.modes.default.name"))
                .font(QMDesign.Typography.captionSmall)
                .foregroundColor(QMDesign.Colors.textTertiary)
                .padding(.horizontal, 6)
                .padding(.vertical, 2)
                .background(
                    Capsule()
                        .fill(QMDesign.Colors.surfaceMedium)
                )

            // Expand button
            Image(systemName: "chevron.down")
                .font(.system(size: 10))
                .foregroundColor(QMDesign.Colors.textTertiary)
        }
        .padding(.horizontal, QMDesign.Spacing.md)
        .padding(.vertical, QMDesign.Spacing.sm)
        .frame(width: 280)
        .background(
            RoundedRectangle(cornerRadius: QMDesign.Radius.lg)
                .fill(QMDesign.Colors.backgroundSecondary)
                .overlay(
                    RoundedRectangle(cornerRadius: QMDesign.Radius.lg)
                        .stroke(
                            LinearGradient(
                                colors: [QMDesign.Colors.gradientStart.opacity(0.3), QMDesign.Colors.gradientEnd.opacity(0.3)],
                                startPoint: .topLeading,
                                endPoint: .bottomTrailing
                            ),
                            lineWidth: 1
                        )
                )
        )
        .shadow(color: .black.opacity(0.3), radius: 10, y: 5)
    }
}

struct WidgetMockupExpanded: View {
    var body: some View {
        VStack(spacing: 0) {
            // Header
            HStack {
                Circle()
                    .fill(QMDesign.Colors.success)
                    .frame(width: 8, height: 8)

                Text(String(localized: "onboarding.features.widget.mockup.recording"))
                    .font(QMDesign.Typography.captionSmall)
                    .foregroundColor(QMDesign.Colors.textSecondary)

                Spacer()

                Image(systemName: "chevron.up")
                    .font(.system(size: 10))
                    .foregroundColor(QMDesign.Colors.textTertiary)
            }
            .padding(.horizontal, QMDesign.Spacing.md)
            .padding(.vertical, QMDesign.Spacing.sm)

            Divider()
                .background(QMDesign.Colors.borderSubtle)

            // Tab Bar
            HStack(spacing: 0) {
                let tabLabels = [String(localized: "onboarding.features.widget.mockup.tab.assist"), String(localized: "onboarding.features.widget.mockup.tab.say"), String(localized: "onboarding.features.widget.mockup.tab.followUp"), String(localized: "onboarding.features.widget.mockup.tab.recap")]
                ForEach(Array(tabLabels.enumerated()), id: \.offset) { index, tab in
                    Text(tab)
                        .font(QMDesign.Typography.captionSmall)
                        .foregroundColor(index == 0 ? QMDesign.Colors.accent : QMDesign.Colors.textTertiary)
                        .padding(.horizontal, QMDesign.Spacing.sm)
                        .padding(.vertical, QMDesign.Spacing.xs)
                        .background(
                            index == 0 ?
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
                Text(String(localized: "onboarding.features.widget.mockup.aiResponse"))
                    .font(QMDesign.Typography.caption)
                    .foregroundColor(QMDesign.Colors.textSecondary)

                Text(String(localized: "onboarding.features.widget.mockup.aiResponseExample"))
                    .font(QMDesign.Typography.captionSmall)
                    .foregroundColor(QMDesign.Colors.textTertiary)
                    .lineLimit(2)
            }
            .padding(QMDesign.Spacing.md)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .frame(width: 280)
        .background(
            RoundedRectangle(cornerRadius: QMDesign.Radius.lg)
                .fill(QMDesign.Colors.backgroundSecondary)
                .overlay(
                    RoundedRectangle(cornerRadius: QMDesign.Radius.lg)
                        .stroke(
                            LinearGradient(
                                colors: [QMDesign.Colors.gradientStart.opacity(0.3), QMDesign.Colors.gradientEnd.opacity(0.3)],
                                startPoint: .topLeading,
                                endPoint: .bottomTrailing
                            ),
                            lineWidth: 1
                        )
                )
        )
        .shadow(color: .black.opacity(0.3), radius: 10, y: 5)
    }
}

struct DashboardMockup: View {
    var body: some View {
        HStack(spacing: 0) {
            // Sidebar
            VStack(alignment: .leading, spacing: QMDesign.Spacing.sm) {
                // Sidebar items
                let sidebarItems = [String(localized: "onboarding.features.dashboard.mockup.sessions"), String(localized: "onboarding.features.dashboard.mockup.modes"), String(localized: "onboarding.features.dashboard.mockup.settings")]
                ForEach(Array(sidebarItems.enumerated()), id: \.offset) { index, item in
                    HStack(spacing: QMDesign.Spacing.xs) {
                        Circle()
                            .fill(index == 0 ? QMDesign.Colors.accent : QMDesign.Colors.surfaceMedium)
                            .frame(width: 6, height: 6)
                        Text(item)
                            .font(QMDesign.Typography.captionSmall)
                            .foregroundColor(index == 0 ? QMDesign.Colors.textPrimary : QMDesign.Colors.textTertiary)
                    }
                }
            }
            .padding(QMDesign.Spacing.sm)
            .frame(width: 80)
            .background(QMDesign.Colors.surfaceLight)

            // Main Content
            VStack(alignment: .leading, spacing: QMDesign.Spacing.sm) {
                // Header
                HStack {
                    Text(String(localized: "onboarding.features.dashboard.mockup.sessions"))
                        .font(QMDesign.Typography.labelSmall)
                        .foregroundColor(QMDesign.Colors.textPrimary)
                    Spacer()
                    RoundedRectangle(cornerRadius: QMDesign.Radius.sm)
                        .fill(QMDesign.Colors.primaryGradient)
                        .frame(width: 50, height: 16)
                        .overlay(
                            Text(String(localized: "onboarding.features.dashboard.mockup.start"))
                                .font(.system(size: 8, weight: .semibold))
                                .foregroundColor(.white)
                        )
                }

                // Session Cards
                ForEach(0..<2, id: \.self) { _ in
                    RoundedRectangle(cornerRadius: QMDesign.Radius.sm)
                        .fill(QMDesign.Colors.surfaceLight)
                        .frame(height: 24)
                }
            }
            .padding(QMDesign.Spacing.sm)
        }
        .frame(height: 120)
        .background(
            RoundedRectangle(cornerRadius: QMDesign.Radius.md)
                .fill(QMDesign.Colors.backgroundSecondary)
        )
        .overlay(
            RoundedRectangle(cornerRadius: QMDesign.Radius.md)
                .stroke(QMDesign.Colors.borderSubtle, lineWidth: 1)
        )
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
                Text(String(localized: "onboarding.completion.title"))
                    .font(.system(size: 32, weight: .bold))
                    .foregroundStyle(QMDesign.Colors.primaryGradient)

                Text(String(localized: "onboarding.completion.subtitle"))
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
                    Text(String(localized: "onboarding.completion.button.startFirstSession"))
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

// MARK: - Feature Tour Sheet (Standalone)

/// A standalone sheet to review the feature tour from the Dashboard
struct FeatureTourSheet: View {
    @Environment(\.dismiss) private var dismiss
    @State private var currentPage = 0
    @State private var isButtonHovered = false

    private let totalPages = 5

    var body: some View {
        ZStack {
            // Background
            QMDesign.Colors.backgroundPrimary
                .ignoresSafeArea()

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
                // Header with close button
                HStack {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(String(localized: "onboarding.features.tour.title"))
                            .font(QMDesign.Typography.titleSmall)
                            .foregroundColor(QMDesign.Colors.textPrimary)
                        Text(String(localized: "onboarding.features.tour.subtitle"))
                            .font(QMDesign.Typography.caption)
                            .foregroundColor(QMDesign.Colors.textTertiary)
                    }

                    Spacer()

                    Button(action: { dismiss() }) {
                        Image(systemName: "xmark.circle.fill")
                            .font(.system(size: 20))
                            .foregroundColor(QMDesign.Colors.textTertiary)
                    }
                    .buttonStyle(.plain)
                    .onHover { isHovered in
                        if isHovered {
                            NSCursor.pointingHand.push()
                        } else {
                            NSCursor.pop()
                        }
                    }
                }
                .padding(QMDesign.Spacing.lg)

                Divider()
                    .background(QMDesign.Colors.borderSubtle)

                // Tour Content
                Group {
                    switch currentPage {
                    case 0: WidgetTourScreen()
                    case 1: AIFeaturesTourScreen()
                    case 2: DashboardTourScreen()
                    case 3: ModesTourScreen()
                    case 4: ShortcutsTourScreen()
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
                                    Text(String(localized: "onboarding.button.back"))
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
                                Text(currentPage < totalPages - 1 ? String(localized: "onboarding.button.next") : String(localized: "onboarding.button.done"))
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
                            .scaleEffect(isButtonHovered ? 1.05 : 1.0)
                        }
                        .buttonStyle(.plain)
                        .onHover { isButtonHovered = $0 }
                        .animation(QMDesign.Animation.smooth, value: isButtonHovered)
                    }
                    .padding(.horizontal, QMDesign.Spacing.xl)
                }
                .padding(.vertical, QMDesign.Spacing.lg)
            }
        }
        .frame(width: 650, height: 680)
    }
}
