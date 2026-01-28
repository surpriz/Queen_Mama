import { SignInChoice } from '@/components/auth/SignInChoice'

export function OnboardingPage() {
  return (
    <div className="flex h-screen items-center justify-center bg-qm-bg-primary">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-title-lg font-bold bg-gradient-to-r from-qm-gradient-start to-qm-gradient-end bg-clip-text text-transparent">
            Queen Mama
          </h1>
          <p className="mt-2 text-body-md text-qm-text-secondary">
            Real-time AI coaching assistant
          </p>
        </div>
        <SignInChoice />
      </div>
    </div>
  )
}
