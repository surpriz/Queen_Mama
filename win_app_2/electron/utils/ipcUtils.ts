import { BrowserWindow } from 'electron'

/**
 * Safely send an IPC message to a specific window.
 * Handles the case where the window is destroyed between the check and the send.
 *
 * @param win - The BrowserWindow to send to
 * @param channel - The IPC channel name
 * @param args - Arguments to send
 * @returns true if the message was sent successfully, false otherwise
 */
export function safeSendToWindow(
  win: BrowserWindow | null | undefined,
  channel: string,
  ...args: unknown[]
): boolean {
  try {
    if (win && !win.isDestroyed()) {
      win.webContents.send(channel, ...args)
      return true
    }
  } catch (error) {
    // Window was destroyed between the check and the send
    if (error instanceof Error && error.message.includes('Object has been destroyed')) {
      console.warn(`[IPC] Window destroyed, skipping message on channel: ${channel}`)
    } else {
      console.error(`[IPC] Failed to send message on channel ${channel}:`, error)
    }
  }
  return false
}

/**
 * Safely send an IPC message to all windows.
 *
 * @param channel - The IPC channel name
 * @param args - Arguments to send
 * @returns The number of windows that received the message
 */
export function safeSendToAllWindows(channel: string, ...args: unknown[]): number {
  let successCount = 0
  const windows = BrowserWindow.getAllWindows()

  for (const win of windows) {
    if (safeSendToWindow(win, channel, ...args)) {
      successCount++
    }
  }

  return successCount
}

/**
 * Safely send an IPC message to the main window (non-overlay).
 *
 * @param channel - The IPC channel name
 * @param args - Arguments to send
 * @returns true if the message was sent successfully
 */
export function safeSendToMainWindow(channel: string, ...args: unknown[]): boolean {
  const windows = BrowserWindow.getAllWindows()
  const mainWindow = windows.find((w) => !w.isAlwaysOnTop() && !w.isDestroyed())
  return safeSendToWindow(mainWindow, channel, ...args)
}

/**
 * Safely send an IPC message to all overlay windows (always-on-top).
 *
 * @param channel - The IPC channel name
 * @param args - Arguments to send
 * @returns The number of overlay windows that received the message
 */
export function safeSendToOverlayWindows(channel: string, ...args: unknown[]): number {
  let successCount = 0
  const windows = BrowserWindow.getAllWindows()

  for (const win of windows) {
    try {
      if (!win.isDestroyed() && win.isAlwaysOnTop()) {
        if (safeSendToWindow(win, channel, ...args)) {
          successCount++
        }
      }
    } catch {
      // Window might be destroyed while checking isAlwaysOnTop
    }
  }

  return successCount
}
