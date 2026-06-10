import { useEffect } from 'react'
import { useAppStore } from '@/stores/appStore'
import { useOverlayStore } from '@/stores/overlayStore'
import { useLicenseStore } from '@/stores/licenseStore'
import { loadSessions } from '@/services/session/sessionManager'
import type { ResponseType } from '@/types/models'
import type { License } from '@/types/auth'

/**
 * Listens for cross-window transcript, session state, and AI response broadcasts
 * and syncs them to the local store instances.
 * Mount this hook in both the overlay and dashboard root components.
 */
export function useTranscriptSync() {
  useEffect(() => {
    const unsubTranscript = window.electronAPI?.onTranscriptSync?.((data) => {
      const store = useAppStore.getState()
      // Only update if values actually changed (avoid unnecessary re-renders)
      if (store.currentTranscript !== data.transcript) {
        store.setCurrentTranscript(data.transcript)
      }
      if (store.interimTranscript !== data.interim) {
        store.setInterimTranscript(data.interim)
      }
      if (Math.abs(store.audioLevel - data.audioLevel) > 0.01) {
        store.setAudioLevel(data.audioLevel)
      }
    })

    const unsubSession = window.electronAPI?.onSessionStateSync?.((data) => {
      const store = useAppStore.getState()
      if (store.isSessionActive !== data.isSessionActive) {
        store.setSessionActive(data.isSessionActive)
      }
      // Sync finalization state cross-window
      if (data.isFinalizingSession !== undefined) {
        store.setFinalizingSession(data.isFinalizingSession)
      }
      // When session finalized flag is set, reload sessions from DB and show success
      if (data.sessionFinalized) {
        store.setFinalizingSession(false)
        loadSessions().then(() => {
          store.setSessionJustFinalized(true)
          // Auto-dismiss after 5 seconds
          setTimeout(() => {
            useAppStore.getState().setSessionJustFinalized(false)
          }, 5000)
        }).catch((e) => console.warn('[useTranscriptSync] Session reload after finalize failed:', e))
      }
    })

    const unsubAudioLevel = window.electronAPI?.onAudioLevelSync?.((data) => {
      const store = useAppStore.getState()
      if (Math.abs(store.audioLevel - data.audioLevel) > 0.01) {
        store.setAudioLevel(data.audioLevel)
      }
    })

    const unsubAIResponse = window.electronAPI?.onAIResponseSync?.((data) => {
      const overlay = useOverlayStore.getState()
      if (data.type === 'streaming' && data.streamingContent !== undefined) {
        // Update streaming content (only if different to avoid loops)
        if (overlay.streamingContent !== data.streamingContent) {
          overlay.setStreamingContent(data.streamingContent)
        }
      } else if (data.type === 'history' && data.entry) {
        // Add completed response to history and clear streaming
        overlay.setStreamingContent('')
        // Dedup: check if this entry already exists (avoid double-add from the originating window)
        const last = overlay.responseHistory[0]
        if (!last || last.content !== data.entry.content || last.timestamp !== data.entry.timestamp) {
          overlay.addToHistory(data.entry.type as ResponseType, data.entry.content)
        }
      }
    })

    // License sync: keep overlay in sync with main window's license state
    const unsubLicense = window.electronAPI?.onLicenseSync?.((data: { license: unknown; smartModeUsedToday: number; aiRequestsToday: number; lastValidatedAt: string | null }) => {
      const store = useLicenseStore.getState()
      const license = data.license as License
      if (store.currentLicense.plan !== license.plan || store.currentLicense.status !== license.status) {
        store.setLicense(license)
        if (data.lastValidatedAt) store.setLastValidatedAt(data.lastValidatedAt)
      }
      // Always sync usage counters
      useLicenseStore.setState({
        smartModeUsedToday: data.smartModeUsedToday,
        aiRequestsToday: data.aiRequestsToday,
      })
    })

    return () => {
      unsubTranscript?.()
      unsubSession?.()
      unsubAudioLevel?.()
      unsubAIResponse?.()
      unsubLicense?.()
    }
  }, [])
}
