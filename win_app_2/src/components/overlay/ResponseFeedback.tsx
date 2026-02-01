import { useState } from 'react'
import { ThumbsUp, ThumbsDown } from 'lucide-react'
import { useLicenseStore } from '@/stores/licenseStore'
import { cn } from '@/lib/utils'

interface ResponseFeedbackProps {
  responseId: string
  onFeedback?: (isPositive: boolean) => void
}

type FeedbackState = 'none' | 'helpful' | 'notHelpful'

export function ResponseFeedback({ responseId: _responseId, onFeedback }: ResponseFeedbackProps) {
  const [feedbackState, setFeedbackState] = useState<FeedbackState>('none')
  const isEnterprise = useLicenseStore((s) => s.isEnterprise())

  // Only show feedback for Enterprise users
  if (!isEnterprise) return null

  const handleFeedback = (isPositive: boolean) => {
    setFeedbackState(isPositive ? 'helpful' : 'notHelpful')
    onFeedback?.(isPositive)

    // TODO: Wire to FeedbackSyncManager
    // window.electronAPI?.submitFeedback(responseId, isPositive)
  }

  if (feedbackState !== 'none') {
    return (
      <div className="flex items-center gap-1.5 text-[10px]">
        {feedbackState === 'helpful' ? (
          <>
            <ThumbsUp size={10} className="text-qm-success" fill="currentColor" />
            <span className="text-qm-success font-medium">Thanks!</span>
          </>
        ) : (
          <>
            <ThumbsDown size={10} className="text-qm-text-tertiary" fill="currentColor" />
            <span className="text-qm-text-tertiary font-medium">Got it</span>
          </>
        )}
      </div>
    )
  }

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={() => handleFeedback(true)}
        className={cn(
          'flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-medium',
          'bg-qm-surface-hover/50 text-qm-text-tertiary',
          'hover:bg-qm-success/15 hover:text-qm-success transition-colors'
        )}
        title="Helpful"
      >
        <ThumbsUp size={10} />
        <span>Helpful</span>
      </button>
      <button
        onClick={() => handleFeedback(false)}
        className={cn(
          'flex items-center justify-center w-6 h-6 rounded-full',
          'bg-qm-surface-hover/50 text-qm-text-tertiary',
          'hover:bg-qm-surface-hover transition-colors'
        )}
        title="Not helpful"
      >
        <ThumbsDown size={10} />
      </button>
    </div>
  )
}
