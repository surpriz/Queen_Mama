//
//  DesignSystem.swift
//  QueenMama
//
//  Design System - Single source of truth for all design tokens
//

import SwiftUI

// MARK: - Design System

struct QMDesign {

    // MARK: - Colors

    struct Colors {
        // Primary Gradient (Purple to Blue)
        static let gradientStart = Color(hex: "7C3AED")  // Violet
        static let gradientEnd = Color(hex: "3B82F6")    // Blue

        static var primaryGradient: LinearGradient {
            LinearGradient(
                colors: [gradientStart, gradientEnd],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
        }

        static var horizontalGradient: LinearGradient {
            LinearGradient(
                colors: [gradientStart, gradientEnd],
                startPoint: .leading,
                endPoint: .trailing
            )
        }

        // Accent Colors
        static let accent = Color(hex: "8B5CF6")        // Main accent
        static let accentLight = Color(hex: "A78BFA")   // Lighter accent
        static let accentDark = Color(hex: "6D28D9")    // Darker accent

        // Background variants
        static let backgroundPrimary = Color(nsColor: .windowBackgroundColor)
        static let backgroundSecondary = Color(hex: "1F1F23")
        static let backgroundTertiary = Color(hex: "27272A")
        static let backgroundElevated = Color(hex: "2D2D32")

        // Surface colors (for cards, panels)
        static let surfaceLight = Color.white.opacity(0.05)
        static let surfaceMedium = Color.white.opacity(0.08)
        static let surfaceHover = Color.white.opacity(0.12)
        static let surfacePressed = Color.white.opacity(0.15)

        // Semantic colors
        static let success = Color(hex: "10B981")       // Green
        static let successLight = Color(hex: "10B981").opacity(0.15)
        static let warning = Color(hex: "F59E0B")       // Amber
        static let warningLight = Color(hex: "F59E0B").opacity(0.15)
        static let error = Color(hex: "EF4444")         // Red
        static let errorLight = Color(hex: "EF4444").opacity(0.15)
        static let info = Color(hex: "3B82F6")          // Blue
        static let infoLight = Color(hex: "3B82F6").opacity(0.15)

        // Text colors
        static let textPrimary = Color.white
        static let textSecondary = Color.white.opacity(0.7)
        static let textTertiary = Color.white.opacity(0.5)
        static let textDisabled = Color.white.opacity(0.3)

        // Border colors
        static let borderSubtle = Color.white.opacity(0.08)
        static let borderMedium = Color.white.opacity(0.15)
        static let borderStrong = Color.white.opacity(0.25)

        // Overlay
        static let overlay = Color.black.opacity(0.85)
        static let overlayLight = Color.black.opacity(0.5)

        // Auto-Answer specific
        static let autoAnswer = Color(hex: "F97316")    // Orange
        static let autoAnswerLight = Color(hex: "F97316").opacity(0.2)
    }

    // MARK: - Typography

    struct Typography {
        // Titles
        static let titleLarge = Font.system(size: 28, weight: .bold)
        static let titleMedium = Font.system(size: 22, weight: .semibold)
        static let titleSmall = Font.system(size: 18, weight: .semibold)

        // Headlines
        static let headline = Font.system(size: 16, weight: .semibold)
        static let subheadline = Font.system(size: 14, weight: .medium)

        // Body
        static let bodyLarge = Font.system(size: 15, weight: .regular)
        static let bodyMedium = Font.system(size: 13, weight: .regular)
        static let bodySmall = Font.system(size: 12, weight: .regular)

        // Caption
        static let caption = Font.system(size: 11, weight: .medium)
        static let captionSmall = Font.system(size: 10, weight: .regular)

        // Monospace (for shortcuts, code)
        static let mono = Font.system(size: 11, weight: .medium, design: .monospaced)
        static let monoSmall = Font.system(size: 10, weight: .regular, design: .monospaced)

        // Labels
        static let labelLarge = Font.system(size: 13, weight: .semibold)
        static let labelMedium = Font.system(size: 12, weight: .medium)
        static let labelSmall = Font.system(size: 11, weight: .medium)
    }

    // MARK: - Spacing

    struct Spacing {
        static let xxxs: CGFloat = 2
        static let xxs: CGFloat = 4
        static let xs: CGFloat = 8
        static let sm: CGFloat = 12
        static let md: CGFloat = 16
        static let lg: CGFloat = 20
        static let xl: CGFloat = 24
        static let xxl: CGFloat = 32
        static let xxxl: CGFloat = 48
    }

    // MARK: - Corner Radius

