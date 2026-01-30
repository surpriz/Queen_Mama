import { useEffect, useState } from 'react'
import { HashRouter, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { DashboardPage } from './pages/DashboardPage'
import { OverlayPage } from './pages/OverlayPage'
import { OnboardingPage } from './pages/OnboardingPage'
import { ErrorBoundary } from './components/common/ErrorBoundary'
import { LoadingSpinner } from './components/common/LoadingSpinner'
import { initializeApp } from './services/appInitializer'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts'

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

  // Register global keyboard shortcut handlers
  useKeyboardShortcuts()

  useEffect(() => {
    initializeApp()
      .then(() => setIsInitialized(true))
      .catch((error) => {
        console.error('[App] Initialization failed:', error)
        setIsInitialized(true) // Continue anyway
      })
  }, [])

  if (!isInitialized) {
    return (
      <div className="flex h-screen items-center justify-center bg-qm-bg-primary">
        <LoadingSpinner size="lg" label="Initializing..." />
      </div>
    )
  }

  return (
    <Routes>
      <Route path="/" element={<DashboardPage />} />
      <Route path="/onboarding" element={<OnboardingPage />} />
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
