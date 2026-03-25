import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Sparkles, Crown, X } from 'lucide-react'
import { useLicenseStore } from '@/stores/licenseStore'
import { SubscriptionPlan, SubscriptionStatus } from '@/types/auth'
import { PricingModal } from './PricingModal'

const DISMISSED_KEY = 'freeWelcomeBannerDismissed'

export function FreeWelcomeBanner() {
  const { t } = useTranslation()
  const plan = useLicenseStore((s) => s.currentLicense.plan)
  const status = useLicenseStore((s) => s.currentLicense.status)
  const isValidating = useLicenseStore((s) => s.isValidating)
  const [isDismissed, setIsDismissed] = useState(() => localStorage.getItem(DISMISSED_KEY) === 'true')
  const [showPricing, setShowPricing] = useState(false)

  const isPro =
    (plan === SubscriptionPlan.Pro || plan === SubscriptionPlan.Enterprise) &&
    (status === SubscriptionStatus.Active || status === SubscriptionStatus.Trialing)

  if (isDismissed || isPro || isValidating) return null

  const handleDismiss = () => {
    setIsDismissed(true)
    localStorage.setItem(DISMISSED_KEY, 'true')
  }

  return (
    <>
      <div className="flex items-center gap-4 px-5 py-3 bg-qm-accent/[0.06] border-b border-qm-accent/15">
        {/* Icon */}
        <div className="w-9 h-9 rounded-full bg-qm-accent/15 flex items-center justify-center flex-shrink-0">
          <Sparkles size={16} className="text-qm-accent" />
        </div>

        {/* Message */}
        <div className="flex-1 min-w-0">
          <p className="text-body-sm font-semibold text-qm-text-primary">
            {t('pricing.freeBannerTitle')}
          </p>
          <p className="text-caption-sm text-qm-text-secondary">
            {t('pricing.freeBannerSubtitle')}
          </p>
        </div>

        {/* CTA */}
        <button
          onClick={() => setShowPricing(true)}
          className="flex items-center gap-1.5 px-4 py-1.5 rounded-qm-pill bg-gradient-to-r from-qm-gradient-start to-qm-gradient-end text-white text-caption font-medium hover:shadow-qm-glow transition-shadow flex-shrink-0"
        >
          <Crown size={12} />
          {t('pricing.seePlans')}
        </button>

        {/* Dismiss */}
        <button
          onClick={handleDismiss}
          className="p-1 text-qm-text-tertiary hover:text-qm-text-secondary transition-colors flex-shrink-0"
        >
          <X size={14} />
        </button>
      </div>

      <PricingModal isOpen={showPricing} onClose={() => setShowPricing(false)} />
    </>
  )
}
