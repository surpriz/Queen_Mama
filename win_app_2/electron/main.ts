import { app, BrowserWindow, ipcMain } from 'electron'
import { electronApp, optimizer } from 'electron-vite'
import {
  createMainWindow,
  getMainWindow,
} from './windows/mainWindow'
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

// Handle single instance lock
const gotTheLock = app.requestSingleInstanceLock()

if (!gotTheLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    // Focus the existing window if a second instance is launched
    const mainWindow = getMainWindow()
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })

  app.whenReady().then(() => {
    // Set app user model id for Windows
    electronApp.setAppUserModelId('com.queenmama.windows')

    // Default open or close DevTools by F12 in development
    app.on('browser-window-created', (_, window) => {
      optimizer.watchWindowShortcuts(window)
    })

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
      const { initAutoUpdater } = require('./services/updater')
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
    // Unregister all shortcuts
    const { globalShortcut } = require('electron')
    globalShortcut.unregisterAll()
  })
}
