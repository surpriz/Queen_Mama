//
//  ScreenCaptureSettingsView.swift
//  QueenMama
//
//  Advanced › Screen Capture: interval and display. The on/off switch is in Essentials.
//

import SwiftUI

struct ModernScreenCaptureSettingsView: View {
    @StateObject private var config = ConfigurationManager.shared

    var body: some View {
        VStack(spacing: QMDesign.Spacing.lg) {
            SettingsSectionHeader(
                title: String(localized: "settings.screenCapture.title"),
                subtitle: String(localized: "settings.screenCapture.subtitle")
            )

            SettingsCard(title: String(localized: "settings.general.screenCapture"), icon: "camera.fill") {
                VStack(spacing: QMDesign.Spacing.md) {
                    if !config.autoScreenCapture {
                        Text(String(localized: "settings.screenCapture.disabledHint"))
                            .font(QMDesign.Typography.caption)
                            .foregroundColor(QMDesign.Colors.textTertiary)
                            .frame(maxWidth: .infinity, alignment: .leading)
                    }

                    if config.autoScreenCapture {
                        HStack {
                            Text(String(localized: "settings.general.captureInterval"))
                                .font(QMDesign.Typography.bodySmall)
                                .foregroundColor(QMDesign.Colors.textSecondary)

                            Spacer()

                            HStack(spacing: QMDesign.Spacing.sm) {
                                Button(action: { config.screenCaptureIntervalSeconds = max(1, config.screenCaptureIntervalSeconds - 1) }) {
                                    Image(systemName: "minus")
                                        .frame(width: 28, height: 28)
                                        .background(QMDesign.Colors.surfaceMedium)
                                        .clipShape(Circle())
                                }
                                .buttonStyle(.plain)

                                Text("\(Int(config.screenCaptureIntervalSeconds))s")
                                    .font(QMDesign.Typography.bodyMedium)
                                    .foregroundColor(QMDesign.Colors.textPrimary)
                                    .frame(minWidth: 40)

                                Button(action: { config.screenCaptureIntervalSeconds = min(30, config.screenCaptureIntervalSeconds + 1) }) {
                                    Image(systemName: "plus")
                                        .frame(width: 28, height: 28)
                                        .background(QMDesign.Colors.surfaceMedium)
                                        .clipShape(Circle())
                                }
                                .buttonStyle(.plain)
                            }
                        }
                        .padding(QMDesign.Spacing.sm)
                        .background(
                            RoundedRectangle(cornerRadius: QMDesign.Radius.md)
                                .fill(QMDesign.Colors.backgroundSecondary)
                        )
                    }

                    Divider()
                        .background(QMDesign.Colors.borderSubtle)

                    // Display Selection
                    DisplaySelectorRow()
                }
            }
        }
    }
}

// MARK: - Display Selector Row

struct DisplaySelectorRow: View {
    @StateObject private var config = ConfigurationManager.shared
    @State private var displays: [ScreenCaptureService.DisplayInfo] = []
    @State private var isLoading = true

    var body: some View {
        VStack(alignment: .leading, spacing: QMDesign.Spacing.sm) {
            HStack(spacing: QMDesign.Spacing.sm) {
                Image(systemName: "display")
                    .font(.system(size: 14))
                    .foregroundColor(QMDesign.Colors.textSecondary)
                    .frame(width: 24)

                VStack(alignment: .leading, spacing: 2) {
                    Text(String(localized: "settings.general.captureDisplay"))
                        .font(QMDesign.Typography.bodySmall)
                        .foregroundColor(QMDesign.Colors.textPrimary)
                    Text(String(localized: "settings.general.captureDisplay.description"))
                        .font(QMDesign.Typography.captionSmall)
                        .foregroundColor(QMDesign.Colors.textTertiary)
                }

                Spacer()
            }

            if isLoading {
                HStack(spacing: QMDesign.Spacing.xs) {
                    ProgressView()
                        .scaleEffect(0.7)
                    Text(String(localized: "settings.general.detectingDisplays"))
                        .font(QMDesign.Typography.caption)
                        .foregroundColor(QMDesign.Colors.textTertiary)
                }
                .padding(QMDesign.Spacing.sm)
            } else if displays.isEmpty {
                HStack(spacing: QMDesign.Spacing.xs) {
                    Image(systemName: "exclamationmark.triangle")
                        .foregroundColor(QMDesign.Colors.warning)
                    Text(String(localized: "settings.general.noDisplaysAvailable"))
                        .font(QMDesign.Typography.caption)
                        .foregroundColor(QMDesign.Colors.warning)
                }
                .padding(QMDesign.Spacing.sm)
            } else {
                VStack(spacing: QMDesign.Spacing.xs) {
                    ForEach(displays) { display in
                        DisplayOptionRow(
                            display: display,
                            isSelected: isDisplaySelected(display),
                            onSelect: { selectDisplay(display) }
                        )
                    }
                }
            }
        }
        .task {
            await loadDisplays()
        }
    }

    private func loadDisplays() async {
        let screenService = ScreenCaptureService()
        displays = await screenService.getAvailableDisplays()
        isLoading = false
    }

    private func isDisplaySelected(_ display: ScreenCaptureService.DisplayInfo) -> Bool {
        if config.selectedDisplayID == 0 {
            // Primary display (first one) is selected
            return display.id == displays.first?.id
        }
        return display.id == config.selectedDisplayID
    }

    private func selectDisplay(_ display: ScreenCaptureService.DisplayInfo) {
        // Store 0 for primary display, otherwise store the ID
        if display.id == displays.first?.id {
            config.selectedDisplayID = 0
        } else {
            config.selectedDisplayID = display.id
        }
    }
}

// MARK: - Display Option Row

struct DisplayOptionRow: View {
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
                    .frame(width: 28, height: 28)
                    .background(
                        RoundedRectangle(cornerRadius: QMDesign.Radius.sm)
                            .fill(isSelected ? QMDesign.Colors.accent : QMDesign.Colors.surfaceMedium)
                    )

                VStack(alignment: .leading, spacing: 2) {
                    Text(display.name)
                        .font(QMDesign.Typography.bodySmall)
                        .foregroundColor(isSelected ? QMDesign.Colors.textPrimary : QMDesign.Colors.textSecondary)

                    Text(display.resolution)
                        .font(QMDesign.Typography.captionSmall)
                        .foregroundColor(QMDesign.Colors.textTertiary)
                }

                Spacer()

                if isSelected {
                    Image(systemName: "checkmark.circle.fill")
                        .font(.system(size: 16))
                        .foregroundColor(QMDesign.Colors.accent)
                }
            }
            .padding(QMDesign.Spacing.sm)
            .background(
                RoundedRectangle(cornerRadius: QMDesign.Radius.md)
                    .fill(isSelected ? QMDesign.Colors.accent.opacity(0.1) : (isHovered ? QMDesign.Colors.surfaceHover : QMDesign.Colors.backgroundSecondary))
            )
            .overlay(
                RoundedRectangle(cornerRadius: QMDesign.Radius.md)
                    .stroke(isSelected ? QMDesign.Colors.accent.opacity(0.3) : Color.clear, lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
        .onHover { isHovered = $0 }
    }
}
