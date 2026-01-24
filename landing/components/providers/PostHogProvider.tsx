'use client'

import { Suspense, useEffect } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import posthog from 'posthog-js'
import { PostHogProvider as PHProvider } from 'posthog-js/react'

// Initialize PostHog once
if (typeof window !== 'undefined' && process.env.NEXT_PUBLIC_POSTHOG_KEY) {
  posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://eu.i.posthog.com',
    capture_pageview: false, // We capture manually below
    capture_pageleave: true,
    // Debug in development
    loaded: (posthog) => {
      if (process.env.NODE_ENV === 'development') {
        posthog.debug()
      }
    },
  })
}

/**
 * Captures pageviews on route changes
 */
function PostHogPageviewInner() {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  useEffect(() => {
    if (pathname && posthog) {
      let url = window.origin + pathname
      const search = searchParams.toString()
      if (search) {
        url = url + '?' + search
      }
      posthog.capture('$pageview', { $current_url: url })
    }
  }, [pathname, searchParams])

  return null
}

function PostHogPageview() {
  return (
    <Suspense fallback={null}>
      <PostHogPageviewInner />
    </Suspense>
  )
}

/**
 * Identifies user when they log in
 */
function PostHogUserIdentifier() {
  const { data: session, status } = useSession()

  useEffect(() => {
    if (status === 'authenticated' && session?.user) {
      posthog.identify(session.user.id, {
        email: session.user.email,
        name: session.user.name,
      })
    } else if (status === 'unauthenticated') {
      posthog.reset()
    }
  }, [session, status])

  return null
}

/**
 * PostHog Provider - wraps the app and provides analytics
 */
export function PostHogProvider({ children }: { children: React.ReactNode }) {
  return (
    <PHProvider client={posthog}>
      <PostHogPageview />
      <PostHogUserIdentifier />
      {children}
    </PHProvider>
  )
}
