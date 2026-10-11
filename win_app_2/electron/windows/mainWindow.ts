import { BrowserWindow, shell, app, nativeImage, screen } from 'electron'
import { join } from 'path'
import { existsSync } from 'fs'
import { captureMessage, captureException } from '@sentry/electron/main'
import Store from 'electron-store'

const store = new Store()
const BG = '#0E0E11' // = tailwind qm-bg-primary
const DEFAULT_SIZE = { width: 900, height: 700 }
const MIN_SIZE = { width: 720, height: 500 }

interface SavedBounds {
  x: number
  y: number
  width: number
  height: number
}

/** Last window frame, only if it still lands on a connected display. */
function restoreBounds(): Partial<SavedBounds> {
  const saved = store.get('mainWindow.bounds') as SavedBounds | undefined
  if (!saved || typeof saved.width !== 'number') return {}
  const area = screen.getDisplayMatching(saved).workArea
  const visible =
    saved.x < area.x + area.width - 100 &&
    saved.x + saved.width > area.x + 100 &&
    saved.y < area.y + area.height - 50 &&
    saved.y + saved.height > area.y + 50
  if (!visible) return { width: saved.width, height: saved.height }
  return saved
}

let mainWindow: BrowserWindow | null = null
let saveTimer: ReturnType<typeof setTimeout> | null = null

function scheduleSaveBounds(): void {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    saveTimer = null
    if (!mainWindow || mainWindow.isDestroyed() || mainWindow.isMinimized() || mainWindow.isMaximized()) return
    store.set('mainWindow.bounds', mainWindow.getBounds())
  }, 400)
}

export function createMainWindow(): BrowserWindow {
  const iconPath = join(__dirname, '../../resources/icon.ico')
  const icon = existsSync(iconPath) ? nativeImage.createFromPath(iconPath) : undefined

  mainWindow = new BrowserWindow({
    ...DEFAULT_SIZE,
    ...restoreBounds(),
    minWidth: MIN_SIZE.width,
    minHeight: MIN_SIZE.height,
    backgroundColor: BG,
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: BG,
      symbolColor: '#ffffff',
      height: 36,
    },
    icon,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false,
    },
    show: false,
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
  })

  // Remember size/position across launches (mac WindowGroup frame restore)
  mainWindow.on('resize', scheduleSaveBounds)
  mainWindow.on('move', scheduleSaveBounds)

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

  // Auto-open DevTools on beta builds so testers can capture renderer logs.
  // Remove once the audio-capture issue is diagnosed.
  // DevTools are opt-in (QM_DEVTOOLS=1); beta builds used to open them on
  // every launch, which also exposed a non-content-protected window.
  if (process.env.QM_DEVTOOLS === '1') {
    mainWindow.webContents.once('did-finish-load', () => {
      mainWindow?.webContents.openDevTools({ mode: 'detach' })
    })
  }

  return mainWindow
}

export function getMainWindow(): BrowserWindow | null {
  if (mainWindow && mainWindow.isDestroyed()) {
    mainWindow = null
  }
  return mainWindow
}
