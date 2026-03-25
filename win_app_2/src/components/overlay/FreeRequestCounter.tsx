import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLicenseStore } from '@/stores/licenseStore'
import { SubscriptionPlan, SubscriptionStatus } from '@/types/auth'
import { PricingModal } from '@/components/license/PricingModal'
import { cn } from '@/lib/utils'

export function FreeRequestCounter() {
  const { t } = useTranslation()
  const plan = useLicenseStore((s) => s.currentLicense.plan)
  const status = useLicenseStore((s) => s.currentLicense.status)
  const dailyLimit = useLicenseStore((s) => s.currentLicense.features.dailyAiRequestLimit)
  const aiRequestsToday = useLicenseStore((s) => s.aiRequestsToday)
  const [showPricing, setShowPricing] = useState(false)

  // Compute isPro inline for proper reactivity (instead of calling store function)
  const isPro =
    (plan === SubscriptionPlan.Pro || plan === SubscriptionPlan.Enterprise) &&
    (status === SubscriptionStatus.Active || status === SubscriptionStatus.Trialing)

  if (isPro || !dailyLimit) return null

  const remaining = Math.max(0, dailyLimit - aiRequestsToday)
  const isExhausted = remaining === 0

  return (
    <>
      <button
        onClick={(e) => { e.stopPropagation(); setShowPricing(true) }}
        className={cn(
          'px-1.5 py-0.5 rounded-qm-pill text-[10px] font-bold font-mono transition-colors titlebar-no-drag',
          isExhausted
            ? 'bg-qm-warning/25 text-qm-warning'
            : 'bg-qm-surface-light text-qm-text-tertiary hover:text-qm-text-secondary',
        )}
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        title={t('pricing.counterTooltip')}
      >
        {remaining}/{dailyLimit}
      </button>

      <PricingModal
        isOpen={showPricing}
        onClose={() => setShowPricing(false)}
        contextMessage={isExhausted ? t('pricing.limitReached') : undefined}
      />
    </>
  )
}
