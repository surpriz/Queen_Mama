import { getApiBaseUrl } from '../config/appEnvironment'
import { createLogger } from '@/lib/logger'
import type {
  LoginResponse,
  RefreshResponse,
  DeviceCodeResponse,
  DeviceCodePollResponse,
  DeviceInfo,
  EmailCheckResponse,
  License,
} from '@/types/auth'

const log = createLogger('AuthAPI')

class AuthError extends Error {
  constructor(
    message: string,
    public code?: string,
  ) {
    super(message)
    this.name = 'AuthError'
  }
}

export const AUTH_ERRORS = {
  notAuthenticated: new AuthError('Not authenticated', 'not_authenticated'),
  invalidToken: new AuthError('Invalid token', 'invalid_token'),
  tokenExpired: new AuthError('Token expired', 'token_expired'),
  emailAlreadyExists: new AuthError('Email already exists', 'email_exists'),
  oauthAccountExists: new AuthError('Account uses Google Sign-In', 'oauth_account_exists'),
  accountBlocked: new AuthError('Account blocked', 'account_blocked'),
  deviceLimitReached: new AuthError('Device limit reached', 'device_limit'),
}

// Session expiration callback (avoids circular imports with stores)
let onSessionExpiredCallback: (() => void) | null = null

export function setOnSessionExpired(callback: () => void): void {
  onSessionExpiredCallback = callback
}

// In-memory token state
let accessToken: string | null = null
let accessTokenExpiry: number | null = null

export function setAccessToken(token: string, expiresIn: number): void {
  accessToken = token
  accessTokenExpiry = Date.now() + expiresIn * 1000
}

export function clearTokens(): void {
  accessToken = null
  accessTokenExpiry = null
}

function isAccessTokenValid(): boolean {
  return !!(accessToken && accessTokenExpiry && Date.now() < accessTokenExpiry)
}

async function getValidAccessToken(): Promise<string | null> {
  if (isAccessTokenValid()) return accessToken

  // Try to refresh
  const refreshToken = await window.electronAPI?.secureStore.get('refresh_token')
  if (!refreshToken) return null

  try {
    const response = await refreshTokens(refreshToken)
    setAccessToken(response.accessToken, response.expiresIn)
    await window.electronAPI?.secureStore.set('refresh_token', response.refreshToken)
    return response.accessToken
  } catch (error) {
    const errorStr = String(error).toLowerCase()
    const isAuthRejection =
      errorStr.includes('invalid_token') ||
      errorStr.includes('token_revoked') ||
      errorStr.includes('401') ||
      errorStr.includes('403')

    if (isAuthRejection) {
      log.warn('Token refresh rejected by server, session expired')
      clearTokens()
      await window.electronAPI?.secureStore.delete('refresh_token')
      onSessionExpiredCallback?.()
    } else {
      log.error('Token refresh failed (network error)', error)
    }

    return null
  }
}

async function fetchAPI<T>(
  endpoint: string,
  options: {
    method?: string
    body?: Record<string, unknown>
    requiresAuth?: boolean
    queryParams?: Record<string, string>
  } = {},
): Promise<T> {
  const { method = 'GET', body, requiresAuth = false, queryParams } = options
  const baseUrl = getApiBaseUrl()
  let url = `${baseUrl}${endpoint}`

  if (queryParams) {
    const params = new URLSearchParams(queryParams)
    url += `?${params.toString()}`
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }

  if (requiresAuth) {
    const token = await getValidAccessToken()
    if (!token) throw AUTH_ERRORS.notAuthenticated
    headers['Authorization'] = `Bearer ${token}`
  }

  log.info(`API Request: ${method} ${url}`)

  let response: Response
  try {
    // Add timeout to prevent hanging requests
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 30000) // 30 second timeout

    response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    })

    clearTimeout(timeoutId)
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    log.error(`Network error on ${method} ${url}:`, errorMessage)

    if (errorMessage.includes('aborted')) {
      throw new AuthError('Request timed out. Please check your internet connection.', 'timeout')
    }

    throw new AuthError(
      `Network error: ${errorMessage}. Please check your internet connection.`,
      'network_error'
    )
  }

  log.info(`API Response: ${response.status} ${response.statusText}`)

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    log.error(`API Error ${response.status}:`, errorData)

    if (response.status === 401) {
      if (errorData.error === 'oauth_user') {
        throw new AuthError('This account uses Google Sign-In', 'oauth_user')
      }
      throw AUTH_ERRORS.invalidToken
    }

    if (response.status === 403) {
      if (errorData.error === 'account_blocked') throw AUTH_ERRORS.accountBlocked
      if (errorData.error === 'device_limit') throw AUTH_ERRORS.deviceLimitReached
    }

    if (response.status === 400) {
      if (errorData.error === 'email_exists') throw AUTH_ERRORS.emailAlreadyExists
      if (errorData.error === 'oauth_account_exists') throw AUTH_ERRORS.oauthAccountExists
    }

    throw new AuthError(errorData.message || `Request failed (${response.status})`, errorData.error)
  }

  return response.json()
}

