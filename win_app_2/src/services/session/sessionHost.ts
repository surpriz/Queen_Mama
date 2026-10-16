/**
 * Session host — runs only in the hidden `#/session` window.
 *
 * Executes commands sent by UI windows (`session:invoke`), mirrors host-only
 * state to the other windows (processing flag, dictation, moments, errors)
 * and reacts to global shortcuts / tray actions forwarded by main.
 */

import { createLogger } from '@/lib/logger'
import { isSessionHost } from '@/lib/runtime'
import { useAppStore } from '@/stores/appStore'
import { useAuthStore } from '@/stores/authStore'
import { useOverlayStore } from '@/stores/overlayStore'
import { modesService } from '@/services/modes/modesService'
import * as contactDb from '@/services/contacts/contactDb'
import * as lifecycle from '@/services/sessionLifecycle'
import * as aiService from '@/services/ai/aiService'
import * as autoAnswer from '@/services/detection/autoAnswerService'
import { onMomentsDetected } from '@/services/detection/momentDetectionService'
import { dictationService } from '@/services/dictation/dictationService'
import * as licenseManager from '@/services/license/licenseManager'
import * as relay from '@/services/relay/relayClient'
import { broadcastAuthState } from '@/services/relay/authRelay'
import { ResponseType, type Mode } from '@/types/models'
import type { SessionCommand } from '@/types/relay'

const log = createLogger('SessionHost')

let registered = false
const disposers: Array<() => void> = []

async function resolveMode(modeId: string | null | undefined): Promise<Mode | null> {
  if (modeId) {
    const mode = await modesService.getById(modeId)
    if (mode) return mode
  }
  return useAppStore.getState().selectedMode
}

async function triggerAI(type: ResponseType | string, question?: string): Promise<string> {
  const { selectedMode, isProcessing } = useAppStore.getState()
  if (isProcessing) {
    log.info(`AI trigger ignored (${type}): already processing`)
    return ''
  }
  const transcript = lifecycle.getFullTranscript()

  switch (type) {
    case ResponseType.Assist:
      autoAnswer.recordManualTrigger()
      return aiService.assist(transcript, selectedMode)
    case ResponseType.WhatToSay:
      return aiService.whatToSay(transcript, selectedMode)
    case ResponseType.FollowUp:
      return aiService.followUp(transcript, selectedMode)
    case ResponseType.Recap:
      return aiService.recap(transcript, selectedMode)
    case ResponseType.Decode:
      return aiService.decode(transcript, selectedMode)
    case ResponseType.Custom:
    case 'Custom':
      if (!question?.trim()) return ''
      return aiService.askCustomQuestion(transcript, question.trim(), selectedMode)
    default:
      log.warn(`Unknown AI trigger type: ${type}`)
      return ''
  }
}

async function handleCommand(command: SessionCommand): Promise<unknown> {
  switch (command.cmd) {
    case 'host.ping':
      return { ok: true, at: Date.now() }

    case 'session.start': {
      const mode = await resolveMode(command.payload?.modeId)
      const contact = command.payload?.contactId
        ? (await contactDb.getContact(command.payload.contactId)) ?? null
        : null
      if (mode) useAppStore.getState().setSelectedMode(mode)
      await lifecycle.startSession(mode, contact)
      return undefined
    }

    case 'session.stop':
      await lifecycle.stopSession()
      return undefined

    case 'session.toggle': {
      const mode = await resolveMode(command.payload?.modeId)
      if (mode) useAppStore.getState().setSelectedMode(mode)
      await lifecycle.toggleSession(mode)
      return undefined
    }

    case 'session.clearContext':
      lifecycle.clearContext()
      return undefined

    case 'session.setMode': {
      const mode = await resolveMode(command.payload.modeId)
      useAppStore.getState().setSelectedMode(mode)
      return undefined
    }

    case 'ai.trigger':
      return triggerAI(command.payload.type, command.payload.question)

    case 'ai.clearHistory':
      aiService.clearHistory()
      relay.broadcast('relay:ai-response', { type: 'clear' })
      return undefined

    case 'dictation.start':
      dictationService.reset()
      await dictationService.startRecording()
      return undefined

    case 'dictation.stop': {
      dictationService.stopRecording()
      const text = dictationService.getState().finalText.trim()
      dictationService.reset()
      return { text }
    }

    case 'dictation.cancel':
      dictationService.stopRecording()
      dictationService.reset()
      return undefined

    case 'license.revalidate':
      if (command.payload?.force) {
        await licenseManager.revalidate()
      } else {
        await licenseManager.revalidateIfStale()
      }
      return undefined

    default:
      throw new Error(`Unknown session command: ${(command as { cmd: string }).cmd}`)
  }
}

