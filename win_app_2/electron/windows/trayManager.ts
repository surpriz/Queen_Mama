import { Tray, Menu, nativeImage, app } from 'electron'
import { join } from 'path'
import { existsSync } from 'fs'
import { IPC_CHANNELS } from '../ipc/channels'
import { getMainWindow } from './mainWindow'
import { toggleOverlay } from './overlayWindow'
import { safeSendToWindow } from '../utils/ipcUtils'

let tray: Tray | null = null

function getIcon(name: string): Electron.NativeImage {
  const iconPath = join(__dirname, `../../resources/${name}`)
  if (existsSync(iconPath)) {
    return nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 })
  }
  // Fallback: create a simple colored icon
  return nativeImage.createFromBuffer(
    Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
      0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x10, 0x00, 0x00, 0x00, 0x10,
      0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0xf3, 0xff, 0x61, 0x00, 0x00, 0x00,
      0x19, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0x64, 0xc0, 0x0e, 0xfe,
      0xe3, 0xc0, 0xa8, 0x6a, 0x60, 0x60, 0x60, 0x60, 0x00, 0x00, 0x00, 0x00,
      0x00, 0xff, 0xff, 0x03, 0x00, 0x06, 0x40, 0x01, 0x01, 0x9e, 0xf6, 0xdc,
      0x73, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82
    ])
  )
}

export function createTray(): Tray {
  const icon = getIcon('tray-icon.png')

  tray = new Tray(icon)
  tray.setToolTip('Queen Mama')

  updateTrayMenu(false)

  tray.on('click', () => {
    const mainWindow = getMainWindow()
    if (mainWindow && !mainWindow.isDestroyed()) {
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
        safeSendToWindow(mainWindow, IPC_CHANNELS.SESSION_TOGGLE)
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
        if (mainWindow && !mainWindow.isDestroyed()) {
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
  const icon = getIcon(iconName)
  tray.setImage(icon)
}
