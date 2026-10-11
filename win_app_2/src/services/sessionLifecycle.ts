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
import { processTranscriptForMoments, clearMomentState, onMomentsDetected, setMomentDetectionOptions, type DetectedMoment } from '@/services/detection/momentDetectionService'
import * as syncManager from '@/services/sync/syncManager'
import * as analytics from '@/services/analytics/analyticsService'
import { configurationManager } from '@/services/config/configurationManager'
import { useConfigStore } from '@/stores/configStore'
import { ResponseType, type Mode } from '@/types/models'
import { extractContactsFromTranscript } from '@/services/contacts/contactExtractor'
import * as contactSyncService from '@/services/contacts/contactSyncService'
import * as contactDb from '@/services/contacts/contactDb'
import { useContactStore } from '@/stores/contactStore'
import { transcriptBuffer, TranscriptBuffer, SYSTEM_FLUSH_INTERVAL } from '@/services/transcription/transcriptBuffer'
import * as healthCheck from '@/services/health/healthCheckService'
import * as dedup from '@/services/transcription/transcriptDeduplicator'
import * as echoCanceller from '@/services/audio/echoCanceller'
import { EnergyVAD } from '@/services/audio/energyVad'
import * as translationService from '@/services/translation/translationService'
import { dictationService } from '@/services/dictation/dictationService'
import * as relay from '@/services/relay/relayClient'

// Local VAD gates: one per stream, independent state. Reset on session end.
const micVad = new EnergyVAD({}, 'mic')
const systemVad = new EnergyVAD({}, 'system')
import * as proxyConfig from '@/services/proxy/proxyConfigManager'
import { useLicenseStore } from '@/stores/licenseStore'
import { Feature } from '@/types/auth'
import type { Contact } from '@/types/models'
import { toast } from '@/stores/toastStore'
import i18n from '@/i18n'
import { withTimeout } from '@/lib/utils'
import * as preGeneration from '@/services/ai/preGenerationService'

const MAX_TRANSCRIPT_MEMORY = 50000 // 50KB - max in-memory transcript size for display
const systemTranscriptBuffer = new TranscriptBuffer(SYSTEM_FLUSH_INTERVAL) // 2 s, mac parity
const SYSTEM_AUDIO_STALE_MS = 3000
let audioHealthTimer: ReturnType<typeof setInterval> | null = null
let lastAudioHealthKey = ''
let transcriptionErrorsReported = 0
let lastSystemInterim = ''
let unsubscribeConfig: (() => void) | null = null

