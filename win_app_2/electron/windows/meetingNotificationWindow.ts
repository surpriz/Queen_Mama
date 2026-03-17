import { BrowserWindow, screen } from 'electron'
import { join } from 'path'

const NOTIFICATION_WIDTH = 400
const NOTIFICATION_HEIGHT = 100
const MARGIN = 20

let notificationWindow: BrowserWindow | null = null

export function createMeetingNotificationWindow(): BrowserWindow {
  notificationWindow = new BrowserWindow({
    width: NOTIFICATION_WIDTH,
    height: NOTIFICATION_HEIGHT,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    focusable: false,
    hasShadow: false,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
    },
    show: false,
  })

  notificationWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })

  notificationWindow.on('closed', () => {
    notificationWindow = null
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
    notificationWindow.loadURL(`${process.env['ELECTRON_RENDERER_URL']}#/notification`)
  } else {
    notificationWindow.loadFile(join(__dirname, '../renderer/index.html'), {
      hash: '/notification',
    })
  }

  return notificationWindow
}

export function showMeetingNotification(): void {
  if (!notificationWindow || notificationWindow.isDestroyed()) return

  const display = screen.getPrimaryDisplay()
  const { width: screenW } = display.workAreaSize
  const x = screenW - NOTIFICATION_WIDTH - MARGIN
  const y = MARGIN

  notificationWindow.setPosition(x, y)
  notificationWindow.showInactive()
}

export function hideMeetingNotification(): void {
  if (!notificationWindow || notificationWindow.isDestroyed()) return
  notificationWindow.hide()
}
