import { useEffect, useState, useCallback } from 'react'
import { Coins, Minus, Plus } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAppStore } from '@/stores/appStore'
import { useConfigStore } from '@/stores/configStore'
import { cn } from '@/lib/utils'

const CURRENCY_SYMBOLS: Record<string, string> = { EUR: '€', USD: '$', GBP: '£', CHF: 'CHF', CAD: 'CA$' }

export function formatMeetingCost(amount: number, currency: string): string {
  const symbol = CURRENCY_SYMBOLS[currency] ?? currency
  const value = amount >= 100 ? Math.round(amount).toString() : amount.toFixed(amount >= 10 ? 1 : 2)
  return symbol.length === 1 ? `${value} ${symbol}` : `${value} ${symbol}`
}

/**
 * Live meeting cost in the pill (mac `MeetingCostIndicator` parity):
 * participants × hourly rate × elapsed time, with a ± stepper for participants.
 */
export function MeetingCostIndicator() {
  const { t } = useTranslation('overlay')
  const isSessionActive = useAppStore((s) => s.isSessionActive)
  const sessionStartedAt = useAppStore((s) => s.sessionStartedAt)
  const enabled = useConfigStore((s) => s.meetingCostEnabled)
  const currency = useConfigStore((s) => s.meetingCostCurrency)
  const hourlyRate = useConfigStore((s) => s.meetingCostHourlyRate)
  const participants = useConfigStore((s) => s.meetingCostParticipants)
  const updateConfig = useConfigStore((s) => s.updateConfig)
  const [now, setNow] = useState(Date.now())
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    if (!enabled || !isSessionActive) return
    const timer = setInterval(() => setNow(Date.now()), 5000)
    return () => clearInterval(timer)
  }, [enabled, isSessionActive])

  const adjust = useCallback(
    (delta: number) => {
      updateConfig({ meetingCostParticipants: Math.max(1, Math.min(50, participants + delta)) })
    },
    [participants, updateConfig],
  )

  if (!enabled || !isSessionActive || !sessionStartedAt) return null

  const hours = Math.max(0, now - sessionStartedAt) / 3_600_000
  const cost = participants * hourlyRate * hours

  return (
    <div
      className={cn(
        'flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-qm-surface-medium transition-colors',
        expanded && 'bg-qm-surface-hover',
      )}
      style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      onClick={(e) => e.stopPropagation()}
      title={t('meetingCost.tooltip', { participants, rate: hourlyRate, currency })}
    >
      <button onClick={() => setExpanded((v) => !v)} className="flex items-center gap-1">
        <Coins size={11} className="text-amber-300" />
        <span className="text-caption-sm font-semibold text-amber-200 tabular-nums">{formatMeetingCost(cost, currency)}</span>
      </button>
      {expanded && (
        <div className="flex items-center gap-0.5 ml-1">
          <button onClick={() => adjust(-1)} className="p-0.5 rounded-full hover:bg-white/10 text-qm-text-secondary" title={t('meetingCost.fewer')}>
            <Minus size={10} />
          </button>
          <span className="text-caption-sm text-qm-text-secondary tabular-nums">{participants}</span>
          <button onClick={() => adjust(1)} className="p-0.5 rounded-full hover:bg-white/10 text-qm-text-secondary" title={t('meetingCost.more')}>
            <Plus size={10} />
          </button>
        </div>
      )}
    </div>
  )
}
