/**
 * Auth Token Service (main process)
 *
 * Single source of truth for refresh-token rotation. All renderer windows
 * (dashboard, overlay, meeting notification) route their token refresh through
 * the one IPC handler backed by this module, so concurrent callers share a
 * single in-flight network request and a single atomic refresh_token write.
 *
 * Without this, each window independently POSTed /api/auth/macos/refresh with
 * the same one-time-use refresh token at boot, racing the server's rotation and
 * leaving a revoked/stale token on disk — the app then looked logged in but
 * could not start a working session until logout/login.
 */

import { safeStorage } from 'electron'
import Store from 'electron-store'

// Same backing store + key scheme as the SECURE_STORE_* IPC handlers
// (electron-store, `secure.<key>`), so main and renderer read/write the
// identical refresh_token entry.
const store = new Store()
const REFRESH_KEY = 'secure.refresh_token'

export type RefreshResult =
  | { ok: true; accessToken: string; expiresIn: number }
  | { ok: false; code: string }

function readRefreshToken(): string | null {
  if (!safeStorage.isEncryptionAvailable()) return null
  const encrypted = store.get(REFRESH_KEY) as string | undefined
  if (!encrypted) return null
  try {
    return safeStorage.decryptString(Buffer.from(encrypted, 'base64'))
  } catch {
    return null
  }
}

function writeRefreshToken(value: string): void {
  if (!safeStorage.isEncryptionAvailable()) return
  store.set(REFRESH_KEY, safeStorage.encryptString(value).toString('base64'))
}

function deleteRefreshToken(): void {
  store.delete(REFRESH_KEY)
}

let refreshInFlight: Promise<RefreshResult> | null = null

/**
 * Refresh the access token. Concurrent callers coalesce onto a single in-flight
 * request so the rotating refresh_token is never spent more than once at a time.
 */
export function refreshToken(apiBaseUrl: string): Promise<RefreshResult> {
  if (refreshInFlight) {
    console.log('[AuthTokenService] Reusing in-flight refresh')
    return refreshInFlight
  }
  refreshInFlight = doRefresh(apiBaseUrl).finally(() => {
    refreshInFlight = null
  })
  return refreshInFlight
}

async function doRefresh(apiBaseUrl: string): Promise<RefreshResult> {
  const token = readRefreshToken()
  if (!token) return { ok: false, code: 'no_token' }

  let response: Response
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 30000)
    response = await fetch(`${apiBaseUrl}/api/auth/macos/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: token }),
      signal: controller.signal,
    })
    clearTimeout(timeout)
  } catch (error) {
    // Network/timeout — keep the token, the next action retries.
    console.error('[AuthTokenService] Refresh network error:', error)
    return { ok: false, code: 'network_error' }
  }

  if (!response.ok) {
    const data = (await response.json().catch(() => ({}))) as { error?: string }
    const code = data.error || (response.status === 401 ? 'invalid_token' : `http_${response.status}`)
    // Auth rejection (revoked/expired/blocked): the token is dead — drop it so
    // the app falls back to the login screen instead of replaying it forever.
    if (response.status === 401 || response.status === 403) {
      deleteRefreshToken()
    }
    console.warn(`[AuthTokenService] Refresh rejected: ${response.status} code=${code}`)
    return { ok: false, code }
  }

  const data = (await response.json()) as {
    accessToken: string
    refreshToken: string
    expiresIn: number
  }
  writeRefreshToken(data.refreshToken)
  console.log('[AuthTokenService] Refresh OK, token rotated')
  return { ok: true, accessToken: data.accessToken, expiresIn: data.expiresIn }
}
