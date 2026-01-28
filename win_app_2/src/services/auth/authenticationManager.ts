import { createLogger } from '@/lib/logger'
import { useAuthStore } from '@/stores/authStore'
import * as authApi from './authApiClient'
import type { AuthUser, DeviceInfo } from '@/types/auth'

const log = createLogger('Auth')

let pollingInterval: ReturnType<typeof setInterval> | null = null

async function getDeviceInfo(): Promise<DeviceInfo> {
  const info = await window.electronAPI?.getDeviceInfo()
  return (
    info || {
      deviceId: 'unknown',
      deviceName: 'Unknown',
      platform: 'windows' as const,
      osVersion: 'Unknown',
      appVersion: '1.0.0',
    }
  )
}

async function storeTokens(
  accessToken: string,
  refreshToken: string,
  expiresIn: number,
  user: AuthUser,
): Promise<void> {
  authApi.setAccessToken(accessToken, expiresIn)
  await window.electronAPI?.secureStore.set('refresh_token', refreshToken)
  await window.electronAPI?.store.set('auth.user', JSON.stringify(user))
}

export async function checkExistingAuth(): Promise<void> {
  const store = useAuthStore.getState()

  const userJson = (await window.electronAPI?.store.get('auth.user')) as string | null
  const hasRefreshToken = await window.electronAPI?.secureStore.has('refresh_token')

  if (!userJson || !hasRefreshToken) {
    log.info('No stored credentials found')
    store.setUnauthenticated()
    return
  }

  const user: AuthUser = JSON.parse(userJson)
  log.info(`Found stored credentials for: ${user.email}`)

  try {
    const refreshToken = await window.electronAPI?.secureStore.get('refresh_token')
    if (!refreshToken) {
      store.setUnauthenticated()
      return
    }

    const response = await authApi.refreshTokens(refreshToken)
    authApi.setAccessToken(response.accessToken, response.expiresIn)
    await window.electronAPI?.secureStore.set('refresh_token', response.refreshToken)

    store.setAuthenticated(user)
    log.info(`Authentication restored for: ${user.email}`)
  } catch (error) {
    const errorStr = String(error).toLowerCase()
    const isAuthRejection =
      errorStr.includes('invalid_token') ||
      errorStr.includes('token_revoked') ||
      errorStr.includes('401') ||
      errorStr.includes('403')

    if (isAuthRejection) {
      log.warn('Server rejected credentials, clearing')
      await clearCredentials()
      store.setUnauthenticated()
    } else {
      // Network error - keep credentials (offline mode)
      log.warn('Network error during auth check, keeping credentials')
      store.setAuthenticated(user)
    }
  }
}

export async function loginWithCredentials(email: string, password: string): Promise<void> {
  const store = useAuthStore.getState()
  store.setAuthenticating()

  try {
    const deviceInfo = await getDeviceInfo()
    const response = await authApi.login(email, password, deviceInfo)

    await storeTokens(response.accessToken, response.refreshToken, response.expiresIn, response.user)
    store.setAuthenticated(response.user)
  } catch (error) {
    store.setError(error instanceof Error ? error.message : 'Login failed')
    throw error
  }
}

export async function registerWithCredentials(
  name: string,
  email: string,
  password: string,
): Promise<void> {
  const store = useAuthStore.getState()
  store.setAuthenticating()

  try {
    const deviceInfo = await getDeviceInfo()
    const response = await authApi.register(name, email, password, deviceInfo)

    await storeTokens(response.accessToken, response.refreshToken, response.expiresIn, response.user)
    store.setAuthenticated(response.user)
  } catch (error) {
    store.setError(error instanceof Error ? error.message : 'Registration failed')
    throw error
  }
}

export async function startDeviceCodeFlow(): Promise<{
  userCode: string
  verificationUri: string
}> {
  const store = useAuthStore.getState()
  store.setAuthenticating()

  try {
    const deviceInfo = await getDeviceInfo()
    const response = await authApi.requestDeviceCode(deviceInfo)

    const expiresAt = new Date(Date.now() + response.expiresIn * 1000).toISOString()
    store.setDeviceCodePending(response.userCode, response.deviceCode, expiresAt)

    // Start polling
    startPolling(response.deviceCode, response.expiresIn)

    return {
      userCode: response.userCode,
      verificationUri: response.verificationUri,
    }
  } catch (error) {
    store.setError(error instanceof Error ? error.message : 'Device code flow failed')
    throw error
  }
}

function startPolling(deviceCode: string, expiresIn: number): void {
  cancelDeviceCodeFlow()

  const expiresAt = Date.now() + expiresIn * 1000

  pollingInterval = setInterval(async () => {
    if (Date.now() > expiresAt) {
      cancelDeviceCodeFlow()
      useAuthStore.getState().setError('Device code expired. Please try again.')
      return
    }

    try {
      const response = await authApi.pollDeviceCode(deviceCode)

      if (response.accessToken && response.refreshToken && response.user && response.expiresIn) {
        cancelDeviceCodeFlow()
        await storeTokens(
          response.accessToken,
          response.refreshToken,
          response.expiresIn,
          response.user,
        )
        useAuthStore.getState().setAuthenticated(response.user)
        return
      }

      if (response.error && response.error !== 'authorization_pending') {
        cancelDeviceCodeFlow()
        useAuthStore.getState().setError(response.message || response.error)
      }
    } catch {
      // Ignore network errors during polling
    }
  }, 5000)
}

export function cancelDeviceCodeFlow(): void {
  if (pollingInterval) {
    clearInterval(pollingInterval)
    pollingInterval = null
  }
}

export async function loginWithGoogle(): Promise<void> {
  const store = useAuthStore.getState()
  store.setAuthenticating()

  try {
    // Open Google OAuth in system browser
    const webBaseUrl = 'https://queenmama.ai'
    const loginUrl = `${webBaseUrl}/auth/google?redirect=queenmama://auth/callback`
    await window.electronAPI?.openExternal(loginUrl)

    // The callback will be handled by custom protocol handler
    // For now, fall back to device code flow
    log.info('Google OAuth opened in browser')
  } catch (error) {
    store.setError(error instanceof Error ? error.message : 'Google login failed')
    throw error
  }
}

export async function logoutUser(allDevices: boolean = false): Promise<void> {
  const store = useAuthStore.getState()
  cancelDeviceCodeFlow()

  try {
    const refreshToken = await window.electronAPI?.secureStore.get('refresh_token')
    await authApi.logout(refreshToken, allDevices)
  } catch {
    log.warn('Logout API call failed, continuing with local logout')
  }

  await clearCredentials()
  store.logout()
}

async function clearCredentials(): Promise<void> {
  authApi.clearTokens()
  await window.electronAPI?.secureStore.delete('refresh_token')
  await window.electronAPI?.store.delete('auth.user')
}

export async function getAccessToken(): Promise<string> {
  const token = await authApi.getValidAccessToken()
  if (!token) throw new Error('Not authenticated')
  return token
}
