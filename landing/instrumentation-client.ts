// This file configures the initialization of Sentry and PostHog on the client.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/
// https://posthog.com/docs/libraries/next-js

import * as Sentry from "@sentry/nextjs";
import posthog from "posthog-js";

// Initialize Sentry
Sentry.init({
  dsn: "https://879dba53c9a5ea8667f5107e96a5bb55@o4510350814085121.ingest.de.sentry.io/4510764737232976",

  // Define how likely traces are sampled. Adjust this value in production, or use tracesSampler for greater control.
  tracesSampleRate: 1,
  // Enable logs to be sent to Sentry
  enableLogs: true,

  // Enable sending user PII (Personally Identifiable Information)
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/configuration/options/#sendDefaultPii
  sendDefaultPii: true,
});

// Initialize PostHog
if (typeof window !== "undefined" && process.env.NEXT_PUBLIC_POSTHOG_KEY) {
  posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://eu.i.posthog.com",
    capture_pageview: true,
    capture_pageleave: true,
    respect_dnt: true,
    defaults: "2025-11-30",
  });
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
