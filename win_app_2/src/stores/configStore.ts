import { create } from 'zustand'
import type { AppConfig } from '@/types/config'
import { DEFAULT_CONFIG } from '@/types/config'

interface ConfigStoreState extends AppConfig {
  // Actions
  updateConfig: (partial: Partial<AppConfig>) => void
  resetToDefaults: () => void
  loadFromStorage: () => Promise<void>
}

export const useConfigStore = create<ConfigStoreState>((set, get) => ({
  ...DEFAULT_CONFIG,

  updateConfig: (partial) => {
    set(partial)
    // Persist to electron-store
    Object.entries(partial).forEach(([key, value]) => {
      window.electronAPI?.store.set(`config.${key}`, value)
    })
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
    if (Object.keys(loaded).length > 0) {
      set(loaded)
    }
  },
}))
