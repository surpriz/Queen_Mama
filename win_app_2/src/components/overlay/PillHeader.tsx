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
  Lock,
  Sparkles,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useOverlayStore } from '@/stores/overlayStore'
import { useAppStore } from '@/stores/appStore'
import { useConfigStore } from '@/stores/configStore'
import { useLicenseStore } from '@/stores/licenseStore'
import { useMomentStore } from '@/stores/momentStore'
import { useAudioHealthStore } from '@/stores/audioHealthStore'
import { usePreGenStore } from '@/stores/preGenStore'
import { Feature } from '@/types/auth'
import type { MomentType } from '@/services/detection/momentDetectionService'
import * as sessionClient from '@/services/session/sessionClient'
import { toast } from '@/stores/toastStore'
import { PopupMenu } from './PopupMenu'
import { FreeRequestCounter } from './FreeRequestCounter'
import { MeetingCostIndicator } from './MeetingCostIndicator'
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

const NO_DRAG = { WebkitAppRegion: 'no-drag' } as React.CSSProperties

export function PillHeader() {
  const { t } = useTranslation('overlay')
  const isExpanded = useOverlayStore((s) => s.isExpanded)
  const toggleExpanded = useOverlayStore((s) => s.toggleExpanded)
  const setShowContactPicker = useOverlayStore((s) => s.setShowContactPicker)
  const isSessionActive = useAppStore((s) => s.isSessionActive)
  const setShowUpgradePricing = useAppStore((s) => s.setShowUpgradePricing)
  const autoAnswerEnabled = useConfigStore((s) => s.autoAnswerEnabled)
  const smartModeEnabled = useConfigStore((s) => s.smartModeEnabled)
  const isUndetectable = useConfigStore((s) => s.isUndetectabilityEnabled)
  const autoScreenCapture = useConfigStore((s) => s.autoScreenCapture)
  const updateConfig = useConfigStore((s) => s.updateConfig)
  const isFinalizingSession = useAppStore((s) => s.isFinalizingSession)
  const canUse = useLicenseStore((s) => s.canUse)
  const preGenState = usePreGenStore((s) => s.state)

  // Enterprise locks (mac shows a lock badge and disables the toggle)
  const hiddenLocked = canUse(Feature.Undetectable).type !== 'allowed'
  const autoLocked = canUse(Feature.AutoAnswer).type !== 'allowed'
  const smartLocked = canUse(Feature.SmartMode).type === 'requiresEnterprise'

  const MOMENT_LABELS_SHORT: Record<MomentType, string> = {
    objection: t('proactive.obj'),
    expertiseQuestion: t('proactive.q'),
    hesitation: t('proactive.hes'),
    closingOpportunity: t('proactive.close'),
  }

  // Moments are detected in the hidden session window and relayed here
  const currentMoment = useMomentStore((s) => s.current)
  const momentVisible = useMomentStore((s) => s.visible)
  const micAvailable = useAudioHealthStore((s) => s.micAvailable)
  const systemAudioAvailable = useAudioHealthStore((s) => s.systemAudioAvailable)
  const systemAudioReceiving = useAudioHealthStore((s) => s.systemAudioReceiving)
  const audioWarning: string | null = !isSessionActive
    ? null
    : !micAvailable
      ? t('pillHeader.noMic')
      : !systemAudioAvailable || !systemAudioReceiving
        ? t('pillHeader.micOnly')
        : null

  // Pulsing ring states (auto-stop after 3s)
  const [isExpandPulsing, setIsExpandPulsing] = useState(false)
  const [isStartPulsing, setIsStartPulsing] = useState(false)

  useEffect(() => {
    if (!isExpanded) {
      setIsExpandPulsing(true)
      const timer = setTimeout(() => setIsExpandPulsing(false), 3000)
      return () => clearTimeout(timer)
    }
    setIsExpandPulsing(false)
  }, [isExpanded])

  useEffect(() => {
    if (!isSessionActive) {
      setIsStartPulsing(true)
      const timer = setTimeout(() => setIsStartPulsing(false), 3000)
      return () => clearTimeout(timer)
    }
    setIsStartPulsing(false)
  }, [isSessionActive])

  const handleToggleSession = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      if (isSessionActive) {
        sessionClient.stopSession().catch((err) => {
          toast.error(err instanceof Error ? err.message : String(err))
        })
        return
      }
      // Pick a contact before starting (mac: sheet from the widget)
      if (!isExpanded) toggleExpanded()
      setShowContactPicker(true)
    },
    [isSessionActive, isExpanded, toggleExpanded, setShowContactPicker],
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
      if (hiddenLocked) {
        setShowUpgradePricing(true)
        return
      }
      updateConfig({ isUndetectabilityEnabled: !isUndetectable })
    },
    [hiddenLocked, isUndetectable, updateConfig, setShowUpgradePricing],
  )

  const handleToggleAuto = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      if (autoLocked) {
        setShowUpgradePricing(true)
        return
      }
      updateConfig({ autoAnswerEnabled: !autoAnswerEnabled })
    },
    [autoLocked, autoAnswerEnabled, updateConfig, setShowUpgradePricing],
  )

  const handleSmartClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      if (smartLocked) {
        setShowUpgradePricing(true)
        return
      }
      updateConfig({ smartModeEnabled: !smartModeEnabled })
    },
    [smartLocked, smartModeEnabled, updateConfig, setShowUpgradePricing],
  )

  const handleOpenDashboard = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    window.electronAPI?.window.show()
  }, [])

  return (
    <div
      className={cn('flex items-center gap-2 px-3 cursor-pointer select-none transition-all', isExpanded ? '' : 'rounded-2xl')}
      style={{ height: 44, WebkitAppRegion: 'drag' } as React.CSSProperties}
      onClick={toggleExpanded}
    >
      <div
        className="flex items-center justify-center w-7 h-7 rounded-full bg-gradient-to-br from-qm-gradient-start to-qm-gradient-end flex-shrink-0 shadow-sm cursor-grab active:cursor-grabbing"
        onClick={(e) => e.stopPropagation()}
        title={t('pillHeader.dragToMove')}
      >
        <AudioLines size={13} className="text-white" />
      </div>

      <button
        onClick={handleOpenDashboard}
        className="flex items-center justify-center w-[26px] h-[26px] rounded-full bg-qm-surface-medium hover:bg-gradient-to-br hover:from-qm-gradient-start/40 hover:to-qm-gradient-end/40 transition-all hover-scale-lg flex-shrink-0 titlebar-no-drag"
        style={NO_DRAG}
        title={t('pillHeader.openDashboard')}
      >
        <Home size={13} className="text-qm-text-secondary" />
      </button>

      <div className="relative flex-shrink-0 titlebar-no-drag" style={NO_DRAG}>
        {isExpandPulsing && !isExpanded && (
          <span className="absolute inset-0 rounded-full bg-qm-accent/40 animate-pulsing-ring pointer-events-none" />
        )}
        <button
          onClick={(e) => {
            e.stopPropagation()
            toggleExpanded()
          }}
          className={cn(
            'relative flex items-center justify-center w-7 h-7 rounded-full transition-all',
            isExpanded ? 'bg-qm-surface-medium hover:bg-qm-surface-hover' : 'bg-gradient-to-br from-qm-gradient-start to-qm-gradient-end shadow-sm',
          )}
          title={isExpanded ? t('pillHeader.collapse') : t('pillHeader.expand')}
        >
          <div className="transition-transform duration-300" style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}>
            <ChevronDown size={14} className={isExpanded ? 'text-qm-text-secondary' : 'text-white'} />
          </div>
        </button>
      </div>

      <FreeRequestCounter />
      <MeetingCostIndicator />

      <div className="flex-1 min-w-2 titlebar-drag" />

      <div className="flex items-center gap-1 titlebar-no-drag" style={NO_DRAG}>
        {audioWarning && (
          <div
            className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-amber-500/20 animate-qm-fade-in"
            title={!micAvailable ? t('pillHeader.noMicHint') : t('pillHeader.micOnlyHint')}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            <span className="text-caption-sm font-semibold text-amber-400">{audioWarning}</span>
          </div>
        )}

        {momentVisible && currentMoment && (
          <div
            className={cn(
              'flex items-center gap-0.5 px-1.5 py-0.5 rounded-full animate-qm-fade-in transition-opacity duration-250',
              MOMENT_BG_COLORS[currentMoment.type as MomentType],
            )}
            title={currentMoment.triggerPhrase}
          >
            <div className={cn('w-1.5 h-1.5 rounded-full', MOMENT_COLORS[currentMoment.type as MomentType])} />
            <span className={cn('text-caption-sm font-semibold', MOMENT_TEXT_COLORS[currentMoment.type as MomentType])}>
              {MOMENT_LABELS_SHORT[currentMoment.type as MomentType]}
            </span>
          </div>
        )}

        {isSessionActive && preGenState !== 'idle' && (
          <div
            className={cn(
              'flex items-center gap-0.5 px-1.5 py-0.5 rounded-full',
              preGenState === 'ready' ? 'bg-qm-accent/25' : 'bg-qm-surface-medium',
            )}
            title={preGenState === 'ready' ? t('pillHeader.preGenReadyHint') : t('pillHeader.preGenGeneratingHint')}
          >
            <Sparkles size={11} className={cn(preGenState === 'ready' ? 'text-qm-accent-light' : 'text-qm-text-tertiary animate-pulse')} />
            {preGenState === 'ready' && <span className="text-caption-sm font-medium text-qm-accent-light">{t('pillHeader.ready')}</span>}
          </div>
        )}

        <button
          onClick={handleToggleHidden}
          className={cn(
            'flex items-center gap-0.5 px-1.5 py-0.5 rounded-full transition-colors',
            isUndetectable && !hiddenLocked ? 'bg-emerald-500/20 hover:bg-emerald-500/30' : 'bg-qm-surface-medium hover:bg-qm-surface-hover',
            hiddenLocked && 'opacity-70',
          )}
          title={hiddenLocked ? t('pillHeader.enterpriseOnly') : isUndetectable ? t('pillHeader.hiddenModeOn') : t('pillHeader.hiddenModeOff')}
        >
          {hiddenLocked ? (
            <Lock size={10} className="text-qm-text-tertiary" />
          ) : (
            <EyeOff size={11} className={isUndetectable ? 'text-emerald-400' : 'text-qm-text-tertiary'} />
          )}
          <span className={cn('text-caption-sm font-medium', isUndetectable && !hiddenLocked ? 'text-emerald-400' : 'text-qm-text-tertiary')}>
            {t('pillHeader.hidden')}
          </span>
        </button>

        {(smartModeEnabled || smartLocked) && (
          <button
            onClick={handleSmartClick}
            className={cn(
              'flex items-center gap-0.5 px-1.5 py-0.5 rounded-full transition-colors',
              smartModeEnabled && !smartLocked ? 'bg-purple-500/20 hover:bg-purple-500/30' : 'bg-qm-surface-medium hover:bg-qm-surface-hover opacity-70',
            )}
            title={smartLocked ? t('pillHeader.enterpriseOnly') : t('pillHeader.smartModeTooltip')}
          >
            {smartLocked ? <Lock size={10} className="text-qm-text-tertiary" /> : <Brain size={11} className="text-purple-400" />}
            <span className={cn('text-caption-sm font-medium', smartModeEnabled && !smartLocked ? 'text-purple-400' : 'text-qm-text-tertiary')}>
              {t('pillHeader.smart')}
            </span>
          </button>
        )}

        {(autoAnswerEnabled || autoLocked) && (
          <button
            onClick={handleToggleAuto}
            className={cn(
              'flex items-center gap-0.5 px-1.5 py-0.5 rounded-full transition-colors',
              autoAnswerEnabled && !autoLocked
                ? 'bg-qm-auto-answer/20 ring-1 ring-qm-auto-answer/30 animate-pulse'
                : 'bg-qm-surface-medium hover:bg-qm-surface-hover opacity-70',
            )}
            title={autoLocked ? t('pillHeader.enterpriseOnly') : t('pillHeader.autoTooltip')}
          >
            {autoLocked ? <Lock size={10} className="text-qm-text-tertiary" /> : <Zap size={11} className="text-qm-auto-answer" />}
            <span className={cn('text-caption-sm font-medium', autoAnswerEnabled && !autoLocked ? 'text-qm-auto-answer' : 'text-qm-text-tertiary')}>
              {t('pillHeader.auto')}
            </span>
          </button>
        )}

        <button
          onClick={handleToggleScreenCapture}
          className={cn(
            'flex items-center justify-center w-[26px] h-[26px] rounded-full transition-colors',
            autoScreenCapture ? 'bg-emerald-500/20 text-emerald-400' : 'bg-qm-error/15 text-qm-error hover:bg-qm-error/25',
          )}
          title={autoScreenCapture ? t('pillHeader.screenCaptureOn') : t('pillHeader.screenCaptureOff')}
        >
          <Camera size={12} />
        </button>

        <PopupMenu />

        {isFinalizingSession && (
          <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-qm-accent/15">
            <Loader2 size={11} className="text-qm-accent animate-spin" />
            <span className="text-caption-sm text-qm-accent font-medium">{t('pillHeader.summary')}</span>
          </div>
        )}

        <div className="relative flex-shrink-0">
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
            title={isSessionActive ? t('pillHeader.stopSession') : t('pillHeader.startSession')}
          >
            {isSessionActive ? <Square size={10} className="text-red-400" fill="currentColor" /> : <Play size={14} className="text-white" fill="currentColor" />}
          </button>
        </div>
      </div>
    </div>
  )
}
