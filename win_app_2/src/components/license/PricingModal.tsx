import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Crown, Check, Minus, Loader2, X } from 'lucide-react'
import { useLicenseStore } from '@/stores/licenseStore'
import { SubscriptionPlan } from '@/types/auth'
import { cn } from '@/lib/utils'

interface PricingModalProps {
  isOpen: boolean
  onClose: () => void
  contextMessage?: string
}

interface PlanFeature {
  name: string
  detail?: string
  available: boolean
}

export function PricingModal({ isOpen, onClose, contextMessage }: PricingModalProps) {
  const { t } = useTranslation()
  const isPro = useLicenseStore((s) => s.isPro)
  const isEnterprise = useLicenseStore((s) => s.isEnterprise)
  const currentPlan = useLicenseStore((s) => s.currentLicense.plan)
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null)

  if (!isOpen) return null

  const handleUpgrade = async (plan: string) => {
    setLoadingPlan(plan)
    try {
      window.electronAPI?.openExternal('https://www.queenmama.co/dashboard/billing')
    } catch {
      window.open('https://www.queenmama.co/dashboard/billing', '_blank')
    }
    setTimeout(() => {
      setLoadingPlan(null)
      onClose()
    }, 1000)
  }

  const freeFeatures: PlanFeature[] = [
    { name: t('pricing.feature.aiRequests'), detail: t('pricing.feature.aiRequestsFree'), available: true },
    { name: t('pricing.feature.customModes'), available: false },
    { name: t('pricing.feature.cloudSync'), available: false },
    { name: t('pricing.feature.smartMode'), available: false },
  ]

  const proFeatures: PlanFeature[] = [
    { name: t('pricing.feature.aiRequests'), detail: t('pricing.feature.unlimited'), available: true },
    { name: t('pricing.feature.customModes'), available: true },
    { name: t('pricing.feature.cloudSync'), available: true },
    { name: t('pricing.feature.export'), available: true },
  ]

  const enterpriseFeatures: PlanFeature[] = [
    { name: t('pricing.feature.aiRequests'), detail: t('pricing.feature.unlimited'), available: true },
    { name: t('pricing.feature.smartMode'), available: true },
    { name: t('pricing.feature.autoAnswer'), available: true },
    { name: t('pricing.feature.undetectable'), available: true },
    { name: t('pricing.feature.contextIntel'), available: true },
  ]

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 backdrop-blur-sm overflow-y-auto"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-sm mx-2 my-4 rounded-qm-xl bg-qm-bg-primary border border-qm-border-subtle shadow-2xl overflow-hidden">
        {/* Close button */}
        <div className="flex justify-end p-2 pb-0">
          <button
            onClick={onClose}
            className="p-1.5 rounded-qm-md text-qm-text-tertiary hover:text-qm-text-secondary hover:bg-qm-surface-light transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <div className="px-4 pb-4 space-y-3">
          {/* Context banner */}
          {contextMessage && (
            <div className="p-2 rounded-qm-md bg-qm-warning/10 border border-qm-warning/20">
              <span className="text-caption-sm text-qm-text-secondary">{contextMessage}</span>
            </div>
          )}

          {/* Compact header */}
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-qm-gradient-start to-qm-gradient-end flex items-center justify-center flex-shrink-0">
              <Crown size={14} className="text-white" />
            </div>
            <div>
              <h2 className="text-body-sm font-semibold text-qm-text-primary">{t('pricing.title')}</h2>
              <p className="text-caption-sm text-qm-text-tertiary">{t('pricing.subtitle')}</p>
            </div>
          </div>

          {/* Plans stacked vertically */}
          <div className="space-y-2">
            <PlanCard
              name={t('pricing.planFree')}
              price="$0"
              features={freeFeatures}
              isCurrent={!isPro()}
              isRecommended={false}
              ctaLabel={t('pricing.currentPlan')}
              ctaEnabled={false}
              isLoading={false}
              onUpgrade={() => {}}
            />
            <PlanCard
              name={t('pricing.planPro')}
              price="$19"
              priceSubtitle={t('pricing.perMonth')}
              features={proFeatures}
              isCurrent={currentPlan === SubscriptionPlan.Pro}
              isRecommended={true}
              ctaLabel={t('pricing.upgradePro')}
              ctaEnabled={!isPro()}
              isLoading={loadingPlan === 'pro'}
              onUpgrade={() => handleUpgrade('pro')}
            />
            <PlanCard
              name={t('pricing.planEnterprise')}
              price="$49"
              priceSubtitle={t('pricing.perMonth')}
              features={enterpriseFeatures}
              isCurrent={isEnterprise()}
              isRecommended={false}
              ctaLabel={t('pricing.upgradeEnterprise')}
              ctaEnabled={!isEnterprise()}
              isLoading={loadingPlan === 'enterprise'}
              onUpgrade={() => handleUpgrade('enterprise')}
            />
          </div>

          {/* Dismiss */}
          <button
            onClick={onClose}
            className="w-full text-caption-sm text-qm-text-tertiary hover:text-qm-text-secondary transition-colors py-1"
          >
            {t('pricing.maybeLater')}
          </button>
        </div>
      </div>
    </div>
  )
}

