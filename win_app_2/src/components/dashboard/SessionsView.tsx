import { useState, useCallback } from 'react'
import {
  Search,
  Trash2,
  Calendar,
  FileText,
  RefreshCw,
  CloudUpload,
  Cloud,
  CloudOff,
  Loader2,
  CheckCircle,
  Clock,
  AlertCircle,
} from 'lucide-react'
import { useSession } from '@/hooks/useSession'
import { formatDate, truncate, cn } from '@/lib/utils'
import { SessionDetail } from './SessionDetail'
import {
  performFullSync,
  queueSessionForSync,
  reconcileRemoteSessions,
  requeueAllLocalSessions,
  getPendingCount,
} from '@/services/sync/syncManager'

export function SessionsView() {
  const { filteredSessions, searchQuery, setSearchQuery, deleteSession } = useSession()
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null)
  const [isSyncing, setIsSyncing] = useState(false)
  const [isPulling, setIsPulling] = useState(false)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)

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

  const handleSyncAll = useCallback(async () => {
    setIsSyncing(true)
    try {
      requeueAllLocalSessions()
      await performFullSync()
    } catch {
      // errors logged internally
    } finally {
      setIsSyncing(false)
    }
  }, [])

  const handlePullRemote = useCallback(async () => {
    setIsPulling(true)
    try {
      await reconcileRemoteSessions()
    } catch {
      // errors logged internally
    } finally {
      setIsPulling(false)
    }
  }, [])

  const handleSyncSingle = useCallback((e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation()
    queueSessionForSync(sessionId)
  }, [])

  const handleDeleteConfirm = useCallback(
    (sessionId: string) => {
      deleteSession(sessionId)
      if (selectedSessionId === sessionId) setSelectedSessionId(null)
      setDeleteConfirmId(null)
    },
    [deleteSession, selectedSessionId],
  )

  const pendingCount = getPendingCount()

  const getSyncIcon = (status?: string) => {
    switch (status) {
      case 'synced':
        return <CheckCircle size={12} className="text-green-400" />
      case 'pending':
        return <Clock size={12} className="text-yellow-400" />
      case 'failed':
        return <AlertCircle size={12} className="text-red-400" />
      default:
        return <CloudOff size={12} className="text-qm-text-disabled" />
    }
  }

  return (
    <div className="flex h-full">
      {/* Left panel - Session list */}
      <div className="w-[320px] flex flex-col border-r border-qm-border-subtle">
        {/* Search + Toolbar */}
        <div className="p-4 space-y-3">
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

          {/* Toolbar: count + sync actions */}
          <div className="flex items-center justify-between">
            <span className="text-caption text-qm-text-tertiary">
              {filteredSessions.length} session{filteredSessions.length !== 1 ? 's' : ''}
              {pendingCount > 0 && (
                <span className="ml-1 text-yellow-400">({pendingCount} pending)</span>
              )}
            </span>
            <div className="flex items-center gap-1">
              {/* Pull remote */}
              <button
                onClick={handlePullRemote}
                disabled={isPulling}
                className="p-1.5 rounded-qm-sm text-qm-text-tertiary hover:text-qm-accent hover:bg-qm-surface-hover transition-colors disabled:opacity-50"
                title="Pull sessions from web dashboard"
              >
                {isPulling ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
              </button>
              {/* Sync all */}
              <button
                onClick={handleSyncAll}
                disabled={isSyncing}
                className="p-1.5 rounded-qm-sm text-qm-text-tertiary hover:text-qm-accent hover:bg-qm-surface-hover transition-colors disabled:opacity-50"
                title="Upload all sessions to web dashboard"
              >
                {isSyncing ? <Loader2 size={14} className="animate-spin" /> : <CloudUpload size={14} />}
              </button>
            </div>
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
              const isConfirmingDelete = deleteConfirmId === session.id

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
                  {/* Title + Actions */}
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h3 className="text-body-md font-medium text-qm-text-primary line-clamp-1 min-w-0">
                      {session.title}
                    </h3>
                    <div className="flex items-center gap-1 shrink-0">
                      {/* Delete button / confirm */}
                      {isConfirmingDelete ? (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDeleteConfirm(session.id)
                            }}
                            className="px-2 py-0.5 rounded-qm-sm bg-qm-error/15 text-qm-error text-[10px] font-semibold hover:bg-qm-error/25 transition-colors"
                          >
                            Delete
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              setDeleteConfirmId(null)
                            }}
                            className="px-2 py-0.5 rounded-qm-sm bg-qm-surface-medium text-qm-text-tertiary text-[10px] font-semibold hover:bg-qm-surface-hover transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setDeleteConfirmId(session.id)
                          }}
                          className="opacity-0 group-hover:opacity-100 p-1.5 rounded-qm-sm hover:bg-qm-error/15 text-qm-text-tertiary hover:text-qm-error transition-all"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Date + Duration + Sync badge */}
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
                    {/* Sync status badge - clickable for unsynced/failed */}
                    {session.endTime && (
                      <button
                        onClick={(e) => {
                          if (session.syncStatus !== 'synced') {
                            handleSyncSingle(e, session.id)
                          } else {
                            e.stopPropagation()
                          }
                        }}
                        className={cn(
                          'ml-auto flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] transition-colors',
                          session.syncStatus === 'synced'
                            ? 'bg-green-500/10 text-green-400 cursor-default'
                            : session.syncStatus === 'failed'
                              ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20 cursor-pointer'
                              : 'bg-qm-surface-medium text-qm-text-disabled hover:bg-qm-surface-hover hover:text-qm-text-tertiary cursor-pointer',
                        )}
                        title={
                          session.syncStatus === 'synced'
                            ? 'Synced to cloud'
                            : session.syncStatus === 'failed'
                              ? 'Sync failed - click to retry'
                              : 'Click to sync'
                        }
                      >
                        {getSyncIcon(session.syncStatus)}
                        <Cloud size={10} />
                      </button>
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
