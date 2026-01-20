"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { AuthCard } from "@/components/auth";
import { Input, Label, GradientButton } from "@/components/ui";
import { resetPasswordSchema } from "@/lib/validations";
import Link from "next/link";

function ResetPasswordContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token");

  const [isLoading, setIsLoading] = useState(false);
  const [isValidating, setIsValidating] = useState(true);
  const [isTokenValid, setIsTokenValid] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [formData, setFormData] = useState({
    password: "",
    confirmPassword: "",
  });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    async function validateToken() {
      if (!token) {
        setIsValidating(false);
        setIsTokenValid(false);
        return;
      }

      try {
        const response = await fetch(`/api/auth/reset-password?token=${token}`);
        const data = await response.json();
        setIsTokenValid(data.valid);
      } catch {
        setIsTokenValid(false);
      } finally {
        setIsValidating(false);
      }
    }

    validateToken();
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setFieldErrors({});

    const result = resetPasswordSchema.safeParse({
      token,
      password: formData.password,
      confirmPassword: formData.confirmPassword,
    });

    if (!result.success) {
      const errors: Record<string, string> = {};
      result.error.issues.forEach((err) => {
        const field = err.path[0] as string;
        errors[field] = err.message;
      });
      setFieldErrors(errors);
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          password: formData.password,
          confirmPassword: formData.confirmPassword,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Something went wrong");
      } else {
        setSuccess(true);
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  if (isValidating) {
    return (
      <AuthCard
        title="Verifying..."
        description="Please wait while we verify your reset link"
      >
        <div className="flex justify-center py-8">
          <div className="w-8 h-8 border-2 border-[var(--qm-accent)] border-t-transparent rounded-full animate-spin" />
        </div>
      </AuthCard>
    );
  }

  if (!token || !isTokenValid) {
    return (
      <AuthCard
        title="Invalid or expired link"
        description="This password reset link is no longer valid"
        footer={{
          text: "Need a new link?",
          linkText: "Request password reset",
          linkHref: "/forgot-password",
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
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <p className="text-[var(--qm-text-secondary)] mb-4">
            This reset link may have expired or already been used. Password reset links are valid for 1 hour.
          </p>
          <Link
            href="/forgot-password"
            className="inline-flex items-center justify-center px-6 py-3 rounded-lg bg-[var(--qm-accent)] text-white font-medium hover:bg-[var(--qm-accent-light)] transition-colors"
          >
            Request New Link
          </Link>
        </div>
      </AuthCard>
    );
  }

  if (success) {
    return (
      <AuthCard
        title="Password reset!"
        description="Your password has been successfully updated"
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
            You can now sign in with your new password.
          </p>
          <GradientButton
            onClick={() => router.push("/signin")}
            className="w-full"
          >
            Sign In
          </GradientButton>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Reset your password"
      description="Enter your new password below"
      footer={{
        text: "Remember your password?",
        linkText: "Sign in",
        linkHref: "/signin",
      }}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 rounded-[var(--qm-radius-md)] bg-[var(--qm-error)]/10 border border-[var(--qm-error)]/20">
            <p className="text-sm text-[var(--qm-error)]">{error}</p>
          </div>
        )}

        <div>
          <Label htmlFor="password" required>
            New Password
          </Label>
          <Input
            id="password"
            type="password"
            placeholder="Enter your new password"
            value={formData.password}
            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            error={fieldErrors.password}
            disabled={isLoading}
          />
          <p className="mt-1 text-xs text-[var(--qm-text-tertiary)]">
            At least 8 characters with uppercase, lowercase, and numbers
          </p>
        </div>

        <div>
          <Label htmlFor="confirmPassword" required>
            Confirm Password
          </Label>
          <Input
            id="confirmPassword"
            type="password"
            placeholder="Confirm your new password"
            value={formData.confirmPassword}
            onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
            error={fieldErrors.confirmPassword}
            disabled={isLoading}
          />
        </div>

        <GradientButton type="submit" className="w-full" disabled={isLoading}>
          {isLoading ? "Resetting..." : "Reset Password"}
        </GradientButton>
      </form>
    </AuthCard>
  );
}

export default function ResetPasswordPage() {
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
      <ResetPasswordContent />
    </Suspense>
  );
}
