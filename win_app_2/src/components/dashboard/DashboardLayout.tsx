import { useState, useEffect, useRef } from 'react'
import { Loader2, CheckCircle2 } from 'lucide-react'
import { useAppStore } from '@/stores/appStore'
import { useLicenseStore } from '@/stores/licenseStore'
import { useAuthStore } from '@/stores/authStore'
import { Sidebar } from './Sidebar'
import { LiveSessionView } from './LiveSessionView'
import { SessionsView } from './SessionsView'
import { ModesListView } from './ModesListView'
import { ContactsView } from './ContactsView'
import { SettingsView } from './SettingsView'
import { FreeWelcomeBanner } from '@/components/license/FreeWelcomeBanner'
import { PricingModal } from '@/components/license/PricingModal'
import { UpdateBanner } from '@/components/common/UpdateBanner'

export type NavItem = 'sessions' | 'live' | 'modes' | 'contacts' | 'settings'

const LAUNCH_SHOWN_KEY = 'freeUpgradeLaunchShown'
const SESSIONS_KEY = 'freeSessionsCompleted'
const SESSION_UPGRADE_KEY = 'freeSessionUpgradeShown'

export function DashboardLayout() {
  const [activeNav, setActiveNav] = useState<NavItem>('live')
  const isFinalizingSession = useAppStore((s) => s.isFinalizingSession)
  const sessionJustFinalized = useAppStore((s) => s.sessionJustFinalized)
  const isPro = useLicenseStore((s) => s.isPro)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)

  // Pricing modal state
  const [showPricing, setShowPricing] = useState(false)
  const [pricingContext, setPricingContext] = useState<string | undefined>()
  const prevFinalizing = useRef(isFinalizingSession)

  // First-launch upgrade prompt (delayed to wait for license revalidation)
  useEffect(() => {
    if (!isAuthenticated) return
    const alreadyShown = localStorage.getItem(LAUNCH_SHOWN_KEY) === 'true'
    if (alreadyShown) return

    const timer = setTimeout(() => {
      if (!isPro()) {
        localStorage.setItem(LAUNCH_SHOWN_KEY, 'true')
        setShowPricing(true)
      }
    }, 2000)

    return () => clearTimeout(timer)
  }, [isAuthenticated]) // eslint-disable-line react-hooks/exhaustive-deps

  // After 3 completed sessions, show upgrade prompt once
  useEffect(() => {
    if (prevFinalizing.current && !isFinalizingSession && !isPro()) {
      const count = parseInt(localStorage.getItem(SESSIONS_KEY) || '0', 10) + 1
      localStorage.setItem(SESSIONS_KEY, String(count))
      if (count >= 3 && localStorage.getItem(SESSION_UPGRADE_KEY) !== 'true') {
        localStorage.setItem(SESSION_UPGRADE_KEY, 'true')
        setPricingContext('pricing.triggerAfterSession')
        setTimeout(() => setShowPricing(true), 1000)
      }
    }
    prevFinalizing.current = isFinalizingSession
  }, [isFinalizingSession]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex h-screen bg-qm-bg-primary">
      {/* Titlebar drag region */}
      <div className="titlebar-drag absolute top-0 left-0 right-0 h-9 z-50" />

      {/* Sidebar */}
      <Sidebar activeItem={activeNav} onItemClick={setActiveNav} />

      {/* Main content */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden pt-9 relative">
        {/* Auto-update banner — high priority */}
        <UpdateBanner />

        {/* FREE plan banner */}
        {isAuthenticated && <FreeWelcomeBanner />}

        {activeNav === 'live' && <LiveSessionView />}
        {activeNav === 'sessions' && <SessionsView />}
        {activeNav === 'modes' && <ModesListView />}
        {activeNav === 'contacts' && <ContactsView />}
        {activeNav === 'settings' && <SettingsView />}

        {/* Session finalization notifications */}
        {isFinalizingSession && (
          <div className="fixed top-12 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-5 py-3 rounded-qm-lg bg-qm-accent/90 text-white shadow-lg animate-qm-fade-in">
            <Loader2 size={18} className="animate-spin" />
            <span className="text-body-sm font-medium">
              Finalisation en cours... Transcription et résumé en cours de génération
            </span>
          </div>
        )}
        {sessionJustFinalized && !isFinalizingSession && (
          <div
            className="fixed top-12 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-5 py-3 rounded-qm-lg bg-qm-success/90 text-white shadow-lg animate-qm-fade-in cursor-pointer"
            onClick={() => {
              useAppStore.getState().setSessionJustFinalized(false)
              setActiveNav('sessions')
            }}
          >
            <CheckCircle2 size={18} />
            <span className="text-body-sm font-medium">
              Session archivée — Transcription et résumé disponibles
            </span>
          </div>
        )}
      </div>

      <PricingModal
        isOpen={showPricing}
        onClose={() => { setShowPricing(false); setPricingContext(undefined) }}
        contextMessage={pricingContext}
      />
    </div>
  )
}
