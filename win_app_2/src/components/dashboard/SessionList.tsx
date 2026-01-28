import { Search, Trash2, Download, Cloud, HardDrive } from 'lucide-react'
import { useSession } from '@/hooks/useSession'
import { formatDate, formatDuration, truncate } from '@/lib/utils'
import { cn } from '@/lib/utils'

interface SessionListProps {
  onSelectSession: (id: string) => void
}

export function SessionList({ onSelectSession }: SessionListProps) {
  const { filteredSessions, searchQuery, setSearchQuery, deleteSession } = useSession()

  return (
    <div className="flex flex-col h-full p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-title-sm font-semibold text-qm-text-primary">Sessions</h2>
        <span className="text-caption text-qm-text-tertiary">
          {filteredSessions.length} sessions
        </span>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-qm-text-tertiary" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search sessions..."
          className="w-full pl-10 pr-4 py-2.5 rounded-qm-md bg-qm-surface-light border border-qm-border-subtle text-body-sm text-qm-text-primary placeholder:text-qm-text-disabled focus:border-qm-accent focus:outline-none"
        />
      </div>

      {/* Session cards */}
      <div className="flex-1 overflow-y-auto space-y-2">
        {filteredSessions.length === 0 ? (
          <div className="text-center py-12 text-qm-text-tertiary text-body-sm">
            {searchQuery ? 'No sessions found' : 'No sessions yet'}
          </div>
        ) : (
          filteredSessions.map((session) => {
            const duration = session.endTime
              ? (new Date(session.endTime).getTime() - new Date(session.startTime).getTime()) / 1000
              : null

            return (
              <div
                key={session.id}
                onClick={() => onSelectSession(session.id)}
                className="flex items-center gap-4 p-4 rounded-qm-lg bg-qm-surface-medium hover:bg-qm-surface-hover cursor-pointer transition-colors group"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-body-md font-medium text-qm-text-primary truncate">
                      {session.title}
                    </h3>
                    {session.syncStatus === 'synced' ? (
                      <Cloud size={12} className="text-qm-success flex-shrink-0" />
                    ) : (
                      <HardDrive size={12} className="text-qm-text-tertiary flex-shrink-0" />
                    )}
                  </div>
                  <p className="text-caption text-qm-text-tertiary mt-1">
                    {formatDate(session.startTime)}
                    {duration && ` · ${formatDuration(duration)}`}
                  </p>
                  {session.summary && (
                    <p className="text-body-sm text-qm-text-secondary mt-1">
                      {truncate(session.summary, 120)}
                    </p>
                  )}
                </div>

                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    deleteSession(session.id)
                  }}
                  className="opacity-0 group-hover:opacity-100 p-2 rounded-qm-md hover:bg-qm-error-light text-qm-text-tertiary hover:text-qm-error transition-all"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
