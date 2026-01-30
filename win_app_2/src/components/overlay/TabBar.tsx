import { Sparkles, MessageSquare, HelpCircle, RotateCcw } from 'lucide-react'
import { useOverlayStore } from '@/stores/overlayStore'
import { ResponseType } from '@/types/models'
import { cn } from '@/lib/utils'

const TABS = [
  { type: ResponseType.Assist, label: 'Assist', icon: Sparkles },
  { type: ResponseType.WhatToSay, label: 'Say', icon: MessageSquare },
  { type: ResponseType.FollowUp, label: 'Follow-up', icon: HelpCircle },
  { type: ResponseType.Recap, label: 'Recap', icon: RotateCcw },
] as const

export function TabBar() {
  const selectedTab = useOverlayStore((s) => s.selectedTab)
  const setSelectedTab = useOverlayStore((s) => s.setSelectedTab)

  return (
    <div className="flex items-center px-2 border-b border-qm-border-subtle" style={{ height: 36 }}>
      {TABS.map(({ type, label, icon: Icon }) => (
        <button
          key={type}
          onClick={() => setSelectedTab(type)}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 text-caption font-medium rounded-qm-sm transition-colors',
            selectedTab === type
              ? 'text-qm-accent bg-qm-accent/10'
              : 'text-qm-text-tertiary hover:text-qm-text-secondary hover:bg-qm-surface-light',
          )}
        >
          <Icon size={12} />
          {label}
        </button>
      ))}
    </div>
  )
}
