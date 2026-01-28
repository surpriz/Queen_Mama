import { useState } from 'react'
import { Sidebar } from './Sidebar'
import { LiveSessionView } from './LiveSessionView'
import { SessionList } from './SessionList'
import { SessionDetail } from './SessionDetail'
import { ModesListView } from './ModesListView'
import { SettingsView } from './SettingsView'

export type NavItem = 'sessions' | 'live' | 'modes' | 'settings'

export function DashboardLayout() {
  const [activeNav, setActiveNav] = useState<NavItem>('live')
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null)

  return (
    <div className="flex h-screen bg-qm-bg-primary">
      {/* Titlebar drag region */}
      <div className="titlebar-drag absolute top-0 left-0 right-0 h-9 z-50" />

      {/* Sidebar */}
      <Sidebar activeItem={activeNav} onItemClick={setActiveNav} />

      {/* Main content */}
      <div className="flex-1 overflow-hidden pt-9">
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
        {activeNav === 'settings' && <SettingsView />}
      </div>
    </div>
  )
}