    struct Radius {
        static let xs: CGFloat = 4
        static let sm: CGFloat = 6
        static let md: CGFloat = 8
        static let lg: CGFloat = 12
        static let xl: CGFloat = 16
        static let xxl: CGFloat = 20
        static let pill: CGFloat = 9999
    }

    // MARK: - Shadows

    struct Shadows {
        static let small = ShadowStyle(color: .black.opacity(0.15), radius: 4, x: 0, y: 2)
        static let medium = ShadowStyle(color: .black.opacity(0.2), radius: 8, x: 0, y: 4)
        static let large = ShadowStyle(color: .black.opacity(0.25), radius: 16, x: 0, y: 8)
        static let glow = ShadowStyle(color: Colors.accent.opacity(0.4), radius: 12, x: 0, y: 0)
        static let glowStrong = ShadowStyle(color: Colors.accent.opacity(0.6), radius: 20, x: 0, y: 0)
    }

    struct ShadowStyle {
        let color: Color
        let radius: CGFloat
        let x: CGFloat
        let y: CGFloat
    }

    // MARK: - Animation

    struct Animation {
        static let quick = SwiftUI.Animation.easeInOut(duration: 0.15)
        static let standard = SwiftUI.Animation.easeInOut(duration: 0.25)
        static let slow = SwiftUI.Animation.easeInOut(duration: 0.4)
        static let smooth = SwiftUI.Animation.spring(response: 0.3, dampingFraction: 0.8)
        static let bounce = SwiftUI.Animation.spring(response: 0.4, dampingFraction: 0.6)
        static let gentle = SwiftUI.Animation.spring(response: 0.5, dampingFraction: 0.9)
    }

    // MARK: - Dimensions

    struct Dimensions {
        // Overlay Widget
        struct Overlay {
            static let collapsedWidth: CGFloat = 380
            static let collapsedHeight: CGFloat = 52
            static let expandedWidth: CGFloat = 420
            static let expandedHeight: CGFloat = 480

            static let headerHeight: CGFloat = 44
            static let tabBarHeight: CGFloat = 36
            static let inputHeight: CGFloat = 48
        }

        // Dashboard
        struct Dashboard {
            static let sidebarMinWidth: CGFloat = 220
            static let sidebarMaxWidth: CGFloat = 280
            static let detailMinWidth: CGFloat = 500
        }

        // Cards
        struct Card {
            static let minHeight: CGFloat = 80
            static let padding: CGFloat = 16
        }

        // Buttons
        struct Button {
            static let heightSmall: CGFloat = 28
            static let heightMedium: CGFloat = 36
            static let heightLarge: CGFloat = 44
            static let iconSize: CGFloat = 20
        }
    }

    // MARK: - Icons

    struct Icons {
        // Navigation
        static let sessions = "list.bullet.rectangle.portrait"
        static let liveSession = "waveform"
        static let modes = "person.2.fill"
        static let settings = "gearshape.fill"

        // Actions
        static let play = "play.fill"
        static let stop = "stop.fill"
        static let pause = "pause.fill"
        static let send = "arrow.up.circle.fill"
        static let expand = "chevron.down"
        static let collapse = "chevron.up"
        static let more = "ellipsis.circle.fill"
        static let close = "xmark.circle.fill"
        static let add = "plus.circle.fill"
        static let delete = "trash.fill"
        static let copy = "doc.on.doc"
        static let export = "square.and.arrow.up"
        static let clear = "xmark.circle"

        // Features
        static let camera = "camera.fill"
        static let cameraOff = "camera.slash.fill"
        static let microphone = "mic.fill"
        static let microphoneOff = "mic.slash.fill"
        static let autoAnswer = "bolt.fill"
        static let autoAnswerOff = "bolt.slash.fill"
        static let smart = "brain.head.profile"
        static let undetectable = "eye.slash.fill"

        // Response Types
        static let assist = "sparkles"
        static let whatToSay = "text.bubble.fill"
        static let followUp = "questionmark.bubble.fill"
        static let recap = "arrow.counterclockwise"

        // Providers
        static let openai = "circle.hexagongrid.fill"
        static let anthropic = "a.circle.fill"
        static let gemini = "g.circle.fill"

