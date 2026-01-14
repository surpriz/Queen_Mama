import { AuthCard, SignInForm, OAuthButtons } from "@/components/auth";

export const metadata = {
  title: "Sign In - Queen Mama",
  description: "Sign in to your Queen Mama account",
};

export default function SignInPage() {
  return (
    <AuthCard
      title="Welcome back"
      description="Sign in to your account to continue"
      footer={{
        text: "Don't have an account?",
        linkText: "Sign up",
        linkHref: "/signup",
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

      <SignInForm />
    </AuthCard>
  );
}
