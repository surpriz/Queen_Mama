import { useCallback } from 'react'
import { Monitor, AlertTriangle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { TabBar } from './TabBar'
import { TranscriptPanel } from './TranscriptPanel'
import { TranscriptionBanner } from './TranscriptionBanner'
import { ResponseDisplay } from './ResponseDisplay'
import { TranslateTab } from './TranslateTab'
import { ContactBriefingView } from './ContactBriefingView'
import { ActionBar } from './ActionBar'
import { InputBar } from './InputBar'
import { useConfigStore } from '@/stores/configStore'
import { useAppStore } from '@/stores/appStore'
import { useOverlayStore } from '@/stores/overlayStore'
import { useAiResponse } from '@/hooks/useAiResponse'
import { ResponseType } from '@/types/models'

/**
 * Decide whether a tab click should hit the AI, shared by the tab bar and the
 * input bar's Enter-on-empty. Reads the transcript at click time instead of
 * subscribing to it (that re-rendered the whole expanded area on every word).
 */
export function useTabTrigger() {
  const { t } = useTranslation('overlay')
  const { triggerByType } = useAiResponse()

  return useCallback(
    (type: ResponseType) => {
      if (type === ResponseType.Translate || type === ResponseType.Briefing) return // passive tabs — no AI trigger
      const { isSessionActive, currentTranscript, isProcessing } = useAppStore.getState()
      if (isProcessing) return
      const hasTranscript = isSessionActive && currentTranscript.trim().length > 0
      const hasScreenCapture = useConfigStore.getState().autoScreenCapture
      if ((type === ResponseType.WhatToSay || type === ResponseType.FollowUp || type === ResponseType.Decode) && !hasTranscript) {
        useOverlayStore.getState().addToHistory(type, t('expandedContent.noConversation'))
        return
      }
      if (hasTranscript || hasScreenCapture) {
        void triggerByType(type)
      } else {
        useOverlayStore.getState().addToHistory(type, t('expandedContent.noInputHint'))
      }
    },
    [triggerByType, t],
  )
}

export function ExpandedContent() {
  const { t } = useTranslation('overlay')
  const autoScreenCapture = useConfigStore((s) => s.autoScreenCapture)
  const showLiveTranscript = useConfigStore((s) => s.showLiveTranscript)
  const isSessionActive = useAppStore((s) => s.isSessionActive)
  const selectedTab = useOverlayStore((s) => s.selectedTab)
  const isTranslateTab = selectedTab === ResponseType.Translate
  const isBriefingTab = selectedTab === ResponseType.Briefing
  const isPassiveTab = isTranslateTab || isBriefingTab
  const handleTabSelected = useTabTrigger()

  return (
    <div className="flex flex-col flex-1 min-h-0 border-t border-white/5 overflow-hidden">
      <TranscriptionBanner />
      {showLiveTranscript && <TranscriptPanel />}

      {isTranslateTab ? <TranslateTab /> : isBriefingTab ? <ContactBriefingView /> : <ResponseDisplay />}

      <TabBar onTabSelected={handleTabSelected} />

      {!isPassiveTab && <ActionBar />}

      {!isSessionActive && !isPassiveTab && (
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

      {!isPassiveTab && <InputBar />}
    </div>
  )
}
