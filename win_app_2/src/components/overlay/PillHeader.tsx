import { useState, useEffect, useCallback } from 'react'
import {
  ChevronDown,
  ChevronUp,
  Music,
  EyeOff,
  Zap,
  Play,
  Square,
  Camera,
  Home,
} from 'lucide-react'
import { useOverlayStore } from '@/stores/overlayStore'
import { useAppStore } from '@/stores/appStore'
import { useConfigStore } from '@/stores/configStore'
import { toggleSession } from '@/services/sessionLifecycle'
import {
  onMomentsDetected,
  type DetectedMoment,
  type MomentType,
} from '@/services/detection/momentDetectionService'
import { cn } from '@/lib/utils'

const MOMENT_COLORS: Record<MomentType, string> = {
  objection: 'bg-red-500',
  expertiseQuestion: 'bg-blue-500',
  hesitation: 'bg-yellow-500',
  closingOpportunity: 'bg-emerald-500',
}

const MOMENT_TEXT_COLORS: Record<MomentType, string> = {
  objection: 'text-red-400',
  expertiseQuestion: 'text-blue-400',
  hesitation: 'text-yellow-400',
  closingOpportunity: 'text-emerald-400',
}

const MOMENT_BG_COLORS: Record<MomentType, string> = {
  objection: 'bg-red-500/20',
  expertiseQuestion: 'bg-blue-500/20',
  hesitation: 'bg-yellow-500/20',
  closingOpportunity: 'bg-emerald-500/20',
}

const MOMENT_LABELS_SHORT: Record<MomentType, string> = {
  objection: 'OBJ',
  expertiseQuestion: 'Q',
  hesitation: 'HES',
  closingOpportunity: 'CLOSE',
}

