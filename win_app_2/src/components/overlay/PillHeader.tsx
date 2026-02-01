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
  Sparkles,
} from 'lucide-react'
import { useOverlayStore } from '@/stores/overlayStore'
import { useAppStore } from '@/stores/appStore'
import { useConfigStore } from '@/stores/configStore'
import { cn } from '@/lib/utils'
import { PopupMenu } from './PopupMenu'
import * as sessionLifecycle from '@/services/sessionLifecycle'

export function PillHeader() {
  const isExpanded = useOverlayStore((s) => s.isExpanded)
  const toggleExpanded = useOverlayStore((s) => s.toggleExpanded)
  const isSessionActive = useAppStore((s) => s.isSessionActive)
  const isProcessing = useAppStore((s) => s.isProcessing)
  const autoAnswerEnabled = useConfigStore((s) => s.autoAnswerEnabled)
  const updateConfig = useConfigStore((s) => s.updateConfig)
  const autoScreenCapture = useConfigStore((s) => s.autoScreenCapture)
  const isUndetectabilityEnabled = useConfigStore((s) => s.isUndetectabilityEnabled)
  const smartModeEnabled = useConfigStore((s) => s.smartModeEnabled)

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

      {/* 3. Expand/Collapse Button with Pulsing Ring */}
      <button
        onClick={(e) => {
          e.stopPropagation()
          toggleExpanded()
        }}
        className="relative flex items-center justify-center w-7 h-7 rounded-full bg-qm-surface-light hover:bg-qm-surface-hover transition-colors titlebar-no-drag"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        title={isExpanded ? 'Collapse' : 'Expand'}
      >
        {/* Pulsing ring when collapsed */}
        {!isExpanded && (
          <span className="absolute inset-0 rounded-full bg-qm-accent/40 animate-pulse-ring" />
        )}
        {isExpanded ? (
          <ChevronUp size={14} className="text-qm-text-secondary relative z-10" />
        ) : (
          <ChevronDown size={14} className="text-qm-text-secondary relative z-10" />
        )}
      </button>

      {/* Spacer / Status badges area */}
      <div className="flex-1 flex items-center gap-1.5 titlebar-drag">
        {/* Mode badge */}
        {smartModeEnabled && (
          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-qm-accent/15 text-[10px] font-medium text-qm-accent">
            <Sparkles size={10} />
            Smart
          </span>
        )}

        {/* Processing indicator */}
        {isProcessing && (
          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-qm-info/15 text-[10px] font-medium text-qm-info">
            <span className="w-1.5 h-1.5 rounded-full bg-qm-info animate-pulse" />
            Processing
          </span>
        )}
      </div>

      {/* Controls - Right side */}
      <div
        className="flex items-center gap-1 titlebar-no-drag"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      >
        {/* 4. Hidden Mode Toggle (Capsule) */}
        <button
          onClick={handleToggleHiddenMode}
          className={cn(
            'flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-medium transition-colors',
            isUndetectabilityEnabled
              ? 'bg-qm-accent/15 text-qm-accent'
              : 'bg-qm-surface-light text-qm-text-tertiary hover:bg-qm-surface-hover',
          )}
          title="Hidden Mode - Invisible during screen sharing"
        >
          {isUndetectabilityEnabled ? <EyeOff size={10} /> : <Eye size={10} />}
          Hidden
        </button>

        {/* 5. Auto-Answer Toggle (Capsule with pulsing dot) */}
        <button
          onClick={handleToggleAutoAnswer}
          className={cn(
            'relative flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-medium transition-colors',
            autoAnswerEnabled
              ? 'bg-qm-auto-answer/15 text-qm-auto-answer'
              : 'bg-qm-surface-light text-qm-text-tertiary hover:bg-qm-surface-hover',
          )}
          title="Auto-Answer - Automatically respond to questions"
        >
          <Zap size={10} />
          Auto
          {/* Pulsing dot when enabled */}
          {autoAnswerEnabled && (
            <span className="absolute -top-0.5 -right-0.5 w-2 h-2">
              <span className="absolute inset-0 rounded-full bg-qm-auto-answer animate-pulse-dot" />
              <span className="absolute inset-0 rounded-full bg-qm-auto-answer" style={{ transform: 'scale(0.6)' }} />
            </span>
          )}
        </button>

        {/* 6. Screen Capture Toggle */}
        <button
          onClick={handleToggleScreenCapture}
          className={cn(
            'flex items-center justify-center w-[26px] h-[26px] rounded-full transition-colors',
            autoScreenCapture
              ? 'bg-qm-success/15 text-qm-success'
              : 'bg-qm-surface-light text-qm-text-tertiary hover:bg-qm-surface-hover',
          )}
          title={autoScreenCapture ? 'Screen capture enabled' : 'Screen capture disabled'}
        >
          {autoScreenCapture ? <Camera size={12} /> : <CameraOff size={12} />}
        </button>

        {/* 7. More Menu */}
        <PopupMenu />

        {/* 8. Start/Stop Session Button with Glow */}
        <button
          onClick={handleStartStop}
          className="relative flex items-center justify-center w-8 h-8 rounded-full transition-transform hover:scale-105 active:scale-95"
          title={isSessionActive ? 'Stop Session' : 'Start Session'}
        >
          {/* Glow effect when active */}
          {isSessionActive && (
            <span className="absolute inset-0 rounded-full bg-gradient-to-br from-qm-gradient-start to-qm-gradient-end animate-pulse-glow" />
          )}
          {/* Button background */}
          <span
            className={cn(
              'absolute inset-0 rounded-full',
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
      </div>
    </div>
  )
}
