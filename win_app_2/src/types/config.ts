import type { AIProviderType } from './models'

// Configuration settings types (ported from ConfigurationManager.swift)

export interface AppConfig {
  // General
  isUndetectabilityEnabled: boolean
  captureSystemAudio: boolean
  captureMicrophone: boolean
  autoScreenCapture: boolean
  screenCaptureIntervalSeconds: number
  showLiveTranscript: boolean
  smartModeEnabled: boolean
  selectedAIProvider: AIProviderType
  /**
   * User-selected AI model for standard (non-smart) responses. Defaults to "auto" — backend
   * cascade picks `gpt-5.4-mini` as primary. Other valid values mirror the whitelist in
   * `landing/lib/ai-providers.ts` USER_SELECTABLE_MODELS.
   */
  selectedAIModel: string
  primaryLanguage: string
  uiLanguage: string

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

  // Live Translation (DeepL via proxy)
  translationEnabled: boolean
  translationShowInOverlay: boolean
  /** DeepL source code or "auto" for auto-detect. */
  translationSourceLanguage: string
  /** DeepL target code (e.g. "EN-US", "FR"). */
  translationTargetLanguage: string
}

export const DEFAULT_CONFIG: AppConfig = {
  isUndetectabilityEnabled: false,
  captureSystemAudio: true,
  captureMicrophone: true,
  autoScreenCapture: true,
  screenCaptureIntervalSeconds: 5.0,
  showLiveTranscript: false,
  smartModeEnabled: false,
  selectedAIProvider: 'OpenAI' as AIProviderType,
  selectedAIModel: 'auto',
  primaryLanguage: 'multi',
  uiLanguage: 'en',

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

  translationEnabled: false,
  translationShowInOverlay: true,
  translationSourceLanguage: 'auto',
  translationTargetLanguage: 'EN-US',
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
    apiBaseUrl: 'https://staging.queenmama.co',
    webBaseUrl: 'https://staging.queenmama.co',
  },
  production: {
    name: 'production',
    apiBaseUrl: 'https://www.queenmama.co',
    webBaseUrl: 'https://www.queenmama.co',
  },
}

export function getCurrentEnvironment(): AppEnvironment {
  const env = import.meta.env.VITE_APP_ENV || 'production'
  return ENVIRONMENTS[env] || ENVIRONMENTS.production
}

// ----------------------------------------------------------------------------
// User-selectable AI model choices (parity with mac_app AIModelChoice).
// Raw value `auto` = backend default cascade (currently gpt-5.4-mini primary).
// Other raw values must match the whitelist in `landing/lib/ai-providers.ts`.
// ----------------------------------------------------------------------------

export interface AIModelOption {
  /** Raw value persisted in config (and sent to backend; `auto` is the no-override sentinel). */
  id: string
  /** i18n key suffix — looked up under `settings.general.aiModel.<key>` / `.<key>Subtitle`. */
  i18nKey: string
}

export const AI_MODEL_OPTIONS: AIModelOption[] = [
  { id: 'auto', i18nKey: 'auto' },
  { id: 'claude-sonnet-4-6', i18nKey: 'sonnet46' },
  { id: 'gpt-4o-mini', i18nKey: 'gpt4oMini' },
  { id: 'gpt-4.1-mini', i18nKey: 'gpt41Mini' },
]

/** Returns the value to send to the backend, or null for the default cascade. */
export function resolveBackendModel(selected: string | undefined): string | null {
  if (!selected || selected === 'auto') return null
  return AI_MODEL_OPTIONS.some((o) => o.id === selected) ? selected : null
}
