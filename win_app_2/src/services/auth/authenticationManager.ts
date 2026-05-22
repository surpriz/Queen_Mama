import { createLogger } from '@/lib/logger'
import { captureError, addBreadcrumb, setUser as setSentryUser, clearUser as clearSentryUser } from '@/services/crash/crashReporter'
import { useAuthStore } from '@/stores/authStore'
import * as authApi from './authApiClient'
import { setOnSessionExpired } from './authApiClient'
import { startGoogleAuth } from './googleAuthService'
import * as licenseManager from '@/services/license/licenseManager'
import type { AuthUser, DeviceInfo } from '@/types/auth'

const log = createLogger('Auth')

// Wire mid-session expiration detection at module level
setOnSessionExpired(() => useAuthStore.getState().setSessionExpired())

let pollingInterval: ReturnType<typeof setInterval> | null = null

// Fallback device ID - persisted in memory for consistency across the session
let fallbackDeviceId: string | null = null

function getFallbackDeviceId(): string {
  if (!fallbackDeviceId) {
    fallbackDeviceId = crypto.randomUUID()
  }
  return fallbackDeviceId
}

async function getDeviceInfo(): Promise<DeviceInfo> {
  const info = await window.electronAPI?.getDeviceInfo()
  return (
    info || {
      deviceId: getFallbackDeviceId(),
      deviceName: 'Unknown',
      platform: 'windows' as const,
      osVersion: 'Unknown',
      appVersion: '1.0.0',
    }
  )
}

