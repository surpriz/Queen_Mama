"use client";

import { useState, useSyncExternalStore } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Input, Label, GradientButton } from "@/components/ui";
import { signInSchema, type SignInInput } from "@/lib/validations";
import { setLastAuthMethod } from "./OAuthButtons";

interface SignInFormProps {
  callbackUrl?: string;
}

const REMEMBER_ME_KEY = "qm_remember_me";

function getRememberMeSnapshot(): boolean {
  const saved = localStorage.getItem(REMEMBER_ME_KEY);
  return saved === null ? true : saved === "true";
}

function getRememberMeServerSnapshot(): boolean {
  return true;
}

function subscribeToStorage(callback: () => void) {
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
}

export function SignInForm({ callbackUrl = "/dashboard" }: SignInFormProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const storedRememberMe = useSyncExternalStore(
    subscribeToStorage,
    getRememberMeSnapshot,
    getRememberMeServerSnapshot
  );
  const [rememberMe, setRememberMe] = useState(storedRememberMe);
  const [formData, setFormData] = useState<SignInInput>({
    email: "",
    password: "",
  });
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof SignInInput, string>>>({});

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setFieldErrors({});

    const result = signInSchema.safeParse(formData);
    if (!result.success) {
      const errors: Partial<Record<keyof SignInInput, string>> = {};
      result.error.issues.forEach((err) => {
        const field = err.path[0] as keyof SignInInput;
        errors[field] = err.message;
      });
      setFieldErrors(errors);
      return;
    }

    setIsLoading(true);

    try {
      const response = await signIn("credentials", {
        email: formData.email,
        password: formData.password,
        redirect: false,
      });

      if (response?.error) {
        setError("Invalid email or password");
      } else {
        setLastAuthMethod("email");
        localStorage.setItem(REMEMBER_ME_KEY, String(rememberMe));
        router.push(callbackUrl);
        router.refresh();
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
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
          value={formData.email}
          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          error={fieldErrors.email}
          disabled={isLoading}
        />
      </div>

      <div>
        <div className="flex items-center justify-between">
          <Label htmlFor="password" required>
            Password
          </Label>
          <Link
            href="/forgot-password"
            className="text-sm text-[var(--qm-accent)] hover:text-[var(--qm-accent-light)] transition-colors"
          >
            Forgot password?
          </Link>
        </div>
        <Input
          id="password"
          type="password"
          placeholder="Enter your password"
          value={formData.password}
          onChange={(e) => setFormData({ ...formData, password: e.target.value })}
          error={fieldErrors.password}
          disabled={isLoading}
        />
      </div>

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="rememberMe"
          checked={rememberMe}
          onChange={(e) => setRememberMe(e.target.checked)}
          disabled={isLoading}
          className="w-4 h-4 rounded border-[var(--qm-border-subtle)] bg-[var(--qm-surface-dark)] text-[var(--qm-accent)] focus:ring-[var(--qm-accent)] focus:ring-offset-0 cursor-pointer"
        />
        <label
          htmlFor="rememberMe"
          className="text-sm text-[var(--qm-text-secondary)] cursor-pointer select-none"
        >
          Keep me logged in for 30 days
        </label>
      </div>

      <GradientButton type="submit" className="w-full" disabled={isLoading}>
        {isLoading ? "Signing in..." : "Sign In"}
      </GradientButton>
    </form>
  );
}
