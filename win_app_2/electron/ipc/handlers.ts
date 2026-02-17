import { ipcMain, app, shell, safeStorage, BrowserWindow, desktopCapturer, dialog } from 'electron'
import { IPC_CHANNELS } from './channels'
import { v4 as uuidv4 } from 'uuid'
import * as os from 'os'
import * as path from 'path'
import * as fs from 'fs'
import Store from 'electron-store'
import { executeQuery, executeQueryGet, executeQueryAll, walCheckpoint } from '../db/database'
import { startOAuthServer, stopOAuthServer } from '../services/oauthServer'
import { checkForUpdates } from '../services/updater'
import { safeSendToWindow, safeSendToOverlayWindows, safeSendToMainWindow } from '../utils/ipcUtils'
import {
  toggleOverlay,
  showOverlay,
  hideOverlay,
  setOverlayExpanded,
  setOverlayPosition,
  setOverlaySize,
  getOverlayWindow,
} from '../windows/overlayWindow'

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

  // Overlay management
  ipcMain.on(IPC_CHANNELS.OVERLAY_TOGGLE, () => {
    toggleOverlay()
  })

  ipcMain.on(IPC_CHANNELS.OVERLAY_SHOW, () => {
    showOverlay()
  })

  ipcMain.on(IPC_CHANNELS.OVERLAY_HIDE, () => {
    hideOverlay()
  })

  ipcMain.on(IPC_CHANNELS.OVERLAY_SET_EXPANDED, (_event, expanded: boolean) => {
    setOverlayExpanded(expanded)
  })

  ipcMain.on(IPC_CHANNELS.OVERLAY_SET_POSITION, (_event, position: string) => {
    setOverlayPosition(position as Parameters<typeof setOverlayPosition>[0])
  })

  ipcMain.on(IPC_CHANNELS.OVERLAY_SET_SIZE, (_event, width: number, height: number) => {
    setOverlaySize(width, height)
  })

  ipcMain.handle(IPC_CHANNELS.OVERLAY_GET_BOUNDS, () => {
    const win = getOverlayWindow()
    if (!win || win.isDestroyed()) return null
    return win.getBounds()
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

  // Updater
  ipcMain.handle(IPC_CHANNELS.UPDATER_CHECK, () => {
    checkForUpdates()
    return true
  })

  // File dialog (for mode file attachments)
  ipcMain.handle(IPC_CHANNELS.DIALOG_OPEN_FILE, async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) return { canceled: true, filePaths: [] }
    const result = await dialog.showOpenDialog(win, {
      properties: ['openFile'],
      filters: [
        { name: 'Documents', extensions: ['pdf', 'txt', 'rtf', 'md', 'docx'] },
        { name: 'All Files', extensions: ['*'] },
      ],
    })
    return result
  })

  // Read file as text (for AI context)
  ipcMain.handle(IPC_CHANNELS.FILE_READ_TEXT, (_event, filePath: string) => {
    try {
      return fs.readFileSync(filePath, 'utf-8')
    } catch (error) {
      console.error('[IPC] File read failed:', error)
      return null
    }
  })

  // Cross-window relay: main window → overlay window
  ipcMain.on(IPC_CHANNELS.RELAY_TO_OVERLAY, (_event, channel: string, data: unknown) => {
    safeSendToOverlayWindows(channel, data)
  })

  // Cross-window relay: overlay → main window
  ipcMain.on(IPC_CHANNELS.RELAY_TO_MAIN, (_event, channel: string, data: unknown) => {
    safeSendToMainWindow(channel, data)
  })

  // Database operations
  ipcMain.handle(IPC_CHANNELS.DB_QUERY, (_event, sql: string, params: unknown[] = []) => {
    try {
      return executeQuery(sql, params)
    } catch (error) {
      console.error('[IPC] DB query failed:', error)
      throw error
    }
  })

  ipcMain.handle(IPC_CHANNELS.DB_QUERY_GET, (_event, sql: string, params: unknown[] = []) => {
    try {
      return executeQueryGet(sql, params)
    } catch (error) {
      console.error('[IPC] DB query get failed:', error)
      throw error
    }
  })

  ipcMain.handle(IPC_CHANNELS.DB_QUERY_ALL, (_event, sql: string, params: unknown[] = []) => {
    try {
      return executeQueryAll(sql, params)
    } catch (error) {
      console.error('[IPC] DB query all failed:', error)
      throw error
    }
  })

  ipcMain.handle(
    IPC_CHANNELS.DB_INSERT,
    (_event, table: string, data: Record<string, unknown>) => {
      try {
        const columns = Object.keys(data)
        const placeholders = columns.map(() => '?').join(', ')
        const values = Object.values(data)
        const sql = `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`
        return executeQuery(sql, values)
      } catch (error) {
        console.error('[IPC] DB insert failed:', error)
        throw error
      }
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.DB_UPDATE,
    (
      _event,
      table: string,
      data: Record<string, unknown>,
      where: string,
      whereParams: unknown[] = []
    ) => {
      try {
        const setClause = Object.keys(data)
          .map((col) => `${col} = ?`)
          .join(', ')
        const values = [...Object.values(data), ...whereParams]
        const sql = `UPDATE ${table} SET ${setClause} WHERE ${where}`
        return executeQuery(sql, values)
      } catch (error) {
        console.error('[IPC] DB update failed:', error)
        throw error
      }
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.DB_DELETE,
    (_event, table: string, where: string, whereParams: unknown[] = []) => {
      try {
        const sql = `DELETE FROM ${table} WHERE ${where}`
        return executeQuery(sql, whereParams)
      } catch (error) {
        console.error('[IPC] DB delete failed:', error)
        throw error
      }
    }
  )

  ipcMain.handle(IPC_CHANNELS.DB_WAL_CHECKPOINT, () => {
    try {
      walCheckpoint()
      return { success: true }
    } catch (error) {
      console.error('[IPC] WAL checkpoint failed:', error)
      throw error
    }
  })

  // OAuth server for loopback authentication
  ipcMain.handle(IPC_CHANNELS.AUTH_START_OAUTH_SERVER, async () => {
    try {
      const port = await startOAuthServer()
      return { success: true, port }
    } catch (error) {
      console.error('[IPC] OAuth server start failed:', error)
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle(IPC_CHANNELS.AUTH_STOP_OAUTH_SERVER, () => {
    stopOAuthServer()
    return { success: true }
  })
}
