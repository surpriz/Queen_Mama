import { useRef, useEffect, useState, useCallback } from 'react'
import { Copy, Check, Sparkles, MessageSquare, HelpCircle, RotateCcw, Command, ChevronDown } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useOverlayStore } from '@/stores/overlayStore'
import { useAppStore } from '@/stores/appStore'
import { ResponseType } from '@/types/models'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { cn } from '@/lib/utils'
import { AutoResponseBadge } from './AutoResponseBadge'
import { ScreenshotIndicator } from './ScreenshotIndicator'
import { ResponseFeedback } from './ResponseFeedback'

const TYPE_CONFIG = {
  [ResponseType.Assist]: { icon: Sparkles, label: 'Assist', color: 'text-qm-accent' },
  [ResponseType.WhatToSay]: { icon: MessageSquare, label: 'What to say', color: 'text-qm-info' },
  [ResponseType.FollowUp]: { icon: HelpCircle, label: 'Follow-up', color: 'text-qm-warning' },
  [ResponseType.Recap]: { icon: RotateCcw, label: 'Recap', color: 'text-qm-success' },
  [ResponseType.Custom]: { icon: Sparkles, label: 'Custom', color: 'text-qm-text-secondary' },
}

interface ResponseItemProps {
  content: string
  type?: ResponseType
  isStreaming?: boolean
  timestamp?: string
  isAutomatic?: boolean
  hasScreenshot?: boolean
  screenshotTimestamp?: string
  responseId?: string
}

function ResponseItem({
  content,
  type = ResponseType.Assist,
  isStreaming,
  timestamp,
  isAutomatic = false,
  hasScreenshot = false,
  screenshotTimestamp,
  responseId,
}: ResponseItemProps) {
  const [copied, setCopied] = useState(false)
  const config = TYPE_CONFIG[type] || TYPE_CONFIG[ResponseType.Assist]
  const Icon = config.icon

  const handleCopy = () => {
    navigator.clipboard.writeText(content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const formattedTime = timestamp
    ? new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={cn(
        'rounded-qm-md bg-qm-surface-light p-3 mb-3 relative',
        isAutomatic && 'border-l-[3px] border-l-qm-auto-answer',
        isStreaming && 'border border-qm-accent/30'
      )}
    >
      {/* Screenshot indicator - positioned above content */}
      {hasScreenshot && screenshotTimestamp && (
        <div className="mb-2">
          <ScreenshotIndicator timestamp={screenshotTimestamp} />
        </div>
      )}

      {/* Header row - Type label, icons, timestamp */}
      <div className="flex items-center justify-between mb-2">
        {/* Left - Auto badge OR Type label */}
        <div className="flex items-center gap-2">
          {isAutomatic ? (
            <AutoResponseBadge />
          ) : (
            <div className={cn('flex items-center gap-1.5 text-[12px] font-medium', config.color)}>
              <Icon size={14} />
              {config.label}
            </div>
          )}
        </div>

        {/* Right - Keyboard icon, Copy, Timestamp */}
        <div className="flex items-center gap-2 text-qm-text-disabled">
          <Command size={12} />
          <button
            onClick={handleCopy}
            className="hover:text-qm-text-secondary transition-colors"
            title="Copy to clipboard"
          >
            {copied ? <Check size={12} className="text-qm-success" /> : <Copy size={12} />}
          </button>
          <span className="text-[11px] tabular-nums">{formattedTime}</span>
        </div>
      </div>

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

      {/* Feedback buttons - only shown when not streaming and for Enterprise */}
      {!isStreaming && content && responseId && (
        <div className="flex justify-end mt-2 pt-2 border-t border-qm-border-subtle/50">
          <ResponseFeedback responseId={responseId} />
        </div>
      )}
    </motion.div>
  )
}

export function ResponseDisplay() {
  const streamingContent = useOverlayStore((s) => s.streamingContent)
  const responseHistory = useOverlayStore((s) => s.responseHistory)
  const selectedTab = useOverlayStore((s) => s.selectedTab)
  const isProcessing = useAppStore((s) => s.isProcessing)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Smart scroll state - disable auto-scroll when user scrolls up
  const [isUserScrolling, setIsUserScrolling] = useState(false)
  const [showScrollButton, setShowScrollButton] = useState(false)

  // Detect user scroll
  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return

    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 20

    if (!isAtBottom && !isUserScrolling) {
      setIsUserScrolling(true)
      setShowScrollButton(true)
    } else if (isAtBottom && isUserScrolling) {
      setIsUserScrolling(false)
      setShowScrollButton(false)
    }
  }, [isUserScrolling])

  // Scroll to bottom function
  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: 'smooth',
      })
      setIsUserScrolling(false)
      setShowScrollButton(false)
    }
  }, [])

  // Auto-scroll only when not user scrolling
  useEffect(() => {
    if (!isUserScrolling && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [streamingContent, isUserScrolling])

  // Reset user scrolling when new response starts
  useEffect(() => {
    if (isProcessing) {
      setIsUserScrolling(false)
      setShowScrollButton(false)
    }
  }, [isProcessing])

  const hasContent = streamingContent || responseHistory.length > 0

  return (
    <div className="flex-1 relative overflow-hidden min-h-0">
      <div ref={scrollRef} onScroll={handleScroll} className="h-full overflow-y-auto p-3">
        <AnimatePresence mode="popLayout">
          {hasContent ? (
            <>
              {/* Show streaming content if available */}
              {streamingContent && (
                <ResponseItem
                  key="streaming"
                  content={streamingContent}
                  type={selectedTab}
                  isStreaming={isProcessing}
                />
              )}

              {/* Show response history when no streaming */}
              {!streamingContent &&
                responseHistory.slice(0, 5).map((response, index) => (
                  <ResponseItem
                    key={`${response.timestamp}-${index}`}
                    content={response.content}
                    type={response.type}
                    timestamp={response.timestamp}
                  />
                ))}
            </>
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center h-full text-center py-8"
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

      {/* Scroll to bottom button - appears when user scrolls up */}
      <AnimatePresence>
        {showScrollButton && (
          <motion.button
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.15 }}
            onClick={scrollToBottom}
            className="absolute bottom-3 right-3 w-8 h-8 rounded-full bg-qm-accent shadow-qm-lg flex items-center justify-center hover:bg-qm-accent-light transition-colors"
            title="Scroll to bottom"
          >
            <ChevronDown size={16} className="text-white" />
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  )
}
