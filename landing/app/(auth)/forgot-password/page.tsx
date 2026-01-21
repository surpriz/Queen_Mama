"use client";

import { useState } from "react";
import { AuthCard } from "@/components/auth";
import { Input, Label, GradientButton } from "@/components/ui";
import { forgotPasswordSchema, type ForgotPasswordInput } from "@/lib/validations";

export default function ForgotPasswordPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [email, setEmail] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof ForgotPasswordInput, string>>>({});

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setFieldErrors({});

    const result = forgotPasswordSchema.safeParse({ email });
    if (!result.success) {
      const errors: Partial<Record<keyof ForgotPasswordInput, string>> = {};
      result.error.issues.forEach((err) => {
        const field = err.path[0] as keyof ForgotPasswordInput;
        errors[field] = err.message;
      });
      setFieldErrors(errors);
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
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

  if (success) {
    return (
      <AuthCard
        title="Check your email"
        description="We've sent you a password reset link"
        footer={{
          text: "Remember your password?",
          linkText: "Sign in",
          linkHref: "/signin",
        }}
      >
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[var(--qm-accent)]/10 flex items-center justify-center">
            <svg
              className="w-8 h-8 text-[var(--qm-accent)]"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
              />
            </svg>
          </div>
          <p className="text-[var(--qm-text-secondary)] mb-4">
            If an account exists for <span className="text-white font-medium">{email}</span>,
            you will receive an email with instructions to reset your password.
          </p>
          <p className="text-sm text-[var(--qm-text-tertiary)]">
            Didn&apos;t receive the email? Check your spam folder or{" "}
            <button
              onClick={() => {
                setSuccess(false);
                setEmail("");
              }}
              className="text-[var(--qm-accent)] hover:underline"
            >
              try again
            </button>
          </p>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Forgot your password?"
      description="Enter your email and we'll send you a reset link"
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
          <Label htmlFor="email" required>
            Email
          </Label>
          <Input
            id="email"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={fieldErrors.email}
            disabled={isLoading}
          />
        </div>

        <GradientButton type="submit" className="w-full" disabled={isLoading}>
          {isLoading ? "Sending..." : "Send Reset Link"}
        </GradientButton>
      </form>
    </AuthCard>
  );
}