        // Status
        static let success = "checkmark.circle.fill"
        static let error = "xmark.circle.fill"
        static let warning = "exclamationmark.triangle.fill"
        static let info = "info.circle.fill"
        static let loading = "circle.dotted"
    }
}

// MARK: - Color Extension for Hex Support

extension Color {
    init(hex: String) {
        let hex = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var int: UInt64 = 0
        Scanner(string: hex).scanHexInt64(&int)
        let a, r, g, b: UInt64
        switch hex.count {
        case 3: // RGB (12-bit)
            (a, r, g, b) = (255, (int >> 8) * 17, (int >> 4 & 0xF) * 17, (int & 0xF) * 17)
        case 6: // RGB (24-bit)
            (a, r, g, b) = (255, int >> 16, int >> 8 & 0xFF, int & 0xFF)
        case 8: // ARGB (32-bit)
            (a, r, g, b) = (int >> 24, int >> 16 & 0xFF, int >> 8 & 0xFF, int & 0xFF)
        default:
            (a, r, g, b) = (1, 1, 1, 0)
        }
        self.init(
            .sRGB,
            red: Double(r) / 255,
            green: Double(g) / 255,
            blue: Double(b) / 255,
            opacity: Double(a) / 255
        )
    }
}

// MARK: - View Modifiers

extension View {
    /// Applies card styling with optional hover effect
    func qmCard(hovering: Bool = false) -> some View {
        self
            .padding(QMDesign.Spacing.md)
            .background(
                RoundedRectangle(cornerRadius: QMDesign.Radius.lg)
                    .fill(hovering ? QMDesign.Colors.surfaceHover : QMDesign.Colors.surfaceMedium)
                    .shadow(
                        color: QMDesign.Shadows.small.color,
                        radius: QMDesign.Shadows.small.radius,
                        x: QMDesign.Shadows.small.x,
                        y: QMDesign.Shadows.small.y
                    )
            )
    }

    /// Applies gradient background
    func qmGradientBackground() -> some View {
        self.background(QMDesign.Colors.primaryGradient)
    }

    /// Applies subtle gradient overlay for text/icons
    func qmGradientForeground() -> some View {
        self.overlay(QMDesign.Colors.primaryGradient)
            .mask(self)
    }

    /// Applies glow effect
    func qmGlow(color: Color = QMDesign.Colors.accent, radius: CGFloat = 12) -> some View {
        self.shadow(color: color.opacity(0.4), radius: radius, x: 0, y: 0)
    }

    /// Applies selection styling with gradient
    func qmSelected(_ isSelected: Bool) -> some View {
        self
            .background(
                Group {
                    if isSelected {
                        RoundedRectangle(cornerRadius: QMDesign.Radius.md)
                            .fill(QMDesign.Colors.primaryGradient.opacity(0.2))
                    }
                }
            )
    }

    /// Applies pill/capsule button styling
    func qmPillButton(isActive: Bool = false, color: Color = QMDesign.Colors.accent) -> some View {
        self
            .padding(.horizontal, QMDesign.Spacing.sm)
            .padding(.vertical, QMDesign.Spacing.xs)
            .background(
                Capsule()
                    .fill(isActive ? color.opacity(0.2) : QMDesign.Colors.surfaceMedium)
            )
            .foregroundColor(isActive ? color : QMDesign.Colors.textSecondary)
    }

    /// Applies accent button styling
    func qmAccentButton() -> some View {
        self
            .padding(.horizontal, QMDesign.Spacing.md)
            .padding(.vertical, QMDesign.Spacing.xs)
            .background(
                Capsule()
                    .fill(QMDesign.Colors.primaryGradient)
            )
            .foregroundColor(.white)
            .shadow(
                color: QMDesign.Colors.accent.opacity(0.3),
                radius: 8,
                x: 0,
                y: 4
            )
    }

    /// Applies input field styling
    func qmInputField() -> some View {
        self
            .padding(QMDesign.Spacing.sm)
            .background(
                RoundedRectangle(cornerRadius: QMDesign.Radius.md)
                    .fill(QMDesign.Colors.surfaceLight)
                    .overlay(
                        RoundedRectangle(cornerRadius: QMDesign.Radius.md)
                            .stroke(QMDesign.Colors.borderSubtle, lineWidth: 1)
                    )
            )
    }

    /// Applies section header styling
    func qmSectionHeader() -> some View {
        self
            .font(QMDesign.Typography.caption)
            .foregroundColor(QMDesign.Colors.textTertiary)
            .textCase(.uppercase)
            .tracking(0.5)
    }
}

// MARK: - Keyboard Shortcut Badge Component

struct KeyboardShortcutBadge: View {
    let shortcut: String
    var size: BadgeSize = .medium

    enum BadgeSize {
        case small, medium

        var font: Font {
            switch self {
            case .small: return QMDesign.Typography.monoSmall
            case .medium: return QMDesign.Typography.mono
            }
        }

        var padding: EdgeInsets {
            switch self {
            case .small: return EdgeInsets(top: 2, leading: 4, bottom: 2, trailing: 4)
            case .medium: return EdgeInsets(top: 3, leading: 6, bottom: 3, trailing: 6)
            }
        }
    }

