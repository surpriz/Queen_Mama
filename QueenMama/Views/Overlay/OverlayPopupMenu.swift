//
//  OverlayPopupMenu.swift
//  QueenMama
//
//  Modern contextual popup menu for overlay settings and actions
//

import SwiftUI

// MARK: - Overlay Position

enum OverlayPosition: String, CaseIterable {
    case topLeft = "Top Left"
    case topCenter = "Top Center"
    case topRight = "Top Right"
    case bottomLeft = "Bottom Left"
    case bottomCenter = "Bottom Center"
    case bottomRight = "Bottom Right"

    var icon: String {
        switch self {
        case .topLeft: return "arrow.up.left"
        case .topCenter: return "arrow.up"
        case .topRight: return "arrow.up.right"
        case .bottomLeft: return "arrow.down.left"
        case .bottomCenter: return "arrow.down"
        case .bottomRight: return "arrow.down.right"
        }
    }
}

// MARK: - Overlay Popup Menu

struct OverlayPopupMenu: View {
    @Binding var isAutoAnswerEnabled: Bool
    @Binding var isSmartModeEnabled: Bool
    @Binding var enableScreenCapture: Bool
    @Binding var isVisible: Bool

    let onClearContext: () -> Void
    let onMovePosition: (OverlayPosition) -> Void

    @State private var showPositionSubmenu = false
    @State private var hoveredItem: String?

    var body: some View {
        VStack(spacing: 0) {
            // Toggle Items
            MenuToggleItem(
                title: "Auto-Answer",
                icon: QMDesign.Icons.autoAnswer,
                shortcut: "Cmd+Shift+A",
                isEnabled: $isAutoAnswerEnabled,
                accentColor: QMDesign.Colors.autoAnswer,
                isHovered: hoveredItem == "auto"
            )
            .onHover { if $0 { hoveredItem = "auto" } }

            MenuToggleItem(
                title: "Smart Mode",
                icon: QMDesign.Icons.smart,
                shortcut: nil,
                isEnabled: $isSmartModeEnabled,
                accentColor: QMDesign.Colors.accent,
                isHovered: hoveredItem == "smart"
            )
            .onHover { if $0 { hoveredItem = "smart" } }

            MenuToggleItem(
                title: "Screen Capture",
                icon: QMDesign.Icons.camera,
                shortcut: nil,
                isEnabled: $enableScreenCapture,
                accentColor: QMDesign.Colors.success,
                isHovered: hoveredItem == "capture"
            )
            .onHover { if $0 { hoveredItem = "capture" } }

            MenuDivider()

            // Position Submenu
            PositionMenuItem(
                isExpanded: $showPositionSubmenu,
                isHovered: hoveredItem == "position",
                onSelect: { position in
                    onMovePosition(position)
                    isVisible = false
                }
            )
            .onHover { if $0 { hoveredItem = "position" } }

            MenuDivider()

            // Action Items
            MenuActionItem(
                title: "Clear Context",
                icon: QMDesign.Icons.clear,
                shortcut: "Cmd+R",
                isHovered: hoveredItem == "clear",
                isDestructive: false
            ) {
                onClearContext()
                isVisible = false
            }
            .onHover { if $0 { hoveredItem = "clear" } }

            MenuActionItem(
                title: "Hide Widget",
                icon: "eye.slash",
                shortcut: "Cmd+\\",
                isHovered: hoveredItem == "hide",
                isDestructive: false
            ) {
                isVisible = false
                // Widget will be hidden through the main view
            }
            .onHover { if $0 { hoveredItem = "hide" } }
        }
        .padding(QMDesign.Spacing.xs)
        .frame(width: 220)
        .background(
            RoundedRectangle(cornerRadius: QMDesign.Radius.lg)
                .fill(QMDesign.Colors.backgroundSecondary)
                .shadow(
                    color: QMDesign.Shadows.large.color,
                    radius: QMDesign.Shadows.large.radius,
                    x: QMDesign.Shadows.large.x,
                    y: QMDesign.Shadows.large.y
                )
        )
        .overlay(
            RoundedRectangle(cornerRadius: QMDesign.Radius.lg)
                .stroke(QMDesign.Colors.borderSubtle, lineWidth: 1)
        )
        .onHover { isHovering in
            if !isHovering {
                hoveredItem = nil
            }
        }
    }
}

// MARK: - Menu Toggle Item

struct MenuToggleItem: View {
    let title: String
    let icon: String
    let shortcut: String?
    @Binding var isEnabled: Bool
    let accentColor: Color
    let isHovered: Bool

