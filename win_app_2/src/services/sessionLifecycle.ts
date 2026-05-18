/**
 * Session Lifecycle Orchestrator
 *
 * Wires all services together into the complete session flow:
 * startSession → audioCapture + transcription + screenCapture → AI → stopSession → title/summary → sync
 */

import { captureError, addBreadcrumb } from '@/services/crash/crashReporter'
import { useAppStore } from '@/stores/appStore'
import { useOverlayStore, setOverlaySessionId } from '@/stores/overlayStore'
import * as audioCapture from '@/services/audio/audioCaptureService'
import * as transcription from '@/services/transcription/transcriptionService'
import { screenCaptureService } from '@/services/screenCapture/screenCaptureService'
import * as sessionMgr from '@/services/session/sessionManager'
import * as aiService from '@/services/ai/aiService'
import * as autoAnswer from '@/services/detection/autoAnswerService'
import { processTranscriptForMoments, clearMomentState, onMomentsDetected, type DetectedMoment } from '@/services/detection/momentDetectionService'
import * as syncManager from '@/services/sync/syncManager'
import * as analytics from '@/services/analytics/analyticsService'
import { configurationManager } from '@/services/config/configurationManager'
import { useConfigStore } from '@/stores/configStore'
import { ResponseType, type Mode } from '@/types/models'
import { extractContactsFromTranscript } from '@/services/contacts/contactExtractor'
import * as contactSyncService from '@/services/contacts/contactSyncService'
import * as contactDb from '@/services/contacts/contactDb'
import { useContactStore } from '@/stores/contactStore'
import { transcriptBuffer, TranscriptBuffer } from '@/services/transcription/transcriptBuffer'
import * as dedup from '@/services/transcription/transcriptDeduplicator'
import type { Contact } from '@/types/models'

const MAX_TRANSCRIPT_MEMORY = 50000 // 50KB - max in-memory transcript size for display
const systemTranscriptBuffer = new TranscriptBuffer()

let audioLevelInterval: ReturnType<typeof setInterval> | null = null
let currentSessionId: string | null = null
let unsubscribeMoments: (() => void) | null = null
let fullTranscript = '' // Always grows, persisted to DB via sessionMgr.updateTranscript()
let userSpeakerIndex: number | null = null // First speaker seen in single-stream diarized fallback = mic owner = "Moi"

