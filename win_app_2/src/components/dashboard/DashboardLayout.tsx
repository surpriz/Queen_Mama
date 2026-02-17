import { useState } from 'react'
import { Loader2, CheckCircle2 } from 'lucide-react'
import { useAppStore } from '@/stores/appStore'
import { Sidebar } from './Sidebar'
import { LiveSessionView } from './LiveSessionView'
import { SessionList } from './SessionList'
import { SessionDetail } from './SessionDetail'
import { ModesListView } from './ModesListView'
import { KnowledgeBaseView } from './KnowledgeBaseView'
import { ContactsView } from './ContactsView'
import { SettingsView } from './SettingsView'

export type NavItem = 'sessions' | 'live' | 'modes' | 'knowledgeBase' | 'contacts' | 'settings'

export function DashboardLayout() {
  const [activeNav, setActiveNav] = useState<NavItem>('live')
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null)
  const isFinalizingSession = useAppStore((s) => s.isFinalizingSession)
  const sessionJustFinalized = useAppStore((s) => s.sessionJustFinalized)

  return (
    <div className="flex h-screen bg-qm-bg-primary">
      {/* Titlebar drag region */}
      <div className="titlebar-drag absolute top-0 left-0 right-0 h-9 z-50" />

      {/* Sidebar */}
      <Sidebar activeItem={activeNav} onItemClick={setActiveNav} />

      {/* Main content */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden pt-9 relative">
        {activeNav === 'live' && <LiveSessionView />}
        {activeNav === 'sessions' && !selectedSessionId && (
          <SessionList onSelectSession={setSelectedSessionId} />
        )}
        {activeNav === 'sessions' && selectedSessionId && (
          <SessionDetail
            sessionId={selectedSessionId}
            onBack={() => setSelectedSessionId(null)}
          />
        )}
        {activeNav === 'modes' && <ModesListView />}
        {activeNav === 'knowledgeBase' && <KnowledgeBaseView />}
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
              setSelectedSessionId(null)
            }}
          >
            <CheckCircle2 size={18} />
            <span className="text-body-sm font-medium">
              Session archivée — Transcription et résumé disponibles
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
