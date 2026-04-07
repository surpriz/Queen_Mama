// This file configures the initialization of Sentry on the client.
// The added config here will be used whenever a users loads a page in their browser.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: "https://879dba53c9a5ea8667f5107e96a5bb55@o4510350814085121.ingest.de.sentry.io/4510764737232976",

  // Define how likely traces are sampled. Adjust this value in production, or use tracesSampler for greater control.
  tracesSampleRate: 1,
  // Enable logs to be sent to Sentry
  enableLogs: true,

  // Enable sending user PII (Personally Identifiable Information)
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/configuration/options/#sendDefaultPii
  sendDefaultPii: true,

  // Filter out noise from browser extensions (LastPass, Bitwarden, etc.)
  beforeSend(event) {
    const message =
      event.exception?.values?.[0]?.value ?? event.message ?? "";

    const browserExtensionPatterns = [
      /Object Not Found Matching Id:\d+, MethodName:\w+, ParamCount:\d+/,
      /ResizeObserver loop/,
    ];

    if (browserExtensionPatterns.some((p) => p.test(message))) {
      return null;
    }

    return event;
  },
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
