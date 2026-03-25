import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Crown, Check, Minus, Loader2 } from 'lucide-react'
import { Modal } from '@/components/common/Modal'
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
    { name: t('pricing.feature.export'), available: false },
    { name: t('pricing.feature.smartMode'), available: false },
    { name: t('pricing.feature.autoAnswer'), available: false },
    { name: t('pricing.feature.undetectable'), available: false },
    { name: t('pricing.feature.contextIntel'), available: false },
  ]

  const proFeatures: PlanFeature[] = [
    { name: t('pricing.feature.aiRequests'), detail: t('pricing.feature.unlimited'), available: true },
    { name: t('pricing.feature.customModes'), available: true },
    { name: t('pricing.feature.cloudSync'), available: true },
    { name: t('pricing.feature.export'), available: true },
    { name: t('pricing.feature.smartMode'), available: false },
    { name: t('pricing.feature.autoAnswer'), available: false },
    { name: t('pricing.feature.undetectable'), available: false },
    { name: t('pricing.feature.contextIntel'), available: false },
  ]

  const enterpriseFeatures: PlanFeature[] = [
    { name: t('pricing.feature.aiRequests'), detail: t('pricing.feature.unlimited'), available: true },
    { name: t('pricing.feature.customModes'), available: true },
    { name: t('pricing.feature.cloudSync'), available: true },
    { name: t('pricing.feature.export'), available: true },
    { name: t('pricing.feature.smartMode'), available: true },
    { name: t('pricing.feature.autoAnswer'), available: true },
    { name: t('pricing.feature.undetectable'), available: true },
    { name: t('pricing.feature.contextIntel'), available: true },
  ]

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="xl" showCloseButton={false}>
      <div className="space-y-5">
        {/* Context banner */}
        {contextMessage && (
          <div className="flex items-center gap-2 p-3 rounded-qm-md bg-qm-warning/10 border border-qm-warning/20">
            <span className="text-body-sm text-qm-text-secondary">{contextMessage}</span>
          </div>
        )}

        {/* Header */}
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-qm-gradient-start to-qm-gradient-end flex items-center justify-center">
            <Crown size={22} className="text-white" />
          </div>
          <h2 className="text-title-sm font-semibold text-qm-text-primary">
            {t('pricing.title')}
          </h2>
          <p className="text-body-sm text-qm-text-tertiary">{t('pricing.subtitle')}</p>
        </div>

        {/* 3 columns */}
        <div className="grid grid-cols-3 gap-4">
          <PlanColumn
            name={t('pricing.planFree')}
            price="$0"
            priceSubtitle=""
            features={freeFeatures}
            accentColor="text-qm-text-tertiary"
            isCurrent={!isPro()}
            isRecommended={false}
            ctaLabel={t('pricing.currentPlan')}
            ctaEnabled={false}
            isLoading={false}
            onUpgrade={() => {}}
          />
          <PlanColumn
            name={t('pricing.planPro')}
            price="$19"
            priceSubtitle={t('pricing.perMonth')}
            features={proFeatures}
            accentColor="text-qm-accent"
            isCurrent={currentPlan === SubscriptionPlan.Pro}
            isRecommended={true}
            ctaLabel={t('pricing.upgradePro')}
            ctaEnabled={!isPro()}
            isLoading={loadingPlan === 'pro'}
            onUpgrade={() => handleUpgrade('pro')}
          />
          <PlanColumn
            name={t('pricing.planEnterprise')}
            price="$49"
            priceSubtitle={t('pricing.perMonth')}
            features={enterpriseFeatures}
            accentColor="text-qm-warning"
            isCurrent={isEnterprise()}
            isRecommended={false}
            ctaLabel={t('pricing.upgradeEnterprise')}
            ctaEnabled={!isEnterprise()}
            isLoading={loadingPlan === 'enterprise'}
            onUpgrade={() => handleUpgrade('enterprise')}
          />
        </div>

        {/* Dismiss */}
        <div className="text-center">
          <button
            onClick={onClose}
            className="text-body-sm text-qm-text-tertiary hover:text-qm-text-secondary transition-colors"
          >
            {t('pricing.maybeLater')}
          </button>
        </div>
      </div>
    </Modal>
  )
}

