import { create } from 'zustand'
import { captureError } from '@/services/crash/crashReporter'

function reportOnboardingError(operation: string, e: unknown): void {
  const err = e instanceof Error ? e : new Error(String(e))
  captureError(err, { source: 'onboarding_store', operation })
}

export type OnboardingStep = 'welcome' | 'permissions' | 'account' | 'tour' | 'ready'

interface OnboardingState {
  currentStep: OnboardingStep
  hasCompletedOnboarding: boolean

  // Actions
  setCurrentStep: (step: OnboardingStep) => void
  nextStep: () => void
  previousStep: () => void
  skipOnboarding: () => void
  completeOnboarding: () => void
  resetOnboarding: () => void
  loadOnboardingState: () => void
}

const ONBOARDING_STEPS: OnboardingStep[] = ['welcome', 'permissions', 'account', 'tour', 'ready']

const STORAGE_KEY = 'has_completed_onboarding'

export const useOnboardingStore = create<OnboardingState>((set, get) => ({
  currentStep: 'welcome',
  hasCompletedOnboarding: false,

  setCurrentStep: (step) => set({ currentStep: step }),

  nextStep: () => {
    const { currentStep } = get()
    const currentIndex = ONBOARDING_STEPS.indexOf(currentStep)
    if (currentIndex < ONBOARDING_STEPS.length - 1) {
      set({ currentStep: ONBOARDING_STEPS[currentIndex + 1] })
    }
  },

  previousStep: () => {
    const { currentStep } = get()
    const currentIndex = ONBOARDING_STEPS.indexOf(currentStep)
    if (currentIndex > 0) {
      set({ currentStep: ONBOARDING_STEPS[currentIndex - 1] })
    }
  },

  skipOnboarding: async () => {
    try {
      await window.electronAPI?.store.set(STORAGE_KEY, true)
    } catch (e) {
      console.error('[Onboarding] Failed to persist skip state:', e)
      reportOnboardingError('persist_skip', e)
    }
    set({ currentStep: 'ready', hasCompletedOnboarding: true })
  },

  completeOnboarding: async () => {
    try {
      await window.electronAPI?.store.set(STORAGE_KEY, true)
    } catch (e) {
      console.error('[Onboarding] Failed to persist completion state:', e)
      reportOnboardingError('persist_completion', e)
    }
    set({ hasCompletedOnboarding: true })
  },

  resetOnboarding: async () => {
    try {
      await window.electronAPI?.store.set(STORAGE_KEY, false)
    } catch (e) {
      console.error('[Onboarding] Failed to reset completion state:', e)
      reportOnboardingError('reset_completion', e)
    }
    set({ currentStep: 'welcome', hasCompletedOnboarding: false })
  },

  loadOnboardingState: async () => {
    try {
      const completed = await window.electronAPI?.store.get(STORAGE_KEY)
      if (completed === true) {
        set({ hasCompletedOnboarding: true })
      }
    } catch (e) {
      console.error('[Onboarding] Failed to load completion state:', e)
      reportOnboardingError('load_completion', e)
    }
  },
}))
