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
