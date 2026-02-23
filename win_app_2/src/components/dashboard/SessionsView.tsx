import { useState } from 'react'
import { Search, Trash2, Calendar, FileText } from 'lucide-react'
import { useSession } from '@/hooks/useSession'
import { formatDate, truncate, cn } from '@/lib/utils'
import { SessionDetail } from './SessionDetail'

export function SessionsView() {
  const { filteredSessions, searchQuery, setSearchQuery, deleteSession } = useSession()
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null)

  const selectedSession = selectedSessionId
    ? filteredSessions.find((s) => s.id === selectedSessionId)
    : null

  const formatDuration = (startTime: string, endTime: string | null): string => {
    if (!endTime) return ''
    const durationMs = new Date(endTime).getTime() - new Date(startTime).getTime()
    const minutes = Math.floor(durationMs / 60000)
    const seconds = Math.floor((durationMs % 60000) / 1000)
    if (minutes >= 60) {
      const hours = Math.floor(minutes / 60)
      const mins = minutes % 60
      return `${hours}:${mins.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
    }
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  return (
    <div className="flex h-full">
      {/* Left panel - Session list */}
      <div className="w-[400px] flex flex-col border-r border-qm-border-subtle">
        {/* Search */}
        <div className="p-4">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-qm-text-tertiary" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search sessions..."
              className="w-full pl-10 pr-4 py-2.5 rounded-qm-md bg-qm-surface-light border border-qm-border-subtle text-body-sm text-qm-text-primary placeholder:text-qm-text-disabled focus:border-qm-accent focus:outline-none"
            />
          </div>
        </div>

        {/* Session cards */}
        <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-2">
          {filteredSessions.length === 0 ? (
            <div className="text-center py-12 text-qm-text-tertiary text-body-sm">
              {searchQuery ? 'No sessions found' : 'No sessions yet'}
            </div>
          ) : (
            filteredSessions.map((session) => {
              const duration = formatDuration(session.startTime, session.endTime)
              const isSelected = session.id === selectedSessionId

              return (
                <div
                  key={session.id}
                  onClick={() => setSelectedSessionId(session.id)}
                  className={cn(
                    'p-4 rounded-qm-lg cursor-pointer transition-colors group',
                    isSelected
                      ? 'bg-qm-surface-hover border border-qm-border-medium'
                      : 'bg-qm-surface-light hover:bg-qm-surface-medium border border-transparent',
                  )}
                >
                  {/* Title + Sync dot + Delete */}
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      {session.syncStatus === 'synced' && (
                        <span className="w-2 h-2 rounded-full bg-green-400 shrink-0" title="Synced" />
                      )}
                      {session.syncStatus === 'pending' && (
                        <span className="w-2 h-2 rounded-full bg-yellow-400 shrink-0" title="Pending" />
                      )}
                      <h3 className="text-body-md font-medium text-qm-text-primary line-clamp-1">
                        {session.title}
                      </h3>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        deleteSession(session.id)
                        if (isSelected) setSelectedSessionId(null)
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1.5 rounded-qm-sm hover:bg-qm-error-light text-qm-text-tertiary hover:text-qm-error transition-all shrink-0"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>

                  {/* Date + Duration badge */}
                  <div className="flex items-center gap-2 mb-2">
                    <div className="flex items-center gap-1.5 text-caption text-qm-text-tertiary">
                      <Calendar size={12} />
                      {formatDate(session.startTime)}
                    </div>
                    {duration && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-qm-accent/20 text-qm-accent">
                        {duration}
                      </span>
                    )}
                  </div>

                  {/* Transcript preview */}
                  {session.transcript && (
                    <p className="text-body-sm text-qm-text-secondary line-clamp-2">
                      {truncate(session.transcript, 150)}
                    </p>
                  )}
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* Right panel - Session detail or empty state */}
      <div className="flex-1 flex flex-col">
        {selectedSession ? (
          <SessionDetail
            sessionId={selectedSession.id}
            onBack={() => setSelectedSessionId(null)}
          />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
            <div className="w-16 h-16 rounded-qm-xl bg-qm-surface-light flex items-center justify-center mb-4">
              <FileText size={32} className="text-qm-accent" />
            </div>
            <h3 className="text-title-sm font-semibold text-qm-text-primary mb-2">
              No Session Selected
            </h3>
            <p className="text-body-sm text-qm-text-tertiary">
              Select a session to view its details
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
