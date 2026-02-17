import { useEffect, useCallback } from 'react'
import { toggleSession } from '@/services/sessionLifecycle'
import * as aiService from '@/services/ai/aiService'
import * as autoAnswer from '@/services/detection/autoAnswerService'
import { useAppStore } from '@/stores/appStore'

/**
 * Registers global keyboard shortcut handlers.
 * Called from App.tsx to wire IPC shortcut events to app actions.
 */
export function useKeyboardShortcuts(): void {
  const handleToggleSession = useCallback(() => {
    console.log('[Shortcuts] IPC received: SESSION_TOGGLE')
    const mode = useAppStore.getState().selectedMode
    toggleSession(mode)
  }, [])

  const handleToggleWidget = useCallback(() => {
    console.log('[Shortcuts] IPC received: TOGGLE_WIDGET')
    useAppStore.getState().toggleOverlay()
  }, [])

  const handleTriggerAssist = useCallback(() => {
    console.log('[Shortcuts] IPC received: TRIGGER_ASSIST')
    const { currentTranscript, selectedMode, isProcessing } = useAppStore.getState()
    if (isProcessing) {
      console.log('[Shortcuts] Already processing, skipping duplicate assist')
      return
    }
    if (currentTranscript) {
      // Reset auto-answer cooldown so it won't fire right after manual trigger
      autoAnswer.recordManualTrigger()
      aiService.assist(currentTranscript, selectedMode)
    }
  }, [])

  const handleClearContext = useCallback(() => {
    console.log('[Shortcuts] IPC received: CLEAR_CONTEXT')
    useAppStore.getState().clearContext()
  }, [])

  useEffect(() => {
    console.log('[Shortcuts] Setting up IPC listeners, electronAPI available:', !!window.electronAPI)
    const unsubscribers: (() => void)[] = []

    const unsub1 = window.electronAPI?.onSessionToggle(handleToggleSession)
    if (unsub1) unsubscribers.push(unsub1)

    const unsub2 = window.electronAPI?.onShortcutToggleWidget(handleToggleWidget)
    if (unsub2) unsubscribers.push(unsub2)

    const unsub3 = window.electronAPI?.onShortcutTriggerAssist(handleTriggerAssist)
    if (unsub3) unsubscribers.push(unsub3)

    const unsub4 = window.electronAPI?.onShortcutClearContext(handleClearContext)
    if (unsub4) unsubscribers.push(unsub4)

    console.log(`[Shortcuts] ${unsubscribers.length} IPC listeners registered`)

    return () => {
      unsubscribers.forEach((unsub) => unsub())
    }
  }, [handleToggleSession, handleToggleWidget, handleTriggerAssist, handleClearContext])
}
