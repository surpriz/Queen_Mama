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

    var localizedName: String {
        switch self {
        case .topLeft: return String(localized: "overlay.position.topLeft")
        case .topCenter: return String(localized: "overlay.position.topCenter")
        case .topRight: return String(localized: "overlay.position.topRight")
        case .bottomLeft: return String(localized: "overlay.position.bottomLeft")
        case .bottomCenter: return String(localized: "overlay.position.bottomCenter")
        case .bottomRight: return String(localized: "overlay.position.bottomRight")
        }
    }
}

// MARK: - Overlay Popup Menu

struct OverlayPopupMenu: View {
    @Binding var isAutoAnswerEnabled: Bool
    @Binding var isSmartModeEnabled: Bool
    @Binding var enableScreenCapture: Bool
    @Binding var isVisible: Bool
    @Binding var selectedDisplayID: UInt32

    let onCopyResponse: () -> Void
    let onClearContext: () -> Void
    let onMovePosition: (OverlayPosition) -> Void

    @State private var showPositionSubmenu = false
    @State private var showDisplaySubmenu = false
    @State private var hoveredItem: String?

    var body: some View {
        VStack(spacing: 0) {
            // Toggle Items
            MenuToggleItem(
                title: String(localized: "overlay.menu.autoAnswer"),
                icon: QMDesign.Icons.autoAnswer,
                shortcut: "Cmd+Shift+A",
                isEnabled: $isAutoAnswerEnabled,
                accentColor: QMDesign.Colors.autoAnswer,
                isHovered: hoveredItem == "auto",
                subtitle: String(localized: "overlay.menu.autoAnswerSubtitle")
            )
            .onHover { if $0 { hoveredItem = "auto" } }

            MenuToggleItem(
                title: String(localized: "overlay.menu.smartMode"),
                icon: QMDesign.Icons.smart,
                shortcut: nil,
                isEnabled: $isSmartModeEnabled,
                accentColor: QMDesign.Colors.accent,
                isHovered: hoveredItem == "smart",
                subtitle: String(localized: "overlay.menu.smartModeSubtitle")
            )
            .onHover { if $0 { hoveredItem = "smart" } }

            MenuToggleItem(
                title: String(localized: "overlay.menu.screenCapture"),
                icon: QMDesign.Icons.camera,
                shortcut: nil,
                isEnabled: $enableScreenCapture,
                accentColor: QMDesign.Colors.success,
                isHovered: hoveredItem == "capture"
            )
            .onHover { if $0 { hoveredItem = "capture" } }

            MenuDivider()

            // Display Submenu
            DisplayMenuItem(
                isExpanded: $showDisplaySubmenu,
                isHovered: hoveredItem == "display",
                selectedDisplayID: $selectedDisplayID
            )
            .onHover { if $0 { hoveredItem = "display" } }

            MenuDivider()

            // Action Items
            MenuActionItem(
                title: String(localized: "overlay.menu.copyResponse"),
                icon: "doc.on.doc",
                shortcut: "Cmd+Shift+C",
                isHovered: hoveredItem == "copy",
                isDestructive: false
            ) {
                onCopyResponse()
                isVisible = false
            }
            .onHover { if $0 { hoveredItem = "copy" } }

            MenuActionItem(
                title: String(localized: "overlay.menu.clearContext"),
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
                title: String(localized: "overlay.menu.hideWidget"),
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
    var subtitle: String? = nil

    var body: some View {
        Button(action: { isEnabled.toggle() }) {
            HStack(spacing: QMDesign.Spacing.sm) {
                // Icon
                Image(systemName: icon)
                    .font(.system(size: 13))
                    .foregroundColor(isEnabled ? accentColor : QMDesign.Colors.textSecondary)
                    .frame(width: 20)

                // Title and optional subtitle
                VStack(alignment: .leading, spacing: 1) {
                    Text(title)
                        .font(QMDesign.Typography.bodySmall)
                        .foregroundColor(QMDesign.Colors.textPrimary)
                        .lineLimit(1)

                    if let subtitle = subtitle {
                        Text(subtitle)
                            .font(QMDesign.Typography.captionSmall)
                            .foregroundColor(QMDesign.Colors.textTertiary)
                            .lineLimit(1)
                    }
                }

                Spacer(minLength: QMDesign.Spacing.xs)

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
                    .lineLimit(1)

                Spacer(minLength: QMDesign.Spacing.xs)

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
                    Text(String(localized: "overlay.menu.position"))
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

// MARK: - Display Menu Item

struct DisplayMenuItem: View {
    @Binding var isExpanded: Bool
    let isHovered: Bool
    @Binding var selectedDisplayID: UInt32

    /// Cached display list — loaded when submenu expands, never during body re-evaluation
    @State private var displays: [ScreenCaptureService.DisplayInfo] = []

    var body: some View {
        VStack(spacing: 0) {
            // Main row showing current display
            Button(action: {
                withAnimation(QMDesign.Animation.quick) { isExpanded.toggle() }
            }) {
                HStack(spacing: QMDesign.Spacing.sm) {
                    Image(systemName: "display")
                        .font(.system(size: 13))
                        .foregroundColor(QMDesign.Colors.textSecondary)
                        .frame(width: 20)

                    VStack(alignment: .leading, spacing: 1) {
                        Text(String(localized: "overlay.menu.display"))
                            .font(QMDesign.Typography.captionSmall)
                            .foregroundColor(QMDesign.Colors.textTertiary)
                            .lineLimit(1)
                        Text(currentDisplayName)
                            .font(QMDesign.Typography.bodySmall)
                            .foregroundColor(QMDesign.Colors.textPrimary)
                            .lineLimit(1)
                    }

                    Spacer(minLength: QMDesign.Spacing.xs)

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

            // Submenu with display options
            if isExpanded {
                VStack(spacing: 2) {
                    if displays.isEmpty {
                        Text(String(localized: "overlay.menu.noDisplaysFound"))
                            .font(QMDesign.Typography.captionSmall)
                            .foregroundColor(QMDesign.Colors.textTertiary)
                            .padding(QMDesign.Spacing.sm)
                    } else {
                        ForEach(displays) { display in
                            DisplayMenuOptionButton(
                                display: display,
                                isSelected: isDisplaySelected(display),
                                onSelect: { selectDisplay(display) }
                            )
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
        .onChange(of: isExpanded) { expanded in
            if expanded {
                loadDisplays()
            }
        }
    }

    private func loadDisplays() {
        Task {
            displays = await ScreenCaptureService().getAvailableDisplays()
        }
    }

    private var currentDisplayName: String {
        if displays.isEmpty {
            return String(localized: "overlay.menu.primaryDisplay")
        }

        if selectedDisplayID == 0 {
            if let first = displays.first {
                return "\(first.name) • \(first.resolution)"
            }
            return String(localized: "overlay.menu.primaryDisplay")
        }

        if let selected = displays.first(where: { $0.id == selectedDisplayID }) {
            return "\(selected.name) • \(selected.resolution)"
        }

        return String(localized: "overlay.menu.primaryDisplay")
    }

    private func isDisplaySelected(_ display: ScreenCaptureService.DisplayInfo) -> Bool {
        if selectedDisplayID == 0 {
            return display.id == displays.first?.id
        }
        return display.id == selectedDisplayID
    }

    private func selectDisplay(_ display: ScreenCaptureService.DisplayInfo) {
        let newID: UInt32 = (display.id == displays.first?.id) ? 0 : display.id
        DispatchQueue.main.async {
            selectedDisplayID = newID
            // Flash confirmation on the target screen after binding is committed
            if let screen = NSScreen.screens.first(where: {
                ($0.deviceDescription[NSDeviceDescriptionKey("NSScreenNumber")] as? CGDirectDisplayID) == display.id
            }) {
                DisplayFlashController.shared.flash(
                    displayName: display.name,
                    isBuiltin: display.isBuiltin,
                    on: screen
                )
            }
        }
    }
}

// MARK: - Display Menu Option Button

struct DisplayMenuOptionButton: View {
    let display: ScreenCaptureService.DisplayInfo
    let isSelected: Bool
    let onSelect: () -> Void

    @State private var isHovered = false

    var body: some View {
        Button(action: onSelect) {
            HStack(spacing: QMDesign.Spacing.sm) {
                Image(systemName: display.icon)
                    .font(.system(size: 12))
                    .foregroundColor(isSelected ? .white : QMDesign.Colors.textSecondary)
                    .frame(width: 24, height: 24)
                    .background(
                        Circle()
                            .fill(isSelected ? QMDesign.Colors.success : QMDesign.Colors.surfaceMedium)
                    )

                VStack(alignment: .leading, spacing: 1) {
                    Text(display.name)
                        .font(QMDesign.Typography.bodySmall)
                        .foregroundColor(isSelected ? QMDesign.Colors.textPrimary : QMDesign.Colors.textSecondary)
                        .lineLimit(1)
                    Text(display.resolution)
                        .font(QMDesign.Typography.captionSmall)
                        .foregroundColor(QMDesign.Colors.textTertiary)
                }

                Spacer()

                if isSelected {
                    Image(systemName: "checkmark")
                        .font(.system(size: 10, weight: .bold))
                        .foregroundColor(QMDesign.Colors.success)
                }
            }
            .padding(.horizontal, QMDesign.Spacing.sm)
            .padding(.vertical, QMDesign.Spacing.xs)
            .background(
                RoundedRectangle(cornerRadius: QMDesign.Radius.sm)
                    .fill(isSelected ? QMDesign.Colors.success.opacity(0.15) : (isHovered ? QMDesign.Colors.surfaceHover : Color.clear))
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
            selectedDisplayID: .constant(0),
            onCopyResponse: {},
            onClearContext: {},
            onMovePosition: { _ in }
        )
    }
}
