import { useState, useEffect, useRef } from 'react'
import { ArrowUp, Brain } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAppStore } from '@/stores/appStore'
import { useConfigStore } from '@/stores/configStore'
import * as aiService from '@/services/ai/aiService'
import { DictationButton } from './DictationButton'
import { KeyboardShortcutBadge } from '@/components/common/KeyboardShortcutBadge'
import { cn } from '@/lib/utils'

export function InputBar() {
  const { t } = useTranslation('overlay')
  const [input, setInput] = useState('')
  const isProcessing = useAppStore((s) => s.isProcessing)
  const currentTranscript = useAppStore((s) => s.currentTranscript)
  const selectedMode = useAppStore((s) => s.selectedMode)
  const smartModeEnabled = useConfigStore((s) => s.smartModeEnabled)
  const updateConfig = useConfigStore((s) => s.updateConfig)

  const handleSubmit = async () => {
    if (!input.trim() || isProcessing) return

    const question = input.trim()
    setInput('')

    await aiService.askCustomQuestion(currentTranscript, question, selectedMode)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const [showSmartToast, setShowSmartToast] = useState(false)
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleToggleSmart = () => {
    const willEnable = !smartModeEnabled
    updateConfig({ smartModeEnabled: willEnable })

    if (willEnable) {
      setShowSmartToast(true)
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
      toastTimerRef.current = setTimeout(() => setShowSmartToast(false), 2000)
    }
  }

  const handleDictationText = (text: string) => {
    setInput((prev) => (prev ? `${prev} ${text}` : text))
  }

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    }
  }, [])

  return (
    <div className="relative px-2 pb-2 pt-1.5">
      {/* Smart Mode activated toast */}
      {showSmartToast && (
        <div className="absolute -top-8 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-purple-500/20 text-purple-300 text-caption-sm font-medium whitespace-nowrap animate-qm-fade-in transition-opacity duration-500"
          style={{ pointerEvents: 'none' }}
        >
          {t('inputBar.smartModeActivated')}
        </div>
      )}

      <div className="flex items-center gap-2 px-3 bg-qm-surface-light border border-qm-border-subtle rounded-qm-lg" style={{ height: 44 }}>
        {/* Smart Mode toggle */}
        <button
          onClick={handleToggleSmart}
          className={cn(
            'flex items-center gap-1 px-2 py-1 rounded-full text-caption-sm font-medium transition-colors flex-shrink-0',
            smartModeEnabled
              ? 'bg-purple-500/15 text-purple-400'
              : 'bg-qm-surface-medium text-qm-text-tertiary hover:bg-qm-surface-hover',
          )}
          title={smartModeEnabled ? t('inputBar.smartModeOn') : t('inputBar.smartModeOff')}
        >
          <Brain size={12} />
          <span>{t('inputBar.smart')}</span>
        </button>

        {/* Dictation button */}
        <DictationButton onTextReady={handleDictationText} />

        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={t('inputBar.placeholder')}
          disabled={isProcessing}
          className="flex-1 bg-transparent text-body-sm text-qm-text-primary placeholder:text-qm-text-disabled focus:outline-none disabled:opacity-50"
        />

        {/* Keyboard shortcut badge when input is empty */}
        {!input.trim() && (
          <KeyboardShortcutBadge shortcut="Ctrl+Enter" size="small" className="flex-shrink-0 opacity-50" />
        )}

        {/* Submit button - gradient circle with arrow up */}
        <button
          onClick={handleSubmit}
          disabled={!input.trim() || isProcessing}
          className="flex items-center justify-center w-7 h-7 rounded-full bg-gradient-to-r from-qm-gradient-start to-qm-gradient-end text-white hover:scale-110 hover:shadow-qm-glow disabled:opacity-30 disabled:hover:scale-100 disabled:hover:shadow-none transition-all flex-shrink-0"
        >
          <ArrowUp size={14} />
        </button>
      </div>
    </div>
  )
}
