import { Sparkles, MessageSquare, HelpCircle, RotateCcw } from 'lucide-react'
import { motion } from 'framer-motion'
import { useOverlayStore } from '@/stores/overlayStore'
import { ResponseType } from '@/types/models'
import { cn } from '@/lib/utils'

const TABS = [
  { type: ResponseType.Assist, label: 'Assist', icon: Sparkles },
  { type: ResponseType.WhatToSay, label: 'What to say', icon: MessageSquare },
  { type: ResponseType.FollowUp, label: 'Follow-up', icon: HelpCircle },
  { type: ResponseType.Recap, label: 'Recap', icon: RotateCcw },
] as const

export function TabBar() {
  const selectedTab = useOverlayStore((s) => s.selectedTab)
  const setSelectedTab = useOverlayStore((s) => s.setSelectedTab)

  return (
    <div className="flex items-center gap-0.5 px-2 py-1.5 border-b border-qm-border-subtle" style={{ height: 36 }}>
      {TABS.map(({ type, label, icon: Icon }) => {
        const isSelected = selectedTab === type
        return (
          <button
            key={type}
            onClick={() => setSelectedTab(type)}
            className="relative flex items-center gap-1.5 px-3 py-1.5 text-caption font-medium rounded-qm-md transition-colors"
          >
            {/* Animated background for selected tab */}
            {isSelected && (
              <motion.div
                layoutId="activeTabBackground"
                className="absolute inset-0 rounded-qm-md bg-gradient-to-r from-qm-gradient-start to-qm-gradient-end"
                transition={{
                  type: 'spring',
                  stiffness: 500,
                  damping: 35,
                }}
              />
            )}
            {/* Icon and label */}
            <Icon
              size={12}
              className={cn(
                'relative z-10 transition-colors',
                isSelected ? 'text-white' : 'text-qm-text-tertiary',
              )}
            />
            <span
              className={cn(
                'relative z-10 transition-colors',
                isSelected ? 'text-white' : 'text-qm-text-tertiary hover:text-qm-text-secondary',
              )}
            >
              {label}
            </span>
          </button>
        )
      })}
    </div>
  )
}
