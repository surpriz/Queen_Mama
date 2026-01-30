import { globalShortcut, BrowserWindow } from 'electron'
import { IPC_CHANNELS } from '../ipc/channels'
import { getMainWindow } from '../windows/mainWindow'
import { getOverlayWindow, toggleOverlay } from '../windows/overlayWindow'

function sendToAllWindows(channel: string, ...args: unknown[]): void {
  BrowserWindow.getAllWindows().forEach((win) => {
    win.webContents.send(channel, ...args)
  })
}

export function registerGlobalShortcuts(): void {
  // Ctrl+Shift+S: Start/Stop Session
  globalShortcut.register('Ctrl+Shift+S', () => {
    sendToAllWindows(IPC_CHANNELS.SESSION_TOGGLE)
  })

  // Ctrl+\: Toggle Widget Visibility
  globalShortcut.register('Ctrl+\\', () => {
    toggleOverlay()
    sendToAllWindows(IPC_CHANNELS.SHORTCUT_TOGGLE_WIDGET)
  })

  // Ctrl+Enter: Trigger AI Assist
  globalShortcut.register('Ctrl+Return', () => {
    sendToAllWindows(IPC_CHANNELS.SHORTCUT_TRIGGER_ASSIST)
  })

  // Ctrl+R: Clear Context
  globalShortcut.register('Ctrl+Shift+R', () => {
    sendToAllWindows(IPC_CHANNELS.SHORTCUT_CLEAR_CONTEXT)
  })

  // Ctrl+Arrows: Move Widget
  globalShortcut.register('Ctrl+Up', () => {
    sendToAllWindows(IPC_CHANNELS.SHORTCUT_MOVE_WIDGET, 'up')
  })
  globalShortcut.register('Ctrl+Down', () => {
    sendToAllWindows(IPC_CHANNELS.SHORTCUT_MOVE_WIDGET, 'down')
  })
  globalShortcut.register('Ctrl+Left', () => {
    sendToAllWindows(IPC_CHANNELS.SHORTCUT_MOVE_WIDGET, 'left')
  })
  globalShortcut.register('Ctrl+Right', () => {
    sendToAllWindows(IPC_CHANNELS.SHORTCUT_MOVE_WIDGET, 'right')
  })
}

export function unregisterGlobalShortcuts(): void {
  globalShortcut.unregisterAll()
}
