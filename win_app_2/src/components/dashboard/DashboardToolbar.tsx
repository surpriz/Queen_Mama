import { useCallback, useState } from 'react'
import { Play, Square, Loader2, PanelTopOpen } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAppStore } from '@/stores/appStore'
import { KeyboardShortcutBadge } from '@/components/common/KeyboardShortcutBadge'
import { ContactPicker } from '@/components/overlay/ContactPicker'
import * as sessionClient from '@/services/session/sessionClient'
import { toast } from '@/stores/toastStore'
import type { Contact } from '@/types/models'
import { cn } from '@/lib/utils'

/**
 * Always-visible session controls at the top of the dashboard
 * (mac toolbar: Start/Stop ⌘⇧S, Toggle widget ⌘\, "generating summary" chip).
 */
export function DashboardToolbar() {
  const { t } = useTranslation('dashboard')
  const isSessionActive = useAppStore((s) => s.isSessionActive)
  const isFinalizingSession = useAppStore((s) => s.isFinalizingSession)
  const [showContactPicker, setShowContactPicker] = useState(false)

  const handleToggle = useCallback(async () => {
    if (isSessionActive) {
      try {
        await sessionClient.stopSession()
      } catch (error) {
        toast.error(error instanceof Error ? error.message : String(error))
      }
      return
    }
    setShowContactPicker(true)
  }, [isSessionActive])

  const handleStart = useCallback(async (contact: Contact | null) => {
    setShowContactPicker(false)
    const mode = useAppStore.getState().selectedMode
    try {
      await sessionClient.startSession(mode?.id ?? null, contact?.id ?? null)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error))
    }
  }, [])

  return (
    <>
      <div className="flex items-center justify-end gap-2 px-4 py-2 border-b border-qm-border-subtle bg-qm-bg-primary/80 backdrop-blur-sm sticky top-0 z-30">
        {isFinalizingSession && (
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-qm-accent/15 text-caption text-qm-accent">
            <Loader2 size={12} className="animate-spin" />
            {t('toolbar.generatingSummary')}
          </span>
        )}
        <button
          onClick={() => window.electronAPI?.overlay.toggle()}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-qm-pill text-caption font-medium text-qm-text-secondary bg-qm-surface-light hover:bg-qm-surface-hover transition-colors"
          title={t('toolbar.toggleWidget')}
        >
          <PanelTopOpen size={13} />
          {t('toolbar.toggleWidget')}
          <KeyboardShortcutBadge shortcut="Ctrl+Shift+H" size="small" className="ml-1 opacity-60" />
        </button>
        <button
          onClick={handleToggle}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-qm-pill text-caption font-medium text-white transition-all',
            isSessionActive ? 'bg-qm-error hover:bg-red-600' : 'bg-gradient-to-r from-qm-gradient-start to-qm-gradient-end hover:shadow-qm-glow',
          )}
        >
          {isSessionActive ? <Square size={12} /> : <Play size={12} />}
          {isSessionActive ? t('toolbar.stop') : t('toolbar.start')}
          <KeyboardShortcutBadge shortcut="Ctrl+Shift+S" size="small" className="ml-1 opacity-70" />
        </button>
      </div>
      {showContactPicker && <ContactPicker onStart={handleStart} onClose={() => setShowContactPicker(false)} />}
    </>
  )
}
