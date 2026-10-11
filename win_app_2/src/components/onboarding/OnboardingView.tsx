import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useOnboardingStore } from '@/stores/onboardingStore'
import { OnboardingStepIndicator } from './OnboardingStepIndicator'
import { WelcomeStep } from './WelcomeStep'
import { PermissionsStep } from './PermissionsStep'
import { AccountStep } from './AccountStep'
import { TourStep } from './TourStep'
import { ReadyStep } from './ReadyStep'

interface OnboardingViewProps {
  onComplete: () => void
}

export function OnboardingView({ onComplete }: OnboardingViewProps) {
  const { t } = useTranslation('onboarding')
  const { currentStep, nextStep, previousStep, completeOnboarding } = useOnboardingStore()

  const steps = [
    { key: 'welcome', label: t('steps.welcome') },
    { key: 'permissions', label: t('steps.permissions') },
    { key: 'account', label: t('steps.account') },
    { key: 'tour', label: t('steps.tour') },
    { key: 'ready', label: t('steps.ready') },
  ]

  const handleComplete = useCallback(async () => {
    await completeOnboarding()
    onComplete()
  }, [completeOnboarding, onComplete])

  const renderStep = () => {
    switch (currentStep) {
      case 'welcome':
        return <WelcomeStep onContinue={nextStep} />
      case 'permissions':
        return <PermissionsStep onContinue={nextStep} onBack={previousStep} />
      case 'account':
        return <AccountStep onContinue={nextStep} onBack={previousStep} allowSkip={false} />
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
      {showStepIndicator && (
        <div className="flex items-center px-6 py-4 border-b border-qm-border-subtle">
          <div className="flex-1">
            <OnboardingStepIndicator steps={steps} currentStep={currentStep} />
          </div>
        </div>
      )}

      <div className="flex-1 overflow-hidden">{renderStep()}</div>
    </div>
  )
}