function installInvokeHandler(): void {
  const api = window.electronAPI?.session
  if (!api?.onInvokeRequest) {
    log.warn('Session bridge unavailable; commands will not be received')
    return
  }
  disposers.push(
    api.onInvokeRequest(async ({ id, cmd, payload }) => {
      try {
        const result = await handleCommand({ cmd, payload } as SessionCommand)
        api.respond({ id, ok: true, result })
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        log.warn(`Command ${cmd} failed: ${message}`)
        api.respond({ id, ok: false, error: message })
      }
    }),
  )
}

function installShortcutHandlers(): void {
  const api = window.electronAPI
  if (!api) return

  disposers.push(
    api.onSessionToggle((data?: { mode?: unknown }) => {
      const mode = (data?.mode as Mode | undefined) ?? useAppStore.getState().selectedMode
      void lifecycle.toggleSession(mode)
    }),
  )
  disposers.push(
    api.onShortcutTriggerAssist(() => {
      void triggerAI(ResponseType.Assist)
    }),
  )
  disposers.push(
    api.onShortcutClearContext(() => {
      lifecycle.clearContext()
    }),
  )
  if (api.session?.onLicenseRevalidateRequest) {
    disposers.push(
      api.session.onLicenseRevalidateRequest(() => {
        void licenseManager.revalidateIfStale()
      }),
    )
  }
}

function installStateMirrors(): void {
  // AI processing flag + error messages (toasts are rendered by UI windows)
  let lastProcessing = useAppStore.getState().isProcessing
  let lastError = useAppStore.getState().errorMessage
  disposers.push(
    useAppStore.subscribe((state) => {
      if (state.isProcessing !== lastProcessing) {
        lastProcessing = state.isProcessing
        relay.broadcast('relay:ai-state', { isProcessing: state.isProcessing })
      }
      if (state.errorMessage && state.errorMessage !== lastError) {
        relay.broadcast('relay:error', { message: state.errorMessage })
      }
      lastError = state.errorMessage
    }),
  )

  // Dictation state (mic lives here; the overlay only renders it)
  disposers.push(
    dictationService.subscribe((state) => {
      relay.broadcast('relay:dictation', {
        isRecording: state.isRecording,
        interimText: state.interimText,
        finalText: state.finalText,
      })
    }),
  )

  // Proactive moments → pill badge in the overlay
  disposers.push(
    onMomentsDetected((moments) => {
      if (moments.length === 0) return
      const top = moments[0]
      relay.broadcast('relay:moment', { type: top.type, triggerPhrase: top.triggerPhrase })
    }),
  )

  // Overlay-level history clears initiated here (e.g. clearContext) → all windows
  disposers.push(
    useOverlayStore.subscribe((state, prev) => {
      if (prev.responseHistory.length > 0 && state.responseHistory.length === 0) {
        relay.broadcast('relay:ai-response', { type: 'clear' })
      }
    }),
  )

  // Losing auth mid-session must stop the pipeline (mac parity)
  disposers.push(
    useAuthStore.subscribe((state, prev) => {
      if (!state.isAuthenticated && prev.isAuthenticated && useAppStore.getState().isSessionActive) {
        log.info('Auth lost during session — stopping')
        void lifecycle.stopSession()
      }
    }),
  )
}

export function registerSessionHost(): () => void {
  if (!isSessionHost()) {
    log.warn('registerSessionHost called outside the session window; ignored')
    return () => undefined
  }
  if (registered) return () => undefined
  registered = true

  installInvokeHandler()
  installShortcutHandlers()
  installStateMirrors()

  // Make sure late-booting UI windows can always obtain the auth snapshot,
  // even when checkExistingAuth finished before the relay hub cached anything.
  broadcastAuthState()

  log.info('Session host registered')

  return () => {
    for (const dispose of disposers.splice(0)) {
      try {
        dispose()
      } catch (err) {
        log.warn('Disposer failed', err)
      }
    }
    registered = false
  }
}
