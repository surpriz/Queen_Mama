import { useState, useEffect, useCallback } from 'react'
import {
  ChevronDown,
  AudioLines,
  EyeOff,
  Zap,
  Play,
  Square,
  Camera,
  Home,
  Brain,
  Loader2,
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
import { PopupMenu } from './PopupMenu'
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
  const smartModeEnabled = useConfigStore((s) => s.smartModeEnabled)
  const isUndetectable = useConfigStore((s) => s.isUndetectabilityEnabled)
  const autoScreenCapture = useConfigStore((s) => s.autoScreenCapture)
  const updateConfig = useConfigStore((s) => s.updateConfig)
  const isFinalizingSession = useAppStore((s) => s.isFinalizingSession)

  // Moment detection state
  const [currentMoment, setCurrentMoment] = useState<DetectedMoment | null>(null)
  const [momentVisible, setMomentVisible] = useState(false)

  // Pulsing ring states (auto-stop after 3s)
  const [isExpandPulsing, setIsExpandPulsing] = useState(false)
  const [isStartPulsing, setIsStartPulsing] = useState(false)

  // Subscribe to moment detection events
  useEffect(() => {
    let hideTimer: ReturnType<typeof setTimeout> | null = null

    const unsubscribe = onMomentsDetected((moments: DetectedMoment[]) => {
      if (moments.length > 0) {
        setCurrentMoment(moments[0])
        setMomentVisible(true)
        if (hideTimer) clearTimeout(hideTimer)
        hideTimer = setTimeout(() => setMomentVisible(false), 8000)
      }
    })

    return () => {
      unsubscribe()
      if (hideTimer) clearTimeout(hideTimer)
    }
  }, [])

  // Pulsing ring for expand button: pulse when collapsed, stop after 3s
  useEffect(() => {
    if (!isExpanded) {
      setIsExpandPulsing(true)
      const t = setTimeout(() => setIsExpandPulsing(false), 3000)
      return () => clearTimeout(t)
    } else {
      setIsExpandPulsing(false)
    }
  }, [isExpanded])

  // Pulsing ring for start button: pulse when not in session, stop after 3s
  useEffect(() => {
    if (!isSessionActive) {
      setIsStartPulsing(true)
      const t = setTimeout(() => setIsStartPulsing(false), 3000)
      return () => clearTimeout(t)
    } else {
      setIsStartPulsing(false)
    }
  }, [isSessionActive])

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
      window.electronAPI?.window.toggle()
    },
    [],
  )

  return (
    <div
      className={cn(
        'flex items-center gap-2 px-3 cursor-pointer select-none transition-all',
        isExpanded ? '' : 'rounded-2xl',
      )}
      style={{ height: 44, WebkitAppRegion: 'drag' } as React.CSSProperties}
      onClick={toggleExpanded}
    >
      {/* 1. Logo - drag handle only, not clickable */}
      <div
        className="flex items-center justify-center w-7 h-7 rounded-full bg-gradient-to-br from-qm-gradient-start to-qm-gradient-end flex-shrink-0 shadow-sm cursor-grab active:cursor-grabbing"
        onClick={(e) => e.stopPropagation()}
        title="Drag to move"
      >
        <AudioLines size={13} className="text-white" />
      </div>

      {/* 2. Dashboard button - gradient on hover */}
      <button
        onClick={handleOpenDashboard}
        className="flex items-center justify-center w-[26px] h-[26px] rounded-full bg-qm-surface-medium hover:bg-gradient-to-br hover:from-qm-gradient-start/40 hover:to-qm-gradient-end/40 transition-all hover-scale-lg flex-shrink-0 titlebar-no-drag"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        title="Open Dashboard"
      >
        <Home size={13} className="text-qm-text-secondary" />
      </button>

      {/* 3. Expand/Collapse chevron - gradient circle when collapsed, surface when expanded */}
      <div className="relative flex-shrink-0 titlebar-no-drag" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
        {/* Pulsing ring behind button (only when collapsed) */}
        {isExpandPulsing && !isExpanded && (
          <span className="absolute inset-0 rounded-full bg-qm-accent/40 animate-pulsing-ring pointer-events-none" />
        )}
        <button
          onClick={(e) => { e.stopPropagation(); toggleExpanded() }}
          className={cn(
            'relative flex items-center justify-center w-7 h-7 rounded-full transition-all',
            isExpanded
              ? 'bg-qm-surface-medium hover:bg-qm-surface-hover'
              : 'bg-gradient-to-br from-qm-gradient-start to-qm-gradient-end shadow-sm',
          )}
        >
          <div
            className="transition-transform duration-300"
            style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}
          >
            <ChevronDown size={14} className={isExpanded ? 'text-qm-text-secondary' : 'text-white'} />
          </div>
        </button>
      </div>

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
              'flex items-center gap-0.5 px-1.5 py-0.5 rounded-full animate-qm-fade-in transition-opacity duration-250',
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

        {/* 7. Smart mode badge */}
        {smartModeEnabled && (
          <div className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-purple-500/20">
            <Brain size={11} className="text-purple-400" />
            <span className="text-caption-sm text-purple-400 font-medium">Smart</span>
          </div>
        )}

        {/* 8. Auto-answer badge */}
        {autoAnswerEnabled && (
          <div className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-qm-auto-answer/20 animate-pulse ring-1 ring-qm-auto-answer/30 transition-opacity duration-250">
            <Zap size={11} className="text-qm-auto-answer" />
            <span className="text-caption-sm text-qm-auto-answer font-medium">Auto</span>
          </div>
        )}

        {/* 9. Screenshot toggle */}
        <button
          onClick={handleToggleScreenCapture}
          className={cn(
            'flex items-center justify-center w-[26px] h-[26px] rounded-full transition-colors',
            autoScreenCapture
              ? 'bg-emerald-500/20 text-emerald-400'
              : 'bg-qm-error/15 text-qm-error hover:bg-qm-error/25',
          )}
          title={autoScreenCapture ? 'Screen capture ON' : 'Screen capture OFF'}
        >
          <Camera size={12} />
        </button>

        {/* 10. Popup menu (more options) */}
        <PopupMenu />

        {/* 11. Finalization indicator */}
        {isFinalizingSession && (
          <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-qm-accent/15">
            <Loader2 size={11} className="text-qm-accent animate-spin" />
            <span className="text-caption-sm text-qm-accent font-medium">Résumé...</span>
          </div>
        )}

        {/* 12. Start/Stop Session - gradient with pulsing glow ring */}
        <div className="relative flex-shrink-0">
          {/* Pulsing glow ring for start button */}
          {isStartPulsing && !isSessionActive && (
            <span className="absolute inset-0 rounded-full bg-qm-accent/30 animate-pulsing-ring-play pointer-events-none" />
          )}
          <button
            onClick={handleToggleSession}
            className={cn(
              'relative flex items-center justify-center rounded-full transition-all flex-shrink-0',
              isSessionActive
                ? 'w-[26px] h-[26px] bg-red-500/15 hover:bg-red-500/25'
                : 'w-8 h-8 bg-gradient-to-br from-qm-gradient-start to-qm-gradient-end shadow-qm-glow hover-scale-lg',
            )}
            title={isSessionActive ? 'Stop session' : 'Start session'}
          >
            {isSessionActive ? (
              <Square size={10} className="text-red-400" fill="currentColor" />
            ) : (
              <Play size={14} className="text-white" fill="currentColor" />
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
