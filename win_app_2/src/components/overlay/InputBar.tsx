import { useState } from 'react'
import { Send } from 'lucide-react'
import { useAppStore } from '@/stores/appStore'
import * as aiService from '@/services/ai/aiService'
import { ResponseType } from '@/types/models'

export function InputBar() {
  const [input, setInput] = useState('')
  const isProcessing = useAppStore((s) => s.isProcessing)
  const currentTranscript = useAppStore((s) => s.currentTranscript)
  const selectedMode = useAppStore((s) => s.selectedMode)

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

  return (
    <div className="flex items-center gap-2 px-3 border-t border-qm-border-subtle" style={{ height: 48 }}>
      <input
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Ask a question... (Ctrl+Enter)"
        disabled={isProcessing}
        className="flex-1 bg-transparent text-body-sm text-qm-text-primary placeholder:text-qm-text-disabled focus:outline-none disabled:opacity-50"
      />
      <button
        onClick={handleSubmit}
        disabled={!input.trim() || isProcessing}
        className="p-1.5 rounded-qm-sm text-qm-accent hover:bg-qm-accent/10 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
      >
        <Send size={14} />
      </button>
    </div>
  )
}
