import { useEffect, useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { HashRouter, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider, QueryCache, MutationCache } from '@tanstack/react-query'
import { captureError } from '@/services/crash/crashReporter'
import { DashboardPage } from './pages/DashboardPage'
import { OverlayPage } from './pages/OverlayPage'
import { OnboardingPage } from './pages/OnboardingPage'
import { NotificationPage } from './pages/NotificationPage'
import { ReauthenticationView } from './components/auth/ReauthenticationView'
import { ErrorBoundary } from './components/common/ErrorBoundary'
import { LoadingSpinner } from './components/common/LoadingSpinner'
import { ToastContainer } from './components/common/ToastContainer'
import { initializeApp } from './services/appInitializer'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts'
import { useUpdater } from './hooks/useUpdater'
import { useOnboardingStore } from './stores/onboardingStore'
import { useAuthStore } from './stores/authStore'

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

function AppContent() {
  const { t } = useTranslation()
  const [isInitialized, setIsInitialized] = useState(false)
  const { hasCompletedOnboarding, loadOnboardingState } = useOnboardingStore()
  const { authState, isAuthenticated, sessionExpired } = useAuthStore()

  // Register global keyboard shortcut handlers
  useKeyboardShortcuts()

  // Subscribe to auto-updater events globally
  useUpdater()

  useEffect(() => {
    const initialize = async () => {
      try {
        // Load onboarding state first
        await loadOnboardingState()
        // Then initialize the app
        await initializeApp()
      } catch (error) {
        console.error('[App] Initialization failed:', error)
      } finally {
        setIsInitialized(true)
      }
    }
    initialize()
  }, [loadOnboardingState])

  // Reactive launch state — mirrors macOS checkAuthAndSetLaunchState()
  const launchState: LaunchState = useMemo(() => {
    const state = (() => {
      if (!isInitialized || authState.type === 'unknown') return 'checking'
      if (isAuthenticated && hasCompletedOnboarding) return 'dashboard'
      if (isAuthenticated && !hasCompletedOnboarding) return 'onboarding'
      // Not authenticated
      if (hasCompletedOnboarding || sessionExpired) return 'login'
      return 'onboarding'
    })()
    console.log('[App] launchState:', state, { isInitialized, authType: authState.type, isAuthenticated, hasCompletedOnboarding, sessionExpired })
    return state
  }, [isInitialized, authState.type, isAuthenticated, hasCompletedOnboarding, sessionExpired])

  const handleReauthenticated = () => {
    // State is reactive — setAuthenticated() in authStore will
    // recalculate launchState to 'dashboard' automatically
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
