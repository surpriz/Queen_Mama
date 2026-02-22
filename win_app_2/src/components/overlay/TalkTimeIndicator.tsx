import { cn } from '@/lib/utils'
import type { TalkTimeStats, BalanceState } from '@/services/detection/talkTimeService'

// ---------------------------------------------------------------------------
// Balance badge configuration
// ---------------------------------------------------------------------------

const BALANCE_CONFIG: Record<BalanceState, { label: string; color: string; bgColor: string }> = {
  noData: {
    label: 'En attente',
    color: 'text-qm-text-tertiary',
    bgColor: 'bg-qm-surface-medium',
  },
  balanced: {
    label: 'Equilibre',
    color: 'text-qm-success',
    bgColor: 'bg-qm-success-light',
  },
  slightImbalance: {
    label: 'Attention',
    color: 'text-qm-warning',
    bgColor: 'bg-qm-warning-light',
  },
  strongImbalance: {
    label: 'Desequilibre',
    color: 'text-qm-error',
    bgColor: 'bg-qm-error-light',
  },
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface TalkTimeIndicatorProps {
  stats: TalkTimeStats
}

export function TalkTimeIndicator({ stats }: TalkTimeIndicatorProps) {
  const { mePercent, otherPercent, balance } = stats
  const badgeCfg = BALANCE_CONFIG[balance]
  const hasData = balance !== 'noData'

  return (
    <div className="flex flex-col gap-1.5 px-3 py-2">
      {/* Labels row */}
      <div className="flex items-center justify-between">
        <span className="text-caption-sm font-medium text-qm-accent-light">
          Moi{hasData ? ` ${mePercent}%` : ''}
        </span>

        {/* Balance badge */}
        <div
          className={cn(
            'px-1.5 py-0.5 rounded-qm-pill text-caption-sm font-semibold',
            badgeCfg.bgColor,
            badgeCfg.color,
          )}
        >
          {badgeCfg.label}
        </div>

        <span className="text-caption-sm font-medium text-qm-info">
          {hasData ? `${otherPercent}% ` : ''}Interlocuteur
        </span>
      </div>

      {/* Progress bar */}
      <div className="relative h-2 w-full rounded-qm-pill bg-qm-surface-medium overflow-hidden">
        {hasData ? (
          <>
            {/* "Moi" segment - purple gradient from left */}
            <div
              className="absolute inset-y-0 left-0 rounded-l-qm-pill"
              style={{
                width: `${mePercent}%`,
                background: 'linear-gradient(to right, #7C3AED, #8B5CF6)',
                transition: 'width 0.5s ease-in-out',
              }}
            />
            {/* "Interlocuteur" segment - blue gradient from right */}
            <div
              className="absolute inset-y-0 right-0 rounded-r-qm-pill"
              style={{
                width: `${otherPercent}%`,
                background: 'linear-gradient(to left, #3B82F6, #60A5FA)',
                transition: 'width 0.5s ease-in-out',
              }}
            />
          </>
        ) : (
          /* Empty state: subtle pulsing placeholder */
          <div className="absolute inset-0 bg-qm-surface-hover animate-pulse rounded-qm-pill" />
        )}
      </div>
    </div>
  )
}
