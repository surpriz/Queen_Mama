import { useRef, useEffect, useState } from 'react'
import { Copy, Check, ThumbsUp, ThumbsDown, Zap } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useOverlayStore } from '@/stores/overlayStore'
import { useAppStore } from '@/stores/appStore'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { cn } from '@/lib/utils'

interface ResponseItemProps {
  content: string
  isAutoAnswer?: boolean
  isStreaming?: boolean
  timestamp?: string
}

function ResponseItem({ content, isAutoAnswer, isStreaming, timestamp }: ResponseItemProps) {
  const [copied, setCopied] = useState(false)
  const [feedback, setFeedback] = useState<'up' | 'down' | null>(null)

  const handleCopy = () => {
    navigator.clipboard.writeText(content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleFeedback = (type: 'up' | 'down') => {
    setFeedback(type)
    // TODO: Send feedback to analytics
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={cn(
        'relative rounded-qm-sm p-3 mb-2',
        isAutoAnswer
          ? 'bg-qm-auto-answer/5 border-l-[3px] border-qm-auto-answer'
          : 'bg-qm-surface-light',
      )}
    >
      {/* Auto badge */}
      {isAutoAnswer && (
        <div className="flex items-center gap-1 mb-2">
          <span className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase bg-qm-auto-answer/20 text-qm-auto-answer">
            <Zap size={9} />
            Auto
          </span>
          {timestamp && (
            <span className="text-[9px] text-qm-text-disabled">
              {new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </div>
      )}

      {/* Content */}
      <div className="prose prose-invert prose-sm max-w-none text-body-sm leading-relaxed">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
        {/* Streaming indicator */}
        {isStreaming && (
          <span className="inline-flex items-center ml-1">
            <span className="w-1.5 h-4 bg-qm-accent rounded-sm animate-pulse" />
          </span>
        )}
      </div>

      {/* Actions - Only show when not streaming */}
      {!isStreaming && content && (
        <div className="flex items-center gap-1 mt-2 pt-2 border-t border-qm-border-subtle">
          {/* Copy button */}
          <button
            onClick={handleCopy}
            className="flex items-center gap-1 px-2 py-1 rounded text-[10px] text-qm-text-tertiary hover:text-qm-text-secondary hover:bg-qm-surface-hover transition-colors"
          >
            {copied ? (
              <>
                <Check size={10} className="text-qm-success" />
                Copied
              </>
            ) : (
              <>
                <Copy size={10} />
                Copy
              </>
            )}
          </button>

          {/* Divider */}
          <div className="w-px h-3 bg-qm-border-subtle" />

          {/* Feedback buttons */}
          <button
            onClick={() => handleFeedback('up')}
            className={cn(
              'p-1 rounded transition-colors',
              feedback === 'up'
                ? 'text-qm-success bg-qm-success/10'
                : 'text-qm-text-tertiary hover:text-qm-success hover:bg-qm-success/10',
            )}
          >
            <ThumbsUp size={10} />
          </button>
          <button
            onClick={() => handleFeedback('down')}
            className={cn(
              'p-1 rounded transition-colors',
              feedback === 'down'
                ? 'text-qm-error bg-qm-error/10'
                : 'text-qm-text-tertiary hover:text-qm-error hover:bg-qm-error/10',
            )}
          >
            <ThumbsDown size={10} />
          </button>
        </div>
      )}
    </motion.div>
  )
}

export function ResponseDisplay() {
  const streamingContent = useOverlayStore((s) => s.streamingContent)
  const responseHistory = useOverlayStore((s) => s.responseHistory)
  const isAutoAnswer = useOverlayStore((s) => s.isAutoAnswer)
  const isProcessing = useAppStore((s) => s.isProcessing)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [streamingContent])

  const hasContent = streamingContent || responseHistory.length > 0

  return (
    <div className="flex-1 relative overflow-hidden">
      <div ref={scrollRef} className="h-full overflow-y-auto p-3">
        <AnimatePresence mode="popLayout">
          {hasContent ? (
            <>
              {/* Show streaming content if available */}
              {streamingContent && (
                <ResponseItem
                  key="streaming"
                  content={streamingContent}
                  isAutoAnswer={isAutoAnswer}
                  isStreaming={isProcessing}
                />
              )}

              {/* Show response history when no streaming */}
              {!streamingContent &&
                responseHistory.slice(0, 5).map((response, index) => (
                  <ResponseItem
                    key={`${response.timestamp}-${index}`}
                    content={response.content}
                    timestamp={response.timestamp}
                  />
                ))}
            </>
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center h-full text-center"
            >
              {isProcessing ? (
                <div className="flex items-center gap-2">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full rounded-full bg-qm-accent animate-ping opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-qm-accent" />
                  </span>
                  <span className="text-body-sm text-qm-text-secondary">Generating response...</span>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-body-sm text-qm-text-tertiary">
                    Press <kbd className="px-1.5 py-0.5 rounded bg-qm-surface-medium text-qm-text-secondary text-[10px] font-mono">Ctrl+Enter</kbd> for AI assistance
                  </p>
                  <p className="text-caption-sm text-qm-text-disabled">
                    Or enable Auto-Answer for automatic responses
                  </p>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
