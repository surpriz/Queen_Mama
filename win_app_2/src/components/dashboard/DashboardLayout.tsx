import { useState, useEffect } from 'react'
import { Play, Square, MonitorUp, XCircle, AlertTriangle, Eye, EyeOff, Loader2, X } from 'lucide-react'
import * as Dialog from '@radix-ui/react-dialog'
import { Sidebar } from './Sidebar'
import { LiveSessionView } from './LiveSessionView'
import { SessionsView } from './SessionsView'
import { ModesListView } from './ModesListView'
import { SettingsView } from './SettingsView'
import { GradientText } from '@/components/common/GradientText'
import { SignInChoice } from '@/components/auth/SignInChoice'
import { useAppStore } from '@/stores/appStore'
import { useAuthStore } from '@/stores/authStore'
import { cn } from '@/lib/utils'
import * as sessionLifecycle from '@/services/sessionLifecycle'

export type NavItem = 'sessions' | 'live' | 'modes' | 'settings'

export function DashboardLayout() {
  const [activeNav, setActiveNav] = useState<NavItem>('sessions')
  const [showSignInModal, setShowSignInModal] = useState(false)
  const isSessionActive = useAppStore((s) => s.isSessionActive)
  const isFinalizingSession = useAppStore((s) => s.isFinalizingSession)
  const isOverlayVisible = useAppStore((s) => s.isOverlayVisible)
  const toggleOverlay = useAppStore((s) => s.toggleOverlay)
  const authState = useAuthStore((s) => s.authState)
  const currentUser = useAuthStore((s) => s.currentUser)

  const isSignedIn = authState === 'authenticated' && currentUser
  const canStartSession = isSignedIn || isSessionActive // Can stop if active, need auth to start

  // Close sign-in modal when user is authenticated
  useEffect(() => {
    if (isSignedIn && showSignInModal) {
      setShowSignInModal(false)
    }
  }, [isSignedIn, showSignInModal])

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

  const handleToggleOverlay = () => {
    toggleOverlay()
  }

  const handleSignIn = () => {
    setShowSignInModal(true)
  }

  return (
    <div className="flex h-screen bg-qm-bg-primary">
      {/* Titlebar drag region */}
      <div className="titlebar-drag absolute top-0 left-0 right-0 h-9 z-50" />

      {/* Sidebar */}
      <Sidebar activeItem={activeNav} onItemClick={setActiveNav} onSignIn={handleSignIn} />

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
            {/* Finalization indicator */}
            {isFinalizingSession && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-qm-md bg-qm-accent/10 border border-qm-accent/20">
                <Loader2 size={14} className="text-qm-accent animate-spin" />
                <span className="text-body-sm text-qm-accent font-medium">Generating summary...</span>
              </div>
            )}

            {/* Start/Stop button - disabled when not signed in (unless already active) */}
            {!isFinalizingSession && (
              <button
                onClick={handleStartStop}
                disabled={!canStartSession}
                className={cn(
                  'flex items-center gap-2 px-4 py-1.5 rounded-qm-md text-body-sm font-medium transition-all',
                  !canStartSession
                    ? 'bg-qm-surface-light/50 text-qm-text-disabled cursor-not-allowed opacity-50'
                    : isSessionActive
                    ? 'bg-qm-error/10 text-qm-error hover:bg-qm-error/20'
                    : 'bg-gradient-to-r from-qm-gradient-start to-qm-gradient-end text-white hover:opacity-90',
                )}
                title={!canStartSession ? 'Sign in to start sessions' : isSessionActive ? 'Stop Session (Ctrl+Shift+S)' : 'Start Session (Ctrl+Shift+S)'}
              >
                {isSessionActive ? (
                  <>
                    <Square size={12} fill="currentColor" />
                    Stop
                  </>
                ) : (
                  <>
                    <Play size={12} fill="currentColor" />
                    Start
                  </>
                )}
              </button>
            )}

            {/* Toggle overlay visibility */}
            <button
              onClick={handleToggleOverlay}
              className={cn(
                'p-2 rounded-qm-md transition-colors',
                isOverlayVisible
                  ? 'bg-qm-accent/10 text-qm-accent hover:bg-qm-accent/20'
                  : 'bg-qm-surface-light text-qm-text-secondary hover:bg-qm-surface-hover'
              )}
              title={isOverlayVisible ? 'Hide Widget (Ctrl+\\)' : 'Show Widget (Ctrl+\\)'}
            >
              {isOverlayVisible ? <Eye size={16} /> : <EyeOff size={16} />}
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

      {/* Sign In Modal */}
      <Dialog.Root open={showSignInModal} onOpenChange={setShowSignInModal}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" />
          <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-qm-bg-secondary rounded-qm-xl border border-qm-border-subtle shadow-2xl z-50 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-qm-border-subtle">
              <Dialog.Title asChild>
                <GradientText as="h2" className="text-title-sm font-semibold">
                  Sign In
                </GradientText>
              </Dialog.Title>
              <Dialog.Close asChild>
                <button className="p-1.5 rounded-qm-md text-qm-text-tertiary hover:text-qm-text-primary hover:bg-qm-surface-light transition-colors">
                  <X size={18} />
                </button>
              </Dialog.Close>
            </div>
            <div className="p-6">
              <SignInChoice />
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  )
}
