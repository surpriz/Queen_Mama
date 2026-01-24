"use client";

import { useEffect } from "react";
import Link from "next/link";
import * as Sentry from "@sentry/nextjs";
import { Container } from "@/components/ui";

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function Error({ error, reset }: ErrorProps) {
  useEffect(() => {
    // Log error to console in development
    console.error("Application error:", error);

    // Send to Sentry
    Sentry.captureException(error);
  }, [error]);

  return (
    <div className="min-h-screen bg-[var(--qm-bg-primary)] flex items-center justify-center">
      <Container>
        <div className="text-center max-w-md mx-auto">
          {/* Logo */}
          <Link href="/" className="inline-flex items-center gap-2 mb-8">
            <div className="w-10 h-10 rounded-full gradient-bg flex items-center justify-center">
              <svg
                className="w-5 h-5 text-white"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
                />
              </svg>
            </div>
            <span className="text-xl font-bold gradient-text">Queen Mama</span>
          </Link>

          {/* Error Icon */}
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-[var(--qm-error-light)] flex items-center justify-center">
            <svg
              className="w-10 h-10 text-[var(--qm-error)]"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>

          {/* Message */}
          <h1 className="text-2xl font-semibold text-white mb-4">
            Something went wrong
          </h1>
          <p className="text-[var(--qm-text-secondary)] mb-8">
            We encountered an unexpected error. Our team has been notified and
            is working to fix it.
          </p>

          {/* Error digest for support */}
          {error.digest && (
            <p className="text-xs text-[var(--qm-text-tertiary)] mb-6 font-mono">
              Error ID: {error.digest}
            </p>
          )}

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={reset}
              className="inline-flex items-center justify-center px-6 py-3 rounded-lg gradient-bg text-white font-medium hover:opacity-90 transition-opacity"
            >
              Try Again
            </button>
            <Link
              href="/"
              className="inline-flex items-center justify-center px-6 py-3 rounded-lg bg-[var(--qm-surface-medium)] text-white font-medium hover:bg-[var(--qm-surface-hover)] transition-colors border border-[var(--qm-border-subtle)]"
            >
              Go Home
            </Link>
          </div>

          {/* Support link */}
          <p className="mt-8 text-sm text-[var(--qm-text-tertiary)]">
            Need help?{" "}
            <Link
              href="/#contact"
              className="text-[var(--qm-accent)] hover:underline"
            >
              Contact support
            </Link>
          </p>
        </div>
      </Container>
    </div>
  );
}
