import { Brain, Lock } from 'lucide-react'
import { useConfigStore } from '@/stores/configStore'
import { useLicenseStore } from '@/stores/licenseStore'
import { cn } from '@/lib/utils'

export function SmartModeBadge() {
  const smartModeEnabled = useConfigStore((s) => s.smartModeEnabled)
  const isEnterprise = useLicenseStore((s) => s.isEnterprise())

  // Only show badge when Smart Mode is enabled
  if (!smartModeEnabled) return null

  return (
    <div
      className={cn(
        'flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wide border',
        'bg-qm-accent/15 text-qm-accent border-qm-accent/30'
      )}
      title="Smart Mode - Enhanced AI reasoning"
    >
      <Brain size={10} />
      <span>SMART</span>
      {!isEnterprise && <Lock size={8} className="text-qm-text-disabled" />}
    </div>
  )
}
