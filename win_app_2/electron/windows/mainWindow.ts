import { BrowserWindow, shell, app, nativeImage } from 'electron'
import { join } from 'path'
import { existsSync } from 'fs'
import { captureMessage, captureException } from '@sentry/electron/main'

let mainWindow: BrowserWindow | null = null

export function createMainWindow(): BrowserWindow {
  const iconPath = join(__dirname, '../../resources/icon.ico')
  const icon = existsSync(iconPath) ? nativeImage.createFromPath(iconPath) : undefined

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
    icon,
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

  // Minimize to taskbar instead of quitting when dashboard is closed
  // This keeps the app icon visible in the Windows taskbar
  mainWindow.on('close', (event) => {
    if (!(app as typeof app & { isQuitting?: boolean }).isQuitting) {
      event.preventDefault()
      mainWindow?.minimize()
    }
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  // Error handlers — both for debugging and Sentry reporting
  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    console.error('[MainWindow] Render process gone:', details)
    captureMessage(`renderer_gone: ${details.reason}`, {
      level: details.reason === 'clean-exit' ? 'info' : 'fatal',
      extra: { reason: details.reason, exitCode: details.exitCode },
    })
  })

  mainWindow.webContents.on('unresponsive', () => {
    console.error('[MainWindow] Renderer unresponsive')
    captureMessage('renderer_unresponsive', { level: 'warning' })
  })

  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
    console.error('[MainWindow] Failed to load:', {
      errorCode,
      errorDescription,
      validatedURL,
    })
    // -3 = ABORTED (normal navigation cancel), ignore.
    if (errorCode === -3) return
    captureMessage('did_fail_load', {
      level: isMainFrame ? 'error' : 'warning',
      extra: { errorCode, errorDescription, validatedURL, isMainFrame },
    })
  })

  mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    // Only log errors and warnings from renderer
    if (level >= 2) {
      console.log(`[Renderer ${level === 2 ? 'WARN' : 'ERROR'}] ${message}`)
    }
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url).catch((err: Error) => {
      captureException(err, { tags: { service: 'shell', operation: 'open_external' }, extra: { url: details.url } })
    })
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
