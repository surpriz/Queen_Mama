export interface DeviceInfo {
  deviceId: string
  deviceName: string
  platform: string
  osVersion: string
  appVersion: string
}

export interface SecureStore {
  set: (key: string, value: string) => Promise<boolean>
  get: (key: string) => Promise<string | null>
  delete: (key: string) => Promise<boolean>
  has: (key: string) => Promise<boolean>
}

export interface SettingsStore {
  get: (key: string) => Promise<unknown>
  set: (key: string, value: unknown) => Promise<boolean>
  delete: (key: string) => Promise<boolean>
}

export interface QueryResult {
  rows: unknown[]
  changes?: number
  lastInsertRowid?: number | bigint
}

export interface DatabaseAPI {
  query: (sql: string, params?: unknown[]) => Promise<QueryResult>
  queryGet: (sql: string, params?: unknown[]) => Promise<unknown | undefined>
  queryAll: (sql: string, params?: unknown[]) => Promise<unknown[]>
  insert: (table: string, data: Record<string, unknown>) => Promise<QueryResult>
  update: (
    table: string,
    data: Record<string, unknown>,
    where: string,
    whereParams?: unknown[]
  ) => Promise<QueryResult>
  delete: (table: string, where: string, whereParams?: unknown[]) => Promise<QueryResult>
}

export type OverlayPosition =
  | 'topLeft'
  | 'topCenter'
  | 'topRight'
  | 'bottomLeft'
  | 'bottomCenter'
  | 'bottomRight'

export interface WindowAPI {
  minimize: () => void
  maximize: () => void
  close: () => void
  show: () => void
}

export interface OverlayAPI {
  toggle: () => void
  show: () => void
  hide: () => void
  setExpanded: (expanded: boolean) => void
  setPosition: (position: OverlayPosition) => void
}

export interface DeviceAPI {
  getId: () => Promise<string>
  getInfo: () => Promise<DeviceInfo>
}

export interface ScreenAPI {
  capture: () => Promise<string | null>
  getSources: () => Promise<Array<{ id: string; name: string; thumbnailDataUrl: string }>>
}

export interface AuthAPI {
  onProtocolCallback: (callback: (url: string) => void) => () => void
  startOAuthServer: () => Promise<{ success: boolean; port?: number; error?: string }>
  stopOAuthServer: () => Promise<{ success: boolean }>
}

export interface ElectronAPI {
  // App
  getVersion: () => Promise<string>
  getPath: (name: string) => Promise<string>
  openExternal: (url: string) => Promise<void>
  quit: () => void

  // Window (namespaced)
  window: WindowAPI
  // Window (flat - backward compat)
  windowMinimize: () => void
  windowMaximize: () => void
  windowClose: () => void

  // Overlay (namespaced)
  overlay: OverlayAPI
  // Overlay (flat - backward compat)
  overlayToggle: () => void
  overlayShow: () => void
  overlayHide: () => void
  overlaySetExpanded: (expanded: boolean) => void
  overlaySetPosition: (position: OverlayPosition) => void

  // Auth / OAuth
  auth: AuthAPI

  // Secure storage
  secureStore: SecureStore

  // Settings store
  store: SettingsStore

  // Database
  db: DatabaseAPI

  // Device (namespaced)
  device: DeviceAPI
  // Device (flat - backward compat)
  getDeviceId: () => Promise<string>
  getDeviceInfo: () => Promise<DeviceInfo>

  // Screen (namespaced)
  screen: ScreenAPI
  // Screen capture (flat - backward compat)
  getScreenSources: () => Promise<Array<{ id: string; name: string; thumbnailDataUrl: string }>>

  // Tray
  updateTrayIcon: (active: boolean) => void

  // Display affinity
  setDisplayAffinity: (exclude: boolean) => void

  // Updater
  checkForUpdates: () => Promise<void>

  // Event listeners
  onSessionToggle: (callback: () => void) => () => void
  onShortcutToggleWidget: (callback: () => void) => () => void
  onShortcutTriggerAssist: (callback: () => void) => () => void
  onShortcutClearContext: (callback: () => void) => () => void
  onShortcutMoveWidget: (callback: (direction: string) => void) => () => void
  onOverlayStateChanged: (callback: (state: unknown) => void) => () => void
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
