import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useLicenseStore } from '@/stores/licenseStore'
import { useAuthStore } from '@/stores/authStore'
import { FREE_LICENSE, SubscriptionPlan, SubscriptionStatus } from '@/types/auth'
import type { AuthUser } from '@/types/auth'

vi.mock('../auth/authApiClient', () => ({
  validateLicense: vi.fn(),
  recordUsage: vi.fn(),
}))

import * as authApi from '../auth/authApiClient'
import * as licenseManager from './licenseManager'

const PRO_LICENSE = {
  ...FREE_LICENSE,
  plan: SubscriptionPlan.Pro,
  status: SubscriptionStatus.Active,
}

describe('licenseManager relay behaviour', () => {
  const broadcast = vi.fn()

  beforeEach(() => {
    broadcast.mockClear()
    vi.mocked(authApi.validateLicense).mockReset()
    const api = (window as unknown as { electronAPI: Record<string, unknown> }).electronAPI
    api.relay = { broadcast, toMain: vi.fn(), toOverlay: vi.fn() }
    ;(api.store as { get: ReturnType<typeof vi.fn> }).get.mockResolvedValue(null)
    useAuthStore.getState().setAuthenticated({ id: 'u1', email: 'a@b.c' } as AuthUser)
    useLicenseStore.setState({ currentLicense: PRO_LICENSE, lastValidatedAt: null, isValidating: false })
  })

  it('broadcasts the fallback state when validation fails (no silent divergence)', async () => {
    vi.mocked(authApi.validateLicense).mockRejectedValue(new Error('network'))

    await licenseManager.revalidate()

    expect(useLicenseStore.getState().isOffline).toBe(true)
    expect(broadcast).toHaveBeenCalledWith(
      'relay:license',
      expect.objectContaining({ license: expect.any(Object), isOffline: true }),
    )
  })

  it('revalidateIfStale skips when validated recently and runs when stale', async () => {
    vi.mocked(authApi.validateLicense).mockResolvedValue(PRO_LICENSE)

    useLicenseStore.setState({ lastValidatedAt: new Date().toISOString() })
    await licenseManager.revalidateIfStale()
    expect(authApi.validateLicense).not.toHaveBeenCalled()

    useLicenseStore.setState({ lastValidatedAt: new Date(Date.now() - 10 * 60 * 1000).toISOString() })
    await licenseManager.revalidateIfStale()
    expect(authApi.validateLicense).toHaveBeenCalledTimes(1)
  })
})
