import { createLogger } from '@/lib/logger'

const log = createLogger('CrashReporter')

let isInitialized = false

// PII scrubbing patterns
const PII_PATTERNS = [
  /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, // emails
  /eyJ[a-zA-Z0-9_-]+\.eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/g, // JWTs
  /[a-f0-9]{32,}/gi, // API keys / tokens
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

  try {
    // Dynamically import Sentry to avoid issues in dev
    const Sentry = await import('@sentry/electron/renderer')

    Sentry.init({
      dsn: 'https://examplePublicKey@o0.ingest.sentry.io/0', // Replace with actual DSN
      environment: import.meta.env.MODE || 'production',
      release: await window.electronAPI?.getVersion(),
      beforeSend(event) {
        // Scrub PII
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

export async function captureError(error: Error, context?: Record<string, unknown>): Promise<void> {
  if (!isInitialized) return
  try {
    const Sentry = await import('@sentry/electron/renderer')
    Sentry.captureException(error, { extra: context })
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