// MARK: - Compact Plan Card (responsive for overlay)

interface PlanCardProps {
  name: string
  price: string
  priceSubtitle?: string
  features: PlanFeature[]
  isCurrent: boolean
  isRecommended: boolean
  ctaLabel: string
  ctaEnabled: boolean
  isLoading: boolean
  onUpgrade: () => void
}

function PlanCard({
  name, price, priceSubtitle, features,
  isCurrent, isRecommended, ctaLabel, ctaEnabled, isLoading, onUpgrade,
}: PlanCardProps) {
  const { t } = useTranslation()

  return (
    <div
      className={cn(
        'rounded-qm-lg p-3 border',
        isRecommended
          ? 'bg-qm-surface-medium border-qm-accent/40'
          : 'bg-qm-surface-light border-qm-border-subtle',
      )}
    >
      {/* Header row: name + price + CTA inline */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-body-sm font-semibold text-qm-text-primary">{name}</span>
          {isRecommended && (
            <span className="text-[8px] font-bold text-white px-1.5 py-0.5 rounded-qm-pill bg-gradient-to-r from-qm-gradient-start to-qm-gradient-end whitespace-nowrap">
              {t('pricing.recommended')}
            </span>
          )}
          {isCurrent && !isRecommended && (
            <span className="text-[8px] font-bold text-qm-text-tertiary px-1.5 py-0.5 rounded-qm-pill bg-qm-surface-medium whitespace-nowrap">
              {t('pricing.currentPlan')}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="flex items-baseline gap-0.5">
            <span className={cn('text-body-sm font-bold', isRecommended ? 'text-qm-accent' : 'text-qm-text-primary')}>
              {price}
            </span>
            {priceSubtitle && (
              <span className="text-[9px] text-qm-text-tertiary">{priceSubtitle}</span>
            )}
          </div>

          {ctaEnabled ? (
            <button
              onClick={onUpgrade}
              disabled={isLoading}
              className={cn(
                'px-3 py-1 rounded-qm-md text-[10px] font-medium text-white transition-all whitespace-nowrap',
                isRecommended
                  ? 'bg-gradient-to-r from-qm-gradient-start to-qm-gradient-end hover:shadow-qm-glow'
                  : 'bg-qm-warning hover:brightness-110',
              )}
            >
              {isLoading ? <Loader2 size={10} className="animate-spin" /> : ctaLabel}
            </button>
          ) : null}
        </div>
      </div>

      {/* Features as compact inline tags */}
      <div className="flex flex-wrap gap-1">
        {features.map((f) => (
          <span
            key={f.name}
            className={cn(
              'inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-qm-pill',
              f.available
                ? 'bg-qm-success/10 text-qm-success'
                : 'bg-qm-surface-medium text-qm-text-disabled',
            )}
          >
            {f.available ? <Check size={8} /> : <Minus size={8} />}
            {f.name}
            {f.detail && <span className="font-medium">({f.detail})</span>}
          </span>
        ))}
      </div>
    </div>
  )
}
