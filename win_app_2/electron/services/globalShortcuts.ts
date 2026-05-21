import { globalShortcut } from 'electron'
import { IPC_CHANNELS } from '../ipc/channels'
import { toggleOverlay } from '../windows/overlayWindow'
import { safeSendToAllWindows, safeSendToOverlayWindows, safeSendToMainWindow } from '../utils/ipcUtils'

function registerShortcut(accelerator: string, label: string, handler: () => void): void {
  const success = globalShortcut.register(accelerator, () => {
    console.log(`[Shortcuts] ${label} triggered (${accelerator})`)
    handler()
  })
  if (success) {
    console.log(`[Shortcuts] ✓ Registered: ${label} (${accelerator})`)
  } else {
    console.warn(`[Shortcuts] ✗ FAILED to register: ${label} (${accelerator}) - may be in use by another app`)
  }
}

export function registerGlobalShortcuts(): void {
  console.log('[Shortcuts] Registering global shortcuts...')

  // Ctrl+Shift+S: Start/Stop Session — route to main window so the session
  // lifecycle (audio capture, transcription, AI) always runs in the dashboard
  // renderer. The overlay listens to broadcasts to stay in sync.
  registerShortcut('Ctrl+Shift+S', 'Toggle Session', () => {
    const ok = safeSendToMainWindow(IPC_CHANNELS.SESSION_TOGGLE)
    console.log(`[Shortcuts] SESSION_TOGGLE sent to main window: ${ok}`)
  })

  // Ctrl+Shift+H: Toggle Widget Visibility (cross-platform safe)
  registerShortcut('Ctrl+Shift+H', 'Toggle Widget', () => {
    toggleOverlay()
    const count = safeSendToOverlayWindows(IPC_CHANNELS.SHORTCUT_TOGGLE_WIDGET)
    console.log(`[Shortcuts] TOGGLE_WIDGET sent to ${count} overlay window(s)`)
  })

  // Ctrl+Enter: Trigger AI Assist (overlay only - prevents duplicate responses)
  registerShortcut('Ctrl+Return', 'Trigger Assist', () => {
    const count = safeSendToOverlayWindows(IPC_CHANNELS.SHORTCUT_TRIGGER_ASSIST)
    console.log(`[Shortcuts] TRIGGER_ASSIST sent to ${count} overlay window(s)`)
  })

  // Ctrl+Shift+R: Clear Context (overlay only)
  registerShortcut('Ctrl+Shift+R', 'Clear Context', () => {
    const count = safeSendToOverlayWindows(IPC_CHANNELS.SHORTCUT_CLEAR_CONTEXT)
    console.log(`[Shortcuts] CLEAR_CONTEXT sent to ${count} overlay window(s)`)
  })

  // Ctrl+Arrows: Move Widget (overlay only)
  registerShortcut('Ctrl+Up', 'Move Up', () => {
    safeSendToOverlayWindows(IPC_CHANNELS.SHORTCUT_MOVE_WIDGET, 'up')
  })
  registerShortcut('Ctrl+Down', 'Move Down', () => {
    safeSendToOverlayWindows(IPC_CHANNELS.SHORTCUT_MOVE_WIDGET, 'down')
  })
  registerShortcut('Ctrl+Left', 'Move Left', () => {
    safeSendToOverlayWindows(IPC_CHANNELS.SHORTCUT_MOVE_WIDGET, 'left')
  })
  registerShortcut('Ctrl+Right', 'Move Right', () => {
    safeSendToOverlayWindows(IPC_CHANNELS.SHORTCUT_MOVE_WIDGET, 'right')
  })

  console.log('[Shortcuts] Registration complete')
}

export function unregisterGlobalShortcuts(): void {
  globalShortcut.unregisterAll()
}