// MARK: - Plan Column

interface PlanColumnProps {
  name: string
  price: string
  priceSubtitle: string
  features: PlanFeature[]
  accentColor: string
  isCurrent: boolean
  isRecommended: boolean
  ctaLabel: string
  ctaEnabled: boolean
  isLoading: boolean
  onUpgrade: () => void
}

function PlanColumn({
  name, price, priceSubtitle, features, accentColor,
  isCurrent, isRecommended, ctaLabel, ctaEnabled, isLoading, onUpgrade,
}: PlanColumnProps) {
  const { t } = useTranslation()

  return (
    <div
      className={cn(
        'flex flex-col rounded-qm-lg p-4 border',
        isRecommended
          ? 'bg-qm-surface-medium border-qm-accent/40'
          : 'bg-qm-surface-light border-qm-border-subtle',
      )}
    >
      {/* Header */}
      <div className="flex flex-col items-center gap-1 mb-3">
        {isRecommended ? (
          <span className="text-[9px] font-bold text-white px-2 py-0.5 rounded-qm-pill bg-gradient-to-r from-qm-gradient-start to-qm-gradient-end">
            {t('pricing.recommended')}
          </span>
        ) : isCurrent ? (
          <span className="text-[9px] font-bold text-qm-text-tertiary px-2 py-0.5 rounded-qm-pill bg-qm-surface-medium">
            {t('pricing.currentPlan')}
          </span>
        ) : (
          <span className="h-4" /> // spacer
        )}

        <span className="text-headline font-semibold text-qm-text-primary">{name}</span>

        <div className="flex items-baseline gap-0.5">
          <span className={cn('text-[28px] font-bold', isRecommended ? 'bg-gradient-to-r from-qm-gradient-start to-qm-gradient-end bg-clip-text text-transparent' : accentColor)}>
            {price}
          </span>
          {priceSubtitle && (
            <span className="text-caption-sm text-qm-text-tertiary">{priceSubtitle}</span>
          )}
        </div>
      </div>

      <div className="border-t border-qm-border-subtle my-2" />

      {/* Features */}
      <div className="flex-1 space-y-2">
        {features.map((f) => (
          <div key={f.name} className="flex items-start gap-2">
            {f.available ? (
              <Check size={12} className="text-qm-success mt-0.5 flex-shrink-0" />
            ) : (
              <Minus size={12} className="text-qm-text-disabled mt-0.5 flex-shrink-0" />
            )}
            <div>
              <span className={cn('text-caption-sm', f.available ? 'text-qm-text-secondary' : 'text-qm-text-disabled')}>
                {f.name}
              </span>
              {f.detail && (
                <span className={cn('block text-[9px]', f.available ? accentColor : 'text-qm-text-disabled')}>
                  {f.detail}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* CTA */}
      <div className="mt-4">
        {ctaEnabled ? (
          <button
            onClick={onUpgrade}
            disabled={isLoading}
            className={cn(
              'w-full py-2 rounded-qm-md text-caption font-medium text-white transition-all',
              isRecommended
                ? 'bg-gradient-to-r from-qm-gradient-start to-qm-gradient-end hover:shadow-qm-glow'
                : 'bg-qm-warning hover:brightness-110',
            )}
          >
            {isLoading ? <Loader2 size={14} className="animate-spin mx-auto" /> : ctaLabel}
          </button>
        ) : (
          <div className="w-full py-2 rounded-qm-md text-caption text-qm-text-tertiary bg-qm-surface-light text-center">
            {ctaLabel}
          </div>
        )}
      </div>
    </div>
  )
}