// Device Code Flow
export async function requestDeviceCode(deviceInfo: DeviceInfo): Promise<DeviceCodeResponse> {
  log.info('Requesting device code...')
  const response = await fetchAPI<DeviceCodeResponse>('/api/auth/device/code', {
    method: 'POST',
    body: {
      deviceId: deviceInfo.deviceId,
      deviceName: deviceInfo.deviceName,
      platform: deviceInfo.platform,
    },
  })
  log.info('Device code request successful')
  return response
}

export async function pollDeviceCode(deviceCode: string): Promise<DeviceCodePollResponse> {
  return fetchAPI('/api/auth/device/poll', {
    queryParams: { deviceCode },
  })
}

// Credentials Login
export async function login(
  email: string,
  password: string,
  deviceInfo: DeviceInfo,
): Promise<LoginResponse> {
  return fetchAPI('/api/auth/macos/login', {
    method: 'POST',
    body: {
      email,
      password,
      deviceId: deviceInfo.deviceId,
      deviceName: deviceInfo.deviceName,
      platform: deviceInfo.platform,
      osVersion: deviceInfo.osVersion,
      appVersion: deviceInfo.appVersion,
    },
  })
}

// Registration
export async function register(
  name: string,
  email: string,
  password: string,
  deviceInfo: DeviceInfo,
): Promise<LoginResponse> {
  return fetchAPI('/api/auth/macos/register', {
    method: 'POST',
    body: {
      name,
      email,
      password,
      deviceId: deviceInfo.deviceId,
      deviceName: deviceInfo.deviceName,
      platform: deviceInfo.platform,
      osVersion: deviceInfo.osVersion,
      appVersion: deviceInfo.appVersion,
    },
  })
}

// Token Refresh
export async function refreshTokens(refreshToken: string): Promise<RefreshResponse> {
  return fetchAPI('/api/auth/macos/refresh', {
    method: 'POST',
    body: { refreshToken },
  })
}

// Logout
export async function logout(
  refreshToken: string | null,
  allDevices: boolean = false,
): Promise<void> {
  await fetchAPI('/api/auth/macos/logout', {
    method: 'POST',
    body: { refreshToken: refreshToken || '', allDevices },
    requiresAuth: true,
  })
}

// License Validation
export async function validateLicense(deviceId: string): Promise<License> {
  return fetchAPI('/api/license/validate', {
    method: 'POST',
    body: { deviceId },
    requiresAuth: true,
  })
}

// Usage Recording
export async function recordUsage(action: string, provider?: string): Promise<void> {
  const deviceInfo = await window.electronAPI?.getDeviceInfo()
  await fetchAPI('/api/usage/record', {
    method: 'POST',
    body: {
      deviceId: deviceInfo?.deviceId,
      action,
      ...(provider && { provider }),
    },
    requiresAuth: true,
  })
}

// Email Check
export async function checkEmail(email: string): Promise<EmailCheckResponse> {
  return fetchAPI('/api/auth/check-email', {
    method: 'POST',
    body: { email },
  })
}

// Google OAuth Exchange
export async function exchangeGoogleAuth(
  code: string,
  codeVerifier: string,
  redirectUri: string,
  deviceInfo: DeviceInfo,
): Promise<LoginResponse> {
  return fetchAPI('/api/auth/macos/google-callback', {
    method: 'POST',
    body: {
      authorizationCode: code,
      codeVerifier,
      redirectUri,
      deviceId: deviceInfo.deviceId,
      deviceName: deviceInfo.deviceName,
      platform: deviceInfo.platform,
      osVersion: deviceInfo.osVersion,
      appVersion: deviceInfo.appVersion,
    },
  })
}

export { AuthError, getValidAccessToken, isAccessTokenValid }
