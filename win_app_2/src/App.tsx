import { useEffect, useState, useMemo } from 'react'
import { HashRouter, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { DashboardPage } from './pages/DashboardPage'
import { OverlayPage } from './pages/OverlayPage'
import { OnboardingPage } from './pages/OnboardingPage'
import { ReauthenticationView } from './components/auth/ReauthenticationView'
import { ErrorBoundary } from './components/common/ErrorBoundary'
import { LoadingSpinner } from './components/common/LoadingSpinner'
import { initializeApp } from './services/appInitializer'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts'
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
})

function AppContent() {
  const [isInitialized, setIsInitialized] = useState(false)
  const { hasCompletedOnboarding, loadOnboardingState } = useOnboardingStore()
  const { authState, isAuthenticated, sessionExpired } = useAuthStore()

  // Register global keyboard shortcut handlers
  useKeyboardShortcuts()

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
    <Routes>
      <Route
        path="/"
        element={
          launchState === 'checking' ? (
            <div className="flex h-screen items-center justify-center bg-qm-bg-primary">
              <LoadingSpinner size="lg" label="Initializing..." />
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
    </Routes>
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
