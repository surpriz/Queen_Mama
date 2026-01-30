/**
 * Session Lifecycle Orchestrator
 *
 * Wires all services together into the complete session flow:
 * startSession → audioCapture + transcription + screenCapture → AI → stopSession → title/summary → sync
 */

import { useAppStore } from '@/stores/appStore'
import { useOverlayStore } from '@/stores/overlayStore'
import * as audioCapture from '@/services/audio/audioCaptureService'
import * as transcription from '@/services/transcription/transcriptionService'
import { screenCaptureService } from '@/services/screenCapture/screenCaptureService'
import * as sessionMgr from '@/services/session/sessionManager'
import * as aiService from '@/services/ai/aiService'
import * as autoAnswer from '@/services/detection/autoAnswerService'
import * as syncManager from '@/services/sync/syncManager'
import * as analytics from '@/services/analytics/analyticsService'
import { configurationManager } from '@/services/config/configurationManager'
import type { Mode } from '@/types/models'

let audioLevelInterval: ReturnType<typeof setInterval> | null = null
let currentSessionId: string | null = null

export async function startSession(mode?: Mode | null): Promise<void> {
  const store = useAppStore.getState()
  if (store.isSessionActive) return

  try {
    store.setSessionActive(true)
    store.setErrorMessage(null)
    store.setCurrentTranscript('')
    useOverlayStore.getState().setStreamingContent('')

    // Create session record
    const session = sessionMgr.startSession('New Session', mode?.id ?? null)
    currentSessionId = session.id

    // Start audio capture
    await audioCapture.startCapture()

    // Connect audio to transcription
    audioCapture.setOnAudioBuffer((buffer) => {
      transcription.sendAudio(buffer)
    })

    // Set up transcription callbacks
    transcription.setCallbacks({
      onTranscript: (text: string, isFinal: boolean) => {
        if (isFinal) {
          const current = useAppStore.getState().currentTranscript
          const separator = current.length > 0 ? ' ' : ''
          const newTranscript = current + separator + text
          store.setCurrentTranscript(newTranscript)

          // Persist transcript entry
          if (currentSessionId) {
            sessionMgr.addTranscriptEntry(currentSessionId, 'user', text, true)
          }

          // Feed to auto-answer detection
          autoAnswer.onTranscriptReceived(newTranscript)
        }
      },
      onError: (error: string) => {
        console.error('[SessionLifecycle] Transcription error:', error)
      },
      onConnectionChange: (connected: boolean) => {
        console.log('[SessionLifecycle] Transcription connected:', connected)
      },
    })

    // Connect transcription
    await transcription.connect()

    // Start screen capture if enabled
    const appConfig = await configurationManager.load()
    if (appConfig.screenshotEnabled) {
      screenCaptureService.startAutoCapture(appConfig.screenshotInterval ?? 30000)
    }

    // Poll audio level for UI
    audioLevelInterval = setInterval(() => {
      // Audio level is updated via the callback set in audioCaptureService
      // We read it from the service directly
    }, 100)

    // Set up auto-answer callback
    autoAnswer.setOnTrigger(async () => {
      const transcript = useAppStore.getState().currentTranscript
      const selectedMode = useAppStore.getState().selectedMode
      await aiService.assist(transcript, selectedMode)
    })

    // Analytics
    analytics.trackSessionStarted()
  } catch (error) {
    console.error('[SessionLifecycle] Failed to start session:', error)
    store.setErrorMessage(error instanceof Error ? error.message : 'Failed to start session')
    store.setSessionActive(false)
    cleanup()
  }
}

export async function stopSession(): Promise<void> {
  const store = useAppStore.getState()
  if (!store.isSessionActive) return

  store.setFinalizingSession(true)

  try {
    // Stop all services
    cleanup()

    store.setSessionActive(false)

    // Generate title and summary
    if (currentSessionId && store.currentTranscript.length > 50) {
      try {
        const title = await aiService.generateSessionTitle(store.currentTranscript)
        const summary = await aiService.generateSessionSummary(store.currentTranscript)

        if (title && currentSessionId) {
          // Update session title via session manager
          sessionMgr.updateTranscript(title)
        }
        if (summary && currentSessionId) {
          sessionMgr.setSummary(summary)
        }
      } catch (err) {
        console.error('[SessionLifecycle] Failed to generate title/summary:', err)
      }
    }

    // End session record
    if (currentSessionId) {
      sessionMgr.endSession()

      // Queue for sync
      const session = sessionMgr.startSession // reference the session
      // Analytics
      analytics.trackSessionEnded()
    }

    currentSessionId = null
  } finally {
    store.setFinalizingSession(false)
  }
}

export async function toggleSession(mode?: Mode | null): Promise<void> {
  const store = useAppStore.getState()
  if (store.isSessionActive) {
    await stopSession()
  } else {
    await startSession(mode)
  }
}

function cleanup(): void {
  audioCapture.stopCapture()
  transcription.disconnect()
  screenCaptureService.stopAutoCapture()
  autoAnswer.reset()

  if (audioLevelInterval) {
    clearInterval(audioLevelInterval)
    audioLevelInterval = null
  }

  useAppStore.getState().setAudioLevel(0)
}

export function getCurrentSessionId(): string | null {
  return currentSessionId
}
