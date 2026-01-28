import { Lock } from 'lucide-react'
import { getUpgradeUrl } from '@/services/license/featureGating'

interface ProFeatureBannerProps {
  featureName: string
  description?: string
}

export function ProFeatureBanner({ featureName, description }: ProFeatureBannerProps) {
  const handleUpgrade = () => {
    window.electronAPI?.openExternal(getUpgradeUrl())
  }

  return (
    <div className="flex flex-col items-center gap-3 p-6 rounded-qm-lg bg-qm-surface-medium border border-qm-border-subtle">
      <div className="p-3 rounded-full bg-qm-accent/10">
        <Lock size={24} className="text-qm-accent" />
      </div>

      <h3 className="text-title-sm font-semibold text-qm-text-primary">{featureName}</h3>

      {description && (
        <p className="text-body-sm text-qm-text-secondary text-center max-w-sm">{description}</p>
      )}

      <button
        onClick={handleUpgrade}
        className="px-6 py-2 rounded-qm-pill bg-gradient-to-r from-qm-gradient-start to-qm-gradient-end text-white text-body-sm font-medium hover:shadow-qm-glow transition-shadow"
      >
        Upgrade to Pro
      </button>
    </div>
  )
}
