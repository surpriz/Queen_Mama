import { getApiBaseUrl } from '@/services/config/appEnvironment'

const CUSTOM_PROTOCOL = 'queenmama'

interface GoogleAuthResult {
  success: boolean
  code?: string
  error?: string
}

/**
 * Google OAuth via system browser + custom protocol callback.
 * Flow:
 * 1. Open system browser to backend Google OAuth URL
 * 2. Backend handles OAuth, redirects to queenmama://auth/callback?code=XXX
 * 3. Electron registers custom protocol handler
 * 4. App receives callback and exchanges code for tokens
 */
export async function startGoogleAuth(): Promise<GoogleAuthResult> {
  return new Promise((resolve) => {
    const baseUrl = getApiBaseUrl()
    const callbackUrl = `${CUSTOM_PROTOCOL}://auth/callback`
    const authUrl = `${baseUrl}/api/auth/google?redirect_uri=${encodeURIComponent(callbackUrl)}&platform=windows`

    // Listen for the callback from main process
    const handler = (_event: unknown, url: string) => {
      try {
        const parsed = new URL(url)
        const code = parsed.searchParams.get('code')
        const error = parsed.searchParams.get('error')

        if (error) {
          resolve({ success: false, error })
        } else if (code) {
          resolve({ success: true, code })
        } else {
          resolve({ success: false, error: 'No code received' })
        }
      } catch {
        resolve({ success: false, error: 'Failed to parse callback URL' })
      }

      // Clean up listener
      window.electronAPI?.app.removeProtocolHandler?.()
    }

    // Register listener for protocol callback
    window.electronAPI?.app.onProtocolCallback?.(handler)

    // Open browser
    window.electronAPI?.openExternal(authUrl)

    // Timeout after 5 minutes
    setTimeout(() => {
      resolve({ success: false, error: 'Authentication timed out' })
    }, 5 * 60 * 1000)
  })
}
