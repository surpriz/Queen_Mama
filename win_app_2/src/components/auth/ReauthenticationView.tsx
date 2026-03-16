import { useTranslation } from 'react-i18next'
import { AlertTriangle, Info } from 'lucide-react'
import { SignInChoice } from './SignInChoice'
import { GradientText } from '@/components/common/GradientText'

interface ReauthenticationViewProps {
  onAuthenticated: () => void
}

export function ReauthenticationView({ onAuthenticated }: ReauthenticationViewProps) {
  const { t } = useTranslation()

  return (
    <div className="flex h-screen items-center justify-center bg-qm-bg-primary">
      <div className="flex flex-col items-center gap-8 px-6 max-w-md">
        {/* Header */}
        <div className="flex flex-col items-center gap-4">
          <div className="flex items-center justify-center w-20 h-20 rounded-full bg-amber-500/10">
            <AlertTriangle className="w-9 h-9 text-amber-500" />
          </div>

          <GradientText as="h1" className="text-title-md font-bold">
            {t('auth.sessionExpired')}
          </GradientText>

          <p className="text-body-sm text-qm-text-secondary text-center">
            {t('auth.sessionExpiredMessage')}
          </p>
        </div>

        {/* Sign-in options (no skip, no sign-up link) */}
        <SignInChoice allowSkip={false} onAuthenticated={onAuthenticated} />

        {/* Reassurance footer */}
        <div className="flex items-start gap-3 px-4 py-3 rounded-qm-md bg-qm-accent/5">
          <Info className="w-4 h-4 text-qm-accent mt-0.5 shrink-0" />
          <p className="text-caption text-qm-text-tertiary">
            {t('auth.localDataPreserved')}
          </p>
        </div>
      </div>
    </div>
  )
}