export async function startSession(mode?: Mode | null, contact?: Contact | null): Promise<void> {
  const store = useAppStore.getState()
  if (store.isSessionActive) return

  try {
    store.setSessionActive(true)
    addBreadcrumb('session', 'Session started', 'info')
    store.setErrorMessage(null)
    store.setCurrentTranscript('')
    fullTranscript = ''
    userSpeakerIndex = null
    useOverlayStore.getState().setStreamingContent('')

    // Broadcast session started to all windows
    window.electronAPI?.relay?.broadcast('relay:session-state', {
      isSessionActive: true,
      sessionStartedAt: store.sessionStartedAt,
    })

    // Create session record
    const session = sessionMgr.startSession('New Session', mode?.id ?? null)
    currentSessionId = session.id
    setOverlaySessionId(session.id)

    // Link contact to session if provided
    if (contact && currentSessionId) {
      await contactDb.linkContactToSession(contact.id, currentSessionId)
      // Update contact lastSeen and sessionCount
      const now = new Date().toISOString()
      const updated = { ...contact, lastSeen: now, sessionCount: contact.sessionCount + 1, updatedAt: now }
      await contactDb.upsertContact(updated)
      useContactStore.getState().addContact(updated)
    }

    // Start audio capture (dual-stream: mic + system audio separately)
    await audioCapture.startCapture()

    // Connect mic audio → primary Deepgram (for "Moi")
    audioCapture.setOnMicAudioBuffer((buffer) => {
      transcription.sendAudio(buffer)
    })

    // Connect system audio → secondary Deepgram (for "Interlocuteur")
    audioCapture.setOnSystemAudioBuffer((buffer) => {
      transcription.sendSystemAudio(buffer)
    })

    // Connect audio level for UI feedback
    audioCapture.setOnAudioLevel((level) => {
      useAppStore.getState().setAudioLevel(level)
    })

    // Check if system audio was captured — if not, enable Deepgram diarization as fallback
    const hasSystem = audioCapture.hasSystemAudio()
    if (hasSystem) {
      // Dual-stream mode: system audio → second Deepgram WS
      transcription.connectSystemAudio().catch((err) => {
        console.warn('[Session] System audio WebSocket failed (continuing without):', err)
      })
      console.log('[Session] Dual-stream diarization active')
    } else {
      // Fallback: enable Deepgram diarize=true on mic stream
      transcription.enableDiarization()
      console.log('[Session] System audio unavailable — using Deepgram single-stream diarization fallback')
    }

    // Helper: update UI + broadcast after transcript changes
    const updateTranscriptUI = () => {
      const currentStore = useAppStore.getState()
      let displayTranscript = fullTranscript
      if (displayTranscript.length > MAX_TRANSCRIPT_MEMORY) {
        displayTranscript = '[...previous content truncated...]\n\n' + displayTranscript.slice(-MAX_TRANSCRIPT_MEMORY)
      }
      currentStore.setCurrentTranscript(displayTranscript)
      currentStore.setInterimTranscript('')

      window.electronAPI?.relay?.broadcast('relay:transcript', {
        transcript: displayTranscript,
        interim: '',
        audioLevel: currentStore.audioLevel,
        isSessionActive: true,
        sessionStartedAt: currentStore.sessionStartedAt,
      })

      autoAnswer.onTranscriptReceived(fullTranscript)
      const config = useConfigStore.getState()
      if (config.proactiveEnabled) {
        processTranscriptForMoments(fullTranscript)
      }
    }

    // Start transcript buffers (mic: 250ms, system: 2s for sentence-level batching)
    transcriptBuffer.start((_batchedText: string) => updateTranscriptUI())

    systemTranscriptBuffer.start((batchedText: string) => {
      // Register in dedup so mic bleed will be filtered
      dedup.addSystemTranscript(batchedText)

      // Add to full transcript as "Interlocuteur"
      const labeled = `Interlocuteur: ${batchedText}`
      fullTranscript = fullTranscript + (fullTranscript.length > 0 ? '\n' : '') + labeled
      sessionMgr.updateTranscript(fullTranscript)
      if (currentSessionId) {
        sessionMgr.addTranscriptEntry('Interlocuteur', batchedText, true)
      }
      updateTranscriptUI()
    })

    // Set up transcription callbacks (dual-stream with dedup)
    transcription.setCallbacks({
      // --- MIC TRANSCRIPTS → "Moi" (with bleed filtering) ---
      onTranscript: (text: string) => {
        // Check if this mic transcript is bleed from the speakers
        if (dedup.isMicTranscriptBleed(text)) {
          console.log(`[Session] Dropped mic bleed: "${text.substring(0, 60)}"`)
          return
        }

        const labeled = `Moi: ${text}`
        fullTranscript = fullTranscript + (fullTranscript.length > 0 ? '\n' : '') + labeled
        sessionMgr.updateTranscript(fullTranscript)
        if (currentSessionId) {
          sessionMgr.addTranscriptEntry('Moi', text, true)
        }
        transcriptBuffer.append(text)
      },
      onInterimTranscript: (text: string) => {
        const currentStore = useAppStore.getState()
        currentStore.setInterimTranscript(text)

        window.electronAPI?.relay?.broadcast('relay:transcript', {
          transcript: currentStore.currentTranscript,
          interim: text,
          audioLevel: currentStore.audioLevel,
          isSessionActive: true,
          sessionStartedAt: currentStore.sessionStartedAt,
        })
      },

      // --- DIARIZED MIC TRANSCRIPTS (fallback when system audio unavailable) ---
      // Deepgram speaker indices are session-relative (0, 1, ...) and assigned
      // in order of detection. The mic owner almost always speaks first after
      // hitting "start session", so we pin the first index we see as "Moi".
      onDiarizedTranscript: (text: string, speaker: number) => {
        if (userSpeakerIndex === null) {
          userSpeakerIndex = speaker
        }
        const label = speaker === userSpeakerIndex ? 'Moi' : 'Interlocuteur'
        const labeled = `${label}: ${text}`
        fullTranscript = fullTranscript + (fullTranscript.length > 0 ? '\n' : '') + labeled
        sessionMgr.updateTranscript(fullTranscript)
        if (currentSessionId) {
          sessionMgr.addTranscriptEntry(label, text, true)
        }
        transcriptBuffer.append(text)
      },

      // --- SYSTEM AUDIO TRANSCRIPTS → "Interlocuteur" ---
      onSystemTranscript: (text: string) => {
        systemTranscriptBuffer.append(text)
      },
      onSystemInterimTranscript: (text: string) => {
        // Feed interims into dedup immediately (before mic diarized arrives)
        dedup.addSystemTranscript(text)
      },
      onError: async (error: Error) => {
        console.error('[SessionLifecycle] Transcription error:', error.message)
        useAppStore.getState().setErrorMessage(error.message)
        // Report to Sentry so we have visibility on transcription failures
        try {
          const { captureError } = await import('@/services/crash/crashReporter')
          captureError(error, { service: 'transcription', sessionId: currentSessionId })
        } catch { /* noop */ }
      },
      onConnectionChanged: (connected: boolean, provider: string | null) => {
        console.log('[SessionLifecycle] Transcription connected:', connected, provider)
      },
    })

    // Connect transcription
    transcription.resetDisconnectFlag()
    await transcription.connect()

    // Start screen capture if enabled
    const appConfig = await configurationManager.load()
    if (appConfig.autoScreenCapture) {
      screenCaptureService.startAutoCapture((appConfig.screenCaptureIntervalSeconds ?? 5) * 1000)
    }

    // Broadcast audio level to all windows at 10fps (every 100ms)
    // This ensures the dashboard sidebar shows audio level even when
    // the session was started from the overlay window
    audioLevelInterval = setInterval(() => {
      const currentLevel = useAppStore.getState().audioLevel
      window.electronAPI?.relay?.broadcast('relay:audio-level', {
        audioLevel: currentLevel,
      })
    }, 100)

    // Configure auto-answer from user settings
    const userConfig = useConfigStore.getState()
    autoAnswer.setConfig({
      enabled: userConfig.autoAnswerEnabled,
      silenceThreshold: userConfig.autoAnswerSilenceThreshold,
      cooldown: userConfig.autoAnswerCooldown,
      minWordsForSilence: 20,
      minWordsForQuestion: 10,
      minWordsForSentence: 50,
    })

    // Set up auto-answer callback
    autoAnswer.setOnTrigger(async () => {
      const { currentTranscript: transcript, selectedMode, isProcessing } = useAppStore.getState()
      if (isProcessing) {
        console.log('[SessionLifecycle] Auto-answer skipped: AI already processing')
        return
      }
      const overlayStore = useOverlayStore.getState()
      overlayStore.setAutoAnswer(true)
      await aiService.assist(transcript, selectedMode)
    })

    // Set up proactive moment detection callback
    unsubscribeMoments = onMomentsDetected(async (moments: DetectedMoment[]) => {
      if (moments.length === 0) return
      const { currentTranscript: transcript, selectedMode, isProcessing } = useAppStore.getState()
      if (isProcessing) {
        console.log('[SessionLifecycle] Moment detection skipped: AI already processing')
        return
      }
      const topMoment = moments[0]
      const overlayStore = useOverlayStore.getState()

      // Map moment type to appropriate response type
      const responseTypeMap: Record<string, ResponseType> = {
        objection: ResponseType.WhatToSay,
        expertiseQuestion: ResponseType.Assist,
        hesitation: ResponseType.WhatToSay,
        closingOpportunity: ResponseType.WhatToSay,
      }
      const responseType = responseTypeMap[topMoment.type] || ResponseType.Assist

      overlayStore.setAutoAnswer(true)
      overlayStore.setSelectedTab(responseType)
      if (!overlayStore.isExpanded) overlayStore.setExpanded(true)

      // Trigger appropriate AI response with moment context
      const momentContext = `[DETECTED: ${topMoment.type.toUpperCase()} - "${topMoment.triggerPhrase}"]\n`
      await aiService.assist(momentContext + transcript, selectedMode)
    })

    // Analytics
    analytics.trackSessionStarted()
  } catch (error) {
    console.error('[SessionLifecycle] Failed to start session:', error)
    captureError(
      error instanceof Error ? error : new Error('Failed to start session'),
      { service: 'session', operation: 'start' },
    )
    store.setErrorMessage(error instanceof Error ? error.message : 'Failed to start session')
    store.setSessionActive(false)
    cleanup()

    // Broadcast failure to all windows so dashboard exits "Live Session" state
    window.electronAPI?.relay?.broadcast('relay:session-state', {
      isSessionActive: false,
      sessionStartedAt: null,
    })
  }
}

