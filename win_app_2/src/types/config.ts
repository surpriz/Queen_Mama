import type { AIProviderType } from './models'

// Configuration settings types (ported from ConfigurationManager.swift)

export interface AppConfig {
  // General
  isUndetectabilityEnabled: boolean
  captureSystemAudio: boolean
  captureMicrophone: boolean
  autoScreenCapture: boolean
  screenCaptureIntervalSeconds: number
  smartModeEnabled: boolean
  selectedAIProvider: AIProviderType
  primaryLanguage: string

  // Auto-Answer
  autoAnswerEnabled: boolean
  autoAnswerSilenceThreshold: number
  autoAnswerCooldown: number
  autoAnswerResponseType: string

  // Proactive Suggestions (Enterprise)
  proactiveEnabled: boolean
  proactiveSensitivity: number
  proactiveCooldown: number
  proactiveObjectionsEnabled: boolean
  proactiveQuestionsEnabled: boolean
  proactiveHesitationsEnabled: boolean
  proactiveClosingEnabled: boolean

  // Keyboard Shortcuts
  shortcutToggleWidget: string
  shortcutAssist: string
  shortcutClearContext: string

  // Onboarding
  hasCompletedOnboarding: boolean
}

export const DEFAULT_CONFIG: AppConfig = {
  isUndetectabilityEnabled: false,
  captureSystemAudio: true,
  captureMicrophone: true,
  autoScreenCapture: true,
  screenCaptureIntervalSeconds: 5.0,
  smartModeEnabled: false,
  selectedAIProvider: 'OpenAI' as AIProviderType,
  primaryLanguage: 'en',

  autoAnswerEnabled: false,
  autoAnswerSilenceThreshold: 2.5,
  autoAnswerCooldown: 10.0,
  autoAnswerResponseType: 'assist',

  proactiveEnabled: false,
  proactiveSensitivity: 0.7,
  proactiveCooldown: 15,
  proactiveObjectionsEnabled: true,
  proactiveQuestionsEnabled: true,
  proactiveHesitationsEnabled: false,
  proactiveClosingEnabled: true,

  shortcutToggleWidget: 'ctrl+\\',
  shortcutAssist: 'ctrl+return',
  shortcutClearContext: 'ctrl+shift+r',

  hasCompletedOnboarding: false,
}

export interface AppEnvironment {
  name: 'development' | 'staging' | 'production'
  apiBaseUrl: string
  webBaseUrl: string
}

export const ENVIRONMENTS: Record<string, AppEnvironment> = {
  development: {
    name: 'development',
    apiBaseUrl: 'http://localhost:3000',
    webBaseUrl: 'http://localhost:3000',
  },
  staging: {
    name: 'staging',
    apiBaseUrl: 'https://staging.queenmama.ai',
    webBaseUrl: 'https://staging.queenmama.ai',
  },
  production: {
    name: 'production',
    apiBaseUrl: 'https://queenmama.ai',
    webBaseUrl: 'https://queenmama.ai',
  },
}

export function getCurrentEnvironment(): AppEnvironment {
  const env = import.meta.env.VITE_APP_ENV || 'production'
  return ENVIRONMENTS[env] || ENVIRONMENTS.production
}
