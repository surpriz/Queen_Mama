import { Sparkles, MessageSquare, MessageCircleQuestion, RotateCcw } from 'lucide-react'
import { useOverlayStore } from '@/stores/overlayStore'
import { ResponseType } from '@/types/models'
import { cn } from '@/lib/utils'

const TABS = [
  { type: ResponseType.Assist, label: 'Assist', icon: Sparkles },
  { type: ResponseType.WhatToSay, label: 'What to say', icon: MessageSquare },
  { type: ResponseType.FollowUp, label: 'Follow-up', icon: MessageCircleQuestion },
  { type: ResponseType.Recap, label: 'Recap', icon: RotateCcw },
] as const

interface TabBarProps {
  onTabSelected?: (type: ResponseType) => void
}

export function TabBar({ onTabSelected }: TabBarProps) {
  const selectedTab = useOverlayStore((s) => s.selectedTab)
  const setSelectedTab = useOverlayStore((s) => s.setSelectedTab)

  return (
    <div className="px-2 pt-1.5 pb-1">
      <div className="flex items-center bg-qm-surface-light rounded-qm-md p-[3px]" style={{ height: 34 }}>
        {TABS.map(({ type, label, icon: Icon }) => (
          <button
            key={type}
            onClick={() => {
              setSelectedTab(type)
              onTabSelected?.(type)
            }}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 text-caption font-medium rounded-qm-sm transition-colors',
              selectedTab === type
                ? 'text-qm-accent bg-gradient-to-br from-qm-gradient-start/20 to-qm-gradient-end/20 border border-qm-accent/30'
                : 'text-qm-text-tertiary hover:text-qm-text-secondary hover:bg-qm-surface-hover border border-white/[0.04]',
            )}
          >
            <Icon size={12} />
            {label}
          </button>
        ))}
      </div>
    </div>
  )
}
