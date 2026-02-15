//
//  OverlayPopupMenu.swift
//  QueenMamaIOS
//
//  iOS adaptation of contextual popup menu for overlay settings.
//  Removed: ScreenCaptureKit, DisplayMenuItem, PositionMenuItem, OverlayPosition
//  (no screen capture or widget positioning on iOS)
//

import SwiftUI

// MARK: - Overlay Popup Menu

struct OverlayPopupMenu: View {
    @Binding var isAutoAnswerEnabled: Bool
    @Binding var isSmartModeEnabled: Bool
    @Binding var selectedMode: Mode?
    @Binding var isVisible: Bool

    let onClearContext: () -> Void

    @State private var showModeSubmenu = false
    @State private var hoveredItem: String?

    var body: some View {
        VStack(spacing: 0) {
            // Mode Selector (at the top for prominence)
            ModeMenuItem(
                selectedMode: $selectedMode,
                isExpanded: $showModeSubmenu,
                onSelect: { mode in
                    selectedMode = mode
                    showModeSubmenu = false
                }
            )

            MenuDivider()

            // Toggle Items
            MenuToggleItem(
                title: "Auto-Answer",
                icon: QMDesign.Icons.autoAnswer,
                isEnabled: $isAutoAnswerEnabled,
                accentColor: QMDesign.Colors.autoAnswer,
                subtitle: "AI responds to key moments automatically"
            )

            MenuToggleItem(
                title: "Smart Mode",
                icon: QMDesign.Icons.smart,
                isEnabled: $isSmartModeEnabled,
                accentColor: QMDesign.Colors.accent,
                subtitle: "Deep thinking - Slower responses"
            )

            MenuDivider()

            // Action Items
            MenuActionItem(
                title: "Clear Context",
                icon: QMDesign.Icons.clear,
                isDestructive: false
            ) {
                onClearContext()
                isVisible = false
            }
        }
        .padding(QMDesign.Spacing.xs)
        .frame(width: 260)
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
    }
}

// MARK: - Mode Menu Item

struct ModeMenuItem: View {
    @Binding var selectedMode: Mode?
    @Binding var isExpanded: Bool
    let onSelect: (Mode) -> Void

    private let builtInModes: [Mode] = [.defaultMode, .professionalMode, .interviewMode, .salesMode, .developerExamMode]

    var body: some View {
        VStack(spacing: 0) {
            // Main row showing current mode
            Button(action: { withAnimation(QMDesign.Animation.quick) { isExpanded.toggle() } }) {
                HStack(spacing: QMDesign.Spacing.sm) {
                    Image(systemName: QMDesign.Icons.modes)
                        .font(.system(size: 13))
                        .foregroundStyle(QMDesign.Colors.primaryGradient)
                        .frame(width: 20)

                    VStack(alignment: .leading, spacing: 1) {
                        Text("Mode")
                            .font(QMDesign.Typography.captionSmall)
                            .foregroundColor(QMDesign.Colors.textTertiary)
                        Text(selectedMode?.name ?? "Default")
                            .font(QMDesign.Typography.bodySmall)
                            .foregroundColor(QMDesign.Colors.textPrimary)
                    }

                    Spacer()

                    Image(systemName: isExpanded ? "chevron.up" : "chevron.down")
                        .font(.system(size: 10, weight: .semibold))
                        .foregroundColor(QMDesign.Colors.textTertiary)
                }
                .padding(.horizontal, QMDesign.Spacing.sm)
                .padding(.vertical, QMDesign.Spacing.xs)
            }
            .buttonStyle(.plain)

            // Submenu with mode options
            if isExpanded {
                VStack(spacing: 2) {
                    ForEach(builtInModes, id: \.name) { mode in
                        ModeOptionButton(
                            mode: mode,
                            isSelected: selectedMode?.name == mode.name,
                            onSelect: { onSelect(mode) }
                        )
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

// MARK: - Mode Option Button

struct ModeOptionButton: View {
    let mode: Mode
    let isSelected: Bool
    let onSelect: () -> Void

    var body: some View {
        Button(action: onSelect) {
            HStack(spacing: QMDesign.Spacing.sm) {
                Image(systemName: iconForMode(mode.name))
                    .font(.system(size: 12))
                    .foregroundColor(isSelected ? .white : QMDesign.Colors.textSecondary)
                    .frame(width: 24, height: 24)
                    .background(
                        Circle()
                            .fill(isSelected ? QMDesign.Colors.success : QMDesign.Colors.surfaceMedium)
                    )

                Text(mode.name)
                    .font(QMDesign.Typography.bodySmall)
                    .foregroundColor(isSelected ? QMDesign.Colors.textPrimary : QMDesign.Colors.textSecondary)

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
                    .fill(isSelected ? QMDesign.Colors.success.opacity(0.15) : Color.clear)
            )
        }
        .buttonStyle(.plain)
    }

    private func iconForMode(_ name: String) -> String {
        switch name.lowercased() {
        case "default": return "sparkles"
        case "professional": return "briefcase"
        case "interview": return "person.fill.questionmark"
        case "sales": return "chart.line.uptrend.xyaxis"
        case "developer exam": return "chevron.left.forwardslash.chevron.right"
        default: return "person.crop.circle"
        }
    }
}

// MARK: - Menu Toggle Item

struct MenuToggleItem: View {
    let title: String
    let icon: String
    @Binding var isEnabled: Bool
    let accentColor: Color
    var subtitle: String? = nil

    var body: some View {
        Button(action: { isEnabled.toggle() }) {
            HStack(spacing: QMDesign.Spacing.sm) {
                Image(systemName: icon)
                    .font(.system(size: 13))
                    .foregroundColor(isEnabled ? accentColor : QMDesign.Colors.textSecondary)
                    .frame(width: 20)

                VStack(alignment: .leading, spacing: 1) {
                    Text(title)
                        .font(QMDesign.Typography.bodySmall)
                        .foregroundColor(QMDesign.Colors.textPrimary)

                    if let subtitle = subtitle {
                        Text(subtitle)
                            .font(QMDesign.Typography.captionSmall)
                            .foregroundColor(QMDesign.Colors.textTertiary)
                    }
                }

                Spacer()

                // Toggle
                Toggle("", isOn: $isEnabled)
                    .labelsHidden()
                    .tint(accentColor)
            }
            .padding(.horizontal, QMDesign.Spacing.sm)
            .padding(.vertical, QMDesign.Spacing.xs)
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Menu Action Item

struct MenuActionItem: View {
    let title: String
    let icon: String
    var isDestructive: Bool = false
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: QMDesign.Spacing.sm) {
                Image(systemName: icon)
                    .font(.system(size: 13))
                    .foregroundColor(isDestructive ? QMDesign.Colors.error : QMDesign.Colors.textSecondary)
                    .frame(width: 20)

                Text(title)
                    .font(QMDesign.Typography.bodySmall)
                    .foregroundColor(isDestructive ? QMDesign.Colors.error : QMDesign.Colors.textPrimary)

                Spacer()
            }
            .padding(.horizontal, QMDesign.Spacing.sm)
            .padding(.vertical, QMDesign.Spacing.xs)
        }
        .buttonStyle(.plain)
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
