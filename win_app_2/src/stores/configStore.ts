import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import type { AppConfig } from '@/types/config'
import { DEFAULT_CONFIG } from '@/types/config'
import i18n, { resolveUiLanguage, SYSTEM_LANGUAGE } from '@/i18n'
import { getTrayStrings } from '@/i18n/trayTranslations'

interface ConfigStoreState extends AppConfig {
  // Actions
  updateConfig: (partial: Partial<AppConfig>) => void
  resetToDefaults: () => void
  loadFromStorage: () => Promise<void>
}

export const useConfigStore = create<ConfigStoreState>()(subscribeWithSelector((set) => ({
  ...DEFAULT_CONFIG,

  updateConfig: (partial) => {
    set(partial)
    // Persist to electron-store
    Object.entries(partial).forEach(([key, value]) => {
      window.electronAPI?.store.set(`config.${key}`, value)
    })
    // Wire content protection to main process when undetectability changes
    if ('isUndetectabilityEnabled' in partial) {
      window.electronAPI?.setDisplayAffinity(!!partial.isUndetectabilityEnabled)
    }
    if ('meetingDetectionEnabled' in partial) {
      window.electronAPI?.setMeetingMonitoring?.(partial.meetingDetectionEnabled !== false)
    }
    if ('autoCheckUpdates' in partial || 'autoDownloadUpdates' in partial) {
      const next = { ...useConfigStore.getState(), ...partial }
      window.electronAPI?.setUpdaterPrefs?.({ autoCheck: next.autoCheckUpdates, autoDownload: next.autoDownloadUpdates })
    }
    if ('uiLanguage' in partial && partial.uiLanguage) {
      const resolved = resolveUiLanguage(partial.uiLanguage)
      if (i18n.language !== resolved) i18n.changeLanguage(resolved)
      window.electronAPI?.notifyLanguageChange?.(resolved, getTrayStrings(resolved))
    }
    // Broadcast partial config to other windows (dashboard <-> overlay) so each
    // window's Zustand instance stays in sync without a restart.
    window.electronAPI?.relay?.broadcast('relay:config', partial as Record<string, unknown>)
  },

  resetToDefaults: () => {
    set(DEFAULT_CONFIG)
    Object.entries(DEFAULT_CONFIG).forEach(([key, value]) => {
      window.electronAPI?.store.set(`config.${key}`, value)
    })
  },

  loadFromStorage: async () => {
    const loaded: Partial<AppConfig> = {}
    for (const key of Object.keys(DEFAULT_CONFIG) as (keyof AppConfig)[]) {
      const value = await window.electronAPI?.store.get(`config.${key}`)
      if (value !== undefined && value !== null) {
        ;(loaded as Record<string, unknown>)[key] = value
      }
    }
    // Follow the OS language until the user picks one ('system', mac parity)
    if (!loaded.uiLanguage) {
      loaded.uiLanguage = SYSTEM_LANGUAGE
      window.electronAPI?.store.set('config.uiLanguage', SYSTEM_LANGUAGE)
    }
    // Migration: force auto-detect for all users (replaces fixed language setting)
    if (loaded.primaryLanguage && loaded.primaryLanguage !== 'multi') {
      loaded.primaryLanguage = 'multi'
      window.electronAPI?.store.set('config.primaryLanguage', 'multi')
    }
    if (Object.keys(loaded).length > 0) {
      set(loaded)
      // Always sync content protection state on startup so disabling invisibility
      // actually reverses the main-process protection set at window creation.
      window.electronAPI?.setDisplayAffinity(!!loaded.isUndetectabilityEnabled)
      // Sync i18next + tray with the resolved UI language
      const resolved = resolveUiLanguage(loaded.uiLanguage)
      if (i18n.language !== resolved) {
        i18n.changeLanguage(resolved)
      }
      window.electronAPI?.notifyLanguageChange?.(resolved, getTrayStrings(resolved))
    }
  },
})))

// Reactive bridge: keep i18next in sync when uiLanguage changes
useConfigStore.subscribe(
  (state) => state.uiLanguage,
  (lang) => {
    const resolved = resolveUiLanguage(lang)
    if (i18n.language !== resolved) {
      i18n.changeLanguage(resolved)
    }
  },
)

// Receive config updates broadcast from the other window. Apply directly via
// setState so we don't re-broadcast or re-persist (avoids feedback loops).
if (typeof window !== 'undefined' && window.electronAPI?.onConfigSync) {
  window.electronAPI.onConfigSync((partial) => {
    useConfigStore.setState(partial as Partial<ConfigStoreState>)
  })
}
