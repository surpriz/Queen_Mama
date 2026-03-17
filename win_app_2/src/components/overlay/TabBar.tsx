import { Sparkles, MessageSquare, MessageCircleQuestion, RotateCcw } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useOverlayStore } from '@/stores/overlayStore'
import { ResponseType } from '@/types/models'
import { cn } from '@/lib/utils'

interface TabBarProps {
  onTabSelected?: (type: ResponseType) => void
}

export function TabBar({ onTabSelected }: TabBarProps) {
  const { t } = useTranslation('overlay')
  const selectedTab = useOverlayStore((s) => s.selectedTab)
  const setSelectedTab = useOverlayStore((s) => s.setSelectedTab)

  const TABS = [
    { type: ResponseType.Assist, label: t('tabs.assist'), icon: Sparkles },
    { type: ResponseType.WhatToSay, label: t('tabs.whatToSay'), icon: MessageSquare },
    { type: ResponseType.FollowUp, label: t('tabs.followUp'), icon: MessageCircleQuestion },
    { type: ResponseType.Recap, label: t('tabs.recap'), icon: RotateCcw },
  ] as const

  return (
    <div className="px-2 pt-1 pb-1.5">
      <div className="flex items-center gap-1.5">
        {TABS.map(({ type, label, icon: Icon }) => (
          <button
            key={type}
            onClick={() => {
              setSelectedTab(type)
              onTabSelected?.(type)
            }}
            className={cn(
              'flex flex-1 flex-col items-center justify-center gap-1 py-2 rounded-xl transition-all duration-200',
              'active:scale-95',
              selectedTab === type
                ? 'bg-gradient-to-br from-qm-gradient-start/20 to-qm-gradient-end/20 border border-qm-accent/40 text-qm-accent shadow-[0_2px_8px_rgba(139,92,246,0.2)]'
                : 'bg-qm-surface-light border border-white/10 text-qm-text-tertiary hover:text-qm-text-secondary hover:bg-qm-surface-hover hover:border-white/15',
            )}
            style={{ height: 44 }}
          >
            <Icon size={14} strokeWidth={selectedTab === type ? 2.5 : 2} />
            <span
              className={cn(
                'text-[9px] leading-none',
                selectedTab === type ? 'font-semibold' : 'font-medium',
              )}
            >
              {label}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}
