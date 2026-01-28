import { getUpgradeMessage, getUpgradeUrl } from '@/services/license/featureGating'
import type { FeatureAccess } from '@/types/auth'

interface UpgradePromptProps {
  access: FeatureAccess
}

export function UpgradePrompt({ access }: UpgradePromptProps) {
  const message = getUpgradeMessage(access)
  if (!message) return null

  const handleUpgrade = () => {
    window.electronAPI?.openExternal(getUpgradeUrl())
  }

  return (
    <div className="flex items-center justify-between p-3 rounded-qm-md bg-qm-accent/10 border border-qm-accent/20">
      <span className="text-body-sm text-qm-text-secondary">{message}</span>
      {(access.type === 'requiresPro' || access.type === 'requiresEnterprise') && (
        <button
          onClick={handleUpgrade}
          className="px-3 py-1 rounded-qm-pill bg-gradient-to-r from-qm-gradient-start to-qm-gradient-end text-white text-caption font-medium hover:shadow-qm-glow transition-shadow"
        >
          Upgrade
        </button>
      )}
    </div>
  )
}
