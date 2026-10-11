import { useState, useCallback } from 'react'
import { Mic, MicOff } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useDictationStore } from '@/stores/dictationStore'
import * as sessionClient from '@/services/session/sessionClient'
import { toast } from '@/stores/toastStore'
import { createLogger } from '@/lib/logger'
import { cn } from '@/lib/utils'

const log = createLogger('DictationButton')

interface DictationButtonProps {
  /** Called when final dictated text is ready (on stop) */
  onTextReady: (text: string) => void
}

/**
 * Push-to-talk dictation. The microphone and the Deepgram socket live in the
 * hidden session window (so they can share the echo-cancelled session mic);
 * this button only sends commands and renders the relayed state.
 */
export function DictationButton({ onTextReady }: DictationButtonProps) {
  const { t } = useTranslation('overlay')
  const isRecording = useDictationStore((s) => s.isRecording)
  const interimText = useDictationStore((s) => s.interimText)
  const finalText = useDictationStore((s) => s.finalText)
  const [busy, setBusy] = useState(false)

  const handleToggle = useCallback(async () => {
    if (busy) return
    setBusy(true)
    try {
      if (isRecording) {
        const { text } = await sessionClient.stopDictation()
        if (text) {
          log.info(`Delivering dictated text (${text.length} chars)`)
          onTextReady(text)
        }
        useDictationStore.getState().reset()
      } else {
        await sessionClient.startDictation()
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      log.error('Dictation command failed:', message)
      toast.error(t('dictation.failed', { defaultValue: 'Dictation unavailable' }), message)
      useDictationStore.getState().reset()
    } finally {
      setBusy(false)
    }
  }, [busy, isRecording, onTextReady, t])

  const displayText = [finalText, interimText].filter(Boolean).join(' ')

  return (
    <div className="flex items-center gap-1.5">
      {isRecording && displayText && (
        <span className="text-body-sm text-qm-text-secondary truncate max-w-[200px]">
          {displayText}
        </span>
      )}

      <button
        onClick={handleToggle}
        disabled={busy}
        className={cn(
          'relative flex items-center justify-center w-7 h-7 rounded-full transition-colors flex-shrink-0',
          isRecording
            ? 'bg-qm-error/20 text-qm-error'
            : 'text-qm-text-tertiary hover:text-qm-text-secondary hover:bg-qm-surface-hover',
          busy && 'opacity-60',
        )}
        title={isRecording ? t('dictation.stop', { defaultValue: 'Stop dictation' }) : t('dictation.start', { defaultValue: 'Start dictation' })}
      >
        {isRecording && (
          <span className="absolute inset-0 rounded-full animate-pulse ring-2 ring-qm-error/40" />
        )}

        {isRecording ? <MicOff size={14} /> : <Mic size={14} />}
      </button>
    </div>
  )
}
