import { useCallback, useEffect, useRef, useState } from 'react'
import { Mic, MicOff, Square, Play, Sparkles, Copy, Check, Trash2 } from 'lucide-react'
import { useAppStore } from '@/stores/appStore'
import { useOverlayStore } from '@/stores/overlayStore'
import { toggleSession } from '@/services/sessionLifecycle'
import { StatusIndicator } from '@/components/common/StatusIndicator'
import { KeyboardShortcutBadge } from '@/components/common/KeyboardShortcutBadge'
import { cn } from '@/lib/utils'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

const PROVIDER_COLORS: Record<string, string> = {
  OpenAI: 'bg-green-500/15 text-green-400',
  Anthropic: 'bg-purple-500/15 text-purple-400',
  'Google Gemini': 'bg-blue-500/15 text-blue-400',
  'xAI Grok': 'bg-orange-500/15 text-orange-400',
}

function ProviderBadge({ provider }: { provider: string }) {
  const colorClass = PROVIDER_COLORS[provider] ?? 'bg-qm-surface-medium text-qm-text-tertiary'
  return (
    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${colorClass}`}>
      {provider}
    </span>
  )
}

export function LiveSessionView() {
  const {
    isSessionActive,
    currentTranscript,
    interimTranscript,
    audioLevel,
    isProcessing,
    isFinalizingSession,
    errorMessage,
  } = useAppStore()

  const streamingContent = useOverlayStore((s) => s.streamingContent)
  const responseHistory = useOverlayStore((s) => s.responseHistory)
  const clearHistory = useOverlayStore((s) => s.clearHistory)
  const transcriptRef = useRef<HTMLDivElement>(null)
  const aiPanelRef = useRef<HTMLDivElement>(null)
  const [transcriptCopied, setTranscriptCopied] = useState(false)

  const wordCount = currentTranscript
    ? currentTranscript.split(/\s+/).filter(Boolean).length
    : 0

  const handleCopyTranscript = useCallback(() => {
    if (!currentTranscript) return
    navigator.clipboard.writeText(currentTranscript)
    setTranscriptCopied(true)
    setTimeout(() => setTranscriptCopied(false), 2000)
  }, [currentTranscript])

  // Auto-scroll transcript
  useEffect(() => {
    if (transcriptRef.current) {
      transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight
    }
  }, [currentTranscript, interimTranscript])

  // Auto-scroll AI panel when new content arrives
  useEffect(() => {
    if (aiPanelRef.current) {
      aiPanelRef.current.scrollTop = aiPanelRef.current.scrollHeight
    }
  }, [streamingContent, responseHistory])

  const handleToggleSession = useCallback(async () => {
    const mode = useAppStore.getState().selectedMode
    await toggleSession(mode)
  }, [])

  return (
    <div className="flex flex-col h-full p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <h2 className="text-title-sm font-semibold text-qm-text-primary">Live Session</h2>
          <StatusIndicator
            status={isSessionActive ? 'active' : 'idle'}
            size={8}
          />
          {isFinalizingSession && (
            <span className="text-caption text-qm-accent animate-pulse">
              Generating summary...
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          <KeyboardShortcutBadge shortcut="Ctrl+Shift+S" size="small" />
          <button
            onClick={handleToggleSession}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-qm-pill font-medium text-body-sm transition-all',
              isSessionActive
                ? 'bg-qm-error text-white hover:bg-red-600'
                : 'bg-gradient-to-r from-qm-gradient-start to-qm-gradient-end text-white hover:shadow-qm-glow',
            )}
          >
            {isSessionActive ? (
              <>
                <Square size={14} /> Stop
              </>
            ) : (
              <>
                <Play size={14} /> Start Session
              </>
            )}
          </button>
        </div>
      </div>

      {/* Error message */}
      {errorMessage && (
        <div className="mb-4 p-3 rounded-qm-md bg-qm-error-light text-qm-error text-body-sm">
          {errorMessage}
        </div>
      )}

      {/* Content area */}
      <div className="flex-1 flex gap-4 min-h-0">
        {/* Transcript panel */}
        <div className="flex-1 flex flex-col rounded-qm-lg bg-qm-surface-light border border-qm-border-subtle overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-qm-border-subtle">
            <div className="flex items-center gap-2">
              <span className="text-label-md text-qm-text-secondary">Transcript</span>
              {wordCount > 0 && (
                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-qm-surface-medium text-qm-text-tertiary">
                  {wordCount} {wordCount === 1 ? 'word' : 'words'}
                </span>
              )}
              {currentTranscript && (
                <button
                  onClick={handleCopyTranscript}
                  className="p-1 rounded-qm-sm hover:bg-qm-surface-medium text-qm-text-tertiary transition-colors"
                  title="Copy transcript"
                >
                  {transcriptCopied ? <Check size={14} className="text-qm-success" /> : <Copy size={14} />}
                </button>
              )}
            </div>
            {isSessionActive && (
              <div className="flex items-center gap-2">
                {audioLevel > 0 ? <Mic size={14} className="text-qm-success" /> : <MicOff size={14} className="text-qm-text-tertiary" />}
                <div className="w-16 h-1.5 bg-qm-bg-tertiary rounded-full overflow-hidden">
                  <div
                    className="h-full bg-qm-success rounded-full transition-all duration-100"
                    style={{ width: `${Math.min(100, audioLevel * 100)}%` }}
                  />
                </div>
              </div>
            )}
          </div>
          <div
            ref={transcriptRef}
            className="flex-1 p-4 overflow-y-auto text-body-md text-qm-text-primary leading-relaxed"
          >
            {currentTranscript || (
              <span className="text-qm-text-tertiary italic">
                {isSessionActive ? 'Listening...' : 'Start a session to see the transcript'}
              </span>
            )}
            {interimTranscript && (
              <span className="text-qm-text-tertiary italic animate-pulse ml-1">
                {interimTranscript}
              </span>
            )}
          </div>
        </div>

        {/* AI Response panel */}
        <div className="flex-1 flex flex-col rounded-qm-lg bg-qm-surface-light border border-qm-border-subtle overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-qm-border-subtle">
            <div className="flex items-center gap-2">
              <Sparkles size={14} className="text-qm-accent" />
              <span className="text-label-md text-qm-text-secondary">AI Responses</span>
              {responseHistory.length > 0 && (
                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-qm-accent/10 text-qm-accent">
                  {responseHistory.length} {responseHistory.length === 1 ? 'response' : 'responses'}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {isProcessing && (
                <span className="text-caption text-qm-accent animate-pulse">Processing...</span>
              )}
              {responseHistory.length > 0 && (
                <button
                  onClick={clearHistory}
                  className="p-1 rounded-qm-sm hover:bg-qm-surface-medium text-qm-text-tertiary hover:text-qm-error transition-colors"
                  title="Clear responses"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          </div>
          <div ref={aiPanelRef} className="flex-1 p-4 overflow-y-auto space-y-3">
            {responseHistory.length === 0 && !streamingContent ? (
              <span className="text-qm-text-tertiary italic text-body-sm">
                {isSessionActive ? 'Type a question or click a tab to get AI assistance' : 'Start a session to get AI assistance'}
              </span>
            ) : (
              <>
                {/* Completed responses (oldest first = reversed since history is newest-first) */}
                {[...responseHistory].reverse().map((response, i) => (
                  <div
                    key={`${response.timestamp}-${i}`}
                    className="p-3 rounded-qm-md bg-qm-surface-medium/50 border border-white/5"
                  >
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-qm-accent/20 text-qm-accent uppercase">
                        {response.type}
                      </span>
                      {response.provider && (
                        <ProviderBadge provider={response.provider} />
                      )}
                      <span className="text-[10px] text-qm-text-tertiary">
                        {new Date(response.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    <div className="prose prose-invert prose-sm max-w-none text-body-sm text-qm-text-primary leading-relaxed">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {response.content}
                      </ReactMarkdown>
                    </div>
                  </div>
                ))}

                {/* Currently streaming response */}
                {streamingContent && (
                  <div className="p-3 rounded-qm-md bg-qm-accent/5 border border-qm-accent/20">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-qm-accent/20 text-qm-accent animate-pulse">
                        STREAMING
                      </span>
                    </div>
                    <div className="prose prose-invert prose-sm max-w-none text-body-sm text-qm-text-primary leading-relaxed">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {streamingContent}
                      </ReactMarkdown>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
