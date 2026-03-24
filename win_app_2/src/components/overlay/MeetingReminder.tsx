/**
 * Meeting Reminder Component
 *
 * Floating notification displayed when a meeting/call app is detected
 * and no session is currently active. Positioned at top-right of the overlay.
 *
 * Features:
 * - App-specific icon and name
 * - "Start session?" button with gradient styling
 * - Dismiss (X) button
 * - Auto-dismiss after 15 seconds
 * - Slide-in / fade-out animation
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { Video, Globe, Hash, Headphones, MessageSquare, X } from 'lucide-react'
import { useAppStore } from '@/stores/appStore'
import { toggleSession } from '@/services/sessionLifecycle'
import { createLogger } from '@/lib/logger'
import { cn } from '@/lib/utils'

const log = createLogger('MeetingReminder')

const AUTO_DISMISS_MS = 15_000 // 15 seconds

// ---------------------------------------------------------------------------
// App icon mapping
// ---------------------------------------------------------------------------

interface AppIconConfig {
  icon: typeof Video
  color: string
  bgColor: string
}

const APP_ICONS: Record<string, AppIconConfig> = {
  Zoom: {
    icon: Video,
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/15',
  },
  'Microsoft Teams': {
    icon: MessageSquare,
    color: 'text-violet-400',
    bgColor: 'bg-violet-500/15',
  },
  'Google Meet': {
    icon: Globe,
    color: 'text-green-400',
    bgColor: 'bg-green-500/15',
  },
  'Slack Huddle': {
    icon: Hash,
    color: 'text-pink-400',
    bgColor: 'bg-pink-500/15',
  },
  Discord: {
    icon: Headphones,
    color: 'text-indigo-400',
    bgColor: 'bg-indigo-500/15',
  },
}

const DEFAULT_ICON: AppIconConfig = {
  icon: Video,
  color: 'text-qm-accent',
  bgColor: 'bg-qm-accent/15',
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function MeetingReminder() {
  const [detectedApp, setDetectedApp] = useState<string | null>(null)
  const [isVisible, setIsVisible] = useState(false)
  const [isExiting, setIsExiting] = useState(false)
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isSessionActive = useAppStore((s) => s.isSessionActive)
  const selectedMode = useAppStore((s) => s.selectedMode)

  // Listen for meeting detection events from main process
  useEffect(() => {
    const api = window.electronAPI
    if (!api?.onMeetingDetected) return

    const cleanup = api.onMeetingDetected((data: { appName: string }) => {
      if (!data?.appName) {
        log.warn('Received meeting detection event with no appName')
        return
      }

      log.info(`Meeting detected: ${data.appName}`)
      showReminder(data.appName)
    })

    return () => {
      if (typeof cleanup === 'function') {
        cleanup()
      }
    }
  }, [])

  // Auto-dismiss if session becomes active while reminder is showing
  useEffect(() => {
    if (isSessionActive && isVisible) {
      dismiss()
    }
  }, [isSessionActive, isVisible])

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (dismissTimerRef.current) {
        clearTimeout(dismissTimerRef.current)
      }
    }
  }, [])

  const showReminder = useCallback((appName: string) => {
    // Clear any previous dismiss timer
    if (dismissTimerRef.current) {
      clearTimeout(dismissTimerRef.current)
    }

    setDetectedApp(appName)
    setIsExiting(false)
    setIsVisible(true)

    // Auto-dismiss after 15 seconds
    dismissTimerRef.current = setTimeout(() => {
      dismiss()
    }, AUTO_DISMISS_MS)
  }, [])

  const dismiss = useCallback(() => {
    if (dismissTimerRef.current) {
      clearTimeout(dismissTimerRef.current)
      dismissTimerRef.current = null
    }

    // Tell main process to hide the notification window
    window.electronAPI?.meetingDismiss('')

    // Start exit animation
    setIsExiting(true)

    // Remove from DOM after animation completes
    setTimeout(() => {
      setIsVisible(false)
      setIsExiting(false)
      setDetectedApp(null)
    }, 300) // matches CSS transition duration
  }, [])

  const handleStartSession = useCallback(async () => {
    log.info(`Starting session from meeting reminder (app: ${detectedApp})`)
    dismiss()
    // Small delay to let the dismiss animation begin
    setTimeout(async () => {
      await toggleSession(selectedMode)
    }, 100)
  }, [detectedApp, dismiss, selectedMode])

  // Don't render if not visible or no app detected
  if (!isVisible || !detectedApp) {
    return null
  }

  const iconConfig = APP_ICONS[detectedApp] ?? DEFAULT_ICON
  const IconComponent = iconConfig.icon

  return (
    <div
      className={cn(
        'fixed top-3 right-3 z-50',
        'transition-all duration-300 ease-out',
        isExiting
          ? 'opacity-0 translate-x-4'
          : 'opacity-100 translate-x-0 animate-slide-in-right',
      )}
    >
      <div
        className={cn(
          'flex items-center gap-3 px-4 py-3',
          'bg-qm-bg-secondary/95 backdrop-blur-xl',
          'rounded-xl',
          'border border-white/[0.08]',
          'shadow-[0_8px_32px_rgba(0,0,0,0.4)]',
          'min-w-[280px] max-w-[360px]',
        )}
      >
        {/* App icon */}
        <div
          className={cn(
            'flex items-center justify-center w-10 h-10 rounded-lg flex-shrink-0',
            iconConfig.bgColor,
          )}
        >
          <IconComponent size={20} className={iconConfig.color} />
        </div>

        {/* Message */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-qm-text-primary truncate">
            {detectedApp} detected
          </p>
          <p className="text-xs text-qm-text-secondary">
            Start a session?
          </p>
        </div>

        {/* Start button */}
        <button
          onClick={handleStartSession}
          className={cn(
            'px-3.5 py-1.5 rounded-lg flex-shrink-0',
            'text-xs font-semibold text-white',
            'bg-gradient-to-r from-qm-accent to-qm-accent-light',
            'hover:opacity-90 active:opacity-80',
            'transition-opacity duration-150',
          )}
        >
          Start
        </button>

        {/* Dismiss button */}
        <button
          onClick={dismiss}
          className={cn(
            'flex items-center justify-center w-6 h-6 rounded-full flex-shrink-0',
            'text-qm-text-tertiary hover:text-qm-text-primary',
            'hover:bg-white/[0.08]',
            'transition-colors duration-150',
          )}
        >
          <X size={12} />
        </button>
      </div>

      {/* Progress bar for auto-dismiss countdown */}
      {!isExiting && (
        <div className="mt-1 mx-4">
          <div className="h-0.5 bg-white/[0.06] rounded-full overflow-hidden">
            <div
              className="h-full bg-qm-accent/40 rounded-full"
              style={{
                animation: `shrink-width ${AUTO_DISMISS_MS}ms linear forwards`,
              }}
            />
          </div>
        </div>
      )}
    </div>
  )
}
