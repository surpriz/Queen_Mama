import { app, session } from 'electron'

/**
 * Content Security Policy for packaged builds.
 *
 * The renderers display AI output rendered through markdown/KaTeX/mermaid. A
 * CSP limits what an injection could do: no inline/remote scripts, network
 * only to the hosts the app talks to, no frames or plugins.
 *
 * Dev builds (Vite HMR, eval, websocket on localhost) are left alone.
 *
 * `webSecurity` is on (same-origin policy + CORS enforced). The renderers are
 * loaded from `file://`, so the backend must answer CORS for the "null"
 * origin — `landing/middleware.ts` does. `QM_RELAX_WEB_SECURITY=1` at runtime turns
 * it back off for diagnosing a backend that is not deployed yet.
 */

function hostOf(url: string | undefined): string | null {
  if (!url) return null
  try {
    return new URL(url).origin
  } catch {
    return null
  }
}

export function buildContentSecurityPolicy(env: NodeJS.ProcessEnv = process.env): string {
  const connect = new Set<string>([
    "'self'",
    'https://www.queenmama.co',
    'https://queenmama.co',
    'https://staging.queenmama.co',
    'https://api.deepgram.com',
    'wss://api.deepgram.com',
    'https://api.assemblyai.com',
    'wss://api.assemblyai.com',
    'https://*.sentry.io',
    'https://*.ingest.sentry.io',
    'https://*.posthog.com',
    'https://*.i.posthog.com',
  ])
  for (const candidate of [env.VITE_API_BASE_URL, env.VITE_POSTHOG_HOST, env.VITE_SENTRY_DSN]) {
    const origin = hostOf(candidate)
    if (origin) connect.add(origin)
  }

  return [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "media-src 'self' blob:",
    "worker-src 'self' blob:",
    `connect-src ${[...connect].join(' ')}`,
    "frame-src 'none'",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
  ].join('; ')
}

export function installContentSecurityPolicy(): void {
  if (!app.isPackaged) return
  const csp = buildContentSecurityPolicy()
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    const isAppPage = details.resourceType === 'mainFrame' && details.url.startsWith('file://')
    if (!isAppPage) {
      callback({ responseHeaders: details.responseHeaders })
      return
    }
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [csp],
      },
    })
  })
}
