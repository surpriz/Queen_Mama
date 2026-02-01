import { useState } from 'react'
import { ArrowUp, Sparkles, Lock, Command, CornerDownLeft } from 'lucide-react'
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
    <div className="flex items-center gap-2 px-3 border-t border-qm-border-subtle" style={{ height: 52 }}>
      {/* Smart Mode Toggle with lock icon (like macOS) */}
      <button
        onClick={handleToggleSmartMode}
        className={cn(
          'flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[11px] font-medium transition-colors border shrink-0',
          smartModeEnabled
            ? 'bg-qm-accent/10 text-qm-text-secondary border-qm-accent/30'
            : 'bg-qm-surface-light/50 text-qm-text-tertiary border-qm-border-subtle hover:bg-qm-surface-hover',
        )}
        title="Smart Mode - Context-aware responses"
      >
        <Sparkles size={12} className={smartModeEnabled ? 'text-qm-accent' : ''} />
        Smart
        <Lock size={8} className="text-qm-text-disabled ml-0.5" />
      </button>

      {/* Input field */}
      <input
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Ask about your screen or conversation..."
        disabled={isProcessing}
        className="flex-1 bg-transparent text-body-sm text-qm-text-primary placeholder:text-qm-text-disabled focus:outline-none disabled:opacity-50"
      />

      {/* Keyboard shortcut badges (like macOS: ⌘ ↵) */}
      <div className="hidden sm:flex items-center gap-1 shrink-0">
        <kbd className="flex items-center justify-center w-5 h-5 rounded bg-qm-surface-light text-qm-text-disabled text-[10px]">
          <Command size={10} />
        </kbd>
        <kbd className="flex items-center justify-center w-5 h-5 rounded bg-qm-surface-light text-qm-text-disabled text-[10px]">
          <CornerDownLeft size={10} />
        </kbd>
      </div>

      {/* Send button - ArrowUp in circle (like macOS) */}
      <button
        onClick={handleSubmit}
        disabled={!input.trim() || isProcessing}
        className={cn(
          'flex items-center justify-center w-8 h-8 rounded-full transition-all shrink-0',
          input.trim() && !isProcessing
            ? 'bg-gradient-to-br from-qm-gradient-start to-qm-gradient-end hover:scale-110 active:scale-95 shadow-qm-glow'
            : 'bg-qm-surface-light opacity-30',
        )}
      >
        <ArrowUp size={16} className="text-white" strokeWidth={2.5} />
      </button>
    </div>
  )
}
