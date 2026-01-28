import { useEffect, useCallback } from 'react'
import { toggleSession } from '@/services/sessionLifecycle'
import * as aiService from '@/services/ai/aiService'
import { useAppStore } from '@/stores/appStore'

/**
 * Registers global keyboard shortcut handlers.
 * Called from App.tsx to wire IPC shortcut events to app actions.
 */
export function useKeyboardShortcuts(): void {
  const handleToggleSession = useCallback(() => {
    const mode = useAppStore.getState().selectedMode
    toggleSession(mode)
  }, [])

  const handleToggleWidget = useCallback(() => {
    useAppStore.getState().toggleOverlay()
  }, [])

  const handleTriggerAssist = useCallback(() => {
    const { currentTranscript, selectedMode } = useAppStore.getState()
    if (currentTranscript) {
      aiService.assist(currentTranscript, selectedMode)
    }
  }, [])

  const handleClearContext = useCallback(() => {
    useAppStore.getState().clearContext()
  }, [])

  useEffect(() => {
    const unsubscribers: (() => void)[] = []

    const unsub1 = window.electronAPI?.onSessionToggle(handleToggleSession)
    if (unsub1) unsubscribers.push(unsub1)

    const unsub2 = window.electronAPI?.onShortcutToggleWidget(handleToggleWidget)
    if (unsub2) unsubscribers.push(unsub2)

    const unsub3 = window.electronAPI?.onShortcutTriggerAssist(handleTriggerAssist)
    if (unsub3) unsubscribers.push(unsub3)

    const unsub4 = window.electronAPI?.onShortcutClearContext(handleClearContext)
    if (unsub4) unsubscribers.push(unsub4)

    return () => {
      unsubscribers.forEach((unsub) => unsub())
    }
  }, [handleToggleSession, handleToggleWidget, handleTriggerAssist, handleClearContext])
}
