import { useRef, useEffect, useState } from 'react'
import { Copy, Check } from 'lucide-react'
import { useOverlayStore } from '@/stores/overlayStore'
import { useAppStore } from '@/stores/appStore'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

export function ResponseDisplay() {
  const streamingContent = useOverlayStore((s) => s.streamingContent)
  const isProcessing = useAppStore((s) => s.isProcessing)
  const scrollRef = useRef<HTMLDivElement>(null)
  const [copied, setCopied] = useState(false)

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [streamingContent])

  const handleCopy = () => {
    navigator.clipboard.writeText(streamingContent)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="flex-1 relative overflow-hidden">
      <div ref={scrollRef} className="h-full overflow-y-auto p-3">
        {streamingContent ? (
          <div className="prose prose-invert prose-sm max-w-none text-body-sm leading-relaxed">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {streamingContent}
            </ReactMarkdown>
            {isProcessing && (
              <span className="inline-block w-1.5 h-4 bg-qm-accent animate-pulse ml-0.5" />
            )}
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-qm-text-tertiary text-body-sm">
            {isProcessing ? 'Generating...' : 'Press Ctrl+Enter for AI assistance'}
          </div>
        )}
      </div>

      {/* Copy button */}
      {streamingContent && !isProcessing && (
        <button
          onClick={handleCopy}
          className="absolute top-2 right-2 p-1.5 rounded-qm-sm bg-qm-surface-medium hover:bg-qm-surface-hover text-qm-text-tertiary transition-colors"
        >
          {copied ? <Check size={12} className="text-qm-success" /> : <Copy size={12} />}
        </button>
      )}
    </div>
  )
}
