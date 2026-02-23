import { useState, useEffect, useCallback } from 'react'
import { Mic, MicOff } from 'lucide-react'
import { dictationService } from '@/services/dictation/dictationService'
import { createLogger } from '@/lib/logger'
import { cn } from '@/lib/utils'

const log = createLogger('DictationButton')

interface DictationButtonProps {
  /** Called when final dictated text is ready (on stop) */
  onTextReady: (text: string) => void
}

export function DictationButton({ onTextReady }: DictationButtonProps) {
  const [isRecording, setIsRecording] = useState(false)
  const [interimText, setInterimText] = useState('')
  const [finalText, setFinalText] = useState('')

  // Subscribe to dictation state changes
  useEffect(() => {
    const unsubscribe = dictationService.subscribe((state) => {
      setIsRecording(state.isRecording)
      setInterimText(state.interimText)
      setFinalText(state.finalText)
    })

    return unsubscribe
  }, [])

  const handleToggle = useCallback(async () => {
    if (isRecording) {
      // Stop recording and deliver text
      dictationService.stopRecording()
      const currentState = dictationService.getState()
      const text = currentState.finalText.trim()
      if (text) {
        log.info(`Delivering dictated text (${text.length} chars)`)
        onTextReady(text)
      }
      dictationService.reset()
    } else {
      // Start recording
      try {
        dictationService.reset()
        await dictationService.startRecording()
      } catch (error) {
        log.error('Failed to start dictation:', error)
      }
    }
  }, [isRecording, onTextReady])

  // Build display text: final + interim (interim shown with lower opacity via parent)
  const displayText = [finalText, interimText].filter(Boolean).join(' ')

  return (
    <div className="flex items-center gap-1.5">
      {/* Interim text preview (shown inline when recording) */}
      {isRecording && displayText && (
        <span className="text-body-sm text-qm-text-secondary truncate max-w-[200px]">
          {displayText}
        </span>
      )}

      {/* Mic button */}
      <button
        onClick={handleToggle}
        className={cn(
          'relative flex items-center justify-center w-7 h-7 rounded-full transition-colors flex-shrink-0',
          isRecording
            ? 'bg-qm-error/20 text-qm-error'
            : 'text-qm-text-tertiary hover:text-qm-text-secondary hover:bg-qm-surface-hover',
        )}
        title={isRecording ? 'Stop dictation' : 'Start dictation'}
      >
        {/* Pulsing ring animation when recording */}
        {isRecording && (
          <span className="absolute inset-0 rounded-full animate-pulse ring-2 ring-qm-error/40" />
        )}

        {isRecording ? <MicOff size={14} /> : <Mic size={14} />}
      </button>
    </div>
  )
}
