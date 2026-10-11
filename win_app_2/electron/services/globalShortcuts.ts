import { globalShortcut } from 'electron'
import { IPC_CHANNELS } from '../ipc/channels'
import { toggleOverlay } from '../windows/overlayWindow'
import { sendToSessionWindow } from './relayHub'

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

/**
 * Global shortcuts. Session-level actions are routed to the hidden session
 * window (single owner of the pipeline); the widget toggle is handled here in
 * main so there is exactly one source of truth for overlay visibility.
 */
export function registerGlobalShortcuts(): void {
  console.log('[Shortcuts] Registering global shortcuts...')

  registerShortcut('Ctrl+Shift+S', 'Toggle Session', () => {
    const ok = sendToSessionWindow(IPC_CHANNELS.SESSION_TOGGLE)
    console.log(`[Shortcuts] SESSION_TOGGLE sent to session window: ${ok}`)
  })

  registerShortcut('Ctrl+Shift+H', 'Toggle Widget', () => {
    toggleOverlay()
  })

  registerShortcut('Ctrl+Return', 'Trigger Assist', () => {
    const ok = sendToSessionWindow(IPC_CHANNELS.SHORTCUT_TRIGGER_ASSIST)
    console.log(`[Shortcuts] TRIGGER_ASSIST sent to session window: ${ok}`)
  })

  registerShortcut('Ctrl+Shift+R', 'Clear Context', () => {
    const ok = sendToSessionWindow(IPC_CHANNELS.SHORTCUT_CLEAR_CONTEXT)
    console.log(`[Shortcuts] CLEAR_CONTEXT sent to session window: ${ok}`)
  })

  // Ctrl+Arrow widget-move shortcuts were removed: they were registered
  // globally (stealing word navigation in every other app) and nothing
  // listened for them.

  console.log('[Shortcuts] Registration complete')
}

export function unregisterGlobalShortcuts(): void {
  globalShortcut.unregisterAll()
}
