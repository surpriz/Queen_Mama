import { useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useOverlayStore } from '@/stores/overlayStore'
import { useAppStore } from '@/stores/appStore'
import { PillHeader } from './PillHeader'
import { ExpandedContent } from './ExpandedContent'
import { ContactPicker } from './ContactPicker'
import { PricingModal } from '@/components/license/PricingModal'
import * as sessionClient from '@/services/session/sessionClient'
import { toast } from '@/stores/toastStore'
import type { Contact } from '@/types/models'
import { cn } from '@/lib/utils'

export function OverlayContent() {
  const { t } = useTranslation()
  const isExpanded = useOverlayStore((s) => s.isExpanded)
  const showContactPicker = useOverlayStore((s) => s.showContactPicker)
  const setShowContactPicker = useOverlayStore((s) => s.setShowContactPicker)
  const showUpgradePricing = useAppStore((s) => s.showUpgradePricing)

  // Single place that resizes the window (store setters are pure state)
  useEffect(() => {
    window.electronAPI?.overlay.setExpanded(isExpanded)
  }, [isExpanded])

  const handleContactPickerStart = useCallback(
    async (contact: Contact | null) => {
      setShowContactPicker(false)
      const mode = useAppStore.getState().selectedMode
      try {
        await sessionClient.startSession(mode?.id ?? null, contact?.id ?? null)
      } catch (error) {
        toast.error(error instanceof Error ? error.message : String(error))
      }
    },
    [setShowContactPicker],
  )

  return (
    <div className="qm-glass-strong relative flex flex-col h-full rounded-2xl overflow-hidden">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />
      <div className="pointer-events-none absolute -top-12 -left-12 w-48 h-48 rounded-full bg-qm-accent/20 blur-3xl" />

      <PillHeader />

      <div
        className={cn('transition-[max-height,opacity] duration-300 overflow-hidden', isExpanded && 'flex-1 flex flex-col min-h-0')}
        style={{
          maxHeight: isExpanded ? 9999 : 0,
          opacity: isExpanded ? 1 : 0,
          transitionTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
        }}
      >
        <ExpandedContent />
      </div>

      {showContactPicker && (
        <ContactPicker onStart={handleContactPickerStart} onClose={() => setShowContactPicker(false)} />
      )}

      <PricingModal
        isOpen={showUpgradePricing}
        onClose={() => useAppStore.getState().setShowUpgradePricing(false)}
        contextMessage={t('pricing.limitReached')}
      />
    </div>
  )
}
