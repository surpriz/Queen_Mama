import { useEffect, useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { HashRouter, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider, QueryCache, MutationCache } from '@tanstack/react-query'
import { captureError } from '@/services/crash/crashReporter'
import { DashboardPage } from './pages/DashboardPage'
import { OverlayPage } from './pages/OverlayPage'
import { OnboardingPage } from './pages/OnboardingPage'
import { NotificationPage } from './pages/NotificationPage'
import { SessionPage } from './pages/SessionPage'
import { ReauthenticationView } from './components/auth/ReauthenticationView'
import { ErrorBoundary } from './components/common/ErrorBoundary'
import { LoadingSpinner } from './components/common/LoadingSpinner'
import { ToastContainer } from './components/common/ToastContainer'
import { initializeApp } from './services/appInitializer'
import { installAuthRelay } from './services/relay/authRelay'
import { useRelaySync } from './hooks/useRelaySync'
import { useUpdater } from './hooks/useUpdater'
import { useOnboardingStore } from './stores/onboardingStore'
import { useAuthStore } from './stores/authStore'
import { getWindowKind, isSessionHost } from './lib/runtime'

type LaunchState = 'checking' | 'dashboard' | 'login' | 'onboarding'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 5 * 60 * 1000,
    },
  },
  queryCache: new QueryCache({
    onError: (error, query) => {
      const err = error instanceof Error ? error : new Error(String(error))
      captureError(err, { source: 'react_query', queryKey: query.queryKey })
    },
  }),
  mutationCache: new MutationCache({
    onError: (error, _variables, _context, mutation) => {
      const err = error instanceof Error ? error : new Error(String(error))
      captureError(err, { source: 'react_query_mutation', mutationKey: mutation.options.mutationKey })
    },
  }),
})

// Every window keeps authStore in sync through the relay (dashboard performs
// logins, the session host restores/expires them).
installAuthRelay()

/**
 * Hidden session window: boots the full pipeline (auth, license, sync, audio)
 * and renders nothing meaningful. See SessionPage / sessionHost.
 */
function SessionHostApp() {
  useEffect(() => {
    initializeApp().catch((error) => console.error('[App] Session host initialization failed:', error))
  }, [])

  return <SessionPage />
}

/**
 * Visible windows: light boot (config + local caches), then mirror the host's
 * auth / license / session state.
 */
function UiApp() {
  const { t } = useTranslation()
  const kind = getWindowKind()
  const [isInitialized, setIsInitialized] = useState(false)
  const { hasCompletedOnboarding, loadOnboardingState } = useOnboardingStore()
  const { authState, isAuthenticated, sessionExpired } = useAuthStore()

  useRelaySync()
  useUpdater()

  useEffect(() => {
    const initialize = async () => {
      try {
        await loadOnboardingState()
        await initializeApp()
      } catch (error) {
        console.error('[App] Initialization failed:', error)
      } finally {
        setIsInitialized(true)
      }
    }
    initialize()
  }, [loadOnboardingState])

  // Reactive launch state — mirrors macOS checkAuthAndSetLaunchState().
  // `authState.type === 'unknown'` until the session host has relayed the
  // result of its credential check.
  const launchState: LaunchState = useMemo(() => {
    const state = (() => {
      if (!isInitialized || authState.type === 'unknown') return 'checking'
      if (isAuthenticated && hasCompletedOnboarding) return 'dashboard'
      if (isAuthenticated && !hasCompletedOnboarding) return 'onboarding'
      if (hasCompletedOnboarding || sessionExpired) return 'login'
      return 'onboarding'
    })()
    console.log('[App] launchState:', state, { isInitialized, authType: authState.type, isAuthenticated, hasCompletedOnboarding, sessionExpired })
    return state
  }, [isInitialized, authState.type, isAuthenticated, hasCompletedOnboarding, sessionExpired])

  // The overlay is only meaningful once the user is signed in and onboarded
  // (mac shows it when the dashboard state is reached). The dashboard window
  // owns this decision.
  useEffect(() => {
    if (kind !== 'dashboard') return
    if (launchState === 'dashboard') {
      window.electronAPI?.overlay.show()
    } else if (launchState !== 'checking') {
      window.electronAPI?.overlay.hide()
    }
  }, [kind, launchState])

  const handleReauthenticated = () => {
    // authStore transition (relayed) flips launchState back to 'dashboard'
  }

  return (
    <>
      <Routes>
        <Route
          path="/"
          element={
            launchState === 'checking' ? (
              <div className="flex h-screen items-center justify-center bg-qm-bg-primary">
                <LoadingSpinner size="lg" label={t('loading')} />
              </div>
            ) : launchState === 'dashboard' ? (
              <DashboardPage />
            ) : launchState === 'login' ? (
              <ReauthenticationView onAuthenticated={handleReauthenticated} />
            ) : (
              <OnboardingPage />
            )
          }
        />
        <Route path="/overlay" element={<OverlayPage />} />
        <Route path="/notification" element={<NotificationPage />} />
      </Routes>
      <ToastContainer />
    </>
  )
}

function AppContent() {
  if (isSessionHost()) {
    return (
      <Routes>
        <Route path="/session" element={<SessionHostApp />} />
        <Route path="*" element={<SessionHostApp />} />
      </Routes>
    )
  }
  return <UiApp />
}

export function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <HashRouter>
          <AppContent />
        </HashRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  )
}
