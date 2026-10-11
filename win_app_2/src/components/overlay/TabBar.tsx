import { useCallback, useEffect, useRef, useState } from 'react'
import { Sparkles, MessageSquare, MessageCircleQuestion, RotateCcw, BookA, Languages, UserRound } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useOverlayStore } from '@/stores/overlayStore'
import { useAppStore } from '@/stores/appStore'
import { useConfigStore } from '@/stores/configStore'
import { useLicenseStore } from '@/stores/licenseStore'
import { Feature } from '@/types/auth'
import { ResponseType } from '@/types/models'
import { cn } from '@/lib/utils'

interface TabBarProps {
  onTabSelected?: (type: ResponseType) => void
}

const HINT_DELAY_MS = 500
const HINT_GRACE_MS = 120

export function TabBar({ onTabSelected }: TabBarProps) {
  const { t } = useTranslation('overlay')
  const selectedTab = useOverlayStore((s) => s.selectedTab)
  const setSelectedTab = useOverlayStore((s) => s.setSelectedTab)
  const translationEnabled = useConfigStore((s) => s.translationEnabled)
  const translationShowInOverlay = useConfigStore((s) => s.translationShowInOverlay)
  const showDecode = useConfigStore((s) => s.showDecodeInOverlay)
  const hasLinkedContact = useAppStore((s) => s.currentContactId !== null)
  const canUseTranslation = useLicenseStore((s) => s.isFeatureAvailable(Feature.LiveTranslation))

  const TABS: ReadonlyArray<{ type: ResponseType; label: string; hint: string; icon: typeof Sparkles }> = [
    { type: ResponseType.Assist, label: t('tabs.assist'), hint: t('tabHints.assist'), icon: Sparkles },
    { type: ResponseType.WhatToSay, label: t('tabs.whatToSay'), hint: t('tabHints.whatToSay'), icon: MessageSquare },
    { type: ResponseType.FollowUp, label: t('tabs.followUp'), hint: t('tabHints.followUp'), icon: MessageCircleQuestion },
    { type: ResponseType.Recap, label: t('tabs.recap'), hint: t('tabHints.recap'), icon: RotateCcw },
    // Decode is opt-in (mac `showDecodeInOverlay`): six tabs don't fit a 380 px pill
    ...(showDecode ? [{ type: ResponseType.Decode, label: t('tabs.decode'), hint: t('tabHints.decode'), icon: BookA }] : []),
    // Briefing only when the running session is linked to a contact (mac parity)
    ...(hasLinkedContact ? [{ type: ResponseType.Briefing, label: t('tabs.briefing'), hint: t('tabHints.briefing'), icon: UserRound }] : []),
    ...(translationEnabled && translationShowInOverlay && canUseTranslation
      ? [{ type: ResponseType.Translate, label: t('tabs.translate'), hint: t('tabHints.translate'), icon: Languages }]
      : []),
  ]

  // Full-width hint above the bar (a per-button tooltip would be clipped at
  // the panel edges). Appears after a short hover, then follows the pointer
  // across buttons without delay (mac TabBar parity).
  const [hintTab, setHintTab] = useState<ResponseType | null>(null)
  const hintTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearTimer = () => {
    if (hintTimer.current) {
      clearTimeout(hintTimer.current)
      hintTimer.current = null
    }
  }

  const handleHover = useCallback(
    (type: ResponseType, hovering: boolean) => {
      clearTimer()
      if (hovering) {
        if (hintTab !== null) {
          setHintTab(type)
          return
        }
        hintTimer.current = setTimeout(() => setHintTab(type), HINT_DELAY_MS)
      } else {
        hintTimer.current = setTimeout(() => setHintTab(null), HINT_GRACE_MS)
      }
    },
    [hintTab],
  )

  useEffect(() => clearTimer, [])

  const hint = hintTab ? TABS.find((tab) => tab.type === hintTab)?.hint : null

  // If the selected tab just got hidden (Decode toggled off), fall back to Assist
  useEffect(() => {
    if (!TABS.some((tab) => tab.type === selectedTab)) setSelectedTab(ResponseType.Assist)
  }, [TABS.length, selectedTab, setSelectedTab]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="relative px-2 pt-1 pb-1.5">
      {hint && (
        <div className="pointer-events-none absolute left-2 right-2 -top-7 z-20 animate-qm-fade-in">
          <div className="px-2.5 py-1 rounded-lg bg-qm-bg-secondary/95 border border-white/10 shadow-qm-lg text-caption text-qm-text-secondary text-center truncate">
            {hint}
          </div>
        </div>
      )}
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
              onMouseEnter={() => handleHover(type, true)}
              onMouseLeave={() => handleHover(type, false)}
              className={cn(
                'group relative flex flex-1 flex-col items-center justify-center gap-1 py-2 rounded-xl transition-all duration-200 active:scale-95',
                isActive
                  ? 'bg-qm-accent-soft text-qm-text-primary shadow-qm-glow'
                  : 'bg-qm-surface-light text-qm-text-tertiary hover:text-qm-text-primary hover:bg-qm-surface-hover',
              )}
              style={{ height: 44 }}
            >
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
