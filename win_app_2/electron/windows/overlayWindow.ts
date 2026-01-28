import { BrowserWindow, screen } from 'electron'
import { join } from 'path'
import { is } from 'electron-vite'

let overlayWindow: BrowserWindow | null = null

export type OverlayPosition =
  | 'topLeft'
  | 'topCenter'
  | 'topRight'
  | 'bottomLeft'
  | 'bottomCenter'
  | 'bottomRight'

const OVERLAY_COLLAPSED = { width: 380, height: 52 }
const OVERLAY_EXPANDED = { width: 420, height: 480 }
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
    hasShadow: true,
    focusable: true,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
    },
    show: false,
  })

  overlayWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    overlayWindow.loadURL(`${process.env['ELECTRON_RENDERER_URL']}#/overlay`)
  } else {
    overlayWindow.loadFile(join(__dirname, '../dist/index.html'), {
      hash: '/overlay',
    })
  }

  // Position at bottom right by default
  setOverlayPosition('bottomRight')

  return overlayWindow
}

export function getOverlayWindow(): BrowserWindow | null {
  return overlayWindow
}

export function showOverlay(): void {
  overlayWindow?.show()
}

export function hideOverlay(): void {
  overlayWindow?.hide()
}

export function toggleOverlay(): void {
  if (overlayWindow?.isVisible()) {
    hideOverlay()
  } else {
    showOverlay()
  }
}

export function setOverlayExpanded(expanded: boolean): void {
  if (!overlayWindow) return
  const size = expanded ? OVERLAY_EXPANDED : OVERLAY_COLLAPSED
  const currentBounds = overlayWindow.getBounds()

  // Animate by adjusting from bottom-right anchor point
  const newX = currentBounds.x + currentBounds.width - size.width
  const newY = currentBounds.y + currentBounds.height - size.height

  overlayWindow.setBounds({
    x: Math.max(0, newX),
    y: Math.max(0, newY),
    width: size.width,
    height: size.height,
  })
}

export function setOverlayPosition(position: OverlayPosition): void {
  if (!overlayWindow) return

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
