import { useState } from 'react'
import { Send, Sparkles } from 'lucide-react'
import { useAppStore } from '@/stores/appStore'
import { useConfigStore } from '@/stores/configStore'
import * as aiService from '@/services/ai/aiService'
import { cn } from '@/lib/utils'

export function InputBar() {
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
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const handleToggleSmartMode = () => {
    updateConfig({ smartModeEnabled: !smartModeEnabled })
  }

  return (
    <div className="flex items-center gap-2 px-3 border-t border-qm-border-subtle" style={{ height: 48 }}>
      {/* Smart Mode Toggle */}
      <button
        onClick={handleToggleSmartMode}
        className={cn(
          'flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-medium transition-colors shrink-0',
          smartModeEnabled
            ? 'bg-qm-accent/15 text-qm-accent'
            : 'bg-qm-surface-light text-qm-text-tertiary hover:bg-qm-surface-hover',
        )}
        title="Smart Mode - Context-aware responses"
      >
        <Sparkles size={10} />
        Smart
      </button>

      {/* Input field */}
      <input
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Ask a question..."
        disabled={isProcessing}
        className="flex-1 bg-transparent text-body-sm text-qm-text-primary placeholder:text-qm-text-disabled focus:outline-none disabled:opacity-50"
      />

      {/* Keyboard shortcut badge */}
      <kbd className="hidden sm:flex items-center px-1.5 py-0.5 rounded bg-qm-surface-light text-qm-text-disabled text-[9px] font-mono shrink-0">
        Ctrl+↵
      </kbd>

      {/* Send button */}
      <button
        onClick={handleSubmit}
        disabled={!input.trim() || isProcessing}
        className={cn(
          'flex items-center justify-center w-7 h-7 rounded-full transition-all shrink-0',
          input.trim() && !isProcessing
            ? 'bg-gradient-to-br from-qm-gradient-start to-qm-gradient-end hover:scale-110 active:scale-95'
            : 'bg-qm-surface-light opacity-30',
        )}
      >
        <Send size={12} className="text-white" />
      </button>
    </div>
  )
}
