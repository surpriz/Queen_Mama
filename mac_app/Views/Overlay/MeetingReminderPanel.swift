import AppKit
import SwiftUI

// MARK: - Meeting Reminder Panel

class MeetingReminderPanel: NSPanel {
    override var canBecomeKey: Bool { true }
    override var canBecomeMain: Bool { false }

    init(size: NSSize) {
        super.init(
            contentRect: NSRect(origin: .zero, size: size),
            styleMask: [.borderless, .nonactivatingPanel],
            backing: .buffered,
            defer: false
        )

        // Match OverlayPanel configuration exactly
        level = .floating
        isOpaque = false
        backgroundColor = .clear
        hasShadow = true
        collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary, .transient]
        isMovableByWindowBackground = false
        hidesOnDeactivate = false

        // Position top-right
        if let screen = NSScreen.main {
            let screenFrame = screen.visibleFrame
            let x = screenFrame.maxX - size.width - 20
            let y = screenFrame.maxY - size.height - 20
            setFrameOrigin(NSPoint(x: x, y: y))
        }
    }
}

// MARK: - Meeting Reminder Controller

@MainActor
final class MeetingReminderController {
    static let shared = MeetingReminderController()

    private var panel: MeetingReminderPanel?
    private var dismissTimer: Timer?

    func showReminder(appName: String, onStartSession: @escaping () -> Void, onDismiss: @escaping () -> Void) {
        // Dismiss any existing reminder first
        dismissSilently()

        let panelSize = NSSize(width: 320, height: 80)
        let reminderPanel = MeetingReminderPanel(size: panelSize)

        let view = MeetingReminderView(
            appName: appName,
            onStartSession: { [weak self] in
                self?.dismiss()
                onStartSession()
            },
            onDismiss: { [weak self] in
                self?.dismiss()
                onDismiss()
            }
        )

        // Set up hosting view using same pattern as OverlayWindow
        let hostingView = NSHostingView(rootView: view)
        hostingView.frame = reminderPanel.contentView!.bounds
        hostingView.autoresizingMask = [.width, .height]
        reminderPanel.contentView = hostingView

        // Show panel
        reminderPanel.alphaValue = 1
        reminderPanel.orderFrontRegardless()

        self.panel = reminderPanel

        // Auto-dismiss after 15 seconds
        dismissTimer = Timer.scheduledTimer(withTimeInterval: 15, repeats: false) { [weak self] _ in
            Task { @MainActor [weak self] in
                self?.dismiss()
                onDismiss()
            }
        }

        print("[MeetingReminder] Showing reminder for \(appName) at frame: \(reminderPanel.frame)")
    }

    func dismiss() {
        dismissTimer?.invalidate()
        dismissTimer = nil

        guard let panel else { return }

        print("[MeetingReminder] Dismissing panel")
        NSAnimationContext.runAnimationGroup({ context in
            context.duration = 0.25
            context.timingFunction = CAMediaTimingFunction(name: .easeIn)
            panel.animator().alphaValue = 0
        }, completionHandler: {
            Task { @MainActor [weak self] in
                self?.panel?.orderOut(nil)
                self?.panel = nil
            }
        })
    }

    private func dismissSilently() {
        dismissTimer?.invalidate()
        dismissTimer = nil
        panel?.orderOut(nil)
        panel = nil
    }
}

// MARK: - Meeting Reminder SwiftUI View

struct MeetingReminderView: View {
    let appName: String
    let onStartSession: () -> Void
    let onDismiss: () -> Void

    @State private var isHoveringStart = false
    @State private var isHoveringDismiss = false

    private var appIcon: String {
        switch appName {
        case "Zoom": return "video.fill"
        case "Microsoft Teams": return "bubble.left.and.bubble.right.fill"
        case "Google Meet": return "globe"
        case "Slack": return "number"
        case "WebEx": return "video.badge.ellipsis"
        case "FaceTime": return "phone.fill"
        case "Discord": return "headphones"
        default: return "video.fill"
        }
    }

    var body: some View {
        HStack(spacing: 10) {
            // App icon
            ZStack {
                RoundedRectangle(cornerRadius: 8)
                    .fill(QMDesign.Colors.accent.opacity(0.15))
                    .frame(width: 40, height: 40)
                Image(systemName: appIcon)
                    .font(.system(size: 18, weight: .semibold))
                    .foregroundStyle(QMDesign.Colors.primaryGradient)
            }

            // Message
            VStack(alignment: .leading, spacing: 2) {
                Text(String(localized: "overlay.reminder.appDetected \(appName)"))
                    .font(QMDesign.Typography.bodySmall)
                    .fontWeight(.semibold)
                    .foregroundColor(QMDesign.Colors.textPrimary)
                Text(String(localized: "overlay.reminder.startSession"))
                    .font(QMDesign.Typography.captionSmall)
                    .foregroundColor(QMDesign.Colors.textSecondary)
            }

            Spacer(minLength: 4)

            // Start Session button
            Button(action: onStartSession) {
                Text(String(localized: "overlay.reminder.start"))
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundColor(.white)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 6)
                    .background(
                        RoundedRectangle(cornerRadius: 6)
                            .fill(QMDesign.Colors.primaryGradient)
                            .opacity(isHoveringStart ? 0.85 : 1)
                    )
            }
            .buttonStyle(.plain)
            .onHover { isHoveringStart = $0 }

            // Dismiss X
            Button(action: onDismiss) {
                Image(systemName: "xmark")
                    .font(.system(size: 10, weight: .semibold))
                    .foregroundColor(isHoveringDismiss ? QMDesign.Colors.textPrimary : QMDesign.Colors.textTertiary)
                    .frame(width: 22, height: 22)
                    .background(
                        Circle()
                            .fill(isHoveringDismiss ? QMDesign.Colors.surfaceHover : Color.clear)
                    )
            }
            .buttonStyle(.plain)
            .onHover { isHoveringDismiss = $0 }
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 12)
        .frame(maxWidth: .infinity)
        .background(
            ZStack {
                VisualEffectView(material: .hudWindow, blendingMode: .behindWindow)
                QMDesign.Colors.surfaceMedium.opacity(0.6)
            }
        )
        .clipShape(RoundedRectangle(cornerRadius: 12))
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .stroke(QMDesign.Colors.borderSubtle, lineWidth: 1)
        )
    }
}

// Note: VisualEffectView is defined in OverlayContentView.swift
