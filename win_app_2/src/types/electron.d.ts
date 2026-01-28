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

export type OverlayPosition =
  | 'topLeft'
  | 'topCenter'
  | 'topRight'
  | 'bottomLeft'
  | 'bottomCenter'
  | 'bottomRight'

export interface ElectronAPI {
  // App
  getVersion: () => Promise<string>
  getPath: (name: string) => Promise<string>
  openExternal: (url: string) => Promise<void>
  quit: () => void

  // Window
  windowMinimize: () => void
  windowMaximize: () => void
  windowClose: () => void

  // Overlay
  overlayToggle: () => void
  overlayShow: () => void
  overlayHide: () => void
  overlaySetExpanded: (expanded: boolean) => void
  overlaySetPosition: (position: OverlayPosition) => void

  // Secure storage
  secureStore: SecureStore

  // Settings store
  store: SettingsStore

  // Device
  getDeviceId: () => Promise<string>
  getDeviceInfo: () => Promise<DeviceInfo>

  // Screen capture
  getScreenSources: () => Promise<Electron.DesktopCapturerSource[]>

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
