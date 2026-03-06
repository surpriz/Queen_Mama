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
    toggle: () => ipcRenderer.send(IPC_CHANNELS.WINDOW_TOGGLE),
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
    setSize: (width: number, height: number) =>
      ipcRenderer.send(IPC_CHANNELS.OVERLAY_SET_SIZE, width, height),
    getBounds: () => ipcRenderer.invoke(IPC_CHANNELS.OVERLAY_GET_BOUNDS),
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
  onUpdaterStatus: (callback: (payload: { status: string; data?: unknown }) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, payload: { status: string; data?: unknown }) =>
      callback(payload)
    ipcRenderer.on(IPC_CHANNELS.UPDATER_STATUS, handler)
    return () => ipcRenderer.removeListener(IPC_CHANNELS.UPDATER_STATUS, handler)
  },

  // File operations
  dialog: {
    openFile: () => ipcRenderer.invoke(IPC_CHANNELS.DIALOG_OPEN_FILE),
  },
  file: {
    readText: (filePath: string) => ipcRenderer.invoke(IPC_CHANNELS.FILE_READ_TEXT, filePath),
  },

  // Database operations
  db: {
    query: (sql: string, params?: unknown[]) =>
      ipcRenderer.invoke(IPC_CHANNELS.DB_QUERY, sql, params),
    queryGet: (sql: string, params?: unknown[]) =>
      ipcRenderer.invoke(IPC_CHANNELS.DB_QUERY_GET, sql, params),
    queryAll: (sql: string, params?: unknown[]) =>
      ipcRenderer.invoke(IPC_CHANNELS.DB_QUERY_ALL, sql, params),
    insert: (table: string, data: Record<string, unknown>) =>
      ipcRenderer.invoke(IPC_CHANNELS.DB_INSERT, table, data),
    update: (table: string, data: Record<string, unknown>, where: string, whereParams?: unknown[]) =>
      ipcRenderer.invoke(IPC_CHANNELS.DB_UPDATE, table, data, where, whereParams),
    delete: (table: string, where: string, whereParams?: unknown[]) =>
      ipcRenderer.invoke(IPC_CHANNELS.DB_DELETE, table, where, whereParams),
    walCheckpoint: () => ipcRenderer.invoke(IPC_CHANNELS.DB_WAL_CHECKPOINT),
  },

  // Auth / OAuth
  auth: {
    onProtocolCallback: (callback: (url: string) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, url: string) => callback(url)
      ipcRenderer.on(IPC_CHANNELS.AUTH_PROTOCOL_CALLBACK, handler)
      return () => ipcRenderer.removeListener(IPC_CHANNELS.AUTH_PROTOCOL_CALLBACK, handler)
    },
    startOAuthServer: () => ipcRenderer.invoke(IPC_CHANNELS.AUTH_START_OAUTH_SERVER),
    stopOAuthServer: () => ipcRenderer.invoke(IPC_CHANNELS.AUTH_STOP_OAUTH_SERVER),
  },

  // Cross-window relay
  relay: {
    toOverlay: (channel: string, data: unknown) =>
      ipcRenderer.send(IPC_CHANNELS.RELAY_TO_OVERLAY, channel, data),
    toMain: (channel: string, data: unknown) =>
      ipcRenderer.send(IPC_CHANNELS.RELAY_TO_MAIN, channel, data),
    broadcast: (channel: string, data: unknown) => {
      // Send to both overlay and main windows
      ipcRenderer.send(IPC_CHANNELS.RELAY_TO_OVERLAY, channel, data)
      ipcRenderer.send(IPC_CHANNELS.RELAY_TO_MAIN, channel, data)
    },
  },

  // Cross-window event listeners
  onTranscriptSync: (callback: (data: { transcript: string; interim: string; audioLevel: number; isSessionActive: boolean; sessionStartedAt: number | null }) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: { transcript: string; interim: string; audioLevel: number; isSessionActive: boolean; sessionStartedAt: number | null }) => callback(data)
    ipcRenderer.on(IPC_CHANNELS.RELAY_TRANSCRIPT, handler)
    return () => ipcRenderer.removeListener(IPC_CHANNELS.RELAY_TRANSCRIPT, handler)
  },
  onSessionStateSync: (callback: (data: { isSessionActive: boolean; sessionStartedAt: number | null }) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: { isSessionActive: boolean; sessionStartedAt: number | null }) => callback(data)
    ipcRenderer.on(IPC_CHANNELS.RELAY_SESSION_STATE, handler)
    return () => ipcRenderer.removeListener(IPC_CHANNELS.RELAY_SESSION_STATE, handler)
  },
  onAudioLevelSync: (callback: (data: { audioLevel: number }) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: { audioLevel: number }) => callback(data)
    ipcRenderer.on(IPC_CHANNELS.RELAY_AUDIO_LEVEL, handler)
    return () => ipcRenderer.removeListener(IPC_CHANNELS.RELAY_AUDIO_LEVEL, handler)
  },
  onAIResponseSync: (callback: (data: { type: 'streaming' | 'history'; streamingContent?: string; entry?: { type: string; content: string; timestamp: string } }) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: { type: 'streaming' | 'history'; streamingContent?: string; entry?: { type: string; content: string; timestamp: string } }) => callback(data)
    ipcRenderer.on(IPC_CHANNELS.RELAY_AI_RESPONSE, handler)
    return () => ipcRenderer.removeListener(IPC_CHANNELS.RELAY_AI_RESPONSE, handler)
  },

  // Meeting detection (main → renderer)
  onMeetingDetected: (callback: (data: { appName: string }) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: { appName: string }) => callback(data)
    ipcRenderer.on(IPC_CHANNELS.MEETING_DETECTED, handler)
    return () => ipcRenderer.removeListener(IPC_CHANNELS.MEETING_DETECTED, handler)
  },
  meetingDismiss: (appName: string) => ipcRenderer.send(IPC_CHANNELS.MEETING_DISMISS, appName),

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
