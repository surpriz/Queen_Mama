import { SignInChoice } from '@/components/auth/SignInChoice'
import { useAuthStore } from '@/stores/authStore'
import { useEffect } from 'react'

interface AccountStepProps {
  onContinue: () => void
  onBack: () => void
  allowSkip?: boolean
}

export function AccountStep({ onContinue, onBack, allowSkip = true }: AccountStepProps) {
  const { authState, isAuthenticated } = useAuthStore()

  // Auto-advance when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      onContinue()
    }
  }, [isAuthenticated, onContinue])

  return (
    <div className="flex flex-col h-full px-8 py-12">
      {/* Header */}
      <div className="text-center mb-6">
        <h2 className="text-title-md font-semibold text-qm-text-primary mb-2">
          Sign in to Queen Mama
        </h2>
        <p className="text-body-md text-qm-text-secondary max-w-md mx-auto">
          Create an account or sign in to sync your sessions, settings, and get access to AI
          features
        </p>
      </div>

      {/* Sign In Component */}
      <div className="flex-1 flex items-center justify-center">
        <SignInChoice />
      </div>

      {/* Navigation */}
      <div className="flex justify-between items-center max-w-md mx-auto w-full mt-6">
        <button
          onClick={onBack}
          className="px-6 py-2.5 rounded-qm-lg text-qm-text-secondary hover:text-qm-text-primary hover:bg-qm-surface-light transition-colors"
        >
          Back
        </button>

        {allowSkip && (
          <button
            onClick={onContinue}
            className="px-6 py-2.5 rounded-qm-lg text-qm-text-tertiary hover:text-qm-text-secondary transition-colors"
          >
            Skip for now
          </button>
        )}
      </div>
    </div>
  )
}
