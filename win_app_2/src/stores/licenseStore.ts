import { create } from 'zustand'
import type { License, Feature, FeatureAccess } from '@/types/auth'
import { FREE_LICENSE, SubscriptionPlan, SubscriptionStatus } from '@/types/auth'

interface LicenseStoreState {
  currentLicense: License
  isValidating: boolean
  isOffline: boolean
  lastValidatedAt: string | null
  smartModeUsedToday: number
  aiRequestsToday: number

  // Actions
  setLicense: (license: License) => void
  setValidating: (validating: boolean) => void
  setOffline: (offline: boolean) => void
  setLastValidatedAt: (date: string) => void
  recordSmartModeUsage: () => void
  recordAiRequestUsage: () => void
  resetUsage: () => void
  canUse: (feature: Feature) => FeatureAccess

  // Computed helpers
  isPro: () => boolean
  isEnterprise: () => boolean
  isFeatureAvailable: (feature: Feature) => boolean
}

export const useLicenseStore = create<LicenseStoreState>((set, get) => ({
  currentLicense: FREE_LICENSE,
  isValidating: false,
  isOffline: false,
  lastValidatedAt: null,
  smartModeUsedToday: 0,
  aiRequestsToday: 0,

  setLicense: (license) => set({ currentLicense: license }),
  setValidating: (validating) => set({ isValidating: validating }),
  setOffline: (offline) => set({ isOffline: offline }),
  setLastValidatedAt: (date) => set({ lastValidatedAt: date }),
  recordSmartModeUsage: () =>
    set((state) => ({ smartModeUsedToday: state.smartModeUsedToday + 1 })),
  recordAiRequestUsage: () =>
    set((state) => ({ aiRequestsToday: state.aiRequestsToday + 1 })),
  resetUsage: () => set({ smartModeUsedToday: 0, aiRequestsToday: 0 }),

  canUse: (feature: Feature): FeatureAccess => {
    const state = get()
    const features = state.currentLicense.features

    switch (feature) {
      case 'smartMode':
        if (!features.smartModeEnabled) return { type: 'requiresEnterprise' }
        if (features.smartModeLimit && state.smartModeUsedToday >= features.smartModeLimit) {
          return { type: 'limitReached', used: state.smartModeUsedToday, limit: features.smartModeLimit }
        }
        return { type: 'allowed' }

      case 'customModes':
        return features.customModesEnabled ? { type: 'allowed' } : { type: 'requiresPro' }

      case 'exportMarkdown':
        return features.exportFormats.includes('markdown') ? { type: 'allowed' } : { type: 'requiresPro' }

      case 'exportJson':
        return features.exportFormats.includes('json') ? { type: 'allowed' } : { type: 'requiresPro' }

      case 'autoAnswer':
        return features.autoAnswerEnabled ? { type: 'allowed' } : { type: 'requiresEnterprise' }

      case 'sessionSync':
        return features.sessionSyncEnabled ? { type: 'allowed' } : { type: 'requiresPro' }

      case 'aiRequest':
        if (features.dailyAiRequestLimit && state.aiRequestsToday >= features.dailyAiRequestLimit) {
          return { type: 'limitReached', used: state.aiRequestsToday, limit: features.dailyAiRequestLimit }
        }
        return { type: 'allowed' }

      case 'undetectable':
        return features.undetectableEnabled ? { type: 'allowed' } : { type: 'requiresEnterprise' }

      case 'screenshot':
        return features.screenshotEnabled ? { type: 'allowed' } : { type: 'requiresPro' }

      case 'sessionStart':
        return { type: 'allowed' }

      case 'knowledgeBase':
        return features.knowledgeBaseEnabled ? { type: 'allowed' } : { type: 'requiresEnterprise' }

      case 'proactiveSuggestions':
        return features.proactiveSuggestionsEnabled ? { type: 'allowed' } : { type: 'requiresEnterprise' }

      default:
        return { type: 'blocked' }
    }
  },

  isPro: () => {
    const { plan, status } = get().currentLicense
    return (
      (plan === SubscriptionPlan.Pro || plan === SubscriptionPlan.Enterprise) &&
      (status === SubscriptionStatus.Active || status === SubscriptionStatus.Trialing)
    )
  },

  isEnterprise: () => {
    const { plan, status } = get().currentLicense
    return (
      plan === SubscriptionPlan.Enterprise &&
      (status === SubscriptionStatus.Active || status === SubscriptionStatus.Trialing)
    )
  },

  isFeatureAvailable: (feature: Feature): boolean => {
    return get().canUse(feature).type === 'allowed'
  },
}))
