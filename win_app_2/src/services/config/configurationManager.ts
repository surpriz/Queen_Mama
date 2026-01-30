import type { AppConfig } from '@/types/config'
import { DEFAULT_CONFIG } from '@/types/config'

const STORE_KEY = 'app_config'

let cachedConfig: AppConfig | null = null

export const configurationManager = {
  async load(): Promise<AppConfig> {
    if (cachedConfig) return cachedConfig

    try {
      const stored = await window.electronAPI?.store.get(STORE_KEY)
      if (stored) {
        const parsed = typeof stored === 'string' ? JSON.parse(stored) : stored
        cachedConfig = { ...DEFAULT_CONFIG, ...parsed }
      } else {
        cachedConfig = { ...DEFAULT_CONFIG }
      }
    } catch {
      cachedConfig = { ...DEFAULT_CONFIG }
    }

    return cachedConfig!
  },

  async save(config: Partial<AppConfig>): Promise<void> {
    const current = await this.load()
    cachedConfig = { ...current, ...config }
    await window.electronAPI?.store.set(STORE_KEY, JSON.stringify(cachedConfig))
  },

  async get<K extends keyof AppConfig>(key: K): Promise<AppConfig[K]> {
    const config = await this.load()
    return config[key]
  },

  async set<K extends keyof AppConfig>(key: K, value: AppConfig[K]): Promise<void> {
    await this.save({ [key]: value } as Partial<AppConfig>)
  },

  async reset(): Promise<void> {
    cachedConfig = { ...DEFAULT_CONFIG }
    await window.electronAPI?.store.set(STORE_KEY, JSON.stringify(cachedConfig))
  },

  clearCache(): void {
    cachedConfig = null
  },
}
