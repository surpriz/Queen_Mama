import { AuthCard, SignUpForm, OAuthButtons } from "@/components/auth";

export const metadata = {
  title: "Sign Up - Queen Mama",
  description: "Create your Queen Mama account",
};

export default function SignUpPage() {
  return (
    <AuthCard
      title="Create your account"
      description="Get started with Queen Mama today"
      footer={{
        text: "Already have an account?",
        linkText: "Sign in",
        linkHref: "/signin",
      }}
    >
      <OAuthButtons />

      <div className="relative my-6">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-[var(--qm-border-subtle)]" />
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="px-4 bg-[var(--qm-surface-medium)] text-[var(--qm-text-tertiary)]">
            or continue with email
          </span>
        </div>
      </div>

      <SignUpForm />

      <p className="mt-4 text-xs text-center text-[var(--qm-text-tertiary)]">
        By creating an account, you agree to our{" "}
        <a href="/terms" className="text-[var(--qm-accent)] hover:underline">
          Terms of Service
        </a>{" "}
        and{" "}
        <a href="/privacy" className="text-[var(--qm-accent)] hover:underline">
          Privacy Policy
        </a>
      </p>
    </AuthCard>
  );
}
