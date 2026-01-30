import { ipcMain, app, shell, safeStorage, BrowserWindow, desktopCapturer } from 'electron'
import { IPC_CHANNELS } from './channels'
import { v4 as uuidv4 } from 'uuid'
import * as os from 'os'
import * as path from 'path'
import * as fs from 'fs'
import Store from 'electron-store'

const store = new Store()

// Persistent device ID
let cachedDeviceId: string | null = null

function getDeviceId(): string {
  if (cachedDeviceId) return cachedDeviceId

  const deviceIdPath = path.join(app.getPath('userData'), 'device-id')
  try {
    cachedDeviceId = fs.readFileSync(deviceIdPath, 'utf-8').trim()
  } catch {
    cachedDeviceId = uuidv4()
    fs.writeFileSync(deviceIdPath, cachedDeviceId, 'utf-8')
  }
  return cachedDeviceId
}

export function registerIPCHandlers(): void {
  // App info
  ipcMain.handle(IPC_CHANNELS.APP_GET_VERSION, () => app.getVersion())
  ipcMain.handle(IPC_CHANNELS.APP_GET_PATH, (_event, name: string) => {
    return app.getPath(name as Parameters<typeof app.getPath>[0])
  })
  ipcMain.handle(IPC_CHANNELS.APP_OPEN_EXTERNAL, (_event, url: string) => {
    return shell.openExternal(url)
  })
  ipcMain.on(IPC_CHANNELS.APP_QUIT, () => app.quit())

  // Device info
  ipcMain.handle(IPC_CHANNELS.DEVICE_GET_ID, () => getDeviceId())
  ipcMain.handle(IPC_CHANNELS.DEVICE_GET_INFO, () => ({
    deviceId: getDeviceId(),
    deviceName: os.hostname(),
    platform: 'windows',
    osVersion: `${os.type()} ${os.release()}`,
    appVersion: app.getVersion(),
  }))

  // Secure storage
  ipcMain.handle(IPC_CHANNELS.SECURE_STORE_SET, (_event, key: string, value: string) => {
    if (!safeStorage.isEncryptionAvailable()) {
      throw new Error('Encryption not available')
    }
    const encrypted = safeStorage.encryptString(value)
    store.set(`secure.${key}`, encrypted.toString('base64'))
    return true
  })

  ipcMain.handle(IPC_CHANNELS.SECURE_STORE_GET, (_event, key: string) => {
    if (!safeStorage.isEncryptionAvailable()) {
      throw new Error('Encryption not available')
    }
    const encrypted = store.get(`secure.${key}`) as string | undefined
    if (!encrypted) return null
    const buffer = Buffer.from(encrypted, 'base64')
    return safeStorage.decryptString(buffer)
  })

  ipcMain.handle(IPC_CHANNELS.SECURE_STORE_DELETE, (_event, key: string) => {
    store.delete(`secure.${key}`)
    return true
  })

  ipcMain.handle(IPC_CHANNELS.SECURE_STORE_HAS, (_event, key: string) => {
    return store.has(`secure.${key}`)
  })

  // Settings store
  ipcMain.handle(IPC_CHANNELS.STORE_GET, (_event, key: string) => {
    return store.get(key)
  })

  ipcMain.handle(IPC_CHANNELS.STORE_SET, (_event, key: string, value: unknown) => {
    store.set(key, value)
    return true
  })

  ipcMain.handle(IPC_CHANNELS.STORE_DELETE, (_event, key: string) => {
    store.delete(key)
    return true
  })

  // Window management
  ipcMain.on(IPC_CHANNELS.WINDOW_MINIMIZE, (event) => {
    BrowserWindow.fromWebContents(event.sender)?.minimize()
  })

  ipcMain.on(IPC_CHANNELS.WINDOW_MAXIMIZE, (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (win?.isMaximized()) {
      win.unmaximize()
    } else {
      win?.maximize()
    }
  })

  ipcMain.on(IPC_CHANNELS.WINDOW_CLOSE, (event) => {
    BrowserWindow.fromWebContents(event.sender)?.close()
  })

  // Show main window (from overlay)
  ipcMain.on('window:show', () => {
    const windows = BrowserWindow.getAllWindows()
    for (const win of windows) {
      if (!win.isAlwaysOnTop() && !win.isDestroyed()) {
        win.show()
        win.focus()
        break
      }
    }
  })

  // Screen capture
  ipcMain.handle(IPC_CHANNELS.SCREEN_CAPTURE, async () => {
    try {
      const sources = await desktopCapturer.getSources({
        types: ['screen'],
        thumbnailSize: { width: 1920, height: 1080 },
      })
      if (sources.length === 0) return null
      return sources[0].thumbnail.toDataURL('image/jpeg', 0.5)
    } catch (error) {
      console.error('[IPC] Screen capture failed:', error)
      return null
    }
  })

  ipcMain.handle(IPC_CHANNELS.SCREEN_GET_SOURCES, async () => {
    try {
      const sources = await desktopCapturer.getSources({
        types: ['screen', 'window'],
        thumbnailSize: { width: 320, height: 180 },
      })
      return sources
        .filter((s) => !s.name.toLowerCase().includes('queen mama'))
        .map((s) => ({
          id: s.id,
          name: s.name,
          thumbnailDataUrl: s.thumbnail.toDataURL(),
        }))
    } catch {
      return []
    }
  })

  // Display affinity
  ipcMain.on(IPC_CHANNELS.DISPLAY_SET_AFFINITY, (_event, exclude: boolean) => {
    const windows = BrowserWindow.getAllWindows()
    for (const win of windows) {
      if (win.isAlwaysOnTop()) {
        win.setContentProtection(exclude)
      }
    }
  })

  // Cross-window relay: main window → overlay window
  ipcMain.on(IPC_CHANNELS.RELAY_TO_OVERLAY, (_event, channel: string, data: unknown) => {
    const windows = BrowserWindow.getAllWindows()
    for (const win of windows) {
      if (win.isAlwaysOnTop() && !win.isDestroyed()) {
        win.webContents.send(channel, data)
      }
    }
  })

  // Cross-window relay: overlay → main window
  ipcMain.on(IPC_CHANNELS.RELAY_TO_MAIN, (_event, channel: string, data: unknown) => {
    const windows = BrowserWindow.getAllWindows()
    for (const win of windows) {
      if (!win.isAlwaysOnTop() && !win.isDestroyed()) {
        win.webContents.send(channel, data)
      }
    }
  })
}
