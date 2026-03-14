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
  CheckSquare,
  Square,
  X,
} from 'lucide-react'
import { useSession } from '@/hooks/useSession'
import { formatDate, truncate, cn } from '@/lib/utils'
import { SessionDetail } from './SessionDetail'
import { Modal } from '@/components/common/Modal'
import {
  performFullSync,
  queueSessionForSync,
  reconcileRemoteSessions,
  requeueAllLocalSessions,
  getPendingCount,
} from '@/services/sync/syncManager'

export function SessionsView() {
  const { filteredSessions, currentSession, searchQuery, setSearchQuery, deleteSession, deleteSessions } = useSession()
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null)
  const [isSyncing, setIsSyncing] = useState(false)
  const [isPulling, setIsPulling] = useState(false)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)

  // Bulk selection state
  const [isSelectMode, setIsSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkModal, setBulkModal] = useState<'bulk' | 'all' | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const selectedSession = selectedSessionId
    ? filteredSessions.find((s) => s.id === selectedSessionId)
    : null

  // Sessions eligible for bulk selection/deletion (exclude active session)
  const deletableSessions = filteredSessions.filter((s) => s.id !== currentSession?.id)

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

  // ── Bulk selection handlers ──────────────────────────────────────────

  const handleToggleSelectMode = useCallback(() => {
    setIsSelectMode((prev) => {
      if (prev) {
        setSelectedIds(new Set())
        setBulkModal(null)
      }
      setDeleteConfirmId(null)
      return !prev
    })
  }, [])

  const handleToggleCard = useCallback((e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    setSelectedIds((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }, [])

  const handleSelectAll = useCallback(() => {
    setSelectedIds((prev) => {
      if (prev.size === deletableSessions.length) return new Set()
      return new Set(deletableSessions.map((s) => s.id))
    })
  }, [deletableSessions])

  const handleBulkDelete = useCallback(async () => {
    setIsDeleting(true)
    try {
      const ids = [...selectedIds]
      if (selectedSessionId && selectedIds.has(selectedSessionId)) {
        setSelectedSessionId(null)
      }
      await deleteSessions(ids)
      setSelectedIds(new Set())
      setBulkModal(null)
      setIsSelectMode(false)
    } finally {
      setIsDeleting(false)
    }
  }, [selectedIds, deleteSessions, selectedSessionId])

  const handleDeleteAll = useCallback(async () => {
    setIsDeleting(true)
    try {
      const ids = deletableSessions.map((s) => s.id)
      setSelectedSessionId(null)
      await deleteSessions(ids)
      setSelectedIds(new Set())
      setBulkModal(null)
      setIsSelectMode(false)
    } finally {
      setIsDeleting(false)
    }
  }, [deletableSessions, deleteSessions])

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

          {/* Toolbar */}
          {isSelectMode ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-caption text-qm-text-tertiary">
                  {selectedIds.size} selected
                </span>
                <button
                  onClick={handleSelectAll}
                  className="text-caption text-qm-accent hover:text-qm-accent/80 transition-colors"
                >
                  {selectedIds.size === deletableSessions.length ? 'Deselect all' : 'Select all'}
                </button>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setBulkModal('bulk')}
                  disabled={selectedIds.size === 0}
                  className="px-2 py-1 rounded-qm-sm text-[10px] font-semibold bg-qm-error/15 text-qm-error hover:bg-qm-error/25 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  title={`Delete ${selectedIds.size} selected session(s)`}
                >
                  Delete ({selectedIds.size})
                </button>
                <button
                  onClick={() => setBulkModal('all')}
                  disabled={deletableSessions.length === 0}
                  className="px-2 py-1 rounded-qm-sm text-[10px] font-semibold bg-qm-error/10 text-qm-error hover:bg-qm-error/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Delete all sessions"
                >
                  Delete all
                </button>
                <button
                  onClick={handleToggleSelectMode}
                  className="p-1.5 rounded-qm-sm text-qm-text-tertiary hover:text-qm-text-secondary hover:bg-qm-surface-hover transition-colors"
                  title="Cancel selection"
                >
                  <X size={14} />
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <span className="text-caption text-qm-text-tertiary">
                {filteredSessions.length} session{filteredSessions.length !== 1 ? 's' : ''}
                {pendingCount > 0 && (
                  <span className="ml-1 text-yellow-400">({pendingCount} pending)</span>
                )}
              </span>
              <div className="flex items-center gap-1">
                {/* Select mode */}
                {deletableSessions.length > 0 && (
                  <button
                    onClick={handleToggleSelectMode}
                    className="p-1.5 rounded-qm-sm text-qm-text-tertiary hover:text-qm-accent hover:bg-qm-surface-hover transition-colors"
                    title="Select sessions"
                  >
                    <CheckSquare size={14} />
                  </button>
                )}
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
          )}
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
              const isActive = session.id === currentSession?.id
              const isChecked = selectedIds.has(session.id)

              return (
                <div
                  key={session.id}
                  onClick={
                    isSelectMode
                      ? isActive
                        ? undefined
                        : (e) => handleToggleCard(e, session.id)
                      : () => setSelectedSessionId(session.id)
                  }
                  className={cn(
                    'p-4 rounded-qm-lg transition-colors group',
                    isSelectMode && isActive ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
                    isSelectMode && isChecked
                      ? 'bg-qm-accent/5 border border-qm-accent/40'
                      : isSelected && !isSelectMode
                        ? 'bg-qm-surface-hover border border-qm-border-medium'
                        : 'bg-qm-surface-light hover:bg-qm-surface-medium border border-transparent',
                  )}
                >
                  {/* Title + Actions */}
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2 min-w-0">
                      {isSelectMode && !isActive && (
                        <button
                          onClick={(e) => handleToggleCard(e, session.id)}
                          className="shrink-0 text-qm-text-tertiary hover:text-qm-accent transition-colors"
                        >
                          {isChecked ? (
                            <CheckSquare size={16} className="text-qm-accent" />
                          ) : (
                            <Square size={16} />
                          )}
                        </button>
                      )}
                      <h3 className="text-body-md font-medium text-qm-text-primary line-clamp-1 min-w-0">
                        {session.title}
                      </h3>
                    </div>
                    {!isSelectMode && (
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
                    )}
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

      {/* Bulk delete confirmation modal */}
      <Modal
        isOpen={bulkModal === 'bulk'}
        onClose={isDeleting ? () => {} : () => setBulkModal(null)}
        title={`Delete ${selectedIds.size} session${selectedIds.size !== 1 ? 's' : ''}?`}
        subtitle="This action cannot be undone. Selected sessions and their transcripts will be permanently removed."
        size="sm"
      >
        <div className="flex justify-end gap-2 pt-2">
          <button
            onClick={() => setBulkModal(null)}
            disabled={isDeleting}
            className="px-4 py-2 rounded-qm-md bg-qm-surface-light text-qm-text-secondary text-body-sm hover:bg-qm-surface-medium transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleBulkDelete}
            disabled={isDeleting}
            className="px-4 py-2 rounded-qm-md bg-qm-error text-white text-body-sm font-semibold hover:bg-qm-error/90 transition-colors disabled:opacity-50 flex items-center gap-1.5"
          >
            {isDeleting && <Loader2 size={14} className="animate-spin" />}
            Delete {selectedIds.size} session{selectedIds.size !== 1 ? 's' : ''}
          </button>
        </div>
      </Modal>

      {/* Delete all confirmation modal */}
      <Modal
        isOpen={bulkModal === 'all'}
        onClose={isDeleting ? () => {} : () => setBulkModal(null)}
        title={`Delete all ${deletableSessions.length} sessions?`}
        subtitle="This action cannot be undone. All sessions in the current view and their transcripts will be permanently removed."
        size="sm"
      >
        <div className="flex justify-end gap-2 pt-2">
          <button
            onClick={() => setBulkModal(null)}
            disabled={isDeleting}
            className="px-4 py-2 rounded-qm-md bg-qm-surface-light text-qm-text-secondary text-body-sm hover:bg-qm-surface-medium transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleDeleteAll}
            disabled={isDeleting}
            className="px-4 py-2 rounded-qm-md bg-qm-error text-white text-body-sm font-semibold hover:bg-qm-error/90 transition-colors disabled:opacity-50 flex items-center gap-1.5"
          >
            {isDeleting && <Loader2 size={14} className="animate-spin" />}
            Delete all sessions
          </button>
        </div>
      </Modal>
    </div>
  )
}
