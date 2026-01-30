import posthog from 'posthog-js'
import { createLogger } from '@/lib/logger'

const log = createLogger('Analytics')

const POSTHOG_KEY = 'phc_n7ZlROEDA8wZ0MAVB4FFeLwFub7rX1FPTlYks131w7v'
const POSTHOG_HOST = 'https://eu.i.posthog.com'

let isInitialized = false

export function start(): void {
  if (isInitialized) return

  try {
    posthog.init(POSTHOG_KEY, {
      api_host: POSTHOG_HOST,
      persistence: 'localStorage',
      autocapture: false,
      capture_pageview: false,
    })
    isInitialized = true
    log.info('Analytics initialized')
  } catch (error) {
    log.error('Failed to initialize analytics', error)
  }
}

export function identify(
  userId: string,
  email: string,
  name: string | null,
  plan: string,
): void {
  if (!isInitialized) return
  posthog.identify(userId, {
    email,
    name,
    plan,
    platform: 'windows',
  })
}

export function capture(event: string, properties?: Record<string, unknown>): void {
  if (!isInitialized) return
  posthog.capture(event, {
    ...properties,
    platform: 'windows',
  })
}

export function trackSessionStarted(modeId?: string | null, modeName?: string | null): void {
  capture('session_started', { modeId, modeName })
}

export function trackSessionEnded(
  durationSeconds: number,
  transcriptLength: number,
  hadAIResponses: boolean,
): void {
  capture('session_ended', { durationSeconds, transcriptLength, hadAIResponses })
}

export function trackOverlayToggled(visible: boolean): void {
  capture('overlay_toggled', { visible })
}

export function trackAIRequestMade(responseType: string, provider: string): void {
  capture('ai_request', { responseType, provider })
}

export function reset(): void {
  if (!isInitialized) return
  posthog.reset()
}
