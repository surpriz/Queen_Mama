import { useCallback } from 'react'
import { useAppStore } from '@/stores/appStore'
import { useOverlayStore } from '@/stores/overlayStore'
import * as sessionClient from '@/services/session/sessionClient'
import { ResponseType } from '@/types/models'

/**
 * AI actions for UI windows. Requests are executed by the hidden session
 * window (which owns the authoritative transcript, screenshots and pre-gen
 * buffer); results arrive through the relay into `overlayStore`.
 */
export function useAiResponse() {
  const isProcessing = useAppStore((s) => s.isProcessing)
  const streamingContent = useOverlayStore((s) => s.streamingContent)
  const responseHistory = useOverlayStore((s) => s.responseHistory)

  const trigger = useCallback(async (type: ResponseType, question?: string) => {
    try {
      await sessionClient.triggerAI(type, question)
    } catch (error) {
      useAppStore.getState().setErrorMessage(error instanceof Error ? error.message : String(error))
    }
  }, [])

  const assist = useCallback(() => trigger(ResponseType.Assist), [trigger])
  const whatToSay = useCallback(() => trigger(ResponseType.WhatToSay), [trigger])
  const followUp = useCallback(() => trigger(ResponseType.FollowUp), [trigger])
  const recap = useCallback(() => trigger(ResponseType.Recap), [trigger])
  const decode = useCallback(() => trigger(ResponseType.Decode), [trigger])
  const askCustomQuestion = useCallback(
    (question: string) => trigger(ResponseType.Custom, question),
    [trigger],
  )

  const triggerByType = useCallback(
    async (type: ResponseType) => {
      if (type === ResponseType.Translate) return
      return trigger(type)
    },
    [trigger],
  )

  return {
    isProcessing,
    streamingContent,
    responseHistory,
    assist,
    whatToSay,
    followUp,
    recap,
    decode,
    askCustomQuestion,
    triggerByType,
  }
}
