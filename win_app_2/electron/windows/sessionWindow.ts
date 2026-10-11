import { BrowserWindow, app } from 'electron'
import { join } from 'path'
import { captureMessage } from '@sentry/electron/main'

/**
 * Hidden renderer that owns the whole session pipeline (audio capture, AEC/VAD,
 * transcription, AI, detection, auth + license ownership, sync).
 *
 * Dashboard / overlay / notification windows are pure consumers: they read
 * state through the relay hub and send commands through `session:invoke`.
 *
 * It is never shown, never closed by the user, and must not be throttled.
 */

let sessionWindow: BrowserWindow | null = null

export function createSessionWindow(): BrowserWindow {
  sessionWindow = new BrowserWindow({
    width: 1,
    height: 1,
    show: false,
    frame: false,
    skipTaskbar: true,
    focusable: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false,
      // Timers (audio batching, keepalives, reconnect backoff) must keep
      // firing at full rate even though the window is never visible.
      backgroundThrottling: false,
    },
  })

  sessionWindow.on('close', (event) => {
    if (!(app as typeof app & { isQuitting?: boolean }).isQuitting) {
      event.preventDefault()
    }
  })

  sessionWindow.on('closed', () => {
    sessionWindow = null
  })

  sessionWindow.webContents.on('render-process-gone', (_event, details) => {
    console.error('[SessionWindow] Render process gone:', details)
    captureMessage(`session_renderer_gone: ${details.reason}`, {
      level: details.reason === 'clean-exit' ? 'info' : 'fatal',
      extra: { reason: details.reason, exitCode: details.exitCode },
    })
    if (details.reason !== 'clean-exit') {
      setTimeout(() => {
        if (sessionWindow && !sessionWindow.isDestroyed()) {
          console.log('[SessionWindow] Reloading session renderer after crash')
          sessionWindow.webContents.reload()
        }
      }, 1000)
    }
  })

  sessionWindow.webContents.on('unresponsive', () => {
    console.error('[SessionWindow] Renderer unresponsive')
    captureMessage('session_renderer_unresponsive', { level: 'warning' })
  })

  sessionWindow.webContents.on('console-message', (_event, level, message) => {
    if (level >= 2) {
      console.log(`[Session ${level === 2 ? 'WARN' : 'ERROR'}] ${message}`)
    }
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
    sessionWindow.loadURL(`${process.env['ELECTRON_RENDERER_URL']}#/session`)
  } else {
    sessionWindow.loadFile(join(__dirname, '../renderer/index.html'), {
      hash: '/session',
    })
  }

  return sessionWindow
}

export function getSessionWindow(): BrowserWindow | null {
  if (sessionWindow && sessionWindow.isDestroyed()) {
    sessionWindow = null
  }
  return sessionWindow
}