export function PillHeader() {
  const isExpanded = useOverlayStore((s) => s.isExpanded)
  const toggleExpanded = useOverlayStore((s) => s.toggleExpanded)
  const isSessionActive = useAppStore((s) => s.isSessionActive)
  const selectedMode = useAppStore((s) => s.selectedMode)
  const autoAnswerEnabled = useConfigStore((s) => s.autoAnswerEnabled)
  const isUndetectable = useConfigStore((s) => s.isUndetectabilityEnabled)
  const autoScreenCapture = useConfigStore((s) => s.autoScreenCapture)
  const updateConfig = useConfigStore((s) => s.updateConfig)

  // Moment detection state
  const [currentMoment, setCurrentMoment] = useState<DetectedMoment | null>(null)
  const [momentVisible, setMomentVisible] = useState(false)

  // Subscribe to moment detection events
  useEffect(() => {
    let hideTimer: ReturnType<typeof setTimeout> | null = null

    const unsubscribe = onMomentsDetected((moments: DetectedMoment[]) => {
      if (moments.length > 0) {
        setCurrentMoment(moments[0])
        setMomentVisible(true)
        // Clear any previous auto-hide timer
        if (hideTimer) clearTimeout(hideTimer)
        // Auto-hide after 8 seconds
        hideTimer = setTimeout(() => setMomentVisible(false), 8000)
      }
    })

    return () => {
      unsubscribe()
      if (hideTimer) clearTimeout(hideTimer)
    }
  }, [])

  const handleToggleSession = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation()
      await toggleSession(selectedMode)
    },
    [selectedMode],
  )

  const handleToggleScreenCapture = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      updateConfig({ autoScreenCapture: !autoScreenCapture })
    },
    [autoScreenCapture, updateConfig],
  )

  const handleToggleHidden = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      updateConfig({ isUndetectabilityEnabled: !isUndetectable })
    },
    [isUndetectable, updateConfig],
  )

  const handleOpenDashboard = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      window.electronAPI?.overlay?.hide()
      window.electronAPI?.window.show()
    },
    [],
  )

  return (
    <div
      className={cn(
        'flex items-center gap-1.5 px-2.5 cursor-pointer select-none transition-all',
        isExpanded ? '' : 'rounded-2xl',
      )}
      style={{ height: 40, WebkitAppRegion: 'drag' } as React.CSSProperties}
      onClick={toggleExpanded}
    >
      {/* 1. Logo */}
      <div className="flex items-center justify-center w-6 h-6 rounded-full bg-qm-accent/20 flex-shrink-0">
        <Music size={12} className="text-qm-accent" />
      </div>

      {/* 2. Dashboard button */}
      <button
        onClick={handleOpenDashboard}
        className="flex items-center justify-center w-6 h-6 rounded-full bg-qm-surface-medium hover:bg-qm-surface-hover transition-colors flex-shrink-0 titlebar-no-drag"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        title="Open Dashboard"
      >
        <Home size={13} className="text-qm-text-secondary" />
      </button>

      {/* 3. Expand/Collapse chevron (Mac position: left side, after dashboard) */}
      <button
        onClick={(e) => { e.stopPropagation(); toggleExpanded() }}
        className={cn(
          'p-1 rounded-qm-sm hover:bg-qm-surface-hover transition-colors titlebar-no-drag',
          isExpanded && isSessionActive && 'animate-pulse ring-1 ring-qm-accent/30',
        )}
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      >
        {isExpanded ? (
          <ChevronUp size={14} className="text-qm-text-secondary" />
        ) : (
          <ChevronDown size={14} className="text-qm-text-secondary" />
        )}
      </button>

      {/* 4. Spacer / drag region */}
      <div className="flex-1 min-w-2 titlebar-drag" />

      {/* Right-side controls */}
      <div
        className="flex items-center gap-1 titlebar-no-drag"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      >
        {/* 5. Moment badge */}
        {momentVisible && currentMoment && (
          <div
            className={cn(
              'flex items-center gap-0.5 px-1.5 py-0.5 rounded-full animate-qm-fade-in',
              MOMENT_BG_COLORS[currentMoment.type],
            )}
            title={currentMoment.triggerPhrase}
          >
            <div
              className={cn('w-1.5 h-1.5 rounded-full', MOMENT_COLORS[currentMoment.type])}
            />
            <span
              className={cn(
                'text-caption-sm font-semibold',
                MOMENT_TEXT_COLORS[currentMoment.type],
              )}
            >
              {MOMENT_LABELS_SHORT[currentMoment.type]}
            </span>
          </div>
        )}

        {/* 6. Hidden mode toggle */}
        <button
          onClick={handleToggleHidden}
          className={cn(
            'flex items-center gap-0.5 px-1.5 py-0.5 rounded-full transition-colors',
            isUndetectable
              ? 'bg-emerald-500/20 hover:bg-emerald-500/30'
              : 'bg-qm-surface-medium hover:bg-qm-surface-hover',
          )}
          title={isUndetectable ? 'Hidden mode ON - Click to disable' : 'Hidden mode OFF - Click to enable'}
        >
          <EyeOff size={11} className={isUndetectable ? 'text-emerald-400' : 'text-qm-text-tertiary'} />
          <span className={cn('text-caption-sm font-medium', isUndetectable ? 'text-emerald-400' : 'text-qm-text-tertiary')}>
            Hidden
          </span>
        </button>

        {/* 7. Auto-answer badge */}
        {autoAnswerEnabled && (
          <div className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-qm-auto-answer/20 animate-pulse ring-1 ring-qm-auto-answer/30">
            <Zap size={11} className="text-qm-auto-answer" />
            <span className="text-caption-sm text-qm-auto-answer font-medium">Auto</span>
          </div>
        )}

        {/* 8. Screenshot toggle */}
        <button
          onClick={handleToggleScreenCapture}
          className={cn(
            'p-1 rounded-qm-sm transition-colors',
            autoScreenCapture
              ? 'bg-qm-accent/20 text-qm-accent'
              : 'text-qm-text-tertiary hover:bg-qm-surface-hover hover:text-qm-text-secondary',
          )}
          title={autoScreenCapture ? 'Screen capture ON' : 'Screen capture OFF'}
        >
          <Camera size={13} />
        </button>

        {/* 9. Start/Stop Session (Mac position: far right) */}
        <button
          onClick={handleToggleSession}
          className={cn(
            'flex items-center justify-center w-7 h-7 rounded-full transition-colors flex-shrink-0',
            isSessionActive
              ? 'bg-red-500/20 hover:bg-red-500/30 ring-2 ring-qm-success/40 animate-pulse'
              : 'bg-qm-accent/20 hover:bg-qm-accent/30',
          )}
          title={isSessionActive ? 'Stop session' : 'Start session'}
        >
          {isSessionActive ? (
            <Square size={10} className="text-red-400" fill="currentColor" />
          ) : (
            <Play size={12} className="text-qm-accent" fill="currentColor" />
          )}
        </button>
      </div>
    </div>
  )
}
