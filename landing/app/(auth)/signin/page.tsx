import { AuthCard, SignInForm, OAuthButtons, EmailDivider } from "@/components/auth";

export const metadata = {
  title: "Sign In - Queen Mama",
  description: "Sign in to your Queen Mama account",
};

interface SignInPageProps {
  searchParams: Promise<{ callbackUrl?: string }>;
}

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const params = await searchParams;
  const callbackUrl = params.callbackUrl || "/dashboard";

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
      <OAuthButtons callbackUrl={callbackUrl} />

      <EmailDivider />

      <SignInForm callbackUrl={callbackUrl} />
    </AuthCard>
  );
}
