import { autoUpdater, type UpdateInfo } from 'electron-updater'
import { BrowserWindow } from 'electron'
import { safeSendToWindow } from '../utils/ipcUtils'

let mainWindow: BrowserWindow | null = null
let periodicCheckTimer: NodeJS.Timeout | null = null

const PERIODIC_CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000 // 4 hours

export function initAutoUpdater(window: BrowserWindow) {
  mainWindow = window

  // Use staging update feed for staging builds
  if (process.env.VITE_APP_ENV === 'staging') {
    autoUpdater.setFeedURL({
      provider: 'generic',
      url: 'https://staging.queenmama.co/api/updates/windows',
    })
  }

  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('checking-for-update', () => {
    sendStatusToWindow('checking-for-update')
  })

  autoUpdater.on('update-available', (info: UpdateInfo) => {
    sendStatusToWindow('update-available', info)
  })

  autoUpdater.on('update-not-available', (info: UpdateInfo) => {
    sendStatusToWindow('update-not-available', info)
  })

  autoUpdater.on('download-progress', (progress) => {
    sendStatusToWindow('download-progress', {
      percent: progress.percent,
      bytesPerSecond: progress.bytesPerSecond,
      transferred: progress.transferred,
      total: progress.total,
    })
  })

  autoUpdater.on('update-downloaded', (info: UpdateInfo) => {
    sendStatusToWindow('update-downloaded', info)
  })

  autoUpdater.on('error', (error) => {
    console.error('[Updater] Error:', error)
    sendStatusToWindow('update-error', { message: error.message })
  })

  // Initial check 5s after boot
  setTimeout(() => {
    checkForUpdates()
  }, 5000)

  // Periodic recheck every 4 hours while the app is running.
  // Covers long-running sessions where the user never quits the app.
  if (periodicCheckTimer) clearInterval(periodicCheckTimer)
  periodicCheckTimer = setInterval(() => {
    checkForUpdates()
  }, PERIODIC_CHECK_INTERVAL_MS)
}

function sendStatusToWindow(status: string, data?: unknown) {
  safeSendToWindow(mainWindow, 'updater:status', { status, data })
}

export function checkForUpdates() {
  try {
    autoUpdater.checkForUpdatesAndNotify()
  } catch (error) {
    console.error('[Updater] Check failed:', error)
  }
}

export function quitAndInstall() {
  autoUpdater.quitAndInstall()
}
