import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { SignInChoice } from '@/components/auth/SignInChoice'
import { useAuthStore } from '@/stores/authStore'

interface AccountStepProps {
  onContinue: () => void
  onBack: () => void
  allowSkip?: boolean
}

export function AccountStep({ onContinue, onBack }: AccountStepProps) {
  const { t } = useTranslation('onboarding')
  const { isAuthenticated } = useAuthStore()

  // Auto-advance when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      onContinue()
    }
  }, [isAuthenticated, onContinue])

  return (
    <div className="flex flex-col h-full px-8 py-12">
      <div className="text-center mb-6">
        <h2 className="text-title-md font-semibold text-qm-text-primary mb-2">{t('account.title')}</h2>
        <p className="text-body-md text-qm-text-secondary max-w-md mx-auto">{t('account.subtitle')}</p>
      </div>

      <div className="flex-1 flex items-center justify-center">
        <SignInChoice />
      </div>

      <div className="flex justify-between items-center max-w-md mx-auto w-full mt-6">
        <button
          onClick={onBack}
          className="px-6 py-2.5 rounded-qm-lg border border-qm-border-medium text-qm-text-primary hover:bg-qm-surface-light transition-colors font-medium"
        >
          {t('nav.back')}
        </button>
      </div>
    </div>
  )
}
