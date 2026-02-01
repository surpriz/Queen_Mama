import { useRef, useEffect, useState } from 'react'
import { Copy, Check, Sparkles, MessageSquare, HelpCircle, RotateCcw, Command } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useOverlayStore } from '@/stores/overlayStore'
import { useAppStore } from '@/stores/appStore'
import { ResponseType } from '@/types/models'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { cn } from '@/lib/utils'

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
}

function ResponseItem({ content, type = ResponseType.Assist, isStreaming, timestamp }: ResponseItemProps) {
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
      className="rounded-qm-md bg-qm-surface-light p-3 mb-3"
    >
      {/* Header row - Type label, icons, timestamp */}
      <div className="flex items-center justify-between mb-2">
        {/* Left - Type label */}
        <div className={cn('flex items-center gap-1.5 text-[12px] font-medium', config.color)}>
          <Icon size={14} />
          {config.label}
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
    </motion.div>
  )
}

export function ResponseDisplay() {
  const streamingContent = useOverlayStore((s) => s.streamingContent)
  const responseHistory = useOverlayStore((s) => s.responseHistory)
  const selectedTab = useOverlayStore((s) => s.selectedTab)
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
    <div className="flex-1 relative overflow-hidden min-h-0">
      <div ref={scrollRef} className="h-full overflow-y-auto p-3">
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
    </div>
  )
}
