import {
  ChevronDown,
  ChevronUp,
  Play,
  Square,
  Camera,
  CameraOff,
  Zap,
  Home,
  Eye,
  EyeOff,
  Lock,
  Loader2,
} from 'lucide-react'
import { useOverlayStore } from '@/stores/overlayStore'
import { useAppStore } from '@/stores/appStore'
import { useConfigStore } from '@/stores/configStore'
import { cn } from '@/lib/utils'
import { PopupMenu } from './PopupMenu'
import { SmartModeBadge } from './SmartModeBadge'
import * as sessionLifecycle from '@/services/sessionLifecycle'

export function PillHeader() {
  const isExpanded = useOverlayStore((s) => s.isExpanded)
  const toggleExpanded = useOverlayStore((s) => s.toggleExpanded)
  const isSessionActive = useAppStore((s) => s.isSessionActive)
  const isFinalizingSession = useAppStore((s) => s.isFinalizingSession)
  const autoAnswerEnabled = useConfigStore((s) => s.autoAnswerEnabled)
  const updateConfig = useConfigStore((s) => s.updateConfig)
  const autoScreenCapture = useConfigStore((s) => s.autoScreenCapture)
  const isUndetectabilityEnabled = useConfigStore((s) => s.isUndetectabilityEnabled)

  const handleStartStop = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (isSessionActive) {
      await sessionLifecycle.stopSession()
    } else {
      await sessionLifecycle.startSession()
    }
  }

  const handleDashboard = (e: React.MouseEvent) => {
    e.stopPropagation()
    window.electronAPI?.window.show()
  }

  const handleToggleAutoAnswer = (e: React.MouseEvent) => {
    e.stopPropagation()
    updateConfig({ autoAnswerEnabled: !autoAnswerEnabled })
  }

  const handleToggleHiddenMode = (e: React.MouseEvent) => {
    e.stopPropagation()
    updateConfig({ isUndetectabilityEnabled: !isUndetectabilityEnabled })
  }

  const handleToggleScreenCapture = (e: React.MouseEvent) => {
    e.stopPropagation()
    updateConfig({ autoScreenCapture: !autoScreenCapture })
  }

  return (
    <div
      className={cn(
        'flex items-center gap-1.5 px-2 pill-glass shadow-qm-lg cursor-pointer select-none transition-all',
        isExpanded ? 'rounded-t-qm-xl' : 'rounded-qm-pill',
      )}
      style={{ height: 44, WebkitAppRegion: 'drag' } as React.CSSProperties}
    >
      {/* 1. Logo Drag Handle - Gradient circle with waveform */}
      <div
        className="flex items-center justify-center w-7 h-7 rounded-full bg-gradient-to-br from-qm-gradient-start to-qm-gradient-end shadow-qm-sm titlebar-drag"
        title="Drag to move"
      >
        {/* Waveform icon representation */}
        <div className="flex items-center gap-0.5">
          <div className="w-0.5 h-2 bg-white/90 rounded-full" />
          <div className="w-0.5 h-3 bg-white/90 rounded-full" />
          <div className="w-0.5 h-1.5 bg-white/90 rounded-full" />
          <div className="w-0.5 h-2.5 bg-white/90 rounded-full" />
        </div>
      </div>

      {/* 2. Dashboard Button */}
      <button
        onClick={handleDashboard}
        className="flex items-center justify-center w-[26px] h-[26px] rounded-full bg-qm-surface-light hover:bg-qm-surface-hover transition-colors titlebar-no-drag"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        title="Open Dashboard"
      >
        <Home size={13} className="text-qm-text-secondary" />
      </button>

      {/* 3. Expand/Collapse Button - Gradient background like macOS */}
      <button
        onClick={(e) => {
          e.stopPropagation()
          toggleExpanded()
        }}
        className="relative flex items-center justify-center w-7 h-7 rounded-full bg-gradient-to-br from-qm-gradient-start to-qm-gradient-end hover:opacity-90 transition-opacity titlebar-no-drag shadow-qm-sm"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        title={isExpanded ? 'Collapse' : 'Expand'}
      >
        {/* Pulsing ring when collapsed - indicates hidden content */}
        {!isExpanded && (
          <span className="absolute inset-0 rounded-full border-2 border-qm-accent/40 animate-pulse-chevron opacity-60" />
        )}
        {isExpanded ? (
          <ChevronUp size={14} className="text-white" />
        ) : (
          <ChevronDown size={14} className={cn('text-white', !isExpanded && 'animate-pulse-chevron')} />
        )}
      </button>

      {/* Spacer with Smart Mode Badge */}
      <div className="flex-1 flex items-center gap-2 titlebar-drag">
        <SmartModeBadge />
      </div>

      {/* Controls - Right side */}
      <div
        className="flex items-center gap-1 titlebar-no-drag"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      >
        {/* 4. Hidden Mode Toggle (Capsule with lock icon) */}
        <button
          onClick={handleToggleHiddenMode}
          className={cn(
            'flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors border',
            isUndetectabilityEnabled
              ? 'bg-qm-accent/10 text-qm-text-secondary border-qm-accent/30'
              : 'bg-qm-surface-light/50 text-qm-text-tertiary border-qm-border-subtle hover:bg-qm-surface-hover',
          )}
          title="Hidden Mode - Invisible during screen sharing"
        >
          <EyeOff size={12} className={isUndetectabilityEnabled ? 'text-qm-accent' : ''} />
          Hidden
          <Lock size={8} className="text-qm-text-disabled ml-0.5" />
        </button>

        {/* 5. Auto-Answer Toggle (Capsule with lock icon) */}
        <button
          onClick={handleToggleAutoAnswer}
          className={cn(
            'flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors border',
            autoAnswerEnabled
              ? 'bg-qm-auto-answer/10 text-qm-text-secondary border-qm-auto-answer/30'
              : 'bg-qm-surface-light/50 text-qm-text-tertiary border-qm-border-subtle hover:bg-qm-surface-hover',
          )}
          title="Auto-Answer - Automatically respond to questions"
        >
          <Zap size={12} className={autoAnswerEnabled ? 'text-qm-auto-answer' : ''} />
          Auto
          <Lock size={8} className="text-qm-text-disabled ml-0.5" />
        </button>

        {/* 6. Screen Capture Toggle - Red when disabled (like macOS) */}
        <button
          onClick={handleToggleScreenCapture}
          className={cn(
            'flex items-center justify-center w-[28px] h-[28px] rounded-full transition-colors',
            autoScreenCapture
              ? 'bg-qm-surface-light text-qm-text-secondary hover:bg-qm-surface-hover'
              : 'bg-qm-error/15 text-qm-error',
          )}
          title={autoScreenCapture ? 'Screen capture enabled' : 'Screen capture disabled'}
        >
          {autoScreenCapture ? <Camera size={14} /> : <CameraOff size={14} />}
        </button>

        {/* 7. More Menu */}
        <PopupMenu />

        {/* 8. Finalization Indicator OR Start/Stop Session Button */}
        {isFinalizingSession ? (
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-qm-accent/15 border border-qm-accent/25">
            <Loader2 size={12} className="text-qm-accent animate-spin" />
            <span className="text-[10px] font-medium text-qm-accent">Résumé...</span>
          </div>
        ) : (
          <button
            onClick={handleStartStop}
            className="relative flex items-center justify-center w-8 h-8 rounded-full transition-transform hover:scale-105 active:scale-95"
            title={isSessionActive ? 'Stop Session' : 'Start Session'}
          >
            {/* Glow effect when active */}
            {isSessionActive && (
              <span className="absolute inset-0 rounded-full bg-gradient-to-br from-qm-gradient-start to-qm-gradient-end animate-pulse-glow" />
            )}
            {/* Pulsing glow ring when not active - invites user to start */}
            {!isSessionActive && (
              <span className="absolute inset-0 rounded-full bg-gradient-to-br from-qm-gradient-start/30 to-qm-gradient-end/30 animate-pulse-glow" />
            )}
            {/* Button background */}
            <span
              className={cn(
                'absolute inset-0 rounded-full shadow-qm-md',
                isSessionActive
                  ? 'bg-qm-error'
                  : 'bg-gradient-to-br from-qm-gradient-start to-qm-gradient-end',
              )}
            />
            {/* Icon */}
            {isSessionActive ? (
              <Square size={12} className="text-white relative z-10" fill="white" />
            ) : (
              <Play size={14} className="text-white relative z-10 ml-0.5" fill="white" />
            )}
          </button>
        )}
      </div>
    </div>
  )
}
