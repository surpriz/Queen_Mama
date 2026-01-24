import { PostHog } from 'posthog-node'

// Server-side PostHog singleton
let posthogClient: PostHog | null = null

export function getPostHogServer(): PostHog {
  if (!posthogClient) {
    posthogClient = new PostHog(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
      host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
      flushAt: 1, // Flush immediately in serverless
      flushInterval: 0,
    })
  }
  return posthogClient
}

// Helper to capture server-side events with proper cleanup
export async function captureServerEvent(
  distinctId: string,
  event: string,
  properties?: Record<string, unknown>
) {
  const posthog = getPostHogServer()
  posthog.capture({
    distinctId,
    event,
    properties,
  })
  await posthog.shutdown()
}
