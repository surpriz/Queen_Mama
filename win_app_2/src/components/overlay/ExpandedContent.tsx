import { useCallback } from 'react'
import { Monitor, AlertTriangle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { TabBar } from './TabBar'
import { TranscriptPanel } from './TranscriptPanel'
import { ResponseDisplay } from './ResponseDisplay'
import { TranslateTab } from './TranslateTab'
import { ActionBar } from './ActionBar'
import { InputBar } from './InputBar'
import { useConfigStore } from '@/stores/configStore'
import { useAppStore } from '@/stores/appStore'
import { useOverlayStore } from '@/stores/overlayStore'
import { useAiResponse } from '@/hooks/useAiResponse'
import { ResponseType } from '@/types/models'

export function ExpandedContent() {
  const { t } = useTranslation('overlay')
  const autoScreenCapture = useConfigStore((s) => s.autoScreenCapture)
  const showLiveTranscript = useConfigStore((s) => s.showLiveTranscript)
  const isSessionActive = useAppStore((s) => s.isSessionActive)
  const currentTranscript = useAppStore((s) => s.currentTranscript)
  const selectedTab = useOverlayStore((s) => s.selectedTab)
  const { triggerByType, isProcessing } = useAiResponse()
  const isTranslateTab = selectedTab === ResponseType.Translate

  const handleTabSelected = useCallback(
    (type: ResponseType) => {
      if (type === ResponseType.Translate) return // Translate tab is passive — no AI trigger
      if (isProcessing) return
      // Allow trigger if there's transcript OR screen capture is enabled
      const hasTranscript = isSessionActive && currentTranscript.trim().length > 0
      const hasScreenCapture = autoScreenCapture
      // What to Say / Follow-up are conversational — with no transcript (screen-only)
      // there is nothing to say and no one to question. Show a message, skip the AI call.
      if ((type === ResponseType.WhatToSay || type === ResponseType.FollowUp) && !hasTranscript) {
        useOverlayStore.getState().addToHistory(type, t('expandedContent.noConversation'))
        return
      }
      if (hasTranscript || hasScreenCapture) {
        triggerByType(type)
      }
    },
    [isSessionActive, currentTranscript, isProcessing, autoScreenCapture, triggerByType, t],
  )

  return (
    <div className="flex flex-col flex-1 min-h-0 border-t border-white/5 overflow-hidden">
      {showLiveTranscript && <TranscriptPanel />}


      {isTranslateTab ? <TranslateTab /> : <ResponseDisplay />}

      <TabBar onTabSelected={handleTabSelected} />

      {!isTranslateTab && <ActionBar />}

      {/* Input state badge when session is not active */}
      {!isSessionActive && !isTranslateTab && (
        <div className="px-3 py-1">
          {autoScreenCapture ? (
            <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-yellow-500/10">
              <Monitor size={10} className="text-yellow-400" />
              <span className="text-caption-sm font-medium text-yellow-400">{t('expandedContent.screenOnly')}</span>
            </div>
          ) : (
            <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-500/10">
              <AlertTriangle size={10} className="text-red-400" />
              <span className="text-caption-sm font-medium text-red-400">{t('expandedContent.noInput')}</span>
            </div>
          )}
        </div>
      )}

      {!isTranslateTab && <InputBar />}
    </div>
  )
}
