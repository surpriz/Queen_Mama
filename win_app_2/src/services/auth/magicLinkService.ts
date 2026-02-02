/**
 * Magic Link Service
 *
 * Generates magic links for auto-login to web dashboard
 */

import { getApiBaseUrl } from '@/services/config/appEnvironment'
import { getAccessToken } from './authenticationManager'

interface MagicLinkResponse {
  url: string
  expiresAt: string
}

/**
 * Generate a magic link for auto-login to web dashboard
 * @param redirect - The path to redirect to after login (e.g., '/dashboard/sessions/123')
 * @returns The full URL with magic token
 */
export async function generateMagicLink(redirect: string = '/dashboard'): Promise<string> {
  try {
    const token = await getAccessToken()
    const baseUrl = getApiBaseUrl()

    const response = await fetch(`${baseUrl}/api/auth/magic-link/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ redirect }),
    })

    if (!response.ok) {
      throw new Error(`Magic link request failed: ${response.status}`)
    }

    const data: MagicLinkResponse = await response.json()
    return data.url
  } catch (error) {
    console.error('[MagicLink] Failed to generate magic link:', error)
    throw error
  }
}

/**
 * Open web dashboard with auto-login
 * Falls back to direct URL if magic link fails
 */
export async function openDashboardWithMagicLink(path: string = '/dashboard'): Promise<void> {
  try {
    const url = await generateMagicLink(path)
    window.electronAPI?.openExternal(url)
  } catch (error) {
    console.warn('[MagicLink] Magic link failed, using fallback URL')
    // Fallback to direct URL without magic link
    const baseUrl = import.meta.env.VITE_APP_ENV === 'development'
      ? 'http://localhost:3000'
      : 'https://queenmama.co'
    window.electronAPI?.openExternal(`${baseUrl}${path}`)
  }
}

/**
 * Open session detail page on web dashboard
 */
export async function openSessionOnWeb(sessionId: string): Promise<void> {
  await openDashboardWithMagicLink(`/dashboard/sessions/${sessionId}`)
}
