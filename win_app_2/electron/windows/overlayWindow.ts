import { BrowserWindow, screen, app } from 'electron'
import { join } from 'path'
import Store from 'electron-store'

const store = new Store()

let overlayWindow: BrowserWindow | null = null
let currentPosition: OverlayPosition = 'topRight'

export type OverlayPosition =
  | 'topLeft'
  | 'topCenter'
  | 'topRight'
  | 'bottomLeft'
  | 'bottomCenter'
  | 'bottomRight'

const OVERLAY_COLLAPSED = { width: 380, height: 52 }
const OVERLAY_EXPANDED = { width: 420, height: 480 }
const OVERLAY_MIN = { width: 320, height: 300 }
const OVERLAY_MAX = { width: 800, height: 900 }
const MARGIN = 20

export function createOverlayWindow(): BrowserWindow {
  overlayWindow = new BrowserWindow({
    width: OVERLAY_COLLAPSED.width,
    height: OVERLAY_COLLAPSED.height,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    hasShadow: false,
    focusable: true,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false,
    },
    show: true,
  })

  overlayWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })

  // Force highest always-on-top level so the overlay stays above browsers, PDF viewers,
  // and other apps that also use floating windows. Default `floating` level is not
  // sufficient on Windows — `screen-saver` keeps it above virtually everything.
  overlayWindow.setAlwaysOnTop(true, 'screen-saver')

  // Hide overlay from screen capture (equivalent to macOS NSPanel.sharingType = .none).
  // Apply the user's configured value at creation to avoid a race where the window is
  // briefly capturable before the renderer's config-load IPC arrives. Dev builds skip
  // protection so designers/devs can screenshot the overlay while iterating.
  if (app.isPackaged) {
    const undetectable = store.get('config.isUndetectabilityEnabled') === true
    overlayWindow.setContentProtection(undetectable)
  }

  // Save size when user resizes (only when expanded)
  overlayWindow.on('resize', () => {
    if (!overlayWindow || overlayWindow.isDestroyed()) return
    const [w, h] = overlayWindow.getSize()
    // Only save if larger than collapsed (i.e. expanded state)
    if (h > OVERLAY_COLLAPSED.height + 10) {
      store.set('overlay.width', w)
      store.set('overlay.height', h)
    }
  })

  // Clean up reference when window is closed
  overlayWindow.on('closed', () => {
    overlayWindow = null
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
    overlayWindow.loadURL(`${process.env['ELECTRON_RENDERER_URL']}#/overlay`)
  } else {
    overlayWindow.loadFile(join(__dirname, '../renderer/index.html'), {
      hash: '/overlay',
    })
  }

  // Position at top right by default
  setOverlayPosition('topRight')

  return overlayWindow
}

export function getOverlayWindow(): BrowserWindow | null {
  if (overlayWindow && overlayWindow.isDestroyed()) {
    overlayWindow = null
  }
  return overlayWindow
}

export function showOverlay(): void {
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.show()
  }
}

export function hideOverlay(): void {
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.hide()
  }
}

export function toggleOverlay(): void {
  if (!overlayWindow || overlayWindow.isDestroyed()) return
  if (overlayWindow.isVisible()) {
    hideOverlay()
  } else {
    showOverlay()
  }
}

export function setOverlayExpanded(expanded: boolean): void {
  if (!overlayWindow || overlayWindow.isDestroyed()) return

  const currentBounds = overlayWindow.getBounds()
  let size: { width: number; height: number }

  if (expanded) {
    // Restore saved size or use default expanded size
    const savedW = store.get('overlay.width') as number | undefined
    const savedH = store.get('overlay.height') as number | undefined
    size = {
      width: savedW && savedW >= OVERLAY_MIN.width ? savedW : OVERLAY_EXPANDED.width,
      height: savedH && savedH >= OVERLAY_MIN.height ? savedH : OVERLAY_EXPANDED.height,
    }
    // Enable resizing when expanded
    overlayWindow.setResizable(true)
    overlayWindow.setMinimumSize(OVERLAY_MIN.width, OVERLAY_MIN.height)
    overlayWindow.setMaximumSize(OVERLAY_MAX.width, OVERLAY_MAX.height)
  } else {
    size = OVERLAY_COLLAPSED
    // Reset minimum size before collapsing, then disable resizing
    overlayWindow.setMinimumSize(OVERLAY_COLLAPSED.width, OVERLAY_COLLAPSED.height)
    overlayWindow.setResizable(false)
  }

  // Anchor based on current position: top positions expand down, bottom positions expand up
  const isTop = currentPosition.startsWith('top')
  const isLeft = currentPosition.includes('Left')
  const isCenter = currentPosition.includes('Center')

  let newX: number
  let newY: number

  if (isLeft) {
    newX = currentBounds.x
  } else if (isCenter) {
    newX = currentBounds.x + Math.round((currentBounds.width - size.width) / 2)
  } else {
    // right: anchor right edge
    newX = currentBounds.x + currentBounds.width - size.width
  }

  if (isTop) {
    // Anchor top edge, expand downward
    newY = currentBounds.y
  } else {
    // Anchor bottom edge, expand upward
    newY = currentBounds.y + currentBounds.height - size.height
  }

  const display = screen.getPrimaryDisplay()
  const { width: screenW, height: screenH } = display.workAreaSize

  overlayWindow.setBounds({
    x: Math.max(0, Math.min(newX, screenW - size.width)),
    y: Math.max(0, Math.min(newY, screenH - size.height)),
    width: size.width,
    height: size.height,
  })
}

export function setOverlaySize(width: number, height: number): void {
  if (!overlayWindow || overlayWindow.isDestroyed()) return
  const w = Math.max(OVERLAY_MIN.width, Math.min(OVERLAY_MAX.width, width))
  const h = Math.max(OVERLAY_MIN.height, Math.min(OVERLAY_MAX.height, height))
  overlayWindow.setSize(w, h)
  // Persist
  store.set('overlay.width', w)
  store.set('overlay.height', h)
}

export function setOverlayPosition(position: OverlayPosition): void {
  if (!overlayWindow || overlayWindow.isDestroyed()) return

  currentPosition = position

  const display = screen.getPrimaryDisplay()
  const { width: screenW, height: screenH } = display.workAreaSize
  const bounds = overlayWindow.getBounds()

  let x: number
  let y: number

  switch (position) {
    case 'topLeft':
      x = MARGIN
      y = MARGIN
      break
    case 'topCenter':
      x = Math.round((screenW - bounds.width) / 2)
      y = MARGIN
      break
    case 'topRight':
      x = screenW - bounds.width - MARGIN
      y = MARGIN
      break
    case 'bottomLeft':
      x = MARGIN
      y = screenH - bounds.height - MARGIN
      break
    case 'bottomCenter':
      x = Math.round((screenW - bounds.width) / 2)
      y = screenH - bounds.height - MARGIN
      break
    case 'bottomRight':
      x = screenW - bounds.width - MARGIN
      y = screenH - bounds.height - MARGIN
      break
  }

  overlayWindow.setPosition(x, y)
}