export async function stopSession(): Promise<void> {
  const store = useAppStore.getState()
  if (!store.isSessionActive) return

  store.setFinalizingSession(true)
  addBreadcrumb('session', `Session stopped (transcript: ${fullTranscript.length} chars)`, 'info')

  try {
    // Stop all services
    cleanup()

    store.setSessionActive(false)

    // Broadcast session stopped + finalizing to all windows
    window.electronAPI?.relay?.broadcast('relay:session-state', {
      isSessionActive: false,
      sessionStartedAt: null,
      isFinalizingSession: true,
    })

    // Generate title and summary from transcript + AI responses
    let generatedTitle: string | null = null
    let generatedSummary: string | null = null

    if (currentSessionId) {
      // Build session content for title/summary generation
      const aiResponses = useOverlayStore.getState().responseHistory
      const aiResponsesText = aiResponses
        .map((r) => `[AI ${r.type}]: ${r.content}`)
        .reverse()
        .join('\n')
      const sessionContent = [fullTranscript, aiResponsesText].filter(Boolean).join('\n\n')

      console.log(`[SessionLifecycle] Session content length: ${sessionContent.length} chars (transcript: ${fullTranscript.length}, AI responses: ${aiResponses.length})`)

      // Try AI generation for title
      if (sessionContent.length > 10) {
        try {
          generatedTitle = await aiService.generateSessionTitle(sessionContent)
          console.log(`[SessionLifecycle] Title generated: "${generatedTitle}"`)
        } catch (titleErr) {
          console.error('[SessionLifecycle] Title generation failed:', titleErr)
          captureError(
            titleErr instanceof Error ? titleErr : new Error('Session title generation failed'),
            { service: 'session', operation: 'generateTitle', sessionId: currentSessionId },
          )
        }

        try {
          generatedSummary = await aiService.generateSessionSummary(sessionContent)
          console.log(`[SessionLifecycle] AI Summary: ${generatedSummary ? generatedSummary.length + ' chars' : 'null'}`)
        } catch (summaryErr) {
          console.error('[SessionLifecycle] Summary generation failed:', summaryErr)
          captureError(
            summaryErr instanceof Error ? summaryErr : new Error('Session summary generation failed'),
            { service: 'session', operation: 'generateSummary', sessionId: currentSessionId },
          )
        }
      }

      // Fallback 1: basic summary from transcript preview (ALWAYS runs if AI failed)
      if (!generatedSummary && fullTranscript.length > 10) {
        const lang = useConfigStore.getState().primaryLanguage || 'multi'
        const previewText = fullTranscript.slice(0, 200).trim()
        generatedSummary = lang === 'fr'
          ? `📝 Résumé automatique — ${previewText}...`
          : `📝 Auto-summary — ${previewText}...`
        console.log('[SessionLifecycle] Using fallback summary from transcript preview')
      }

      // Fallback 2: last resort — always produce something
      if (!generatedSummary) {
        const lang = useConfigStore.getState().primaryLanguage || 'multi'
        generatedSummary = lang === 'fr'
          ? `📝 Session enregistrée le ${new Date().toLocaleDateString('fr-FR')}`
          : `📝 Session recorded on ${new Date().toLocaleDateString('en-US')}`
        console.log('[SessionLifecycle] Using last-resort fallback summary')
      }

      console.log(`[SessionLifecycle] Final summary (${generatedSummary.length} chars): ${generatedSummary.slice(0, 80)}...`)

      // Extract contacts from transcript
      try {
        const extractedContacts = await extractContactsFromTranscript(fullTranscript, currentSessionId)
        if (extractedContacts.length > 0) {
          const contactStore = useContactStore.getState()
          for (const contact of extractedContacts) {
            contactStore.addContact(contact)
          }
          console.log(`[SessionLifecycle] Extracted ${extractedContacts.length} contacts`)
          // Push newly created/updated contacts to server
          contactSyncService.pushContacts().catch(() => {})
        }
      } catch (err) {
        console.error('[SessionLifecycle] Contact extraction failed:', err)
        captureError(
          err instanceof Error ? err : new Error('Contact extraction failed'),
          { service: 'session', operation: 'contactExtraction', sessionId: currentSessionId },
        )
      }

      // Finalize: write transcript + title + summary + endTime to DB in one awaited call
      await sessionMgr.finalizeSession(
        currentSessionId,
        fullTranscript,
        generatedTitle,
        generatedSummary,
      )

      // Queue for sync AFTER finalize so summary is included
      syncManager.queueSessionForSync(currentSessionId)

      // Analytics
      analytics.trackSessionEnded(0, fullTranscript.length, fullTranscript.length > 0)
    }

    currentSessionId = null
    setOverlaySessionId(null)
    fullTranscript = ''

    // Refresh session list from DB (now guaranteed to have all data)
    await sessionMgr.loadSessions()

    // Notify all windows that session is finalized (so dashboard reloads sessions)
    window.electronAPI?.relay?.broadcast('relay:session-state', {
      isSessionActive: false,
      sessionStartedAt: null,
      isFinalizingSession: false,
      sessionFinalized: true,
    })

    // Also set success state on local store
    store.setSessionJustFinalized(true)
    setTimeout(() => {
      useAppStore.getState().setSessionJustFinalized(false)
    }, 5000)
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
  transcriptBuffer.stop()
  systemTranscriptBuffer.stop()
  dedup.reset()
  audioCapture.stopCapture()
  transcription.disconnect()
  screenCaptureService.stopAutoCapture()
  autoAnswer.reset()
  clearMomentState()

  if (unsubscribeMoments) {
    unsubscribeMoments()
    unsubscribeMoments = null
  }

  if (audioLevelInterval) {
    clearInterval(audioLevelInterval)
    audioLevelInterval = null
  }

  useAppStore.getState().setAudioLevel(0)
}

export function getCurrentSessionId(): string | null {
  return currentSessionId
}
