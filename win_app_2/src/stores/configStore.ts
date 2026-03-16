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
    if (Object.keys(loaded).length > 0) {
      set(loaded)
      // Restore content protection state on startup
      if (loaded.isUndetectabilityEnabled) {
        window.electronAPI?.setDisplayAffinity(true)
      }
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
