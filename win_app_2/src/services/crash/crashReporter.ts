import { createLogger } from '@/lib/logger'

const log = createLogger('CrashReporter')

let isInitialized = false

// PII scrubbing patterns
const PII_PATTERNS = [
  /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, // emails
  /eyJ[a-zA-Z0-9_-]+\.eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/g, // JWTs
  /sk-[a-zA-Z0-9]{20,}/g, // OpenAI API keys
  /sk-ant-[a-zA-Z0-9-]{20,}/g, // Anthropic API keys
  /xai-[a-zA-Z0-9]{20,}/g, // xAI API keys
  /[a-f0-9]{32,}/gi, // Generic hex tokens / API keys
]

function scrubPII(text: string): string {
  let scrubbed = text
  PII_PATTERNS.forEach((pattern) => {
    scrubbed = scrubbed.replace(pattern, '[REDACTED]')
  })
  return scrubbed
}

// Patterns for expected errors that should NOT be sent to Sentry.
// These are transient/user-facing errors handled by reconnection logic or UI validation.
const IGNORED_ERROR_PATTERNS = [
  // WebSocket disconnects — handled by reconnection with exponential backoff
  /disconnected: code=100[0-6]/i,
  /disconnected: code=1011/i,
  /connection failed/i,
  // Transcription provider not available for plan (403) — expected for free-tier users
  /provider_not_available/i,
  /not available for your plan/i,
  // Auth validation errors — user input, not bugs
  /password must contain/i,
  /email already exists/i,
  /account uses google/i,
  // Auth network errors — transient, retried automatically
  /^AuthError: Network error/i,
  /^AuthError: Request timed out/i,
  // Failed to fetch — generic browser network error
  /^TypeError: Failed to fetch$/i,
]

function isExpectedError(event: { message?: string; exception?: { values?: Array<{ type?: string; value?: string }> } }): boolean {
  const texts: string[] = []
  if (event.message) texts.push(event.message)
  if (event.exception?.values) {
    for (const ex of event.exception.values) {
      if (ex.value) texts.push(ex.type ? `${ex.type}: ${ex.value}` : ex.value)
    }
  }
  return texts.some((text) => IGNORED_ERROR_PATTERNS.some((pattern) => pattern.test(text)))
}

export async function start(): Promise<void> {
  if (isInitialized) return

  const dsn = import.meta.env.VITE_SENTRY_DSN
  if (!dsn) {
    log.info('Sentry DSN not configured, skipping initialization')
    return
  }

  try {
    const Sentry = await import('@sentry/electron/renderer')

    const version = await window.electronAPI?.getVersion()
    const release = version ? `com.queenmama.windows@${version}` : undefined

    Sentry.init({
      dsn,
      environment:
        import.meta.env.MODE === 'development'
          ? 'development'
          : (import.meta.env.VITE_APP_ENV || 'production'),
      release,
      tracesSampleRate: 0.1,
      autoSessionTracking: true,
      maxBreadcrumbs: 100,
      beforeSend(event) {
        // Drop expected/transient errors that are handled by app logic
        if (isExpectedError(event)) return null

        if (event.message) {
          event.message = scrubPII(event.message)
        }
        if (event.exception?.values) {
          event.exception.values.forEach((ex) => {
            if (ex.value) ex.value = scrubPII(ex.value)
          })
        }
        return event
      },
    })

    isInitialized = true
    log.info('Crash reporter initialized')

    // Static tags that don't change at runtime — set once after init.
    try {
      const locale = navigator.language || 'unknown'
      void setTag('locale', locale)
    } catch { /* noop */ }

    // Global safety nets for renderer — uncaught errors and unhandled promise
    // rejections that escape every other catch must still reach Sentry.
    if (typeof window !== 'undefined') {
      window.addEventListener('error', (e) => {
        const err = e.error instanceof Error ? e.error : new Error(e.message || 'window_error')
        captureError(err, { source: 'window_error', filename: e.filename, lineno: e.lineno })
      })
      window.addEventListener('unhandledrejection', (e) => {
        const err =
          e.reason instanceof Error ? e.reason : new Error(typeof e.reason === 'string' ? e.reason : JSON.stringify(e.reason))
        captureError(err, { source: 'unhandled_rejection' })
      })
    }
  } catch (error) {
    log.warn('Failed to initialize Sentry (may be expected in dev)', error)
  }
}

export async function setUser(id: string, email: string): Promise<void> {
  if (!isInitialized) return
  try {
    const Sentry = await import('@sentry/electron/renderer')
    Sentry.setUser({ id, email })
  } catch { /* noop */ }
}

export async function clearUser(): Promise<void> {
  if (!isInitialized) return
  try {
    const Sentry = await import('@sentry/electron/renderer')
    Sentry.setUser(null)
  } catch { /* noop */ }
}

export async function captureError(error: Error, context?: Record<string, unknown>): Promise<void> {
  if (!isInitialized) return
  try {
    const Sentry = await import('@sentry/electron/renderer')
    Sentry.captureException(error, { extra: context })
  } catch { /* noop */ }
}

export async function captureMessage(
  message: string,
  level: 'fatal' | 'error' | 'warning' | 'info' | 'debug' = 'info',
): Promise<void> {
  if (!isInitialized) return
  try {
    const Sentry = await import('@sentry/electron/renderer')
    Sentry.captureMessage(message, level)
  } catch { /* noop */ }
}

export async function setTag(key: string, value: string): Promise<void> {
  if (!isInitialized) return
  try {
    const Sentry = await import('@sentry/electron/renderer')
    Sentry.setTag(key, value)
  } catch { /* noop */ }
}

export async function addBreadcrumb(
  category: string,
  message: string,
  level: 'info' | 'warning' | 'error' = 'info',
): Promise<void> {
  if (!isInitialized) return
  try {
    const Sentry = await import('@sentry/electron/renderer')
    Sentry.addBreadcrumb({ category, message, level })
  } catch { /* noop */ }
}
