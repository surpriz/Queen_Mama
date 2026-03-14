import { BrowserWindow, screen } from 'electron'

let flashWindow: BrowserWindow | null = null
let dismissTimer: ReturnType<typeof setTimeout> | null = null
let fadeInterval: ReturnType<typeof setInterval> | null = null

const FLASH_WIDTH = 240
const FLASH_HEIGHT = 48
const FLASH_DURATION = 1000 // 1 second
const FADE_STEPS = 6
const FADE_INTERVAL = 50 // 300ms total fade

/**
 * Show a 1-second HUD flash on the target display to confirm selection.
 * Matches macOS DisplayFlashController behavior.
 */
export function flashDisplay(displayId: string, displayName: string, sourceId?: string): void {
  // Dismiss any existing flash
  dismissFlash()

  // Find the target display
  const displays = screen.getAllDisplays()
  let target = displays.find((d) => d.id.toString() === displayId)

  // Fallback: match by source id index (e.g. "screen:0:0" → index 0)
  if (!target && sourceId) {
    const match = sourceId.match(/^screen:(\d+):/)
    if (match) {
      const idx = parseInt(match[1], 10)
      if (idx >= 0 && idx < displays.length) {
        target = displays[idx]
      }
    }
  }

  // Last resort: use primary display
  if (!target) {
    target = screen.getPrimaryDisplay()
    console.warn('[DisplayFlash] Display not found by ID, using primary:', displayId)
  }

  // Position at top-center of the target display
  const x = Math.round(target.bounds.x + (target.bounds.width - FLASH_WIDTH) / 2)
  const y = target.bounds.y + 20

  flashWindow = new BrowserWindow({
    width: FLASH_WIDTH,
    height: FLASH_HEIGHT,
    x,
    y,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    focusable: false,
    hasShadow: true,
    backgroundColor: '#00000000',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
    show: false,
  })

  flashWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })

  // Escape the display name for HTML
  const safeName = displayName.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;')

  const html = `<!DOCTYPE html>
<html><head><style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    background: transparent;
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100vh;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
    -webkit-app-region: no-drag;
    user-select: none;
  }
  .flash {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 20px;
    background: rgba(20, 20, 30, 0.92);
    border: 1px solid rgba(52, 211, 153, 0.35);
    border-radius: 12px;
    backdrop-filter: blur(12px);
    box-shadow: 0 4px 24px rgba(0,0,0,0.4);
  }
  .icon {
    width: 18px;
    height: 18px;
    color: #34d399;
  }
  .name {
    font-size: 13px;
    font-weight: 600;
    color: #e2e8f0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 180px;
  }
</style></head><body>
<div class="flash">
  <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>
  </svg>
  <span class="name">${safeName}</span>
</div>
</body></html>`

  flashWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)

  flashWindow.once('ready-to-show', () => {
    if (flashWindow && !flashWindow.isDestroyed()) {
      flashWindow.showInactive()
    }
  })

  flashWindow.on('closed', () => {
    flashWindow = null
  })

  // Dismiss after FLASH_DURATION with fade
  dismissTimer = setTimeout(() => fadeAndClose(), FLASH_DURATION)
}

function fadeAndClose(): void {
  if (!flashWindow || flashWindow.isDestroyed()) return

  let step = 0
  fadeInterval = setInterval(() => {
    step++
    if (!flashWindow || flashWindow.isDestroyed()) {
      if (fadeInterval) { clearInterval(fadeInterval); fadeInterval = null }
      return
    }
    const opacity = 1 - step / FADE_STEPS
    flashWindow.setOpacity(Math.max(0, opacity))
    if (step >= FADE_STEPS) {
      if (fadeInterval) { clearInterval(fadeInterval); fadeInterval = null }
      if (flashWindow && !flashWindow.isDestroyed()) {
        flashWindow.close()
      }
      flashWindow = null
    }
  }, FADE_INTERVAL)
}

function dismissFlash(): void {
  if (dismissTimer) {
    clearTimeout(dismissTimer)
    dismissTimer = null
  }
  if (fadeInterval) {
    clearInterval(fadeInterval)
    fadeInterval = null
  }
  if (flashWindow && !flashWindow.isDestroyed()) {
    flashWindow.close()
  }
  flashWindow = null
}
