import type { AuthUser, AuthTokens } from '@/types/auth'

const KEYS = {
  accessToken: 'auth_access_token',
  refreshToken: 'auth_refresh_token',
  user: 'auth_user',
} as const

// Access token kept in memory for security
let memoryAccessToken: string | null = null

export const authTokenStore = {
  async getAccessToken(): Promise<string | null> {
    return memoryAccessToken
  },

  async setAccessToken(token: string): Promise<void> {
    memoryAccessToken = token
  },

  async clearAccessToken(): Promise<void> {
    memoryAccessToken = null
  },

  async getRefreshToken(): Promise<string | null> {
    try {
      const result = await window.electronAPI?.secureStore.get(KEYS.refreshToken)
      return result ?? null
    } catch {
      return null
    }
  },

  async setRefreshToken(token: string): Promise<void> {
    await window.electronAPI?.secureStore.set(KEYS.refreshToken, token)
  },

  async clearRefreshToken(): Promise<void> {
    await window.electronAPI?.secureStore.delete(KEYS.refreshToken)
  },

  async getTokens(): Promise<AuthTokens | null> {
    const accessToken = await this.getAccessToken()
    const refreshToken = await this.getRefreshToken()
    if (!accessToken || !refreshToken) return null
    return { accessToken, refreshToken }
  },

  async setTokens(tokens: AuthTokens): Promise<void> {
    await this.setAccessToken(tokens.accessToken)
    await this.setRefreshToken(tokens.refreshToken)
  },

  async clearTokens(): Promise<void> {
    await this.clearAccessToken()
    await this.clearRefreshToken()
  },

  async getUser(): Promise<AuthUser | null> {
    try {
      const json = await window.electronAPI?.store.get(KEYS.user)
      if (!json) return null
      return typeof json === 'string' ? JSON.parse(json) : json
    } catch {
      return null
    }
  },

  async setUser(user: AuthUser): Promise<void> {
    await window.electronAPI?.store.set(KEYS.user, JSON.stringify(user))
  },

  async clearUser(): Promise<void> {
    await window.electronAPI?.store.delete(KEYS.user)
  },

  async clearAll(): Promise<void> {
    await this.clearTokens()
    await this.clearUser()
  },
}
