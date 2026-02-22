export interface AppEnvironment {
  name: 'development' | 'staging' | 'production'
  apiBaseUrl: string
  webBaseUrl: string
}

const ENVIRONMENTS: Record<string, AppEnvironment> = {
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

let currentEnv: AppEnvironment | null = null

export function getCurrentEnvironment(): AppEnvironment {
  if (currentEnv) return currentEnv
  const env = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_APP_ENV) || 'production'
  currentEnv = ENVIRONMENTS[env] || ENVIRONMENTS.production
  return currentEnv
}

export function getApiBaseUrl(): string {
  return getCurrentEnvironment().apiBaseUrl
}

export function getWebBaseUrl(): string {
  return getCurrentEnvironment().webBaseUrl
}
