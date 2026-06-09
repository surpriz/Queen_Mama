import { useEffect, useSyncExternalStore } from 'react'
import {
  ensureProxyConfig,
  getProxyConfigSnapshot,
  refreshConfig,
  subscribeProxyConfig,
  type ProxyConfigSnapshot,
} from '@/services/proxy/proxyConfigManager'

/**
 * Reactive view over the proxy config. Triggers a fetch on mount if the config
 * isn't loaded yet (covers the boot race where config is skipped because auth
 * wasn't ready), and re-renders whenever the cached config changes.
 */
export function useProxyConfig(): ProxyConfigSnapshot & { refresh: () => void } {
  const snapshot = useSyncExternalStore(subscribeProxyConfig, getProxyConfigSnapshot)

  useEffect(() => {
    void ensureProxyConfig()
  }, [])

  return {
    ...snapshot,
    refresh: () => {
      void refreshConfig().catch(() => {})
    },
  }
}
