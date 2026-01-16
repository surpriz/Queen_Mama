import AppKit
import SwiftUI
import Combine

// MARK: - Overlay Panel

class OverlayPanel: NSPanel {
    override var canBecomeKey: Bool { true }
    override var canBecomeMain: Bool { false }

    init() {
        super.init(
            contentRect: NSRect(
                x: 0,
                y: 0,
                width: QMDesign.Dimensions.Overlay.collapsedWidth,
                height: QMDesign.Dimensions.Overlay.collapsedHeight
            ),
            styleMask: [.borderless, .nonactivatingPanel, .resizable],
            backing: .buffered,
            defer: false
        )

        configurePanel()
    }

    private func configurePanel() {
        // Floating level - stays on top
        level = .floating

        // Appearance
        isOpaque = false
        backgroundColor = .clear
        hasShadow = true

        // Resizing constraints
        minSize = NSSize(
            width: QMDesign.Dimensions.Overlay.collapsedWidth,
            height: QMDesign.Dimensions.Overlay.collapsedHeight
        )
        maxSize = NSSize(width: 800, height: 900)

        // Behavior
        collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary, .transient]
        isMovableByWindowBackground = true
        acceptsMouseMovedEvents = true

        // Undetectability - apply based on setting
        updateUndetectability(ConfigurationManager.shared.isUndetectabilityEnabled)

        // Don't show in mission control or expose
        collectionBehavior.insert(.stationary)

        // Center on screen
        if let screen = NSScreen.main {
            let screenFrame = screen.visibleFrame
            let x = screenFrame.midX - frame.width / 2
            let y = screenFrame.maxY - frame.height - 100
            setFrameOrigin(NSPoint(x: x, y: y))
        }
    }

    /// Update the sharing type based on undetectability setting
    /// - Parameter enabled: If true, widget is hidden from screen capture/sharing
    func updateUndetectability(_ enabled: Bool) {
        sharingType = enabled ? .none : .readOnly
    }

    // Allow dragging
    override func mouseDragged(with event: NSEvent) {
        let currentLocation = event.locationInWindow
        let newOrigin = NSPoint(
            x: frame.origin.x + currentLocation.x - frame.width / 2,
            y: frame.origin.y + currentLocation.y - frame.height / 2
        )
        setFrameOrigin(newOrigin)
    }
}

// MARK: - Overlay Window Controller

@MainActor
class OverlayWindowController: NSObject, ObservableObject, NSWindowDelegate {
    static let shared = OverlayWindowController()

    @Published var isExpanded = false
    @Published var isVisible = true

    private var panel: OverlayPanel?
    private var hostingView: NSHostingView<OverlayContentView>?
    private var configObserver: AnyCancellable?

    // Keys for UserDefaults
    private let widthKey = "overlayWindowWidth"
    private let heightKey = "overlayWindowHeight"

    private override init() {
        super.init()
        setupConfigObserver()
    }

    private func setupConfigObserver() {
        // Observe undetectability setting changes
        configObserver = ConfigurationManager.shared.$isUndetectabilityEnabled
            .receive(on: DispatchQueue.main)
            .sink { [weak self] enabled in
                self?.panel?.updateUndetectability(enabled)
            }
    }

    func showOverlay(appState: AppState, sessionManager: SessionManager) {
        if panel == nil {
            createPanel(appState: appState, sessionManager: sessionManager)
        }

        panel?.orderFront(nil)
        isVisible = true
    }

    func hideOverlay() {
        panel?.orderOut(nil)
        isVisible = false
    }

    func setVisible(_ visible: Bool) {
        if visible {
            panel?.orderFront(nil)
        } else {
            panel?.orderOut(nil)
        }
        isVisible = visible
    }

    func toggleVisibility() {
        setVisible(!isVisible)
    }

    func setExpanded(_ expanded: Bool) {
        isExpanded = expanded
        updatePanelSize()
    }

    func toggleExpanded() {
        setExpanded(!isExpanded)
    }

    func moveToPosition(_ position: OverlayPosition) {
        guard let panel, let screen = NSScreen.main else { return }

        let screenFrame = screen.visibleFrame
        var newOrigin: NSPoint

        switch position {
        case .topLeft:
            newOrigin = NSPoint(x: screenFrame.minX + 20, y: screenFrame.maxY - panel.frame.height - 20)
        case .topCenter:
            newOrigin = NSPoint(x: screenFrame.midX - panel.frame.width / 2, y: screenFrame.maxY - panel.frame.height - 20)
        case .topRight:
            newOrigin = NSPoint(x: screenFrame.maxX - panel.frame.width - 20, y: screenFrame.maxY - panel.frame.height - 20)
        case .bottomLeft:
            newOrigin = NSPoint(x: screenFrame.minX + 20, y: screenFrame.minY + 20)
        case .bottomCenter:
            newOrigin = NSPoint(x: screenFrame.midX - panel.frame.width / 2, y: screenFrame.minY + 20)
        case .bottomRight:
            newOrigin = NSPoint(x: screenFrame.maxX - panel.frame.width - 20, y: screenFrame.minY + 20)
        }

        panel.setFrameOrigin(newOrigin)
    }

    // MARK: - Private Methods

    private func createPanel(appState: AppState, sessionManager: SessionManager) {
        panel = OverlayPanel()
        panel?.delegate = self

        let contentView = OverlayContentView(
            appState: appState,
            sessionManager: sessionManager,
            overlayController: self
        )

        hostingView = NSHostingView(rootView: contentView)
        hostingView?.frame = panel!.contentView!.bounds
        hostingView?.autoresizingMask = [.width, .height]

        panel?.contentView = hostingView
        loadSavedSize()
        updatePanelSize()
    }

    private func updatePanelSize() {
        // Get saved dimensions or use defaults
        let savedWidth = UserDefaults.standard.double(forKey: widthKey)
        let savedHeight = UserDefaults.standard.double(forKey: heightKey)

        let width: CGFloat = savedWidth > 0 ? savedWidth : QMDesign.Dimensions.Overlay.expandedWidth
        let height: CGFloat
        if isExpanded {
            height = savedHeight > 0 ? savedHeight : QMDesign.Dimensions.Overlay.expandedHeight
        } else {
            height = QMDesign.Dimensions.Overlay.collapsedHeight
        }

        NSAnimationContext.runAnimationGroup { context in
            context.duration = 0.25
            context.timingFunction = CAMediaTimingFunction(name: .easeInEaseOut)
            panel?.animator().setContentSize(NSSize(width: width, height: height))
        }
    }

    private func loadSavedSize() {
        let savedWidth = UserDefaults.standard.double(forKey: widthKey)
        let savedHeight = UserDefaults.standard.double(forKey: heightKey)

        if savedWidth > 0 && savedHeight > 0 {
            panel?.setContentSize(NSSize(width: savedWidth, height: savedHeight))
        }
    }

    private func saveSize(_ size: NSSize) {
        // Only save if expanded (don't save collapsed size)
        if isExpanded {
            UserDefaults.standard.set(Double(size.width), forKey: widthKey)
            UserDefaults.standard.set(Double(size.height), forKey: heightKey)
        }
    }

    // MARK: - NSWindowDelegate

    nonisolated func windowDidResize(_ notification: Notification) {
        Task { @MainActor in
            guard let window = notification.object as? NSWindow else { return }
            saveSize(window.frame.size)
        }
    }
}

// Note: OverlayPosition enum is defined in OverlayPopupMenu.swift
