import { useState } from 'react'
import { Send, Brain } from 'lucide-react'
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
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const handleToggleSmart = () => {
    updateConfig({ smartModeEnabled: !smartModeEnabled })
  }

  return (
    <div className="flex items-center gap-2 px-3 border-t border-qm-border-subtle" style={{ height: 48 }}>
      {/* Smart Mode toggle */}
      <button
        onClick={handleToggleSmart}
        className={cn(
          'flex items-center gap-1 px-2 py-1 rounded-full text-caption-sm font-medium transition-colors flex-shrink-0',
          smartModeEnabled
            ? 'bg-purple-500/15 text-purple-400'
            : 'bg-qm-surface-medium text-qm-text-tertiary hover:bg-qm-surface-hover',
        )}
        title={smartModeEnabled ? 'Smart Mode ON' : 'Smart Mode OFF'}
      >
        <Brain size={12} />
        <span>Smart</span>
      </button>

      <input
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Ask about your screen or conversation..."
        disabled={isProcessing}
        className="flex-1 bg-transparent text-body-sm text-qm-text-primary placeholder:text-qm-text-disabled focus:outline-none disabled:opacity-50"
      />
      <button
        onClick={handleSubmit}
        disabled={!input.trim() || isProcessing}
        className="p-1.5 rounded-full bg-qm-accent/20 text-qm-accent hover:bg-qm-accent/30 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
      >
        <Send size={14} />
      </button>
    </div>
  )
}
