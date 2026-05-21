import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import type { AppConfig } from '@/types/config'
import { DEFAULT_CONFIG } from '@/types/config'
import i18n, { detectSystemLanguage } from '@/i18n'
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
    // Detect system language on first launch
    if (!loaded.uiLanguage) {
      const detected = detectSystemLanguage()
      loaded.uiLanguage = detected
      window.electronAPI?.store.set('config.uiLanguage', detected)
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
      // Sync i18next with stored UI language
      if (loaded.uiLanguage && i18n.language !== loaded.uiLanguage) {
        i18n.changeLanguage(loaded.uiLanguage)
      }
      // Sync tray with stored UI language
      if (loaded.uiLanguage) {
        window.electronAPI?.notifyLanguageChange?.(loaded.uiLanguage, getTrayStrings(loaded.uiLanguage))
      }
    }
  },
})))

// Reactive bridge: keep i18next in sync when uiLanguage changes
useConfigStore.subscribe(
  (state) => state.uiLanguage,
  (lang) => {
    if (lang && i18n.language !== lang) {
      i18n.changeLanguage(lang)
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
