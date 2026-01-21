"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { AuthCard } from "@/components/auth";
import { GradientButton } from "@/components/ui";
import Link from "next/link";

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token");

  const [isVerifying, setIsVerifying] = useState(true);
  const [isVerified, setIsVerified] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function verifyEmail() {
      if (!token) {
        setIsVerifying(false);
        setError("No verification token provided");
        return;
      }

      try {
        const response = await fetch(`/api/auth/verify-email?token=${token}`);
        const data = await response.json();

        if (data.verified) {
          setIsVerified(true);
        } else {
          setError(data.error || "Verification failed");
        }
      } catch {
        setError("Something went wrong. Please try again.");
      } finally {
        setIsVerifying(false);
      }
    }

    verifyEmail();
  }, [token]);

  if (isVerifying) {
    return (
      <AuthCard
        title="Verifying your email..."
        description="Please wait while we verify your email address"
      >
        <div className="flex flex-col items-center py-8">
          <div className="w-12 h-12 border-3 border-[var(--qm-accent)] border-t-transparent rounded-full animate-spin mb-4" />
          <p className="text-[var(--qm-text-secondary)]">This will only take a moment...</p>
        </div>
      </AuthCard>
    );
  }

  if (isVerified) {
    return (
      <AuthCard
        title="Email verified!"
        description="Your email has been successfully verified"
      >
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[var(--qm-success)]/10 flex items-center justify-center">
            <svg
              className="w-8 h-8 text-[var(--qm-success)]"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <p className="text-[var(--qm-text-secondary)] mb-6">
            Thank you for verifying your email address. You can now access all features of Queen Mama.
          </p>
          <div className="space-y-3">
            <GradientButton
              onClick={() => router.push("/dashboard")}
              className="w-full"
            >
              Go to Dashboard
            </GradientButton>
            <Link
              href="/download"
              className="block w-full text-center py-3 text-[var(--qm-accent)] hover:text-[var(--qm-accent-light)] transition-colors"
            >
              Download the macOS App
            </Link>
          </div>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Verification failed"
      description="We couldn't verify your email address"
      footer={{
        text: "Need help?",
        linkText: "Contact support",
        linkHref: "mailto:support@queenmama.co",
      }}
    >
      <div className="text-center">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[var(--qm-error)]/10 flex items-center justify-center">
          <svg
            className="w-8 h-8 text-[var(--qm-error)]"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </div>
        <p className="text-[var(--qm-text-secondary)] mb-2">
          {error || "The verification link may have expired or already been used."}
        </p>
        <p className="text-sm text-[var(--qm-text-tertiary)] mb-6">
          Verification links are valid for 24 hours.
        </p>
        <div className="space-y-3">
          <ResendVerificationButton />
          <Link
            href="/signin"
            className="block w-full text-center py-3 text-[var(--qm-accent)] hover:text-[var(--qm-accent-light)] transition-colors"
          >
            Back to Sign In
          </Link>
        </div>
      </div>
    </AuthCard>
  );
}

function ResendVerificationButton() {
  const [isLoading, setIsLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [email, setEmail] = useState("");
  const [showInput, setShowInput] = useState(false);

  const handleResend = async () => {
    if (!email) {
      setShowInput(true);
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch("/api/auth/verify-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (response.ok) {
        setSent(true);
      }
    } catch {
      // Silent fail - we don't want to reveal if email exists
    } finally {
      setIsLoading(false);
    }
  };

  if (sent) {
    return (
      <p className="text-sm text-[var(--qm-success)]">
        If your email is registered, you&apos;ll receive a new verification link.
      </p>
    );
  }

  if (showInput) {
    return (
      <div className="space-y-2">
        <input
          type="email"
          placeholder="Enter your email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full px-4 py-3 rounded-lg bg-[var(--qm-surface-dark)] border border-[var(--qm-border-subtle)] text-white placeholder-[var(--qm-text-tertiary)] focus:outline-none focus:border-[var(--qm-accent)]"
        />
        <GradientButton
          onClick={handleResend}
          className="w-full"
          disabled={isLoading || !email}
        >
          {isLoading ? "Sending..." : "Send Verification Link"}
        </GradientButton>
      </div>
    );
  }

  return (
    <GradientButton
      onClick={handleResend}
      className="w-full"
      disabled={isLoading}
    >
      Resend Verification Email
    </GradientButton>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <AuthCard
          title="Loading..."
          description="Please wait"
        >
          <div className="flex justify-center py-8">
            <div className="w-8 h-8 border-2 border-[var(--qm-accent)] border-t-transparent rounded-full animate-spin" />
          </div>
        </AuthCard>
      }
    >
      <VerifyEmailContent />
    </Suspense>
  );
}
