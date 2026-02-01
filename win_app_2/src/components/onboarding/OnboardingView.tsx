import { useCallback } from 'react'
import { X } from 'lucide-react'
import { useOnboardingStore, OnboardingStep } from '@/stores/onboardingStore'
import { OnboardingStepIndicator } from './OnboardingStepIndicator'
import { WelcomeStep } from './WelcomeStep'
import { PermissionsStep } from './PermissionsStep'
import { AccountStep } from './AccountStep'
import { TourStep } from './TourStep'
import { ReadyStep } from './ReadyStep'

interface OnboardingViewProps {
  onComplete: () => void
}

const STEPS = [
  { key: 'welcome', label: 'Welcome' },
  { key: 'permissions', label: 'Permissions' },
  { key: 'account', label: 'Account' },
  { key: 'tour', label: 'Tour' },
  { key: 'ready', label: 'Ready' },
]

export function OnboardingView({ onComplete }: OnboardingViewProps) {
  const { currentStep, nextStep, previousStep, skipOnboarding, completeOnboarding } =
    useOnboardingStore()

  const handleComplete = useCallback(async () => {
    await completeOnboarding()
    onComplete()
  }, [completeOnboarding, onComplete])

  const handleSkip = useCallback(() => {
    skipOnboarding()
    onComplete()
  }, [skipOnboarding, onComplete])

  const renderStep = () => {
    switch (currentStep) {
      case 'welcome':
        return <WelcomeStep onContinue={nextStep} />
      case 'permissions':
        return <PermissionsStep onContinue={nextStep} onBack={previousStep} />
      case 'account':
        return <AccountStep onContinue={nextStep} onBack={previousStep} allowSkip={true} />
      case 'tour':
        return <TourStep onContinue={nextStep} onBack={previousStep} />
      case 'ready':
        return <ReadyStep onComplete={handleComplete} />
      default:
        return <WelcomeStep onContinue={nextStep} />
    }
  }

  // Don't show indicator on welcome and ready steps for cleaner look
  const showStepIndicator = currentStep !== 'welcome' && currentStep !== 'ready'

  return (
    <div className="h-screen flex flex-col bg-qm-bg-primary">
      {/* Header with step indicator and skip button */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-qm-border-subtle">
        {/* Step Indicator */}
        <div className="flex-1">
          {showStepIndicator && <OnboardingStepIndicator steps={STEPS} currentStep={currentStep} />}
        </div>

        {/* Skip Button */}
        {currentStep !== 'ready' && (
          <button
            onClick={handleSkip}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-qm-md text-qm-text-tertiary hover:text-qm-text-secondary hover:bg-qm-surface-light transition-colors"
            title="Skip onboarding"
          >
            <span className="text-body-sm">Skip</span>
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-hidden">{renderStep()}</div>
    </div>
  )
}
