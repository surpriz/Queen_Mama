import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useLicenseStore } from '@/stores/licenseStore'
import { useAuthStore } from '@/stores/authStore'
import { FREE_LICENSE, Feature, SubscriptionPlan, SubscriptionStatus } from '@/types/auth'
import * as licenseManager from './licenseManager'

// Mock authApiClient
vi.mock('../auth/authApiClient', () => ({
  validateLicense: vi.fn(),
  recordUsage: vi.fn(),
}))

import * as authApi from '../auth/authApiClient'

const PRO_LICENSE = {
  valid: true,
  plan: SubscriptionPlan.Pro,
  status: SubscriptionStatus.Active,
  features: {
    smartModeEnabled: false,
    smartModeLimit: null,
    customModesEnabled: true,
    exportFormats: ['text', 'markdown', 'json'],
    autoAnswerEnabled: false,
    sessionSyncEnabled: true,
    dailyAiRequestLimit: 100,
    maxSyncedSessions: 1000,
    maxTranscriptSize: null,
    undetectableEnabled: false,
    screenshotEnabled: true,
    knowledgeBaseEnabled: false,
    proactiveSuggestionsEnabled: false,
  },
  trial: null,
  cacheTTL: 3600,
  validatedAt: new Date().toISOString(),
  signature: 'test-signature',
}

const ENTERPRISE_LICENSE = {
  ...PRO_LICENSE,
  plan: SubscriptionPlan.Enterprise,
  features: {
    ...PRO_LICENSE.features,
    smartModeEnabled: true,
    smartModeLimit: null,
    autoAnswerEnabled: true,
    undetectableEnabled: true,
    knowledgeBaseEnabled: true,
    proactiveSuggestionsEnabled: true,
  },
}

beforeEach(() => {
  // Reset stores
  useLicenseStore.setState({
    currentLicense: FREE_LICENSE,
    isValidating: false,
    isOffline: false,
    lastValidatedAt: null,
    smartModeUsedToday: 0,
    aiRequestsToday: 0,
  })

  useAuthStore.setState({
    authState: { type: 'unauthenticated' },
    isAuthenticated: false,
  })

  vi.clearAllMocks()
})

describe('licenseManager', () => {
  describe('revalidate', () => {
    it('should set FREE_LICENSE when not authenticated', async () => {
      await licenseManager.revalidate()

      const store = useLicenseStore.getState()
      expect(store.currentLicense.plan).toBe(SubscriptionPlan.Free)
    })

    it('should fetch and set license when authenticated', async () => {
      // Set authenticated state
      useAuthStore.setState({
        authState: {
          type: 'authenticated',
          user: { id: '1', email: 'test@test.com', name: 'Test', image: null, role: 'user' },
        },
        isAuthenticated: true,
      })

      vi.mocked(authApi.validateLicense).mockResolvedValue(PRO_LICENSE)

      await licenseManager.revalidate()

      const store = useLicenseStore.getState()
      expect(store.currentLicense.plan).toBe(SubscriptionPlan.Pro)
      expect(store.lastValidatedAt).toBeTruthy()
    })

    it('should set offline mode on network error', async () => {
      useAuthStore.setState({
        authState: {
          type: 'authenticated',
          user: { id: '1', email: 'test@test.com', name: 'Test', image: null, role: 'user' },
        },
        isAuthenticated: true,
      })

      vi.mocked(authApi.validateLicense).mockRejectedValue(new Error('Network error'))

      await licenseManager.revalidate()

      const store = useLicenseStore.getState()
      expect(store.isOffline).toBe(true)
    })
  })

  describe('recordUsage', () => {
    it('should record smartMode usage locally', async () => {
      await licenseManager.recordUsage('smartMode')

      const store = useLicenseStore.getState()
      expect(store.smartModeUsedToday).toBe(1)
    })

    it('should record aiRequest usage locally', async () => {
      await licenseManager.recordUsage('aiRequest')

      const store = useLicenseStore.getState()
      expect(store.aiRequestsToday).toBe(1)
    })

    it('should try to record to server', async () => {
      await licenseManager.recordUsage('smartMode', 'anthropic')

      expect(authApi.recordUsage).toHaveBeenCalledWith('smartMode', 'anthropic')
    })
  })
})

describe('licenseStore feature gating', () => {
  describe('canUse', () => {
    it('should allow sessionStart for free users', () => {
      const result = useLicenseStore.getState().canUse(Feature.SessionStart)
      expect(result.type).toBe('allowed')
    })

    it('should block smartMode for free users', () => {
      const result = useLicenseStore.getState().canUse(Feature.SmartMode)
      expect(result.type).toBe('requiresEnterprise')
    })

    it('should block customModes for free users', () => {
      const result = useLicenseStore.getState().canUse(Feature.CustomModes)
      expect(result.type).toBe('requiresPro')
    })

    it('should allow customModes for pro users', () => {
      useLicenseStore.setState({ currentLicense: PRO_LICENSE })

      const result = useLicenseStore.getState().canUse(Feature.CustomModes)
      expect(result.type).toBe('allowed')
    })

    it('should allow smartMode for enterprise users', () => {
      useLicenseStore.setState({ currentLicense: ENTERPRISE_LICENSE })

      const result = useLicenseStore.getState().canUse(Feature.SmartMode)
      expect(result.type).toBe('allowed')
    })

    it('should respect daily AI request limits', () => {
      useLicenseStore.setState({
        currentLicense: FREE_LICENSE,
        aiRequestsToday: 10, // At limit for free tier (10 requests/day)
      })

      const result = useLicenseStore.getState().canUse(Feature.AiRequest)
      expect(result.type).toBe('limitReached')
      if (result.type === 'limitReached') {
        expect(result.used).toBe(10)
        expect(result.limit).toBe(10)
      }
    })

    it('should allow AI requests under limit', () => {
      useLicenseStore.setState({
        currentLicense: FREE_LICENSE,
        aiRequestsToday: 0,
      })

      const result = useLicenseStore.getState().canUse(Feature.AiRequest)
      expect(result.type).toBe('allowed')
    })
  })

  describe('isPro', () => {
    it('should return false for free users', () => {
      expect(useLicenseStore.getState().isPro()).toBe(false)
    })

    it('should return true for pro users', () => {
      useLicenseStore.setState({ currentLicense: PRO_LICENSE })
      expect(useLicenseStore.getState().isPro()).toBe(true)
    })

    it('should return true for enterprise users', () => {
      useLicenseStore.setState({ currentLicense: ENTERPRISE_LICENSE })
      expect(useLicenseStore.getState().isPro()).toBe(true)
    })
  })

  describe('isEnterprise', () => {
    it('should return false for free users', () => {
      expect(useLicenseStore.getState().isEnterprise()).toBe(false)
    })

    it('should return false for pro users', () => {
      useLicenseStore.setState({ currentLicense: PRO_LICENSE })
      expect(useLicenseStore.getState().isEnterprise()).toBe(false)
    })

    it('should return true for enterprise users', () => {
      useLicenseStore.setState({ currentLicense: ENTERPRISE_LICENSE })
      expect(useLicenseStore.getState().isEnterprise()).toBe(true)
    })
  })
})
