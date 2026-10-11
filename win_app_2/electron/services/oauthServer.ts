import { createServer, Server, IncomingMessage, ServerResponse } from 'http'
import { IPC_CHANNELS } from '../ipc/channels'
import { safeSendToMainWindow } from '../utils/ipcUtils'
import { getMainWindow } from '../windows/mainWindow'

let server: Server | null = null
let currentPort: number | null = null
let serverTimeout: ReturnType<typeof setTimeout> | null = null
let expectedState: string | null = null

// Timeout for OAuth flow (5 minutes)
const OAUTH_TIMEOUT_MS = 5 * 60 * 1000

/**
 * Start a local HTTP server to receive OAuth callbacks.
 * This is the recommended approach for desktop OAuth with Electron.
 * Google allows loopback URLs (127.0.0.1) without pre-registration.
 */
export function startOAuthServer(state?: string): Promise<number> {
  return new Promise((resolve, reject) => {
    // Stop any existing server
    stopOAuthServer()
    expectedState = state ?? null

    console.log('[OAuth] Creating server...')

    server = createServer((req: IncomingMessage, res: ServerResponse) => {
      console.log(`[OAuth] Received request: ${req.method} ${req.url}`)

      const url = new URL(req.url || '/', `http://127.0.0.1`)

      // Handle the OAuth callback
      if (url.pathname === '/callback' || url.pathname === '/') {
        const code = url.searchParams.get('code')
        const error = url.searchParams.get('error')
        const errorDescription = url.searchParams.get('error_description')
        const state = url.searchParams.get('state')

        // Anyone on the machine can hit this loopback port; a code is only
        // accepted when it carries the state this flow generated.
        const stateOk = !expectedState || state === expectedState

        // Build the callback URL to send to renderer
        let callbackUrl: string
        let succeeded = false
        if (!stateOk) {
          console.warn('[OAuth] State mismatch — callback ignored')
          callbackUrl = 'oauth://callback?error=state_mismatch'
        } else if (error) {
          console.log(`[OAuth] Received error: ${error}`)
          callbackUrl = `oauth://callback?error=${encodeURIComponent(error)}`
          if (errorDescription) {
            callbackUrl += `&error_description=${encodeURIComponent(errorDescription)}`
          }
        } else if (code) {
          console.log(`[OAuth] Received authorization code (length: ${code.length})`)
          callbackUrl = `oauth://callback?code=${encodeURIComponent(code)}`
          succeeded = true
        } else {
          console.log('[OAuth] No code or error in callback')
          callbackUrl = `oauth://callback?error=no_code`
        }

        // Only the dashboard runs the sign-in flow
        console.log('[OAuth] Sending callback to renderer...')
        const sent = safeSendToMainWindow(IPC_CHANNELS.AUTH_PROTOCOL_CALLBACK, callbackUrl)
        console.log(`[OAuth] Callback sent to dashboard: ${sent}`)

        // Focus main window
        try {
          const mainWindow = getMainWindow()
          if (mainWindow && !mainWindow.isDestroyed()) {
            if (mainWindow.isMinimized()) mainWindow.restore()
            mainWindow.focus()
          }
        } catch (error) {
          console.warn('[OAuth] Could not focus main window:', error)
        }

        // Success or error page (it used to say "Authentication Successful" even on errors)
        if (!succeeded) {
          res.writeHead(400, { 'Content-Type': 'text/html' })
          res.end(`<!DOCTYPE html><html><head><title>Sign-in failed</title><style>body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;display:flex;justify-content:center;align-items:center;height:100vh;margin:0;background:#1a1a1e;color:#fff}.c{text-align:center;padding:40px}h1{margin:0 0 10px;font-size:22px}p{margin:0;opacity:.7}</style></head><body><div class="c"><h1>Sign-in could not be completed</h1><p>Close this tab and try again in Queen Mama.</p></div></body></html>`)
          return
        }
        res.writeHead(200, { 'Content-Type': 'text/html' })
        res.end(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>Authentication Complete</title>
            <style>
              body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                display: flex;
                justify-content: center;
                align-items: center;
                height: 100vh;
                margin: 0;
                background: linear-gradient(135deg, #1a1a1e 0%, #2d2d32 100%);
                color: white;
              }
              .container {
                text-align: center;
                padding: 40px;
              }
              .checkmark {
                width: 80px;
                height: 80px;
                border-radius: 50%;
                background: linear-gradient(135deg, #7C3AED 0%, #3B82F6 100%);
                display: flex;
                align-items: center;
                justify-content: center;
                margin: 0 auto 20px;
              }
              .checkmark svg {
                width: 40px;
                height: 40px;
                fill: none;
                stroke: white;
                stroke-width: 3;
              }
              h1 { margin: 0 0 10px; font-size: 24px; }
              p { margin: 0; opacity: 0.7; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="checkmark">
                <svg viewBox="0 0 24 24"><path d="M5 13l4 4L19 7" stroke-linecap="round" stroke-linejoin="round"/></svg>
              </div>
              <h1>Authentication Successful</h1>
              <p>You can close this window and return to Queen Mama.</p>
            </div>
            <script>
              // Try to close the window after a short delay
              setTimeout(() => window.close(), 2000);
            </script>
          </body>
          </html>
        `)

        // Don't stop the server immediately - let the renderer complete the token exchange
        // The server will be stopped by the timeout (5 min) or explicitly by the renderer
        console.log('[OAuth] Callback processed, waiting for token exchange to complete...')
        // Note: Server will be stopped by renderer after successful token exchange
        // or by the 5-minute timeout if something goes wrong
      } else {
        // 404 for other paths
        res.writeHead(404)
        res.end('Not Found')
      }
    })

    // Loopback only: the redirect URI is http://127.0.0.1:PORT/callback, so
    // there is no reason to accept connections from the network.
    server.listen(0, '127.0.0.1', () => {
      const address = server?.address()
      if (address && typeof address === 'object') {
        currentPort = address.port
        console.log(`[OAuth] Server started on port ${currentPort}`)
        console.log(`[OAuth] Listening on http://127.0.0.1:${currentPort}/callback`)
        console.log(`[OAuth] Also accepting: http://localhost:${currentPort}/callback`)
        console.log(`[OAuth] Waiting for OAuth callback (timeout: 5 min)...`)

        // Set a timeout to stop the server if no callback received
        if (serverTimeout) clearTimeout(serverTimeout)
        serverTimeout = setTimeout(() => {
          console.log('[OAuth] Server timeout - no callback received')
          stopOAuthServer()
        }, OAUTH_TIMEOUT_MS)

        resolve(currentPort)
      } else {
        reject(new Error('Failed to get server port'))
      }
    })

    server.on('error', (err) => {
      console.error('[OAuth] Server error:', err)
      reject(err)
    })

    // Handle server close
    server.on('close', () => {
      console.log('[OAuth] Server connection closed')
    })
  })
}

/**
 * Stop the OAuth callback server
 */
export function stopOAuthServer(): void {
  if (serverTimeout) {
    clearTimeout(serverTimeout)
    serverTimeout = null
  }
  if (server) {
    server.close()
    server = null
    currentPort = null
    console.log('[OAuth] Server stopped')
  }
  expectedState = null
}

/**
 * Get the current OAuth server port (if running)
 */
export function getOAuthServerPort(): number | null {
  return currentPort
}
