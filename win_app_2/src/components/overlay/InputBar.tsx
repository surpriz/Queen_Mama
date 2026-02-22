import { useState, useEffect, useRef } from 'react'
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

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    }
  }, [])

  return (
    <div className="relative flex items-center gap-2 px-3 border-t border-qm-border-subtle" style={{ height: 48 }}>
      {/* Smart Mode activated toast */}
      {showSmartToast && (
        <div className="absolute -top-8 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-purple-500/20 text-purple-300 text-caption-sm font-medium whitespace-nowrap animate-qm-fade-in transition-opacity duration-500"
          style={{ pointerEvents: 'none' }}
        >
          Smart Mode activated
        </div>
      )}

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
