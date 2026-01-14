import Foundation
import SwiftUI
import CryptoKit

// MARK: - String Extensions

extension String {
    var isNotEmpty: Bool {
        !isEmpty
    }

    func truncated(to length: Int, trailing: String = "...") -> String {
        if count > length {
            return String(prefix(length)) + trailing
        }
        return self
    }
}

// MARK: - Date Extensions

extension Date {
    var isToday: Bool {
        Calendar.current.isDateInToday(self)
    }

    var isYesterday: Bool {
        Calendar.current.isDateInYesterday(self)
    }

    func timeAgo() -> String {
        let formatter = RelativeDateTimeFormatter()
        formatter.unitsStyle = .abbreviated
        return formatter.localizedString(for: self, relativeTo: Date())
    }
}

// MARK: - View Extensions

extension View {
    func onFirstAppear(perform action: @escaping () -> Void) -> some View {
        modifier(FirstAppearModifier(action: action))
    }

    @ViewBuilder
    func `if`<Content: View>(_ condition: Bool, transform: (Self) -> Content) -> some View {
        if condition {
            transform(self)
        } else {
            self
        }
    }
}

struct FirstAppearModifier: ViewModifier {
    let action: () -> Void
    @State private var hasAppeared = false

    func body(content: Content) -> some View {
        content.onAppear {
            guard !hasAppeared else { return }
            hasAppeared = true
            action()
        }
    }
}

// MARK: - Data Extensions

extension Data {
    var prettyPrintedJSON: String? {
        guard let object = try? JSONSerialization.jsonObject(with: self),
              let data = try? JSONSerialization.data(withJSONObject: object, options: .prettyPrinted),
              let string = String(data: data, encoding: .utf8) else {
            return nil
        }
        return string
    }

    /// Compute SHA256 hash of data (used for screenshot deduplication)
    func sha256Hash() -> String {
        let hash = SHA256.hash(data: self)
        return hash.compactMap { String(format: "%02x", $0) }.joined()
    }
}

// MARK: - Color Extensions (Legacy - use QMDesign.Colors instead)

extension Color {
    // Legacy aliases pointing to new design system
    static let queenMamaPrimary = QMDesign.Colors.accent
    static let queenMamaSecondary = QMDesign.Colors.gradientStart
    static let queenMamaBackground = QMDesign.Colors.backgroundPrimary
    static let queenMamaOverlay = QMDesign.Colors.overlay
}

// MARK: - NSColor Extensions

extension NSColor {
    convenience init(hex: String) {
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
            (a, r, g, b) = (255, 0, 0, 0)
        }
        self.init(
            red: CGFloat(r) / 255,
            green: CGFloat(g) / 255,
            blue: CGFloat(b) / 255,
            alpha: CGFloat(a) / 255
        )
    }
}

// MARK: - Additional View Extensions for Design System

extension View {
    /// Applies hover effect with scale and opacity
    func hoverEffect(isHovered: Bool) -> some View {
        self
            .scaleEffect(isHovered ? 1.02 : 1.0)
            .animation(QMDesign.Animation.quick, value: isHovered)
    }

    /// Applies press effect with scale down
    func pressEffect(isPressed: Bool) -> some View {
        self
            .scaleEffect(isPressed ? 0.96 : 1.0)
            .animation(QMDesign.Animation.quick, value: isPressed)
    }

    /// Applies shimmer loading effect
    @ViewBuilder
    func shimmer(isActive: Bool) -> some View {
        if isActive {
            self.modifier(ShimmerModifier())
        } else {
            self
        }
    }
}

// MARK: - Shimmer Effect Modifier

struct ShimmerModifier: ViewModifier {
    @State private var phase: CGFloat = 0

    func body(content: Content) -> some View {
        content
            .overlay(
                GeometryReader { geometry in
                    LinearGradient(
                        colors: [
                            Color.white.opacity(0),
                            Color.white.opacity(0.3),
                            Color.white.opacity(0)
                        ],
                        startPoint: .leading,
                        endPoint: .trailing
                    )
                    .frame(width: geometry.size.width * 0.6)
                    .offset(x: -geometry.size.width * 0.3 + phase * geometry.size.width * 1.6)
                }
            )
            .mask(content)
            .onAppear {
                withAnimation(.linear(duration: 1.5).repeatForever(autoreverses: false)) {
                    phase = 1
                }
            }
    }
}

// MARK: - Button Style Extensions

struct QMButtonStyle: ButtonStyle {
    var style: Style = .primary

    enum Style {
        case primary    // Gradient background
        case secondary  // Surface background
        case ghost      // Transparent
        case danger     // Red/error
    }

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(QMDesign.Typography.labelMedium)
            .padding(.horizontal, QMDesign.Spacing.md)
            .padding(.vertical, QMDesign.Spacing.xs)
            .background(backgroundFor(style: style, isPressed: configuration.isPressed))
            .foregroundColor(foregroundFor(style: style))
            .clipShape(Capsule())
            .scaleEffect(configuration.isPressed ? 0.96 : 1.0)
            .animation(QMDesign.Animation.quick, value: configuration.isPressed)
    }

    @ViewBuilder
    private func backgroundFor(style: Style, isPressed: Bool) -> some View {
        switch style {
        case .primary:
            QMDesign.Colors.primaryGradient
                .opacity(isPressed ? 0.8 : 1.0)
        case .secondary:
            QMDesign.Colors.surfaceMedium
                .opacity(isPressed ? 0.6 : 1.0)
        case .ghost:
            Color.clear
        case .danger:
            QMDesign.Colors.error.opacity(isPressed ? 0.6 : 0.2)
        }
    }

    private func foregroundFor(style: Style) -> Color {
        switch style {
        case .primary:
            return .white
        case .secondary:
            return QMDesign.Colors.textPrimary
        case .ghost:
            return QMDesign.Colors.textSecondary
        case .danger:
            return QMDesign.Colors.error
        }
    }
}

extension ButtonStyle where Self == QMButtonStyle {
    static var qmPrimary: QMButtonStyle { QMButtonStyle(style: .primary) }
    static var qmSecondary: QMButtonStyle { QMButtonStyle(style: .secondary) }
    static var qmGhost: QMButtonStyle { QMButtonStyle(style: .ghost) }
    static var qmDanger: QMButtonStyle { QMButtonStyle(style: .danger) }
}
