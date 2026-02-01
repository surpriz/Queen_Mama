import { useEffect, useState } from 'react'
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { DashboardPage } from './pages/DashboardPage'
import { OverlayPage } from './pages/OverlayPage'
import { OnboardingPage } from './pages/OnboardingPage'
import { ErrorBoundary } from './components/common/ErrorBoundary'
import { LoadingSpinner } from './components/common/LoadingSpinner'
import { FeatureTourModal, KeyboardShortcutsModal } from './components/tour'
import { initializeApp } from './services/appInitializer'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts'
import { useOnboardingStore } from './stores/onboardingStore'
import { useAuthStore } from './stores/authStore'

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
  const { isAuthenticated } = useAuthStore()

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

  if (!isInitialized) {
    return (
      <div className="flex h-screen items-center justify-center bg-qm-bg-primary">
        <LoadingSpinner size="lg" label="Initializing..." />
      </div>
    )
  }

  // Determine if we should show onboarding
  // Show onboarding if:
  // 1. User hasn't completed onboarding AND
  // 2. User is not authenticated (or hasn't been through onboarding flow)
  const shouldShowOnboarding = !hasCompletedOnboarding && !isAuthenticated

  return (
    <>
      <Routes>
        <Route
          path="/"
          element={shouldShowOnboarding ? <Navigate to="/onboarding" replace /> : <DashboardPage />}
        />
        <Route path="/onboarding" element={<OnboardingPage />} />
        <Route path="/overlay" element={<OverlayPage />} />
      </Routes>

      {/* Global modals */}
      <FeatureTourModal />
      <KeyboardShortcutsModal />
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