    var body: some View {
        Button(action: { isEnabled.toggle() }) {
            HStack(spacing: QMDesign.Spacing.sm) {
                // Icon
                Image(systemName: icon)
                    .font(.system(size: 13))
                    .foregroundColor(isEnabled ? accentColor : QMDesign.Colors.textSecondary)
                    .frame(width: 20)

                // Title
                Text(title)
                    .font(QMDesign.Typography.bodySmall)
                    .foregroundColor(QMDesign.Colors.textPrimary)

                Spacer()

                // Shortcut badge
                if let shortcut = shortcut {
                    KeyboardShortcutBadge(shortcut: shortcut, size: .small)
                }

                // Toggle indicator
                ToggleIndicator(isEnabled: isEnabled, accentColor: accentColor)
            }
            .padding(.horizontal, QMDesign.Spacing.sm)
            .padding(.vertical, QMDesign.Spacing.xs)
            .background(
                RoundedRectangle(cornerRadius: QMDesign.Radius.sm)
                    .fill(isHovered ? QMDesign.Colors.surfaceHover : Color.clear)
            )
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Toggle Indicator

struct ToggleIndicator: View {
    let isEnabled: Bool
    let accentColor: Color

    var body: some View {
        ZStack {
            Capsule()
                .fill(isEnabled ? accentColor.opacity(0.3) : QMDesign.Colors.surfaceMedium)
                .frame(width: 32, height: 18)

            Circle()
                .fill(isEnabled ? accentColor : QMDesign.Colors.textTertiary)
                .frame(width: 14, height: 14)
                .offset(x: isEnabled ? 7 : -7)
                .animation(QMDesign.Animation.quick, value: isEnabled)
        }
    }
}

// MARK: - Menu Action Item

struct MenuActionItem: View {
    let title: String
    let icon: String
    let shortcut: String?
    let isHovered: Bool
    var isDestructive: Bool = false
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: QMDesign.Spacing.sm) {
                // Icon
                Image(systemName: icon)
                    .font(.system(size: 13))
                    .foregroundColor(isDestructive ? QMDesign.Colors.error : QMDesign.Colors.textSecondary)
                    .frame(width: 20)

                // Title
                Text(title)
                    .font(QMDesign.Typography.bodySmall)
                    .foregroundColor(isDestructive ? QMDesign.Colors.error : QMDesign.Colors.textPrimary)

                Spacer()

                // Shortcut badge
                if let shortcut = shortcut {
                    KeyboardShortcutBadge(shortcut: shortcut, size: .small)
                }
            }
            .padding(.horizontal, QMDesign.Spacing.sm)
            .padding(.vertical, QMDesign.Spacing.xs)
            .background(
                RoundedRectangle(cornerRadius: QMDesign.Radius.sm)
                    .fill(isHovered ? (isDestructive ? QMDesign.Colors.errorLight : QMDesign.Colors.surfaceHover) : Color.clear)
            )
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Position Menu Item

struct PositionMenuItem: View {
    @Binding var isExpanded: Bool
    let isHovered: Bool
    let onSelect: (OverlayPosition) -> Void

    var body: some View {
        VStack(spacing: 0) {
            // Main row
            Button(action: { withAnimation(QMDesign.Animation.quick) { isExpanded.toggle() } }) {
                HStack(spacing: QMDesign.Spacing.sm) {
                    // Icon
                    Image(systemName: "arrow.up.and.down.and.arrow.left.and.right")
                        .font(.system(size: 13))
                        .foregroundColor(QMDesign.Colors.textSecondary)
                        .frame(width: 20)

                    // Title
                    Text("Position")
                        .font(QMDesign.Typography.bodySmall)
                        .foregroundColor(QMDesign.Colors.textPrimary)

                    Spacer()

                    // Expand chevron
                    Image(systemName: isExpanded ? "chevron.up" : "chevron.down")
                        .font(.system(size: 10, weight: .semibold))
                        .foregroundColor(QMDesign.Colors.textTertiary)
                }
                .padding(.horizontal, QMDesign.Spacing.sm)
                .padding(.vertical, QMDesign.Spacing.xs)
                .background(
                    RoundedRectangle(cornerRadius: QMDesign.Radius.sm)
                        .fill(isHovered || isExpanded ? QMDesign.Colors.surfaceHover : Color.clear)
                )
            }
            .buttonStyle(.plain)

            // Submenu
            if isExpanded {
                VStack(spacing: 2) {
                    // Position grid
                    LazyVGrid(columns: [
                        GridItem(.flexible()),
                        GridItem(.flexible()),
                        GridItem(.flexible())
                    ], spacing: 4) {
                        ForEach(OverlayPosition.allCases, id: \.self) { position in
                            PositionButton(position: position) {
                                onSelect(position)
                            }
                        }
                    }
                }
                .padding(QMDesign.Spacing.xs)
                .background(
                    RoundedRectangle(cornerRadius: QMDesign.Radius.sm)
                        .fill(QMDesign.Colors.surfaceLight)
                )
                .padding(.horizontal, QMDesign.Spacing.xs)
                .padding(.top, QMDesign.Spacing.xxs)
            }
        }
    }
}

// MARK: - Position Button

struct PositionButton: View {
    let position: OverlayPosition
    let action: () -> Void

    @State private var isHovered = false

    var body: some View {
        Button(action: action) {
            VStack(spacing: 2) {
                Image(systemName: position.icon)
                    .font(.system(size: 12))
                    .foregroundColor(isHovered ? QMDesign.Colors.accent : QMDesign.Colors.textSecondary)
            }
            .frame(width: 50, height: 30)
            .background(
                RoundedRectangle(cornerRadius: QMDesign.Radius.xs)
                    .fill(isHovered ? QMDesign.Colors.accent.opacity(0.15) : QMDesign.Colors.surfaceMedium)
            )
        }
        .buttonStyle(.plain)
        .onHover { isHovered = $0 }
    }
}

// MARK: - Menu Divider

struct MenuDivider: View {
    var body: some View {
        Rectangle()
            .fill(QMDesign.Colors.borderSubtle)
            .frame(height: 1)
            .padding(.horizontal, QMDesign.Spacing.sm)
            .padding(.vertical, QMDesign.Spacing.xs)
    }
}

// MARK: - Preview

#Preview("Overlay Popup Menu") {
    ZStack {
        Color.black.opacity(0.8)

        OverlayPopupMenu(
            isAutoAnswerEnabled: .constant(true),
            isSmartModeEnabled: .constant(false),
            enableScreenCapture: .constant(true),
            isVisible: .constant(true),
            onClearContext: {},
            onMovePosition: { _ in }
        )
    }
}
