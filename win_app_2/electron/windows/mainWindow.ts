import { BrowserWindow, shell, app } from 'electron'
import { join } from 'path'

let mainWindow: BrowserWindow | null = null

export function createMainWindow(): BrowserWindow {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 700,
    minWidth: 720,
    minHeight: 500,
    backgroundColor: '#1a1a1e',
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#1a1a1e',
      symbolColor: '#ffffff',
      height: 36,
    },
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false,
    },
    show: false,
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
  })

  // Hide to tray instead of quitting when dashboard is closed
  mainWindow.on('close', (event) => {
    if (!(app as typeof app & { isQuitting?: boolean }).isQuitting) {
      event.preventDefault()
      mainWindow?.hide()
    }
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  // Error handlers for debugging
  mainWindow.webContents.on('crashed', (event, killed) => {
    console.error('[MainWindow] Renderer process crashed:', { killed })
  })

  mainWindow.webContents.on('render-process-gone', (event, details) => {
    console.error('[MainWindow] Render process gone:', details)
  })

  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    console.error('[MainWindow] Failed to load:', {
      errorCode,
      errorDescription,
      validatedURL,
    })
  })

  mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    // Only log errors and warnings from renderer
    if (level >= 2) {
      console.log(`[Renderer ${level === 2 ? 'WARN' : 'ERROR'}] ${message}`)
    }
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return mainWindow
}

export function getMainWindow(): BrowserWindow | null {
  if (mainWindow && mainWindow.isDestroyed()) {
    mainWindow = null
  }
  return mainWindow
}
