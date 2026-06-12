import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { ProxyConfig } from '@/types/api'

vi.mock('./proxyApiClient', () => ({
  fetchConfig: vi.fn(),
}))

import { fetchConfig } from './proxyApiClient'
import * as mgr from './proxyConfigManager'

const fetchMock = vi.mocked(fetchConfig)

const CONFIG: ProxyConfig = {
  aiProviders: ['openai'],
  transcriptionProviders: ['deepgram'],
  features: {},
  limits: {},
  services: { translation: { enabled: true, provider: 'deepl', monthlyCharsLimit: 500000 } },
}

beforeEach(() => {
  vi.clearAllMocks()
  mgr.__resetProxyConfigForTests()
})

describe('proxyConfigManager', () => {
  it('defaults to disabled before any fetch', () => {
    expect(mgr.isTranslationEnabled()).toBe(false)
    expect(mgr.getProxyConfigSnapshot().status).toBe('idle')
  })

  it('ensureProxyConfig fetches once and caches', async () => {
    fetchMock.mockResolvedValue(CONFIG)
    await mgr.ensureProxyConfig()
    await mgr.ensureProxyConfig()
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(mgr.isTranslationEnabled()).toBe(true)
  })

  it('reflects translation disabled from backend', async () => {
    fetchMock.mockResolvedValue({
      ...CONFIG,
      services: { translation: { enabled: false, provider: null, monthlyCharsLimit: 0 } },
    })
    await mgr.ensureProxyConfig()
    expect(mgr.isTranslationEnabled()).toBe(false)
  })

  it('notifies subscribers and exposes a fresh snapshot on load', async () => {
    fetchMock.mockResolvedValue(CONFIG)
    const cb = vi.fn()
    const unsub = mgr.subscribeProxyConfig(cb)
    const before = mgr.getProxyConfigSnapshot()

    await mgr.getProxyConfig()

    expect(cb).toHaveBeenCalled()
    const after = mgr.getProxyConfigSnapshot()
    expect(after).not.toBe(before) // new reference for useSyncExternalStore
    expect(after.status).toBe('loaded')
    expect(after.config?.services?.translation?.enabled).toBe(true)
    unsub()
  })

  it('ensureProxyConfig swallows fetch errors and surfaces error status', async () => {
    fetchMock.mockRejectedValue(new Error('network down'))
    const result = await mgr.ensureProxyConfig()
    expect(result).toBeNull()
    expect(mgr.getProxyConfigSnapshot().status).toBe('error')
    expect(mgr.isTranslationEnabled()).toBe(false)
  })

  it('refreshConfig re-fetches even when cache is warm', async () => {
    fetchMock.mockResolvedValue(CONFIG)
    await mgr.ensureProxyConfig()
    await mgr.refreshConfig()
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})
