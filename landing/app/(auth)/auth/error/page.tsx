"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { AuthCard } from "@/components/auth";
import { GradientButton } from "@/components/ui";
import Link from "next/link";

const errorMessages: Record<string, string> = {
  Configuration: "There is a problem with the server configuration.",
  AccessDenied: "You do not have permission to sign in.",
  Verification: "The verification token has expired or has already been used.",
  OAuthSignin: "Error starting the OAuth sign-in flow.",
  OAuthCallback: "Error handling the OAuth callback.",
  OAuthCreateAccount: "Error creating a user account with the OAuth provider.",
  EmailCreateAccount: "Error creating a user account with the email provider.",
  Callback: "Error in the OAuth callback handler.",
  OAuthAccountNotLinked:
    "This email is already associated with another account. Please sign in with the original provider.",
  EmailSignin: "Error sending the email for sign-in.",
  CredentialsSignin: "Invalid email or password.",
  SessionRequired: "Please sign in to access this page.",
  Default: "An error occurred during authentication.",
};

function AuthErrorContent() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error") || "Default";
  const errorMessage = errorMessages[error] || errorMessages.Default;

  return (
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
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
      </div>

      <p className="text-[var(--qm-text-secondary)] mb-6">{errorMessage}</p>

      <Link href="/signin">
        <GradientButton>Try Again</GradientButton>
      </Link>
    </div>
  );
}

export default function AuthErrorPage() {
  return (
    <AuthCard
      title="Authentication Error"
      description="Something went wrong during sign in"
    >
      <Suspense fallback={<div className="text-center">Loading...</div>}>
        <AuthErrorContent />
      </Suspense>
    </AuthCard>
  );
}
