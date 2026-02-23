// Google OAuth client ID - Desktop type for Windows/Electron (supports loopback redirects)
const GOOGLE_CLIENT_ID =
  import.meta.env.VITE_GOOGLE_CLIENT_ID ||
  '499912921957-791r0pvvs9j3ptem6gcdvf2qhbha381v.apps.googleusercontent.com'

export interface GoogleAuthResult {
  success: boolean
  code?: string
  codeVerifier?: string
  redirectUri?: string
  error?: string
}

/**
 * Generate a cryptographically random code verifier for PKCE
 * Must be 43-128 characters, using unreserved URI characters
 */
function generateCodeVerifier(): string {
  const array = new Uint8Array(32)
  crypto.getRandomValues(array)
  return base64UrlEncode(array)
}

/**
 * Generate SHA-256 code challenge from verifier (S256 method)
 */
async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(verifier)
  const hash = await crypto.subtle.digest('SHA-256', data)
  return base64UrlEncode(new Uint8Array(hash))
}

/**
 * Base64 URL encoding (RFC 4648)
 */
function base64UrlEncode(buffer: Uint8Array): string {
  // Convert to base64
  let binary = ''
  for (let i = 0; i < buffer.length; i++) {
    binary += String.fromCharCode(buffer[i])
  }
  const base64 = btoa(binary)
  // Convert to base64url
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/**
 * Build Google OAuth authorization URL with PKCE
 */
function buildAuthorizationUrl(codeChallenge: string, redirectUri: string): string {
  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    access_type: 'offline',
    prompt: 'select_account', // Always show account picker
  })

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
}

/**
 * Google OAuth via system browser + loopback server with PKCE.
 *
 * Flow:
 * 1. Start a local HTTP server on a random port
 * 2. Generate PKCE code verifier and challenge
 * 3. Open system browser to Google OAuth with redirect_uri = http://127.0.0.1:PORT/callback
 * 4. User authenticates with Google
 * 5. Google redirects to the local server
 * 6. Server captures the code, sends it to renderer via IPC, and shows success page
 * 7. Return code + code verifier for backend token exchange
 *
 * Note: Google allows loopback URLs (127.0.0.1) for installed applications
 * without pre-registering them in the Cloud Console.
 */
export async function startGoogleAuth(): Promise<GoogleAuthResult> {
  // Check if Google OAuth is configured
  if (!GOOGLE_CLIENT_ID) {
    console.error('[GoogleAuth] Google OAuth client ID not configured')
    return {
      success: false,
      error: 'Google Sign-In is not configured. Please use Device Code login instead.',
    }
  }

  // Start the OAuth loopback server
  console.log('[GoogleAuth] Starting OAuth loopback server')
  const serverResult = await window.electronAPI?.auth?.startOAuthServer()

  if (!serverResult?.success || !serverResult.port) {
    console.error('[GoogleAuth] Failed to start OAuth server:', serverResult?.error)
    return {
      success: false,
      error: 'Failed to start authentication server. Please try again.',
    }
  }

  const port = serverResult.port
  // IMPORTANT: Google OAuth for desktop apps requires 127.0.0.1, not localhost
  // The redirect_uri must exactly match what the OAuth server is listening on
  const redirectUri = `http://127.0.0.1:${port}/callback`

  // Generate PKCE code verifier and challenge
  const codeVerifier = generateCodeVerifier()
  const codeChallenge = await generateCodeChallenge(codeVerifier)

  console.log('[GoogleAuth] ========================================')
  console.log('[GoogleAuth] Starting OAuth flow with PKCE')
  console.log('[GoogleAuth] Client ID:', GOOGLE_CLIENT_ID.substring(0, 20) + '...')
  console.log('[GoogleAuth] Redirect URI:', redirectUri)
  console.log('[GoogleAuth] OAuth server port:', port)
  console.log('[GoogleAuth] ========================================')

  return new Promise((resolve) => {
    let cleanupFn: (() => void) | undefined
    let resolved = false
    let timeoutId: ReturnType<typeof setTimeout> | undefined

    const cleanup = () => {
      console.log('[GoogleAuth] Cleaning up...')
      if (timeoutId) {
        clearTimeout(timeoutId)
        timeoutId = undefined
      }
      cleanupFn?.()
      // Don't stop the server here - let the server handle its own cleanup
      // The server will stop itself after sending the response
    }

    // Handler for the callback from the loopback server
    const handleCallback = (url: string) => {
      console.log('[GoogleAuth] Callback handler invoked with URL:', url)

      if (resolved) {
        console.log('[GoogleAuth] Already resolved, ignoring callback')
        return
      }
      resolved = true

      // Clean up listener (but not server - it handles its own cleanup)
      cleanup()

      console.log('[GoogleAuth] Processing callback URL...')

      try {
        const parsed = new URL(url)
        const code = parsed.searchParams.get('code')
        const error = parsed.searchParams.get('error')

        if (error) {
          const errorDescription = parsed.searchParams.get('error_description')
          console.error('[GoogleAuth] OAuth error:', error, errorDescription)
          resolve({ success: false, error: errorDescription || error })
        } else if (code) {
          console.log('[GoogleAuth] Authorization code received successfully!')
          resolve({
            success: true,
            code,
            codeVerifier,
            redirectUri,
          })
        } else {
          console.error('[GoogleAuth] No authorization code in callback')
          resolve({ success: false, error: 'No authorization code received' })
        }
      } catch (e) {
        console.error('[GoogleAuth] Failed to parse callback URL:', e)
        resolve({ success: false, error: 'Failed to parse callback URL' })
      }
    }

    // Register listener for callback from the loopback server
    console.log('[GoogleAuth] Registering callback listener...')
    cleanupFn = window.electronAPI?.auth?.onProtocolCallback?.(handleCallback)

    // Small delay to ensure server is fully ready before opening browser
    setTimeout(() => {
      // Build and open OAuth URL
      const authUrl = buildAuthorizationUrl(codeChallenge, redirectUri)
      console.log('[GoogleAuth] Opening OAuth URL in browser...')
      console.log('[GoogleAuth] Auth URL:', authUrl.substring(0, 100) + '...')
      window.electronAPI?.openExternal(authUrl)
    }, 100)

    // Timeout after 5 minutes
    timeoutId = setTimeout(() => {
      if (!resolved) {
        resolved = true
        console.warn('[GoogleAuth] Authentication timed out after 5 minutes')
        cleanup()
        window.electronAPI?.auth?.stopOAuthServer()
        resolve({ success: false, error: 'Authentication timed out' })
      }
    }, 5 * 60 * 1000)
  })
}
