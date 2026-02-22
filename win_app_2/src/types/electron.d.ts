export interface DeviceInfo {
  deviceId: string
  deviceName: string
  platform: 'windows' | 'macos' | 'linux' | string
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
  walCheckpoint: () => Promise<{ success: boolean }>
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
  setSize: (width: number, height: number) => void
  getBounds: () => Promise<{ x: number; y: number; width: number; height: number } | null>
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

export interface DialogAPI {
  openFile: () => Promise<{ canceled: boolean; filePaths: string[] }>
  showSaveDialog: (options: {
    title?: string
    defaultPath?: string
    filters?: Array<{ name: string; extensions: string[] }>
  }) => Promise<{ canceled: boolean; filePath?: string }>
}

export interface FileAPI {
  readText: (filePath: string) => Promise<string | null>
  writeFile: (filePath: string, content: string) => Promise<void>
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

  // Dialog / File
  dialog: DialogAPI
  file: FileAPI
  fs: FileAPI

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

  // Cross-window relay
  relay: {
    toOverlay: (channel: string, data: unknown) => void
    toMain: (channel: string, data: unknown) => void
    broadcast: (channel: string, data: unknown) => void
  }

  // Cross-window sync listeners
  onTranscriptSync: (callback: (data: { transcript: string; interim: string; audioLevel: number; isSessionActive: boolean; sessionStartedAt: number | null }) => void) => () => void
  onSessionStateSync: (callback: (data: { isSessionActive: boolean; sessionStartedAt: number | null; isFinalizingSession?: boolean; sessionFinalized?: boolean }) => void) => () => void
  onAudioLevelSync: (callback: (data: { audioLevel: number }) => void) => () => void
  onAIResponseSync: (callback: (data: { type: 'streaming' | 'history'; streamingContent?: string; entry?: { type: string; content: string; timestamp: string } }) => void) => () => void

  // Meeting detection
  onMeetingDetected: (callback: (data: { appName: string }) => void) => () => void
  meetingDismiss: (appName: string) => void

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
