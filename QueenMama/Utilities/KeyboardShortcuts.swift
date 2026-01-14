import AppKit
import Carbon

final class KeyboardShortcutManager {
    static let shared = KeyboardShortcutManager()

    private var eventTap: CFMachPort?
    private var runLoopSource: CFRunLoopSource?

    private init() {}

    deinit {
        unregisterGlobalShortcuts()
    }

    // MARK: - Registration

    func registerGlobalShortcuts() {
        // Note: Global keyboard shortcuts require Accessibility permissions
        // and are complex to implement properly.
        // For now, we rely on SwiftUI's built-in keyboard shortcuts
        // which work when the app has focus.

        // Future implementation could use CGEventTap for true global shortcuts
        requestAccessibilityPermission()
    }

    func unregisterGlobalShortcuts() {
        if let tap = eventTap {
            CGEvent.tapEnable(tap: tap, enable: false)
        }

        if let source = runLoopSource {
            CFRunLoopRemoveSource(CFRunLoopGetCurrent(), source, .commonModes)
        }

        eventTap = nil
        runLoopSource = nil
    }

    // MARK: - Permissions

    private func requestAccessibilityPermission() {
        let options = [kAXTrustedCheckOptionPrompt.takeRetainedValue(): true] as CFDictionary
        let trusted = AXIsProcessTrustedWithOptions(options)

        if !trusted {
            print("Accessibility permission required for global shortcuts")
        }
    }

    // MARK: - Shortcut Handling

    func handleShortcut(_ shortcut: GlobalShortcut) {
        Task { @MainActor in
            switch shortcut {
            case .toggleWidget:
                OverlayWindowController.shared.toggleVisibility()
            case .triggerAssist:
                // Trigger assist action
                NotificationCenter.default.post(name: .triggerAssist, object: nil)
            case .clearContext:
                NotificationCenter.default.post(name: .clearContext, object: nil)
            case .moveWidgetUp:
                // Move widget up
                break
            case .moveWidgetDown:
                // Move widget down
                break
            case .moveWidgetLeft:
                // Move widget left
                break
            case .moveWidgetRight:
                // Move widget right
                break
            }
        }
    }
}

// MARK: - Global Shortcuts

enum GlobalShortcut {
    case toggleWidget      // Cmd + \
    case triggerAssist     // Cmd + Enter
    case clearContext      // Cmd + R
    case moveWidgetUp      // Cmd + Up
    case moveWidgetDown    // Cmd + Down
    case moveWidgetLeft    // Cmd + Left
    case moveWidgetRight   // Cmd + Right
}

// MARK: - Notification Names

extension Notification.Name {
    static let triggerAssist = Notification.Name("com.queenmama.triggerAssist")
    static let clearContext = Notification.Name("com.queenmama.clearContext")
}

// MARK: - Key Code Helpers

struct KeyCode {
    static let backslash: UInt16 = 42
    static let returnKey: UInt16 = 36
    static let r: UInt16 = 15
    static let upArrow: UInt16 = 126
    static let downArrow: UInt16 = 125
    static let leftArrow: UInt16 = 123
    static let rightArrow: UInt16 = 124
}
