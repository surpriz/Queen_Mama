import { useEffect } from 'react'
import { useAppStore } from '@/stores/appStore'
import { useOverlayStore } from '@/stores/overlayStore'
import { useLicenseStore } from '@/stores/licenseStore'
import { useDictationStore } from '@/stores/dictationStore'
import { useMomentStore } from '@/stores/momentStore'
import { loadSessions } from '@/services/session/sessionManager'
import { modesService } from '@/services/modes/modesService'
import * as relay from '@/services/relay/relayClient'
import { applyAuthRelay } from '@/services/relay/authRelay'
import type { ResponseType } from '@/types/models'
import type {
  AiResponseRelay,
  AiStateRelay,
  LicenseRelay,
  ModeRelay,
  SessionStateRelay,
  TranscriptRelay,
} from '@/types/relay'

/**
 * Mirrors host-owned state into this window's stores.
 * Mount once per UI window (dashboard, overlay, notification).
 *
 * Boot order: subscribe first, then apply the snapshot. Sequence numbers in
 * the relay client guarantee the snapshot never overwrites a newer event.
 */

function applyTranscript(data: TranscriptRelay): void {
  const store = useAppStore.getState()
  if (store.currentTranscript !== data.transcript) store.setCurrentTranscript(data.transcript)
  if (store.interimTranscript !== data.interim) store.setInterimTranscript(data.interim)
  if (Math.abs(store.audioLevel - data.audioLevel) > 0.01) store.setAudioLevel(data.audioLevel)
}

function applySessionState(data: SessionStateRelay): void {
  const store = useAppStore.getState()
  if (store.isSessionActive !== data.isSessionActive) {
    store.setSessionActive(data.isSessionActive)
  }
  if (data.sessionStartedAt !== undefined && data.sessionStartedAt !== store.sessionStartedAt) {
    useAppStore.setState({ sessionStartedAt: data.sessionStartedAt })
  }
  if (data.isFinalizingSession !== undefined) {
    store.setFinalizingSession(data.isFinalizingSession)
  }
  if (data.sessionFinalized) {
    store.setFinalizingSession(false)
    loadSessions()
      .then(() => {
        useAppStore.getState().setSessionJustFinalized(true)
        setTimeout(() => useAppStore.getState().setSessionJustFinalized(false), 5000)
      })
      .catch((e) => console.warn('[RelaySync] Session reload after finalize failed:', e))
  }
}

function applyAiState(data: AiStateRelay): void {
  const store = useAppStore.getState()
  if (store.isProcessing !== data.isProcessing) store.setProcessing(data.isProcessing)
}

function applyAiResponse(data: AiResponseRelay): void {
  const overlay = useOverlayStore.getState()
  if (data.type === 'streaming') {
    if (overlay.streamingContent !== data.streamingContent) {
      overlay.setStreamingContent(data.streamingContent)
    }
  } else if (data.type === 'history') {
    overlay.setStreamingContent('')
    overlay.addToHistory(data.entry.type as ResponseType, data.entry.content, {
      id: data.entry.id,
      timestamp: data.entry.timestamp,
      provider: data.entry.provider,
      isAutomatic: data.entry.isAutomatic,
      sessionId: data.entry.sessionId ?? null,
    })
  } else if (data.type === 'clear') {
    if (overlay.responseHistory.length > 0 || overlay.streamingContent) overlay.clearHistory()
  }
}

function applyLicense(data: LicenseRelay): void {
  if (!data?.license) return
  useLicenseStore.setState({
    currentLicense: data.license,
    smartModeUsedToday: data.smartModeUsedToday,
    aiRequestsToday: data.aiRequestsToday,
    lastValidatedAt: data.lastValidatedAt,
    isOffline: data.isOffline ?? false,
    isValidating: false,
  })
}

async function applyMode(data: ModeRelay): Promise<void> {
  const current = useAppStore.getState().selectedMode
  if ((current?.id ?? null) === data.modeId) return
  const mode = data.modeId ? await modesService.getById(data.modeId) : null
  useAppStore.getState().setSelectedMode(mode)
}

export function useRelaySync(): void {
  useEffect(() => {
    const unsubs: Array<() => void> = [
      relay.on('relay:transcript', applyTranscript),
      relay.on('relay:session-state', applySessionState),
      relay.on('relay:audio-level', (data) => {
        const store = useAppStore.getState()
        if (Math.abs(store.audioLevel - data.audioLevel) > 0.01) store.setAudioLevel(data.audioLevel)
      }),
      relay.on('relay:ai-state', applyAiState),
      relay.on('relay:ai-response', applyAiResponse),
      relay.on('relay:license', applyLicense),
      relay.on('relay:dictation', (data) => useDictationStore.getState().apply(data)),
      relay.on('relay:moment', (data) => useMomentStore.getState().show(data)),
      relay.on('relay:mode', (data) => void applyMode(data)),
      relay.on('relay:error', (data) => useAppStore.getState().setErrorMessage(data.message)),
    ]

    let cancelled = false
    void relay.getSnapshot().then((snap) => {
      if (cancelled) return
      if (snap['relay:auth']) applyAuthRelay(snap['relay:auth'])
      if (snap['relay:license']) applyLicense(snap['relay:license'])
      if (snap['relay:session-state']) applySessionState(snap['relay:session-state'])
      if (snap['relay:transcript']) applyTranscript(snap['relay:transcript'])
      if (snap['relay:ai-state']) applyAiState(snap['relay:ai-state'])
      if (snap['relay:dictation']) useDictationStore.getState().apply(snap['relay:dictation'])
      if (snap['relay:mode']) void applyMode(snap['relay:mode'])
    })

    return () => {
      cancelled = true
      unsubs.forEach((u) => u())
    }
  }, [])
}
