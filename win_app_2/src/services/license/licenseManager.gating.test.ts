import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useLicenseStore, todayKey } from '@/stores/licenseStore'
import { useAuthStore } from '@/stores/authStore'
import { FREE_LICENSE, SubscriptionPlan, SubscriptionStatus, type AuthUser } from '@/types/auth'

vi.mock('../auth/authApiClient', () => ({
  validateLicense: vi.fn(),
  recordUsage: vi.fn(),
}))

import * as authApi from '../auth/authApiClient'
import * as licenseManager from './licenseManager'

const PRO = { ...FREE_LICENSE, plan: SubscriptionPlan.Pro, status: SubscriptionStatus.Active }

describe('licenseManager daily usage reset + cache grace', () => {
  const storeSet = vi.fn().mockResolvedValue(undefined)

  beforeEach(() => {
    vi.mocked(authApi.validateLicense).mockReset()
    storeSet.mockClear()
    const api = (window as unknown as { electronAPI: Record<string, unknown> }).electronAPI
    api.store = { get: vi.fn().mockResolvedValue(null), set: storeSet, delete: vi.fn() }
    api.relay = { broadcast: vi.fn(), toMain: vi.fn(), toOverlay: vi.fn() }
    useAuthStore.getState().setAuthenticated({ id: 'u1', email: 'a@b.c' } as AuthUser)
    useLicenseStore.setState({ currentLicense: FREE_LICENSE, smartModeUsedToday: 3, aiRequestsToday: 7, usageDay: '2000-01-01', lastValidatedAt: null, isValidating: false })
  })

  it('resets the daily counters when the day changes', () => {
    licenseManager.ensureUsageDay()
    const s = useLicenseStore.getState()
    expect(s.smartModeUsedToday).toBe(0)
    expect(s.aiRequestsToday).toBe(0)
    expect(s.usageDay).toBe(todayKey())
  })

  it('keeps counters within the same day', () => {
    useLicenseStore.setState({ usageDay: todayKey(), aiRequestsToday: 7 })
    licenseManager.ensureUsageDay()
    expect(useLicenseStore.getState().aiRequestsToday).toBe(7)
  })

  it('caches PRO licenses for 7 days and FREE for 1 day', async () => {
    const day = 24 * 60 * 60 * 1000
    expect(licenseManager.cacheGraceDays(SubscriptionPlan.Pro)).toBe(7)
    expect(licenseManager.cacheGraceDays(SubscriptionPlan.Enterprise)).toBe(7)
    expect(licenseManager.cacheGraceDays(SubscriptionPlan.Free)).toBe(1)

    vi.mocked(authApi.validateLicense).mockResolvedValue(PRO)
    const before = Date.now()
    await licenseManager.revalidate()
    const expiryCall = storeSet.mock.calls.find((c) => c[0] === 'cached_license_expiry')
    expect(expiryCall).toBeDefined()
    const expiry = expiryCall![1] as number
    expect(expiry - before).toBeGreaterThanOrEqual(7 * day - 1000)
    expect(expiry - before).toBeLessThanOrEqual(7 * day + 60_000)
  })
})
