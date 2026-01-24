'use client'

import { useEffect } from 'react'
import { useSession } from 'next-auth/react'
import posthog from 'posthog-js'

/**
 * PostHogProvider identifies the current user when they log in
 * and resets the identity when they log out.
 *
 * This should be placed inside SessionProvider.
 */
export function PostHogProvider({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession()

  useEffect(() => {
    if (status === 'authenticated' && session?.user) {
      // Identify user with their ID and properties
      posthog.identify(session.user.id, {
        email: session.user.email,
        name: session.user.name,
      })
    } else if (status === 'unauthenticated') {
      // Reset identity on logout
      posthog.reset()
    }
  }, [session, status])

  return <>{children}</>
}
