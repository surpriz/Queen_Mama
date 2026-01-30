// IPC Channel Constants
// All IPC communication between main and renderer uses these channel names

export const IPC_CHANNELS = {
  // Window management
  WINDOW_MINIMIZE: 'window:minimize',
  WINDOW_MAXIMIZE: 'window:maximize',
  WINDOW_CLOSE: 'window:close',
  WINDOW_SET_SIZE: 'window:set-size',
  WINDOW_SET_POSITION: 'window:set-position',

  // Overlay
  OVERLAY_TOGGLE: 'overlay:toggle',
  OVERLAY_SHOW: 'overlay:show',
  OVERLAY_HIDE: 'overlay:hide',
  OVERLAY_SET_EXPANDED: 'overlay:set-expanded',
  OVERLAY_SET_POSITION: 'overlay:set-position',
  OVERLAY_STATE_CHANGED: 'overlay:state-changed',

  // Session events (main → renderer)
  SESSION_START: 'session:start',
  SESSION_STOP: 'session:stop',
  SESSION_TOGGLE: 'session:toggle',

  // Keyboard shortcuts (main → renderer)
  SHORTCUT_TOGGLE_WIDGET: 'shortcut:toggle-widget',
  SHORTCUT_TRIGGER_ASSIST: 'shortcut:trigger-assist',
  SHORTCUT_CLEAR_CONTEXT: 'shortcut:clear-context',
  SHORTCUT_MOVE_WIDGET: 'shortcut:move-widget',

  // Secure storage
  SECURE_STORE_SET: 'secure-store:set',
  SECURE_STORE_GET: 'secure-store:get',
  SECURE_STORE_DELETE: 'secure-store:delete',
  SECURE_STORE_HAS: 'secure-store:has',

  // Screen capture
  SCREEN_GET_SOURCES: 'screen:get-sources',

  // Device info
  DEVICE_GET_ID: 'device:get-id',
  DEVICE_GET_INFO: 'device:get-info',

  // App info
  APP_GET_VERSION: 'app:get-version',
  APP_GET_PATH: 'app:get-path',
  APP_QUIT: 'app:quit',
  APP_OPEN_EXTERNAL: 'app:open-external',

  // Updater
  UPDATER_CHECK: 'updater:check',
  UPDATER_DOWNLOAD: 'updater:download',
  UPDATER_INSTALL: 'updater:install',
  UPDATER_STATUS: 'updater:status',

  // Tray
  TRAY_UPDATE_ICON: 'tray:update-icon',
  TRAY_ACTION: 'tray:action',

  // Store (electron-store for settings)
  STORE_GET: 'store:get',
  STORE_SET: 'store:set',
  STORE_DELETE: 'store:delete',

  // Display affinity (Windows undetectable overlay)
  DISPLAY_SET_AFFINITY: 'display:set-affinity',

  // Screen capture
  SCREEN_CAPTURE: 'screen:capture',

  // Cross-window relay (main ↔ overlay)
  RELAY_TO_OVERLAY: 'relay:to-overlay',
  RELAY_TO_MAIN: 'relay:to-main',
  RELAY_SESSION_STATE: 'relay:session-state',
  RELAY_TRANSCRIPT: 'relay:transcript',
  RELAY_AI_RESPONSE: 'relay:ai-response',
} as const

export type IPCChannel = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS]
