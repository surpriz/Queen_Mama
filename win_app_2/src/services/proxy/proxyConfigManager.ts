import { fetchConfig } from './proxyApiClient'
import { createLogger } from '@/lib/logger'
import type { ProxyConfig } from '@/types/api'

const log = createLogger('ProxyConfig')

let cachedConfig: ProxyConfig | null = null
let cacheExpiry: number = 0
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

export type ProxyConfigStatus = 'idle' | 'loading' | 'loaded' | 'error'

// Reactive snapshot for UI (consumed via useSyncExternalStore). Rebuilt on every
// state change so React sees a new reference.
export interface ProxyConfigSnapshot {
  config: ProxyConfig | null
  status: ProxyConfigStatus
  error: string | null
}

let snapshot: ProxyConfigSnapshot = { config: null, status: 'idle', error: null }
const listeners = new Set<() => void>()

function emit(next: Partial<ProxyConfigSnapshot>): void {
  snapshot = { ...snapshot, ...next }
  listeners.forEach((l) => l())
}

export function subscribeProxyConfig(cb: () => void): () => void {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

export function getProxyConfigSnapshot(): ProxyConfigSnapshot {
  return snapshot
}

export async function getProxyConfig(): Promise<ProxyConfig> {
  if (cachedConfig && Date.now() < cacheExpiry) {
    return cachedConfig
  }

  emit({ status: 'loading' })
  try {
    cachedConfig = await fetchConfig()
    cacheExpiry = Date.now() + CACHE_TTL
    log.info('Proxy config loaded', {
      aiProviders: cachedConfig.aiProviders,
      transcriptionProviders: cachedConfig.transcriptionProviders,
    })
    emit({ config: cachedConfig, status: 'loaded', error: null })
    return cachedConfig
  } catch (error) {
    log.error('Failed to load proxy config', error)
    emit({ status: 'error', error: error instanceof Error ? error.message : 'unknown' })
    if (cachedConfig) return cachedConfig
    throw error
  }
}

/**
 * Fetch the config only if we don't already have a fresh copy. Safe to call from
 * UI mounts and auth-change handlers — cheap when the cache is warm.
 */
export async function ensureProxyConfig(): Promise<ProxyConfig | null> {
  if (cachedConfig && Date.now() < cacheExpiry) return cachedConfig
  try {
    return await getProxyConfig()
  } catch {
    return null
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

export function isTranslationEnabled(): boolean {
  return cachedConfig?.services?.translation?.enabled ?? false
}

export function getTranslationProvider(): string | null {
  return cachedConfig?.services?.translation?.provider ?? null
}

/** Test-only: reset module state between specs. */
export function __resetProxyConfigForTests(): void {
  cachedConfig = null
  cacheExpiry = 0
  snapshot = { config: null, status: 'idle', error: null }
  listeners.clear()
}
