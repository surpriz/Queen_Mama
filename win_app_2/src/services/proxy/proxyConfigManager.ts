import { fetchConfig } from './proxyApiClient'
import { createLogger } from '@/lib/logger'
import type { ProxyConfig } from '@/types/api'

const log = createLogger('ProxyConfig')

let cachedConfig: ProxyConfig | null = null
let cacheExpiry: number = 0
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

export async function getProxyConfig(): Promise<ProxyConfig> {
  if (cachedConfig && Date.now() < cacheExpiry) {
    return cachedConfig
  }

  try {
    cachedConfig = await fetchConfig()
    cacheExpiry = Date.now() + CACHE_TTL
    log.info('Proxy config loaded', {
      aiProviders: cachedConfig.aiProviders,
      transcriptionProviders: cachedConfig.transcriptionProviders,
    })
    return cachedConfig
  } catch (error) {
    log.error('Failed to load proxy config', error)
    if (cachedConfig) return cachedConfig
    throw error
  }
}

export async function refreshConfig(): Promise<ProxyConfig> {
  cacheExpiry = 0 // Invalidate cache
  return getProxyConfig()
}

export function isTranscriptionEnabled(): boolean {
  return (cachedConfig?.transcriptionProviders.length ?? 0) > 0
}

export function isAIEnabled(): boolean {
  return (cachedConfig?.aiProviders.length ?? 0) > 0
}

export function getAvailableAIProviders(): string[] {
  return cachedConfig?.aiProviders ?? []
}

export function getAvailableTranscriptionProviders(): string[] {
  return cachedConfig?.transcriptionProviders ?? []
}
