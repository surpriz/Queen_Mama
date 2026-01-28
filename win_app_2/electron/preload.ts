import { contextBridge, ipcRenderer } from 'electron'
import { IPC_CHANNELS } from './ipc/channels'
import type { OverlayPosition } from './windows/overlayWindow'

const electronAPI = {
  // App
  getVersion: () => ipcRenderer.invoke(IPC_CHANNELS.APP_GET_VERSION),
  getPath: (name: string) => ipcRenderer.invoke(IPC_CHANNELS.APP_GET_PATH, name),
  openExternal: (url: string) => ipcRenderer.invoke(IPC_CHANNELS.APP_OPEN_EXTERNAL, url),
  quit: () => ipcRenderer.send(IPC_CHANNELS.APP_QUIT),

  // Window
  window: {
    minimize: () => ipcRenderer.send(IPC_CHANNELS.WINDOW_MINIMIZE),
    maximize: () => ipcRenderer.send(IPC_CHANNELS.WINDOW_MAXIMIZE),
    close: () => ipcRenderer.send(IPC_CHANNELS.WINDOW_CLOSE),
    show: () => ipcRenderer.send('window:show'),
  },
  windowMinimize: () => ipcRenderer.send(IPC_CHANNELS.WINDOW_MINIMIZE),
  windowMaximize: () => ipcRenderer.send(IPC_CHANNELS.WINDOW_MAXIMIZE),
  windowClose: () => ipcRenderer.send(IPC_CHANNELS.WINDOW_CLOSE),

  // Overlay (namespaced)
  overlay: {
    toggle: () => ipcRenderer.send(IPC_CHANNELS.OVERLAY_TOGGLE),
    show: () => ipcRenderer.send(IPC_CHANNELS.OVERLAY_SHOW),
    hide: () => ipcRenderer.send(IPC_CHANNELS.OVERLAY_HIDE),
    setExpanded: (expanded: boolean) =>
      ipcRenderer.send(IPC_CHANNELS.OVERLAY_SET_EXPANDED, expanded),
    setPosition: (position: OverlayPosition) =>
      ipcRenderer.send(IPC_CHANNELS.OVERLAY_SET_POSITION, position),
  },
  // Overlay (flat - backward compat)
  overlayToggle: () => ipcRenderer.send(IPC_CHANNELS.OVERLAY_TOGGLE),
  overlayShow: () => ipcRenderer.send(IPC_CHANNELS.OVERLAY_SHOW),
  overlayHide: () => ipcRenderer.send(IPC_CHANNELS.OVERLAY_HIDE),
  overlaySetExpanded: (expanded: boolean) =>
    ipcRenderer.send(IPC_CHANNELS.OVERLAY_SET_EXPANDED, expanded),
  overlaySetPosition: (position: OverlayPosition) =>
    ipcRenderer.send(IPC_CHANNELS.OVERLAY_SET_POSITION, position),

  // Secure storage
  secureStore: {
    set: (key: string, value: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.SECURE_STORE_SET, key, value),
    get: (key: string) => ipcRenderer.invoke(IPC_CHANNELS.SECURE_STORE_GET, key),
    delete: (key: string) => ipcRenderer.invoke(IPC_CHANNELS.SECURE_STORE_DELETE, key),
    has: (key: string) => ipcRenderer.invoke(IPC_CHANNELS.SECURE_STORE_HAS, key),
  },

  // Settings store
  store: {
    get: (key: string) => ipcRenderer.invoke(IPC_CHANNELS.STORE_GET, key),
    set: (key: string, value: unknown) => ipcRenderer.invoke(IPC_CHANNELS.STORE_SET, key, value),
    delete: (key: string) => ipcRenderer.invoke(IPC_CHANNELS.STORE_DELETE, key),
  },

  // Device
  device: {
    getId: () => ipcRenderer.invoke(IPC_CHANNELS.DEVICE_GET_ID),
    getInfo: () => ipcRenderer.invoke(IPC_CHANNELS.DEVICE_GET_INFO),
  },
  getDeviceId: () => ipcRenderer.invoke(IPC_CHANNELS.DEVICE_GET_ID),
  getDeviceInfo: () => ipcRenderer.invoke(IPC_CHANNELS.DEVICE_GET_INFO),

  // Screen capture
  screen: {
    capture: () => ipcRenderer.invoke(IPC_CHANNELS.SCREEN_CAPTURE),
    getSources: () => ipcRenderer.invoke(IPC_CHANNELS.SCREEN_GET_SOURCES),
  },
  getScreenSources: () => ipcRenderer.invoke(IPC_CHANNELS.SCREEN_GET_SOURCES),

  // Tray
  updateTrayIcon: (active: boolean) => ipcRenderer.send(IPC_CHANNELS.TRAY_UPDATE_ICON, active),

  // Display affinity
  setDisplayAffinity: (exclude: boolean) =>
    ipcRenderer.send(IPC_CHANNELS.DISPLAY_SET_AFFINITY, exclude),

  // Updater
  checkForUpdates: () => ipcRenderer.invoke(IPC_CHANNELS.UPDATER_CHECK),

  // Event listeners (main → renderer)
  onSessionToggle: (callback: () => void) => {
    ipcRenderer.on(IPC_CHANNELS.SESSION_TOGGLE, callback)
    return () => ipcRenderer.removeListener(IPC_CHANNELS.SESSION_TOGGLE, callback)
  },
  onShortcutToggleWidget: (callback: () => void) => {
    ipcRenderer.on(IPC_CHANNELS.SHORTCUT_TOGGLE_WIDGET, callback)
    return () => ipcRenderer.removeListener(IPC_CHANNELS.SHORTCUT_TOGGLE_WIDGET, callback)
  },
  onShortcutTriggerAssist: (callback: () => void) => {
    ipcRenderer.on(IPC_CHANNELS.SHORTCUT_TRIGGER_ASSIST, callback)
    return () => ipcRenderer.removeListener(IPC_CHANNELS.SHORTCUT_TRIGGER_ASSIST, callback)
  },
  onShortcutClearContext: (callback: () => void) => {
    ipcRenderer.on(IPC_CHANNELS.SHORTCUT_CLEAR_CONTEXT, callback)
    return () => ipcRenderer.removeListener(IPC_CHANNELS.SHORTCUT_CLEAR_CONTEXT, callback)
  },
  onShortcutMoveWidget: (callback: (direction: string) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, direction: string) => callback(direction)
    ipcRenderer.on(IPC_CHANNELS.SHORTCUT_MOVE_WIDGET, handler)
    return () => ipcRenderer.removeListener(IPC_CHANNELS.SHORTCUT_MOVE_WIDGET, handler)
  },
  onOverlayStateChanged: (callback: (state: unknown) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, state: unknown) => callback(state)
    ipcRenderer.on(IPC_CHANNELS.OVERLAY_STATE_CHANGED, handler)
    return () => ipcRenderer.removeListener(IPC_CHANNELS.OVERLAY_STATE_CHANGED, handler)
  },
}

contextBridge.exposeInMainWorld('electronAPI', electronAPI)

export type ElectronAPI = typeof electronAPI
