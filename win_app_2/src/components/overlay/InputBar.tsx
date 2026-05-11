import { useState } from 'react'
import { ArrowUp, Brain } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAppStore } from '@/stores/appStore'
import { useConfigStore } from '@/stores/configStore'
import * as aiService from '@/services/ai/aiService'
import { DictationButton } from './DictationButton'
import { KeyboardShortcutBadge } from '@/components/common/KeyboardShortcutBadge'
import { toast } from '@/stores/toastStore'
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

  const handleToggleSmart = () => {
    const willEnable = !smartModeEnabled
    updateConfig({ smartModeEnabled: willEnable })

    if (willEnable) {
      toast.success(t('inputBar.smartModeActivated'), undefined, 2000)
    }
  }

  const handleDictationText = (text: string) => {
    setInput((prev) => (prev ? `${prev} ${text}` : text))
  }

  return (
    <div className="relative px-2 pb-2 pt-1.5">
      <div
        className="group/input flex items-center gap-2 px-3 bg-qm-surface-medium rounded-qm-lg transition-all duration-200 focus-within:bg-qm-surface-hover focus-within:shadow-qm-glow"
        style={{
          height: 44,
          boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.06), inset 0 1px 0 rgba(255,255,255,0.04)',
        }}
      >
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
          className={cn(
            'relative flex items-center justify-center w-7 h-7 rounded-full bg-gradient-to-br from-qm-gradient-start to-qm-gradient-end text-white transition-all flex-shrink-0',
            'disabled:opacity-25 disabled:saturate-50',
            input.trim() && !isProcessing && 'hover:scale-110 shadow-qm-glow hover:shadow-qm-glow-strong',
          )}
        >
          <ArrowUp size={14} strokeWidth={2.5} />
        </button>
      </div>
    </div>
  )
}