/** Push the current settings into the detectors (called at start and on every config change). */
function applyDetectionConfig(): void {
  const cfg = useConfigStore.getState()
  const canAutoAnswer = useLicenseStore.getState().isFeatureAvailable(Feature.AutoAnswer)
  autoAnswer.setConfig({
    enabled: cfg.autoAnswerEnabled && canAutoAnswer,
    silenceThreshold: cfg.autoAnswerSilenceThreshold,
    cooldown: cfg.autoAnswerCooldown,
    minWordsForSilence: 20,
    minWordsForQuestion: 10,
    minWordsForSentence: 50,
  })
  setMomentDetectionOptions({
    sensitivity: cfg.proactiveSensitivity,
    cooldownSeconds: cfg.proactiveCooldown,
    enabledTypes: {
      objection: cfg.proactiveObjectionsEnabled,
      expertiseQuestion: cfg.proactiveQuestionsEnabled,
      hesitation: cfg.proactiveHesitationsEnabled,
      closingOpportunity: cfg.proactiveClosingEnabled,
    },
  })
}

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
    useOverlayStore.getState().clearTranslations()
    translationService.resetContext()
    preGeneration.reset()
    preGeneration.configure(() => useAppStore.getState().selectedMode)

    // Create session record
    const session = sessionMgr.startSession('New Session', mode?.id ?? null)
    currentSessionId = session.id
    setOverlaySessionId(session.id)

    // Broadcast session started to all windows
    window.electronAPI?.relay?.broadcast('relay:session-state', {
      isSessionActive: true,
      sessionStartedAt: useAppStore.getState().sessionStartedAt,
      currentSessionId,
    })

    // Link contact to session if provided
    if (contact && currentSessionId) {
      await contactDb.linkContactToSession(contact.id, currentSessionId)
      // Update contact lastSeen and sessionCount
      const now = new Date().toISOString()
      const updated = { ...contact, lastSeen: now, sessionCount: contact.sessionCount + 1, updatedAt: now }
      await contactDb.upsertContact(updated)
      useContactStore.getState().addContact(updated)
    }

    // Start audio capture (dual-stream: mic + system audio separately).
    // getUserMedia can hang forever on Windows (pending permission dialog,
    // locked device) — without a timeout the Start button freezes silently.
    await withTimeout(audioCapture.startCapture(), 15000, 'Audio capture start')

    // Connect mic audio → AEC (remove speaker bleed) → primary Deepgram (for "Moi").
    // Cancelling echo at the signal level keeps bleed out of Deepgram so it can't be
    // mis-labelled "Moi".
    audioCapture.setOnMicAudioBuffer((buffer) => {
      const cleaned = echoCanceller.process(buffer)
      // Dictation shares the echo-cancelled mic stream while a session runs
      // (it never opened its own socket feed before — it heard nothing).
      if (dictationService.isRecording()) {
        dictationService.sendAudio(cleaned)
      }
      // Gate silence before transcription so Deepgram only bills/transcribes speech.
      if (useConfigStore.getState().vadEnabled) {
        for (const frame of micVad.process(cleaned)) transcription.sendAudio(frame)
      } else {
        transcription.sendAudio(cleaned)
      }
    })

    // Connect system audio → secondary Deepgram (for "Interlocuteur").
    // Also feed it to the AEC as the far-end reference (the echo source).
    audioCapture.setOnSystemAudioBuffer((buffer) => {
      // AEC reference must stay continuous → push raw before any VAD gating.
      echoCanceller.pushReference(buffer)
      if (useConfigStore.getState().vadEnabled) {
        for (const frame of systemVad.process(buffer)) transcription.sendSystemAudio(frame)
      } else {
        transcription.sendSystemAudio(buffer)
      }
    })

    // Connect audio level for UI feedback
    // Capture already throttles the meter to 10 Hz; relay at 4 Hz for the UI
    // windows (was a separate 100 ms interval running for the whole session).
    let lastLevelRelayAt = 0
    audioCapture.setOnAudioLevel((level) => {
      useAppStore.getState().setAudioLevel(level)
      const now = Date.now()
      if (now - lastLevelRelayAt >= 250 || level === 0) {
        lastLevelRelayAt = now
        relay.broadcast('relay:audio-level', { audioLevel: level })
      }
    })

    // Check if system audio was captured — if not, enable Deepgram diarization as fallback.
    // For dual-stream we defer connectSystemAudio() until AFTER transcription.connect() runs:
    // connectSystemAudio mirrors the mic provider class via `instanceof` on currentProvider,
    // and currentProvider is only set once connect() resolves. Calling it earlier means the
    // system stream falls back to the default DeepgramProvider (Nova-3), which on accounts
    // configured for Flux is `isConfigured=false` and the proxy closes the WS with code 1006.
    const hasSystem = audioCapture.hasSystemAudio()
    // Set explicitly every session: the flag used to stick, so one session
    // without system audio diarized the mic for every later session.
    transcription.setDiarization(!hasSystem)
    if (!hasSystem) {
      console.log('[Session] System audio unavailable — using Deepgram single-stream diarization fallback')
    }
    if (audioCapture.isMicUnavailable()) {
      toast.warning(i18n.t('error.micUnavailable', { defaultValue: 'Microphone unavailable — only the other side will be transcribed' }), undefined, 8000)
    }
    startAudioHealthMonitor(hasSystem)

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
      preGeneration.onTranscriptUpdated(fullTranscript)
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
      let entryId: string | null = null
      if (currentSessionId) {
        const entry = sessionMgr.addTranscriptEntry('Interlocuteur', batchedText, true)
        entryId = entry.id
      }
      updateTranscriptUI()

      // Fire-and-forget translation. Never block transcript pipeline.
      // Gated to Enterprise plan — Free/Pro users do not consume DeepL credits.
      const userCfg = useConfigStore.getState()
      const canUseTranslation = useLicenseStore.getState().isFeatureAvailable(Feature.LiveTranslation)
      if (
        entryId &&
        userCfg.translationEnabled &&
        proxyConfig.isTranslationEnabled() &&
        canUseTranslation
      ) {
        translationService
          .translate({
            entryId,
            sessionId: currentSessionId,
            text: batchedText,
            sourceLang: userCfg.translationSourceLanguage,
            targetLang: userCfg.translationTargetLanguage,
          })
          .catch((err) => console.warn('[SessionLifecycle] Translation rejected:', err))
      }
    })

    // Set up transcription callbacks (dual-stream with dedup)
    transcription.setCallbacks({
      // --- MIC TRANSCRIPTS → "Moi" (with bleed filtering) ---
      onTranscript: (text: string) => {
        // Check if this mic transcript is bleed from the speakers.
        // When AEC is active the bleed is already cancelled in the audio, so we skip the
        // blanket temporal suppression (it dropped the user's own speech).
        if (dedup.isMicTranscriptBleed(text, echoCanceller.isActive())) {
          console.log(`[Session] Dropped mic bleed: "${text.substring(0, 60)}"`)
          return
        }

        const labeled = `Moi: ${text}`
        fullTranscript = fullTranscript + (fullTranscript.length > 0 ? '\n' : '') + labeled
        sessionMgr.updateTranscript(fullTranscript)
        if (currentSessionId) {
          sessionMgr.addTranscriptEntry('Moi', text, true)
        }
        healthCheck.recordWordsTranscribed(text.split(/\s+/).filter(Boolean).length)
        transcriptBuffer.append(text)
      },
      onInterimTranscript: (text: string) => {
        useAppStore.getState().setInterimTranscript(text)
        autoAnswer.onInterimTranscript(text)
        // Interims are frequent: relay only the interim text, not the whole
        // transcript (up to 50 KB per message before).
        relay.broadcast('relay:interim', { interim: text })
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
      onSystemInterimTranscript: (text: string) => {
        // Feed interims into dedup immediately (before mic diarized arrives)
        dedup.addSystemTranscript(text)
        lastSystemInterim = text
      },
      onSystemTranscript: (text: string) => {
        lastSystemInterim = ''
        systemTranscriptBuffer.append(text)
      },
      onError: (error: Error) => {
        console.error('[SessionLifecycle] Transcription error:', error.message)
        useAppStore.getState().setErrorMessage(error.message)
        // Report the first error of a session; the provider layer already reports
        // the terminal states (all providers failed / recovery exhausted).
        if (transcriptionErrorsReported === 0) {
          transcriptionErrorsReported++
          captureError(error, { service: 'transcription', sessionId: currentSessionId })
        }
      },
      onConnectionChanged: (connected: boolean, provider: string | null) => {
        console.log('[SessionLifecycle] Transcription connected:', connected, provider)
        if (connected) {
          // Clear any stale transcription error once we're back online
          useAppStore.getState().setErrorMessage(null)
        }
        relay.broadcast('relay:transcription', { connected, provider, recoveryCountdown: 0 })
      },
      // Fired once per recovery cycle; countdown=-1 means recovery gave up for good.
      // Without this the session keeps running with no transcript and no warning.
      onReconnectionBudgetExhausted: (countdown: number) => {
        relay.broadcast('relay:transcription', { connected: false, provider: null, recoveryCountdown: countdown })
        if (countdown === -1) {
          const msg = i18n.t('error.transcriptionStoppedMessage')
          toast.error(i18n.t('error.transcriptionStopped'), msg, 0)
          useAppStore.getState().setErrorMessage(msg)
        } else {
          toast.warning(
            i18n.t('error.transcriptionRetrying', { seconds: countdown }),
            undefined,
            8000,
          )
        }
      },
    })

    // Connect transcription
    transcription.resetDisconnectFlag()
    await transcription.connect()

    // Now that the mic provider is selected, fire the system-audio WebSocket
    // so it mirrors the same provider class (Flux vs Nova-3) via `instanceof`.
    if (hasSystem) {
      transcription.connectSystemAudio().catch((err) => {
        console.warn('[Session] System audio WebSocket failed (continuing without):', err)
      })
      console.log('[Session] Dual-stream diarization active')
    }

    // Start screen capture if enabled
    const appConfig = await configurationManager.load()
    if (appConfig.autoScreenCapture) {
      screenCaptureService.startAutoCapture((appConfig.screenCaptureIntervalSeconds ?? 5) * 1000)
    }

    // Broadcast audio level to all windows at 10fps (every 100ms)
    // This ensures the dashboard sidebar shows audio level even when
    // the session was started from the overlay window

    // Configure auto-answer from user settings

    // Detector settings follow the config live (toggling Auto / Proactive
    // mid-session used to do nothing until the next session).
    applyDetectionConfig()
    unsubscribeConfig?.()
    unsubscribeConfig = useConfigStore.subscribe(() => applyDetectionConfig())
    aiService.setSystemInterimProvider(() => lastSystemInterim)

    // Set up auto-answer callback
    autoAnswer.setOnTrigger(async () => {
      const { currentTranscript: transcript, selectedMode, isProcessing } = useAppStore.getState()
      if (isProcessing) {
        console.log('[SessionLifecycle] Auto-answer skipped: AI already processing')
        return
      }
      await aiService.assist(transcript, selectedMode, undefined, { isAutomatic: true })
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

      overlayStore.setSelectedTab(responseType)
      // The overlay renderer owns its expanded state; ask it instead of
      // resizing the window from here (which left its React state collapsed).
      relay.broadcast('relay:overlay', { expand: true, selectTab: responseType })

      // Trigger appropriate AI response with moment context
      const momentContext = `[DETECTED: ${topMoment.type.toUpperCase()} - "${topMoment.triggerPhrase}"]\n`
      await aiService.assist(momentContext + transcript, selectedMode, undefined, { skipPreGen: true, isAutomatic: true })
    })

    // Analytics
    analytics.trackSessionStarted()
    healthCheck.startMonitoring()
  } catch (error) {
    console.error('[SessionLifecycle] Failed to start session:', error)
    captureError(
      error instanceof Error ? error : new Error('Failed to start session'),
      { service: 'session', operation: 'start' },
    )
    store.setErrorMessage(error instanceof Error ? error.message : 'Failed to start session')
    store.setSessionActive(false)
    cleanup()

    // The session row was created before audio/transcription started; without
    // this it lingered as a ghost "New Session" with a leaked duration timer.
    if (currentSessionId) {
      const ghostId = currentSessionId
      currentSessionId = null
      setOverlaySessionId(null)
      await sessionMgr.discardSession(ghostId)
    }
    fullTranscript = ''

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
    healthCheck.stopMonitoring()

    store.setSessionActive(false)

    // Broadcast session stopped + finalizing to all windows
    window.electronAPI?.relay?.broadcast('relay:session-state', {
      isSessionActive: false,
      sessionStartedAt: null,
      isFinalizingSession: true,
      currentSessionId,
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
          contactSyncService.pushContacts().catch((e) =>
            console.warn('[SessionLifecycle] Contact push failed:', e),
          )
        }
      } catch (err) {
        console.error('[SessionLifecycle] Contact extraction failed:', err)
        captureError(
          err instanceof Error ? err : new Error('Contact extraction failed'),
          { service: 'session', operation: 'contactExtraction', sessionId: currentSessionId },
        )
      }

      // Finalize: write transcript + title + summary + endTime to DB in one awaited call
      const costCfg = useConfigStore.getState()
      await sessionMgr.finalizeSession(
        currentSessionId,
        fullTranscript,
        generatedTitle,
        generatedSummary,
        costCfg.meetingCostEnabled
          ? { participants: costCfg.meetingCostParticipants, hourlyRate: costCfg.meetingCostHourlyRate, currency: costCfg.meetingCostCurrency }
          : null,
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
      currentSessionId: null,
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

function startAudioHealthMonitor(hasSystem: boolean): void {
  stopAudioHealthMonitor()
  const publish = () => {
    const micAvailable = !audioCapture.isMicUnavailable()
    const last = audioCapture.getLastSystemBufferAt()
    const systemAudioReceiving = hasSystem && last > 0 && Date.now() - last < SYSTEM_AUDIO_STALE_MS
    const payload = { micAvailable, systemAudioAvailable: hasSystem, systemAudioReceiving }
    const key = JSON.stringify(payload)
    if (key === lastAudioHealthKey) return
    lastAudioHealthKey = key
    relay.broadcast('relay:audio-health', payload)
    if (hasSystem && !systemAudioReceiving && last > 0) {
      console.warn('[Session] System audio stalled (no buffer for 3s)')
    }
  }
  // Give the capture a moment before judging it stale
  audioHealthTimer = setInterval(publish, 1000)
  relay.broadcast('relay:audio-health', {
    micAvailable: !audioCapture.isMicUnavailable(),
    systemAudioAvailable: hasSystem,
    systemAudioReceiving: hasSystem,
  })
}

function stopAudioHealthMonitor(): void {
  if (audioHealthTimer) {
    clearInterval(audioHealthTimer)
    audioHealthTimer = null
  }
  lastAudioHealthKey = ''
}

function cleanup(): void {
  stopAudioHealthMonitor()
  unsubscribeConfig?.()
  unsubscribeConfig = null
  aiService.setSystemInterimProvider(null)
  lastSystemInterim = ''
  relay.broadcast('relay:transcription', { connected: false, provider: null, recoveryCountdown: 0 })
  if (dictationService.isRecording()) {
    // Dictation shares the session mic; the session ending ends it too
    dictationService.stopRecording()
    dictationService.reset()
  }
  transcriptionErrorsReported = 0
  transcriptBuffer.stop()
  systemTranscriptBuffer.stop()
  dedup.reset()
  echoCanceller.reset()
  micVad.reset()
  systemVad.reset()
  translationService.resetContext()
  audioCapture.stopCapture()
  transcription.disconnect()
  screenCaptureService.stopAutoCapture()
  autoAnswer.reset()
  preGeneration.reset()
  clearMomentState()

  if (unsubscribeMoments) {
    unsubscribeMoments()
    unsubscribeMoments = null
  }

  useAppStore.getState().setAudioLevel(0)
}

export function getCurrentSessionId(): string | null {
  return currentSessionId
}

/** Authoritative transcript for AI requests (UI windows only hold a display copy). */
export function getFullTranscript(): string {
  return fullTranscript
}

/**
 * "Clear context" (mac parity): drop the conversation context, the AI history
 * and any pre-generated answer, without ending the session. The persisted
 * session transcript is kept; only what the AI sees from now on is reset.
 */
export function clearContext(): void {
  fullTranscript = ''
  const store = useAppStore.getState()
  store.clearContext()
  useOverlayStore.getState().clearHistory()
  preGeneration.reset()
  if (store.isSessionActive) {
    preGeneration.configure(() => useAppStore.getState().selectedMode)
  }
  autoAnswer.reset()
  clearMomentState()
  aiService.clearHistory()

  window.electronAPI?.relay?.broadcast('relay:transcript', {
    transcript: '',
    interim: '',
    audioLevel: store.audioLevel,
    isSessionActive: store.isSessionActive,
    sessionStartedAt: store.sessionStartedAt,
  })
  addBreadcrumb('session', 'Context cleared', 'info')
}