// Export for use by syncManager
export async function getDeviceId(): Promise<string> {
  const info = await getDeviceInfo()
  return info.deviceId
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
    setSentryUser(user.id, user.email)
    addBreadcrumb('auth', 'Authentication restored from stored credentials', 'info')
    log.info(`Authentication restored for: ${user.email}`)

    // Revalidate license after restoring auth
    licenseManager.revalidate().catch((err) => {
      log.warn('License revalidation failed:', err)
    })
  } catch (error) {
    const errorCode = error instanceof Error && 'code' in error ? (error as { code?: string }).code : ''
    const errorStr = String(error).toLowerCase()

    // Permanent errors: force full logout (matches macOS isPermanentAuthError)
    const isPermanent =
      errorCode === 'account_blocked' ||
      errorCode === 'device_limit' ||
      errorStr.includes('account_blocked') ||
      errorStr.includes('device_limit')

    if (isPermanent) {
      log.warn('Permanent auth error, forcing logout:', errorStr)
      captureError(
        error instanceof Error ? error : new Error('Permanent auth error'),
        { service: 'auth', errorCode, reason: 'permanent' },
      )
      await clearCredentials()
      store.setUnauthenticated()
      return
    }

    // Auth rejection: session expired
    const isAuthRejection =
      errorStr.includes('invalid_token') ||
      errorStr.includes('token_revoked') ||
      errorStr.includes('401') ||
      errorStr.includes('403')

    if (isAuthRejection) {
      log.warn('Server rejected credentials, session expired')
      await clearCredentials()
      store.setSessionExpired()
    } else {
      // Network/transient error - degraded mode: keep user authenticated with cached data
      // (matches macOS pattern: transparent retry on next action)
      log.warn(`[diag] DEGRADED MODE — auth check transient err: "${errorStr.substring(0, 200)}"`)
      log.warn('Transient error during auth check, entering degraded mode:', errorStr)
      store.setAuthenticated(user)
      setSentryUser(user.id, user.email)
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
    setSentryUser(response.user.id, response.user.email)
    addBreadcrumb('auth', 'User logged in with credentials', 'info')

    // Revalidate license after login
    licenseManager.revalidate().catch((err) => {
      log.warn('License revalidation failed:', err)
    })
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
    setSentryUser(response.user.id, response.user.email)
    addBreadcrumb('auth', 'User registered with credentials', 'info')

    // Revalidate license after registration
    licenseManager.revalidate().catch((err) => {
      log.warn('License revalidation failed:', err)
    })
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
  log.info('Starting device code flow...')
  store.setAuthenticating()

  try {
    const deviceInfo = await getDeviceInfo()
    log.info('Device info:', deviceInfo)

    log.info('Requesting device code from API...')
    const response = await authApi.requestDeviceCode(deviceInfo)
    log.info('Device code response:', {
      userCode: response.userCode,
      verificationUrl: response.verificationUrl,
      expiresIn: response.expiresIn,
    })

    const expiresAt = new Date(Date.now() + response.expiresIn * 1000).toISOString()
    store.setDeviceCodePending(response.userCode, response.deviceCode, expiresAt)
    log.info('Auth state set to deviceCodePending')

    // Start polling
    startPolling(response.deviceCode, response.expiresIn)
    log.info('Polling started')

    return {
      userCode: response.userCode,
      verificationUri: response.verificationUrl, // Keep return type consistent
    }
  } catch (error) {
    log.error('Device code flow failed:', error)
    captureError(
      error instanceof Error ? error : new Error('Device code flow failed'),
      { service: 'auth', method: 'device_code' },
    )
    store.setError(error instanceof Error ? error.message : 'Device code flow failed')
    throw error
  }
}

function startPolling(deviceCode: string, expiresIn: number): void {
  cancelDeviceCodeFlow()

  const expiresAt = Date.now() + expiresIn * 1000
  log.info(`Polling will expire at ${new Date(expiresAt).toISOString()}`)

  pollingInterval = setInterval(async () => {
    if (Date.now() > expiresAt) {
      log.warn('Device code expired')
      cancelDeviceCodeFlow()
      useAuthStore.getState().setError('Device code expired. Please try again.')
      return
    }

    try {
      log.info('Polling for device code authorization...')
      const response = await authApi.pollDeviceCode(deviceCode)
      log.info('Poll response:', { error: response.error, hasToken: !!response.accessToken })

      if (response.accessToken && response.refreshToken && response.user && response.expiresIn) {
        log.info('Authorization successful!')
        cancelDeviceCodeFlow()
        await storeTokens(
          response.accessToken,
          response.refreshToken,
          response.expiresIn,
          response.user,
        )
        useAuthStore.getState().setAuthenticated(response.user)
        setSentryUser(response.user.id, response.user.email)
        addBreadcrumb('auth', 'User authenticated via device code flow', 'info')

        // Revalidate license after device code auth
        licenseManager.revalidate().catch((err) => {
          log.warn('License revalidation failed:', err)
        })
        return
      }

      if (response.error && response.error !== 'authorization_pending') {
        log.warn('Poll returned error:', response.error)
        cancelDeviceCodeFlow()
        useAuthStore.getState().setError(response.message || response.error)
      }
    } catch (error) {
      // Ignore network errors during polling but log them
      log.warn('Polling error (will retry):', error)
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
  log.info('Starting Google sign-in via OAuth flow')
  store.setAuthenticating()

  try {
    // Start OAuth flow - opens browser and waits for callback
    const result = await startGoogleAuth()

    if (!result.success || !result.code || !result.codeVerifier || !result.redirectUri) {
      log.error('Google OAuth failed:', result.error)
      // Stop OAuth server on failure
      await window.electronAPI?.auth?.stopOAuthServer()
      throw new Error(result.error || 'Google sign-in failed')
    }

    log.info('Google OAuth code received, exchanging with backend...')
    log.info('Backend URL:', result.redirectUri)

    // Exchange authorization code for tokens with our backend
    const deviceInfo = await getDeviceInfo()

    try {
      const response = await authApi.exchangeGoogleAuth(
        result.code,
        result.codeVerifier,
        result.redirectUri,
        deviceInfo,
      )

      log.info('Google sign-in successful')
      await storeTokens(response.accessToken, response.refreshToken, response.expiresIn, response.user)
      store.setAuthenticated(response.user)
      setSentryUser(response.user.id, response.user.email)
      addBreadcrumb('auth', 'User logged in via Google OAuth', 'info')

      // Revalidate license after Google sign-in
      licenseManager.revalidate().catch((err) => {
        log.warn('License revalidation failed:', err)
      })
    } finally {
      // Always stop OAuth server after token exchange attempt (success or failure)
      log.info('Stopping OAuth server after token exchange')
      await window.electronAPI?.auth?.stopOAuthServer()
    }
  } catch (error) {
    log.error('Google sign-in failed:', error)
    captureError(
      error instanceof Error ? error : new Error('Google sign-in failed'),
      { service: 'auth', method: 'google' },
    )
    store.setError(error instanceof Error ? error.message : 'Google sign-in failed')
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
  clearSentryUser()
  addBreadcrumb('auth', 'User logged out', 'info')
  store.logout()
}

async function clearCredentials(): Promise<void> {
  authApi.clearTokens()
  await window.electronAPI?.secureStore.delete('refresh_token')
  await window.electronAPI?.store.delete('auth.user')
}

export async function getAccessToken(force = false): Promise<string> {
  const token = await authApi.getValidAccessToken(force)
  if (!token) throw new Error('Not authenticated')
  return token
}
