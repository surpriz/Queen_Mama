import { Sparkles, MessageSquare, MessageCircleQuestion, RotateCcw, Languages } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useOverlayStore } from '@/stores/overlayStore'
import { useConfigStore } from '@/stores/configStore'
import { useLicenseStore } from '@/stores/licenseStore'
import { Feature } from '@/types/auth'
import { ResponseType } from '@/types/models'
import { cn } from '@/lib/utils'

interface TabBarProps {
  onTabSelected?: (type: ResponseType) => void
}

export function TabBar({ onTabSelected }: TabBarProps) {
  const { t } = useTranslation('overlay')
  const selectedTab = useOverlayStore((s) => s.selectedTab)
  const setSelectedTab = useOverlayStore((s) => s.setSelectedTab)
  const translationEnabled = useConfigStore((s) => s.translationEnabled)
  const translationShowInOverlay = useConfigStore((s) => s.translationShowInOverlay)
  const canUseTranslation = useLicenseStore((s) => s.isFeatureAvailable(Feature.LiveTranslation))

  const TABS: ReadonlyArray<{ type: ResponseType; label: string; icon: typeof Sparkles }> = [
    { type: ResponseType.Assist, label: t('tabs.assist'), icon: Sparkles },
    { type: ResponseType.WhatToSay, label: t('tabs.whatToSay'), icon: MessageSquare },
    { type: ResponseType.FollowUp, label: t('tabs.followUp'), icon: MessageCircleQuestion },
    { type: ResponseType.Recap, label: t('tabs.recap'), icon: RotateCcw },
    ...(translationEnabled && translationShowInOverlay && canUseTranslation
      ? [{ type: ResponseType.Translate, label: t('tabs.translate'), icon: Languages }]
      : []),
  ]

  return (
    <div className="px-2 pt-1 pb-1.5">
      <div className="flex items-center gap-1.5">
        {TABS.map(({ type, label, icon: Icon }) => {
          const isActive = selectedTab === type
          return (
            <button
              key={type}
              onClick={() => {
                setSelectedTab(type)
                onTabSelected?.(type)
              }}
              className={cn(
                'group relative flex flex-1 flex-col items-center justify-center gap-1 py-2 rounded-xl transition-all duration-200 active:scale-95',
                isActive
                  ? 'bg-qm-accent-soft text-qm-text-primary shadow-qm-glow'
                  : 'bg-qm-surface-light text-qm-text-tertiary hover:text-qm-text-primary hover:bg-qm-surface-hover',
              )}
              style={{ height: 44 }}
            >
              {/* Active indicator dot above icon */}
              {isActive && (
                <span className="absolute top-1.5 right-2 w-1.5 h-1.5 rounded-full bg-qm-accent-light shadow-[0_0_6px_rgba(167,139,250,0.8)]" />
              )}
              <Icon
                size={14}
                strokeWidth={isActive ? 2.25 : 1.75}
                className={cn(
                  'transition-transform duration-200',
                  isActive ? 'text-qm-accent-light scale-105' : 'group-hover:scale-105',
                )}
              />
              <span
                className={cn(
                  'text-[9px] leading-none tracking-wide transition-colors',
                  isActive ? 'font-semibold text-qm-text-primary' : 'font-medium',
                )}
              >
                {label}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