    var body: some View {
        HStack(spacing: 2) {
            ForEach(parseShortcut(), id: \.self) { key in
                Text(key)
                    .font(size.font)
                    .padding(size.padding)
                    .background(
                        RoundedRectangle(cornerRadius: QMDesign.Radius.xs)
                            .fill(QMDesign.Colors.surfaceMedium)
                            .overlay(
                                RoundedRectangle(cornerRadius: QMDesign.Radius.xs)
                                    .stroke(QMDesign.Colors.borderSubtle, lineWidth: 0.5)
                            )
                    )
                    .foregroundColor(QMDesign.Colors.textTertiary)
            }
        }
    }

    private func parseShortcut() -> [String] {
        // Convert shortcut string into individual keys
        // e.g., "Cmd+Enter" -> ["⌘", "↩"]
        var keys: [String] = []
        let components = shortcut.components(separatedBy: "+")
        for component in components {
            let trimmed = component.trimmingCharacters(in: .whitespaces)
            switch trimmed.lowercased() {
            case "cmd", "command": keys.append("⌘")
            case "shift": keys.append("⇧")
            case "option", "opt", "alt": keys.append("⌥")
            case "ctrl", "control": keys.append("⌃")
            case "enter", "return": keys.append("↩")
            case "esc", "escape": keys.append("⎋")
            case "tab": keys.append("⇥")
            case "space": keys.append("␣")
            case "delete", "backspace": keys.append("⌫")
            case "up": keys.append("↑")
            case "down": keys.append("↓")
            case "left": keys.append("←")
            case "right": keys.append("→")
            case "\\": keys.append("\\")
            default: keys.append(trimmed.uppercased())
            }
        }
        return keys
    }
}

// MARK: - Gradient Text Modifier

struct GradientText: ViewModifier {
    func body(content: Content) -> some View {
        content
            .overlay(QMDesign.Colors.primaryGradient)
            .mask(content)
    }
}

extension View {
    func gradientText() -> some View {
        modifier(GradientText())
    }
}

// MARK: - Status Indicator Component

struct StatusIndicator: View {
    enum Status {
        case idle, active, processing, error

        var color: Color {
            switch self {
            case .idle: return QMDesign.Colors.textTertiary
            case .active: return QMDesign.Colors.success
            case .processing: return QMDesign.Colors.accent
            case .error: return QMDesign.Colors.error
            }
        }
    }

    let status: Status
    var size: CGFloat = 8
    var showPulse: Bool = true

    @State private var isPulsing = false

    var body: some View {
        ZStack {
            // Pulse effect for active/processing
            if (status == .active || status == .processing) && showPulse {
                Circle()
                    .fill(status.color.opacity(0.3))
                    .frame(width: size * 2, height: size * 2)
                    .scaleEffect(isPulsing ? 1.2 : 0.8)
                    .opacity(isPulsing ? 0 : 0.5)
            }

            // Main indicator
            Circle()
                .fill(status.color)
                .frame(width: size, height: size)
        }
        .onAppear {
            if status == .active || status == .processing {
                withAnimation(.easeInOut(duration: 1.0).repeatForever(autoreverses: true)) {
                    isPulsing = true
                }
            }
        }
    }
}

// MARK: - Preview

#Preview("Design System") {
    VStack(spacing: 20) {
        // Colors
        HStack(spacing: 8) {
            Circle().fill(QMDesign.Colors.gradientStart).frame(width: 40, height: 40)
            Circle().fill(QMDesign.Colors.accent).frame(width: 40, height: 40)
            Circle().fill(QMDesign.Colors.gradientEnd).frame(width: 40, height: 40)
        }

        // Gradient
        RoundedRectangle(cornerRadius: QMDesign.Radius.lg)
            .fill(QMDesign.Colors.primaryGradient)
            .frame(height: 60)

        // Keyboard shortcuts
        HStack {
            KeyboardShortcutBadge(shortcut: "Cmd+Enter")
            KeyboardShortcutBadge(shortcut: "Cmd+Shift+S")
            KeyboardShortcutBadge(shortcut: "Cmd+\\", size: .small)
        }

        // Status indicators
        HStack(spacing: 16) {
            StatusIndicator(status: .idle)
            StatusIndicator(status: .active)
            StatusIndicator(status: .processing)
            StatusIndicator(status: .error)
        }

        // Buttons
        HStack {
            Text("Accent Button")
                .font(QMDesign.Typography.labelMedium)
                .qmAccentButton()

            Text("Pill Button")
                .font(QMDesign.Typography.labelSmall)
                .qmPillButton(isActive: true)
        }
    }
    .padding(40)
    .background(QMDesign.Colors.backgroundSecondary)
}
