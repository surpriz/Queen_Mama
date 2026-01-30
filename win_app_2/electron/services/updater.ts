import { autoUpdater, type UpdateInfo } from 'electron-updater'
import { BrowserWindow } from 'electron'

let mainWindow: BrowserWindow | null = null

export function initAutoUpdater(window: BrowserWindow) {
  mainWindow = window

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

  // Check for updates after 5s delay
  setTimeout(() => {
    checkForUpdates()
  }, 5000)
}

function sendStatusToWindow(status: string, data?: unknown) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('updater:status', { status, data })
  }
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
