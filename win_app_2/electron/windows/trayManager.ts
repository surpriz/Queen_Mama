import { Tray, Menu, nativeImage, app, BrowserWindow } from 'electron'
import { join } from 'path'
import { IPC_CHANNELS } from '../ipc/channels'
import { getMainWindow } from './mainWindow'
import { toggleOverlay } from './overlayWindow'

let tray: Tray | null = null

export function createTray(): Tray {
  const iconPath = join(__dirname, '../../resources/tray-icon.png')
  const icon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 })

  tray = new Tray(icon)
  tray.setToolTip('Queen Mama')

  updateTrayMenu(false)

  tray.on('click', () => {
    const mainWindow = getMainWindow()
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.focus()
      } else {
        mainWindow.show()
      }
    }
  })

  return tray
}

export function updateTrayMenu(isSessionActive: boolean): void {
  if (!tray) return

  const contextMenu = Menu.buildFromTemplate([
    {
      label: isSessionActive ? 'Stop Session' : 'Start Session',
      click: () => {
        const mainWindow = getMainWindow()
        if (mainWindow) {
          mainWindow.webContents.send(IPC_CHANNELS.SESSION_TOGGLE)
        }
      },
    },
    { type: 'separator' },
    {
      label: 'Show/Hide Widget',
      click: () => toggleOverlay(),
    },
    {
      label: 'Open Dashboard',
      click: () => {
        const mainWindow = getMainWindow()
        if (mainWindow) {
          mainWindow.show()
          mainWindow.focus()
        }
      },
    },
    { type: 'separator' },
    {
      label: 'Quit Queen Mama',
      click: () => {
        app.quit()
      },
    },
  ])

  tray.setContextMenu(contextMenu)
}

export function updateTrayIcon(active: boolean): void {
  if (!tray) return
  const iconName = active ? 'tray-icon-active.png' : 'tray-icon.png'
  const iconPath = join(__dirname, `../../resources/${iconName}`)
  const icon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 })
  tray.setImage(icon)
}
