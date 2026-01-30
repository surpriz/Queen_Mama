import {
  ChevronDown,
  ChevronUp,
  Play,
  Square,
  Camera,
  CameraOff,
  Zap,
} from 'lucide-react'
import { useOverlayStore } from '@/stores/overlayStore'
import { useAppStore } from '@/stores/appStore'
import { useConfigStore } from '@/stores/configStore'
import { StatusIndicator } from '@/components/common/StatusIndicator'
import { cn } from '@/lib/utils'

export function PillHeader() {
  const isExpanded = useOverlayStore((s) => s.isExpanded)
  const toggleExpanded = useOverlayStore((s) => s.toggleExpanded)
  const isSessionActive = useAppStore((s) => s.isSessionActive)
  const isProcessing = useAppStore((s) => s.isProcessing)
  const autoAnswerEnabled = useConfigStore((s) => s.autoAnswerEnabled)

  return (
    <div
      className={cn(
        'flex items-center gap-2 px-3 rounded-qm-pill bg-qm-overlay border border-qm-border-subtle shadow-qm-lg cursor-pointer select-none transition-all',
        isExpanded ? 'rounded-b-none border-b-0' : '',
      )}
      style={{ height: 44, WebkitAppRegion: 'drag' } as React.CSSProperties}
      onClick={toggleExpanded}
    >
      {/* Status */}
      <StatusIndicator
        status={isSessionActive ? (isProcessing ? 'processing' : 'active') : 'idle'}
        size={6}
      />

      {/* Title */}
      <span className="text-body-sm text-qm-text-primary font-medium flex-1 titlebar-drag">
        Queen Mama
      </span>

      {/* Controls */}
      <div className="flex items-center gap-1.5 titlebar-no-drag" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
        {/* Auto-answer badge */}
        {autoAnswerEnabled && (
          <Zap size={12} className="text-qm-auto-answer" />
        )}

        {/* Expand/collapse */}
        <button className="p-1 rounded-qm-sm hover:bg-qm-surface-hover transition-colors">
          {isExpanded ? (
            <ChevronUp size={14} className="text-qm-text-secondary" />
          ) : (
            <ChevronDown size={14} className="text-qm-text-secondary" />
          )}
        </button>
      </div>
    </div>
  )
}
