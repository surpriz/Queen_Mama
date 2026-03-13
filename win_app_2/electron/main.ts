import { app, BrowserWindow, ipcMain, globalShortcut } from 'electron'
import { execSync } from 'child_process'
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
import { safeSendToAllWindows, safeSendToWindow } from './utils/ipcUtils'

// Google OAuth client ID - Desktop type for Windows/Electron (supports loopback redirects)
// This should match the Client ID used in the renderer (googleAuthService.ts)
const GOOGLE_CLIENT_ID =
  process.env.VITE_GOOGLE_CLIENT_ID ||
  '499912921957-791r0pvvs9j3ptem6gcdvf2qhbha381v.apps.googleusercontent.com'

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

  // Send to all windows (main and overlay) - using safe send to prevent "Object has been destroyed" error
  safeSendToAllWindows(IPC_CHANNELS.AUTH_PROTOCOL_CALLBACK, url)

  // Focus the main window when auth callback is received
  const mainWindow = getMainWindow()
  try {
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  } catch (error) {
    console.warn('[Main] Could not focus main window:', error)
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
    if (mainWindow && !mainWindow.isDestroyed()) {
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

    // Auto-updater
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

    // Don't quit when dashboard is hidden - overlay stays alive
    app.on('window-all-closed', (e: Event) => {
      e.preventDefault()
    })
  })

  // Set quitting flag so mainWindow close handler allows it
  app.on('before-quit', () => {
    ;(app as typeof app & { isQuitting: boolean }).isQuitting = true
  })

  // Clean up on quit
  app.on('will-quit', () => {
    globalShortcut.unregisterAll()
    closeDatabase()

    // In dev mode, kill backend/proxy processes to free all ports
    if (process.env.NODE_ENV !== 'production' || process.env['ELECTRON_RENDERER_URL']) {
      const devPorts = [3000, 3001] // backend + WS proxy
      for (const port of devPorts) {
        try {
          const result = execSync(`netstat -ano | findstr :${port}`, { encoding: 'utf-8' })
          const lines = result.split('\n').filter((l: string) => l.includes('LISTENING'))
          for (const line of lines) {
            const parts = line.trim().split(/\s+/)
            const pid = parts[parts.length - 1]
            if (pid && pid !== '0') {
              try {
                execSync(`taskkill /F /PID ${pid}`, { stdio: 'ignore' })
                console.log(`[Main] Cleanup: killed process ${pid} on port ${port}`)
              } catch {}
            }
          }
        } catch {}
      }
    }
  })
}
