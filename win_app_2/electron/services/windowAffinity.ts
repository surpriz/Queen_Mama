import type { BrowserWindow } from 'electron'

/**
 * Sets window display affinity to exclude from screen capture.
 * On Windows: Uses SetWindowDisplayAffinity(WDA_EXCLUDEFROMCAPTURE)
 * On macOS: Uses NSWindow sharingType = .none (handled at window level)
 *
 * This makes the overlay invisible to screen recording/sharing apps
 * (Zoom, Teams, OBS, etc.)
 */
export function setWindowExcludeFromCapture(window: BrowserWindow, exclude: boolean): boolean {
  try {
    if (process.platform === 'win32') {
      // Electron exposes setContentProtection which maps to WDA_EXCLUDEFROMCAPTURE
      window.setContentProtection(exclude)
      return true
    }

    if (process.platform === 'darwin') {
      // On macOS, setContentProtection maps to NSWindow.sharingType = .none
      window.setContentProtection(exclude)
      return true
    }

    // Linux: not supported
    console.warn('[WindowAffinity] Content protection not supported on this platform')
    return false
  } catch (error) {
    console.error('[WindowAffinity] Failed to set content protection:', error)
    return false
  }
}
