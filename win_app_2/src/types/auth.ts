// Auth types ported from mac_app/Services/Auth/

export type AuthState =
  | { type: 'unknown' }
  | { type: 'unauthenticated' }
  | { type: 'authenticating' }
  | { type: 'authenticated'; user: AuthUser }
  | {
      type: 'deviceCodePending'
      userCode: string
      deviceCode: string
      expiresAt: string
    }
  | { type: 'error'; message: string }

export interface AuthUser {
  id: string
  email: string
  name: string | null
  image: string | null
  role: string
}

export interface AuthTokens {
  accessToken: string
  refreshToken: string
  expiresIn: number
}

export interface DeviceInfo {
  deviceId: string
  deviceName: string
  platform: 'windows'
  osVersion: string
  appVersion: string
}

export interface DeviceCodeResponse {
  deviceCode: string
  userCode: string
  verificationUri: string
  expiresIn: number
  interval: number
}

export interface DeviceCodePollResponse {
  accessToken?: string
  refreshToken?: string
  expiresIn?: number
  user?: AuthUser
  error?: string
  message?: string
}

export interface LoginResponse {
  accessToken: string
  refreshToken: string
  expiresIn: number
  user: AuthUser
  isNewUser?: boolean
}

export interface RefreshResponse {
  accessToken: string
  refreshToken: string
  expiresIn: number
}

export interface EmailCheckResponse {
  exists: boolean
  authMethod?: 'credentials' | 'google' | 'both'
}

export interface License {
  valid: boolean
  plan: SubscriptionPlan
  status: SubscriptionStatus
  features: LicenseFeatures
  trial: TrialInfo | null
  cacheTTL: number
  validatedAt: string
  signature: string
  usage?: UsageInfo
}

export enum SubscriptionPlan {
  Free = 'free',
  Pro = 'pro',
  Enterprise = 'enterprise',
}

export enum SubscriptionStatus {
  Active = 'active',
  Trialing = 'trialing',
  PastDue = 'past_due',
  Canceled = 'canceled',
  Inactive = 'inactive',
}

export interface LicenseFeatures {
  smartModeEnabled: boolean
  smartModeLimit: number | null
  customModesEnabled: boolean
  exportFormats: string[]
  autoAnswerEnabled: boolean
  sessionSyncEnabled: boolean
  dailyAiRequestLimit: number | null
  maxSyncedSessions: number | null
  maxTranscriptSize: number | null
  undetectableEnabled: boolean
  screenshotEnabled: boolean
  knowledgeBaseEnabled: boolean
  proactiveSuggestionsEnabled: boolean
}

export interface TrialInfo {
  isActive: boolean
  daysRemaining: number
  endsAt: string
}

export interface UsageInfo {
  smartModeUsedToday: number
  aiRequestsToday: number
}

export enum Feature {
  SmartMode = 'smartMode',
  CustomModes = 'customModes',
  ExportMarkdown = 'exportMarkdown',
  ExportJson = 'exportJson',
  AutoAnswer = 'autoAnswer',
  SessionSync = 'sessionSync',
  AiRequest = 'aiRequest',
  Undetectable = 'undetectable',
  Screenshot = 'screenshot',
  SessionStart = 'sessionStart',
  KnowledgeBase = 'knowledgeBase',
  ProactiveSuggestions = 'proactiveSuggestions',
}

export type FeatureAccess =
  | { type: 'allowed' }
  | { type: 'blocked' }
  | { type: 'requiresAuth' }
  | { type: 'requiresPro' }
  | { type: 'requiresEnterprise' }
  | { type: 'limitReached'; used: number; limit: number }

export const FREE_LICENSE: License = {
  valid: true,
  plan: SubscriptionPlan.Free,
  status: SubscriptionStatus.Active,
  features: {
    smartModeEnabled: false,
    smartModeLimit: null,
    customModesEnabled: false,
    exportFormats: ['text'],
    autoAnswerEnabled: false,
    sessionSyncEnabled: false,
    dailyAiRequestLimit: 10,
    maxSyncedSessions: null,
    maxTranscriptSize: null,
    undetectableEnabled: false,
    screenshotEnabled: false,
    knowledgeBaseEnabled: false,
    proactiveSuggestionsEnabled: false,
  },
  trial: null,
  cacheTTL: 3600,
  validatedAt: new Date().toISOString(),
  signature: '',
}
