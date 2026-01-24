import Link from "next/link";
import { Metadata } from "next";
import { Container } from "@/components/ui";

export const metadata: Metadata = {
  title: "404 - Page Not Found | Queen Mama",
  description: "The page you're looking for doesn't exist.",
};

export default function NotFound() {
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

          {/* Error Code */}
          <h1 className="text-8xl font-bold gradient-text mb-4">404</h1>

          {/* Message */}
          <h2 className="text-2xl font-semibold text-white mb-4">
            Page Not Found
          </h2>
          <p className="text-[var(--qm-text-secondary)] mb-8">
            The page you&apos;re looking for doesn&apos;t exist or has been moved.
          </p>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/"
              className="inline-flex items-center justify-center px-6 py-3 rounded-lg gradient-bg text-white font-medium hover:opacity-90 transition-opacity"
            >
              Go Home
            </Link>
            <Link
              href="/#contact"
              className="inline-flex items-center justify-center px-6 py-3 rounded-lg bg-[var(--qm-surface-medium)] text-white font-medium hover:bg-[var(--qm-surface-hover)] transition-colors border border-[var(--qm-border-subtle)]"
            >
              Contact Support
            </Link>
          </div>
        </div>
      </Container>
    </div>
  );
}
