import { useCallback } from 'react'
import { useAppStore } from '@/stores/appStore'
import { useOverlayStore } from '@/stores/overlayStore'
import * as aiService from '@/services/ai/aiService'
import { ResponseType } from '@/types/models'

export function useAiResponse() {
  const currentTranscript = useAppStore((s) => s.currentTranscript)
  const isProcessing = useAppStore((s) => s.isProcessing)
  const selectedMode = useAppStore((s) => s.selectedMode)
  const streamingContent = useOverlayStore((s) => s.streamingContent)
  const responseHistory = useOverlayStore((s) => s.responseHistory)

  const assist = useCallback(async () => {
    await aiService.assist(currentTranscript, selectedMode)
  }, [currentTranscript, selectedMode])

  const whatToSay = useCallback(async () => {
    await aiService.whatToSay(currentTranscript, selectedMode)
  }, [currentTranscript, selectedMode])

  const followUp = useCallback(async () => {
    await aiService.followUp(currentTranscript, selectedMode)
  }, [currentTranscript, selectedMode])

  const recap = useCallback(async () => {
    await aiService.recap(currentTranscript, selectedMode)
  }, [currentTranscript, selectedMode])

  const askCustomQuestion = useCallback(
    async (question: string) => {
      await aiService.askCustomQuestion(currentTranscript, question, selectedMode)
    },
    [currentTranscript, selectedMode],
  )

  const triggerByType = useCallback(
    async (type: ResponseType) => {
      switch (type) {
        case ResponseType.Assist:
          return assist()
        case ResponseType.WhatToSay:
          return whatToSay()
        case ResponseType.FollowUp:
          return followUp()
        case ResponseType.Recap:
          return recap()
      }
    },
    [assist, whatToSay, followUp, recap],
  )

  return {
    isProcessing,
    streamingContent,
    responseHistory,
    assist,
    whatToSay,
    followUp,
    recap,
    askCustomQuestion,
    triggerByType,
  }
}
