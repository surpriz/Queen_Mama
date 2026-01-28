/**
 * Session Lifecycle Orchestrator
 *
 * Wires all services together into the complete session flow:
 * startSession → audioCapture + transcription + screenCapture → AI → stopSession → title/summary → sync
 */

import { useAppStore } from '@/stores/appStore'
import { useOverlayStore } from '@/stores/overlayStore'
import { audioCaptureService } from '@/services/audio/audioCaptureService'
import { transcriptionService } from '@/services/transcription/transcriptionService'
import { screenCaptureService } from '@/services/screenCapture/screenCaptureService'
import { sessionManager } from '@/services/session/sessionManager'
import * as aiService from '@/services/ai/aiService'
import { autoAnswerService } from '@/services/detection/autoAnswerService'
import { syncManager } from '@/services/sync/syncManager'
import { analyticsService } from '@/services/analytics/analyticsService'
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
    currentSessionId = await sessionManager.startSession(mode ?? undefined)

    // Start audio capture
    await audioCaptureService.start()

    // Connect audio to transcription
    audioCaptureService.onAudioData((buffer) => {
      transcriptionService.sendAudio(buffer)
    })

    // Set up transcription callbacks
    transcriptionService.onTranscript((text, isFinal) => {
      if (isFinal) {
        const current = useAppStore.getState().currentTranscript
        const separator = current.length > 0 ? ' ' : ''
        const newTranscript = current + separator + text
        store.setCurrentTranscript(newTranscript)

        // Persist transcript entry
        if (currentSessionId) {
          sessionManager.addTranscriptEntry(currentSessionId, 'user', text, true)
        }

        // Feed to auto-answer detection
        const config = useAppStore.getState()
        if (config.selectedMode) {
          autoAnswerService.onTranscriptReceived(newTranscript)
        }
      }
    })

    transcriptionService.onError((error) => {
      console.error('[SessionLifecycle] Transcription error:', error)
    })

    // Connect transcription
    await transcriptionService.connect()

    // Start screen capture if enabled
    const appConfig = await configurationManager.load()
    if (appConfig.screenshotEnabled) {
      screenCaptureService.startAutoCapture(appConfig.screenshotInterval ?? 30000)
    }

    // Poll audio level for UI
    audioLevelInterval = setInterval(() => {
      useAppStore.getState().setAudioLevel(audioCaptureService.getAudioLevel())
    }, 100)

    // Set up auto-answer callback
    autoAnswerService.onAutoTrigger(async () => {
      const transcript = useAppStore.getState().currentTranscript
      const selectedMode = useAppStore.getState().selectedMode
      await aiService.assist(transcript, selectedMode)
    })

    // Analytics
    analyticsService.trackSessionStarted(currentSessionId)
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

        if (title) sessionManager.setTitle(currentSessionId, title)
        if (summary) sessionManager.setSummary(currentSessionId, summary)
      } catch (err) {
        console.error('[SessionLifecycle] Failed to generate title/summary:', err)
      }
    }

    // End session record
    if (currentSessionId) {
      sessionManager.endSession(currentSessionId)

      // Queue for sync
      syncManager.queueSession(currentSessionId)

      // Analytics
      analyticsService.trackSessionEnded(currentSessionId)
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
  audioCaptureService.stop()
  transcriptionService.disconnect()
  screenCaptureService.stopAutoCapture()
  autoAnswerService.stop()

  if (audioLevelInterval) {
    clearInterval(audioLevelInterval)
    audioLevelInterval = null
  }

  useAppStore.getState().setAudioLevel(0)
}

export function getCurrentSessionId(): string | null {
  return currentSessionId
}
