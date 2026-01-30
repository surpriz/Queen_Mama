import { getApiBaseUrl, getEnvironment, setEnvironment, type AppEnvironmentType } from './appEnvironment'

export const urlConfigManager = {
  getBaseUrl(): string {
    return getApiBaseUrl()
  },

  getApiUrl(path: string): string {
    const base = getApiBaseUrl()
    const cleanPath = path.startsWith('/') ? path : `/${path}`
    return `${base}${cleanPath}`
  },

  getAuthUrl(endpoint: string): string {
    return this.getApiUrl(`/api/auth${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`)
  },

  getProxyUrl(endpoint: string): string {
    return this.getApiUrl(`/api/proxy${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`)
  },

  getSyncUrl(endpoint: string): string {
    return this.getApiUrl(`/api/sync${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`)
  },

  getCurrentEnvironment(): AppEnvironmentType {
    return getEnvironment()
  },

  setEnvironment(env: AppEnvironmentType): void {
    setEnvironment(env)
  },
}
