import { app, BrowserWindow, ipcMain, globalShortcut } from 'electron'
import {
  createMainWindow,
  getMainWindow,
} from './windows/mainWindow'
import { initAutoUpdater } from './services/updater'
import {
  createOverlayWindow,
  toggleOverlay,
  showOverlay,
  hideOverlay,
  setOverlayExpanded,
  setOverlayPosition,
  type OverlayPosition,
} from './windows/overlayWindow'
import { createTray, updateTrayMenu, updateTrayIcon } from './windows/trayManager'
import { registerIPCHandlers } from './ipc/handlers'
import { registerGlobalShortcuts } from './services/globalShortcuts'
import { IPC_CHANNELS } from './ipc/channels'
import { initializeDatabase, closeDatabase } from './db/database'

// Google OAuth client ID (same as renderer)
const GOOGLE_CLIENT_ID = '499912921957-jskmos4jm1cpfgu6h7pmomeqvtltj9jq.apps.googleusercontent.com'

// Custom protocol for OAuth callbacks - uses reversed client ID format
// e.g., "499912921957-xxx.apps.googleusercontent.com" -> "com.googleusercontent.apps.499912921957-xxx"
function getOAuthProtocol(): string {
  const parts = GOOGLE_CLIENT_ID.split('.')
  if (parts.length >= 4) {
    return `com.googleusercontent.apps.${parts[0]}`
  }
  return 'com.googleusercontent.apps'
}

const OAUTH_PROTOCOL = getOAuthProtocol()

// Also keep the queenmama protocol for other deep links
const APP_PROTOCOL = 'queenmama'

// Register custom protocols for OAuth callback handling
if (process.defaultApp) {
  // In development, need to register the app as the protocol handler
  if (process.argv.length >= 2) {
    app.setAsDefaultProtocolClient(OAUTH_PROTOCOL, process.execPath, [process.argv[1]])
    app.setAsDefaultProtocolClient(APP_PROTOCOL, process.execPath, [process.argv[1]])
  }
} else {
  // In production, register the app as the protocol handler
  app.setAsDefaultProtocolClient(OAUTH_PROTOCOL)
  app.setAsDefaultProtocolClient(APP_PROTOCOL)
}

// Function to handle protocol URLs (queenmama://...)
function handleProtocolUrl(url: string): void {
  console.log('[Main] Protocol URL received:', url)

  // Send to all windows (main and overlay)
  const windows = BrowserWindow.getAllWindows()
  for (const win of windows) {
    if (!win.isDestroyed()) {
      win.webContents.send(IPC_CHANNELS.AUTH_PROTOCOL_CALLBACK, url)
    }
  }

  // Focus the main window when auth callback is received
  const mainWindow = getMainWindow()
  if (mainWindow && !mainWindow.isDestroyed()) {
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.focus()
  }
}

// Handle single instance lock
const gotTheLock = app.requestSingleInstanceLock()

if (!gotTheLock) {
  app.quit()
} else {
  // Handle second instance launch (Windows) - this receives protocol URLs
  app.on('second-instance', (_event, commandLine) => {
    // Focus the existing window
    const mainWindow = getMainWindow()
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }

    // Windows: protocol URL is passed via command line arguments
    // Look for OAuth protocol (com.googleusercontent.apps.XXX://) or app protocol (queenmama://)
    const protocolUrl = commandLine.find(
      (arg) => arg.startsWith(`${OAUTH_PROTOCOL}:`) || arg.startsWith(`${APP_PROTOCOL}://`)
    )
    if (protocolUrl) {
      handleProtocolUrl(protocolUrl)
    }
  })

  // Handle protocol URL on macOS (open-url event)
  app.on('open-url', (event, url) => {
    event.preventDefault()
    handleProtocolUrl(url)
  })

  app.whenReady().then(() => {
    // Set app user model id for Windows
    app.setAppUserModelId('com.queenmama.windows')

    // Handle protocol URL from initial launch (Windows)
    // When the app is launched via protocol URL, it's in process.argv
    const protocolUrlFromLaunch = process.argv.find(
      (arg) => arg.startsWith(`${OAUTH_PROTOCOL}:`) || arg.startsWith(`${APP_PROTOCOL}://`)
    )
    if (protocolUrlFromLaunch) {
      // Delay handling to ensure windows are ready
      setTimeout(() => handleProtocolUrl(protocolUrlFromLaunch), 100)
    }

    // Initialize database first
    try {
      initializeDatabase()
      console.log('[Main] Database initialized')
    } catch (error) {
      console.error('[Main] Database initialization failed:', error)
    }

    // Register all IPC handlers
    registerIPCHandlers()

    // Overlay IPC handlers
    ipcMain.on(IPC_CHANNELS.OVERLAY_TOGGLE, () => toggleOverlay())
    ipcMain.on(IPC_CHANNELS.OVERLAY_SHOW, () => showOverlay())
    ipcMain.on(IPC_CHANNELS.OVERLAY_HIDE, () => hideOverlay())
    ipcMain.on(IPC_CHANNELS.OVERLAY_SET_EXPANDED, (_event, expanded: boolean) => {
      setOverlayExpanded(expanded)
    })
    ipcMain.on(IPC_CHANNELS.OVERLAY_SET_POSITION, (_event, position: OverlayPosition) => {
      setOverlayPosition(position)
    })

    // Tray icon updates from renderer
    ipcMain.on(IPC_CHANNELS.TRAY_UPDATE_ICON, (_event, active: boolean) => {
      updateTrayIcon(active)
      updateTrayMenu(active)
    })

    // Create windows
    const mainWindow = createMainWindow()
    createOverlayWindow()
    createTray()

    // Register global keyboard shortcuts
    registerGlobalShortcuts()

    // Auto-updater (delayed start)
    try {
      initAutoUpdater(mainWindow)
    } catch (error) {
      console.error('[Main] Auto-updater init failed:', error)
    }

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createMainWindow()
      }
    })

    // Don't quit when all windows are closed (keep tray)
    app.on('window-all-closed', () => {
      // Keep running in system tray
    })
  })

  // Clean up on quit
  app.on('will-quit', () => {
    globalShortcut.unregisterAll()
    closeDatabase()
  })
}
