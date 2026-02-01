import { useState } from 'react'
import { Play, Square, MonitorUp, XCircle, AlertTriangle } from 'lucide-react'
import { Sidebar } from './Sidebar'
import { LiveSessionView } from './LiveSessionView'
import { SessionsView } from './SessionsView'
import { ModesListView } from './ModesListView'
import { SettingsView } from './SettingsView'
import { GradientText } from '@/components/common/GradientText'
import { useAppStore } from '@/stores/appStore'
import { useAuthStore } from '@/stores/authStore'
import { cn } from '@/lib/utils'
import * as sessionLifecycle from '@/services/sessionLifecycle'

export type NavItem = 'sessions' | 'live' | 'modes' | 'settings'

export function DashboardLayout() {
  const [activeNav, setActiveNav] = useState<NavItem>('sessions')
  const isSessionActive = useAppStore((s) => s.isSessionActive)
  const authState = useAuthStore((s) => s.authState)
  const currentUser = useAuthStore((s) => s.currentUser)

  const isSignedIn = authState === 'authenticated' && currentUser

  const handleStartStop = async () => {
    if (isSessionActive) {
      await sessionLifecycle.stopSession()
    } else {
      await sessionLifecycle.startSession()
    }
  }

  const handleScreenCapture = () => {
    window.electronAPI?.screen.capture()
  }

  const handleClearContext = () => {
    useAppStore.getState().clearContext()
  }

  const handleSignIn = () => {
    window.electronAPI?.openExternal('https://queenmama.ai/signin')
  }

  return (
    <div className="flex h-screen bg-qm-bg-primary">
      {/* Titlebar drag region */}
      <div className="titlebar-drag absolute top-0 left-0 right-0 h-9 z-50" />

      {/* Sidebar */}
      <Sidebar activeItem={activeNav} onItemClick={setActiveNav} />

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header bar */}
        <div className="flex items-center justify-between px-6 h-14 border-b border-qm-border-subtle bg-qm-bg-secondary/50 pt-9">
          <div className="flex items-center gap-4">
            {/* Logo icon */}
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-qm-gradient-start to-qm-gradient-end flex items-center justify-center">
              <div className="flex items-center gap-0.5">
                <div className="w-0.5 h-2 bg-white/90 rounded-full" />
                <div className="w-0.5 h-3 bg-white/90 rounded-full" />
                <div className="w-0.5 h-1.5 bg-white/90 rounded-full" />
                <div className="w-0.5 h-2.5 bg-white/90 rounded-full" />
              </div>
            </div>
            <GradientText as="span" className="text-headline font-bold">
              Queen Mama
            </GradientText>
          </div>

          {/* Header actions */}
          <div className="flex items-center gap-2">
            {/* Start/Stop button */}
            <button
              onClick={handleStartStop}
              className={cn(
                'flex items-center gap-2 px-4 py-1.5 rounded-qm-md text-body-sm font-medium transition-all',
                isSessionActive
                  ? 'bg-qm-surface-light text-qm-text-secondary hover:bg-qm-surface-hover'
                  : 'bg-qm-surface-light text-qm-text-secondary hover:bg-qm-surface-hover',
              )}
            >
              {isSessionActive ? (
                <>
                  <Square size={12} className="text-qm-error" />
                  Stop
                </>
              ) : (
                <>
                  <Play size={12} className="text-qm-success" />
                  Start
                </>
              )}
            </button>

            {/* Screen capture */}
            <button
              onClick={handleScreenCapture}
              className="p-2 rounded-qm-md bg-qm-surface-light text-qm-text-secondary hover:bg-qm-surface-hover transition-colors"
              title="Screen Capture"
            >
              <MonitorUp size={16} />
            </button>

            {/* Clear context */}
            <button
              onClick={handleClearContext}
              className="p-2 rounded-qm-md bg-qm-surface-light text-qm-text-secondary hover:bg-qm-surface-hover transition-colors"
              title="Clear Context"
            >
              <XCircle size={16} />
            </button>
          </div>
        </div>

        {/* Sign-in banner */}
        {!isSignedIn && (
          <div className="flex items-center justify-between px-6 py-3 bg-qm-bg-tertiary border-b border-qm-border-subtle">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-qm-warning/20 flex items-center justify-center">
                <AlertTriangle size={16} className="text-qm-warning" />
              </div>
              <div>
                <p className="text-body-sm font-medium text-qm-text-primary">You're not signed in</p>
                <p className="text-caption text-qm-text-tertiary">Sign in to start recording sessions and access all features</p>
              </div>
            </div>
            <button
              onClick={handleSignIn}
              className="flex items-center gap-2 px-4 py-2 rounded-qm-pill bg-gradient-to-r from-qm-gradient-start to-qm-gradient-end text-white text-body-sm font-medium hover:opacity-90 transition-opacity"
            >
              Sign In
            </button>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {activeNav === 'live' && <LiveSessionView />}
          {activeNav === 'sessions' && <SessionsView />}
          {activeNav === 'modes' && <ModesListView />}
          {activeNav === 'settings' && <SettingsView />}
        </div>
      </div>
    </div>
  )
}
