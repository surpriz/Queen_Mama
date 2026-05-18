import { useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
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
import { formatDate, formatRelativeTime, truncate, cn } from '@/lib/utils'

/** Hash a string into a stable accent palette index (0-4) */
function paletteIndex(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return h % 5
}
const AVATAR_GRADIENTS = [
  'from-violet-500 to-fuchsia-500',
  'from-blue-500 to-cyan-400',
  'from-emerald-500 to-teal-400',
  'from-orange-500 to-amber-400',
  'from-pink-500 to-rose-400',
]

/** Color-grade duration pill: short=neutral, medium=accent, long=cyan/warm */
function durationTone(durationStr: string): { bg: string; text: string } {
  // duration is "M:SS" or "H:MM:SS"
  const parts = durationStr.split(':').map(Number)
  const totalMinutes = parts.length === 3 ? parts[0] * 60 + parts[1] : parts[0] || 0
  if (totalMinutes < 5) return { bg: 'bg-qm-surface-medium', text: 'text-qm-text-tertiary' }
  if (totalMinutes < 30) return { bg: 'bg-qm-accent/15', text: 'text-qm-accent-light' }
  return { bg: 'bg-qm-cyan-soft', text: 'text-qm-cyan' }
}
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
  const { t } = useTranslation('dashboard')
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
              placeholder={t('sessions.searchPlaceholder')}
              className="w-full pl-10 pr-4 py-2.5 rounded-qm-md bg-qm-surface-light border border-qm-border-subtle text-body-sm text-qm-text-primary placeholder:text-qm-text-disabled focus:border-qm-accent focus:outline-none"
            />
          </div>

          {/* Toolbar */}
          {isSelectMode ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-caption text-qm-text-tertiary">
                  {t('sessions.selected', { count: selectedIds.size })}
                </span>
                <button
                  onClick={handleSelectAll}
                  className="text-caption text-qm-accent hover:text-qm-accent/80 transition-colors"
                >
                  {selectedIds.size === deletableSessions.length ? t('sessions.deselectAll') : t('sessions.selectAll')}
                </button>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setBulkModal('bulk')}
                  disabled={selectedIds.size === 0}
                  className="px-2 py-1 rounded-qm-sm text-[10px] font-semibold bg-qm-error/15 text-qm-error hover:bg-qm-error/25 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  title={t('sessions.deleteSessionTitle', { count: selectedIds.size })}
                >
                  {t('sessions.deleteCount', { count: selectedIds.size })}
                </button>
                <button
                  onClick={() => setBulkModal('all')}
                  disabled={deletableSessions.length === 0}
                  className="px-2 py-1 rounded-qm-sm text-[10px] font-semibold bg-qm-error/10 text-qm-error hover:bg-qm-error/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  title={t('sessions.deleteAll')}
                >
                  {t('sessions.deleteAll')}
                </button>
                <button
                  onClick={handleToggleSelectMode}
                  className="p-1.5 rounded-qm-sm text-qm-text-tertiary hover:text-qm-text-secondary hover:bg-qm-surface-hover transition-colors"
                  title={t('sessions.cancelSelection')}
                >
                  <X size={14} />
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <span className="text-caption text-qm-text-tertiary">
                {t('sessions.sessionCount', { count: filteredSessions.length })}
                {pendingCount > 0 && (
                  <span className="ml-1 text-yellow-400">{t('status.nPending', { ns: 'common', count: pendingCount })}</span>
                )}
              </span>
              <div className="flex items-center gap-1">
                {/* Select mode */}
                {deletableSessions.length > 0 && (
                  <button
                    onClick={handleToggleSelectMode}
                    className="p-1.5 rounded-qm-sm text-qm-text-tertiary hover:text-qm-accent hover:bg-qm-surface-hover transition-colors"
                    title={t('sessions.selectSessions')}
                  >
                    <CheckSquare size={14} />
                  </button>
                )}
                {/* Pull remote */}
                <button
                  onClick={handlePullRemote}
                  disabled={isPulling}
                  className="p-1.5 rounded-qm-sm text-qm-text-tertiary hover:text-qm-accent hover:bg-qm-surface-hover transition-colors disabled:opacity-50"
                  title={t('sessions.pullSessions')}
                >
                  {isPulling ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                </button>
                {/* Sync all */}
                <button
                  onClick={handleSyncAll}
                  disabled={isSyncing}
                  className="p-1.5 rounded-qm-sm text-qm-text-tertiary hover:text-qm-accent hover:bg-qm-surface-hover transition-colors disabled:opacity-50"
                  title={t('sessions.uploadSessions')}
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
              {searchQuery ? t('sessions.noSessionsFound') : t('sessions.noSessionsYet')}
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
                    'qm-card-hover p-4 rounded-qm-lg transition-all group relative',
                    isSelectMode && isActive ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
                    isSelectMode && isChecked
                      ? 'bg-qm-accent-soft shadow-qm-glow'
                      : isSelected && !isSelectMode
                        ? 'bg-qm-bg-elevated shadow-qm-elev-2'
                        : 'bg-qm-bg-tertiary/60 shadow-qm-elev-1',
                  )}
                >
                  {/* Title + Actions */}
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2.5 min-w-0">
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
                      {/* Avatar — deterministic gradient from title */}
                      <div
                        className={cn(
                          'flex items-center justify-center w-7 h-7 rounded-full bg-gradient-to-br shrink-0 text-white text-caption font-semibold shadow-qm-elev-1',
                          AVATAR_GRADIENTS[paletteIndex(session.title || session.id)],
                        )}
                      >
                        {(session.title || '?').trim().charAt(0).toUpperCase()}
                      </div>
                      <h3 className="text-body-md font-medium text-qm-text-primary line-clamp-1 min-w-0 tracking-tight">
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
                              {t('actions.delete', { ns: 'common' })}
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                setDeleteConfirmId(null)
                              }}
                              className="px-2 py-0.5 rounded-qm-sm bg-qm-surface-medium text-qm-text-tertiary text-[10px] font-semibold hover:bg-qm-surface-hover transition-colors"
                            >
                              {t('actions.cancel', { ns: 'common' })}
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
                    <div
                      className="flex items-center gap-1.5 text-caption text-qm-text-tertiary"
                      title={formatDate(session.startTime)}
                    >
                      <Calendar size={12} />
                      {formatRelativeTime(session.startTime)}
                    </div>
                    {duration && (() => {
                      const tone = durationTone(duration)
                      return (
                        <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-semibold tabular-nums', tone.bg, tone.text)}>
                          {duration}
                        </span>
                      )
                    })()}
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
                            ? t('sessions.syncedToCloud')
                            : session.syncStatus === 'failed'
                              ? t('sessions.syncFailedRetry')
                              : t('sessions.clickToSync')
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
          (() => {
            const total = filteredSessions.length
            const totalSeconds = filteredSessions.reduce((acc, s) => {
              if (!s.endTime) return acc
              return acc + (new Date(s.endTime).getTime() - new Date(s.startTime).getTime()) / 1000
            }, 0)
            const totalMinutes = Math.round(totalSeconds / 60)
            const avgMinutes = total > 0 ? Math.round(totalMinutes / total) : 0
            const syncedCount = filteredSessions.filter((s) => s.syncStatus === 'synced').length

            return (
              <div className="flex-1 flex flex-col items-center justify-center p-10 overflow-hidden">
                {/* Hero illustration: layered gradient orb with floating glyph */}
                <div className="relative w-32 h-32 mb-8 flex items-center justify-center">
                  <div className="absolute inset-0 rounded-full bg-gradient-to-br from-qm-gradient-start to-qm-gradient-end opacity-25 blur-2xl animate-qm-pulse" />
                  <div className="absolute inset-3 rounded-full bg-gradient-to-br from-qm-gradient-start to-qm-gradient-end opacity-40 blur-lg" />
                  <div className="relative w-20 h-20 rounded-full bg-gradient-to-br from-qm-gradient-start to-qm-gradient-end shadow-qm-glow-strong flex items-center justify-center">
                    <FileText size={32} className="text-white" strokeWidth={1.5} />
                  </div>
                </div>

                <h3 className="font-display text-[22px] font-semibold text-qm-text-primary mb-2 tracking-tight">
                  {t('sessions.noSessionSelected')}
                </h3>
                <p className="text-body-sm text-qm-text-tertiary mb-10 max-w-sm text-center leading-relaxed">
                  {t('sessions.selectSessionToView')}
                </p>

                {/* Stat cards */}
                <div className="grid grid-cols-3 gap-3 w-full max-w-md">
                  <div className="qm-card p-4 flex flex-col items-start gap-1">
                    <span className="text-caption-sm text-qm-text-tertiary uppercase tracking-wider">
                      Total
                    </span>
                    <span className="font-display text-[24px] font-bold text-qm-text-primary tabular-nums tracking-tight">
                      {total}
                    </span>
                    <span className="text-caption-sm text-qm-text-tertiary">sessions</span>
                  </div>
                  <div className="qm-card p-4 flex flex-col items-start gap-1">
                    <span className="text-caption-sm text-qm-text-tertiary uppercase tracking-wider">
                      Time
                    </span>
                    <span className="font-display text-[24px] font-bold text-qm-text-primary tabular-nums tracking-tight">
                      {totalMinutes}
                      <span className="text-body-sm font-medium text-qm-text-tertiary ml-1">min</span>
                    </span>
                    <span className="text-caption-sm text-qm-text-tertiary">
                      avg {avgMinutes}m
                    </span>
                  </div>
                  <div className="qm-card p-4 flex flex-col items-start gap-1">
                    <span className="text-caption-sm text-qm-text-tertiary uppercase tracking-wider">
                      Synced
                    </span>
                    <span className="font-display text-[24px] font-bold text-qm-text-primary tabular-nums tracking-tight">
                      {syncedCount}
                      <span className="text-body-sm font-medium text-qm-text-tertiary ml-1">/{total}</span>
                    </span>
                    <span className="text-caption-sm text-emerald-400 flex items-center gap-1">
                      <Cloud size={10} /> cloud
                    </span>
                  </div>
                </div>
              </div>
            )
          })()
        )}
      </div>

      {/* Bulk delete confirmation modal */}
      <Modal
        isOpen={bulkModal === 'bulk'}
        onClose={isDeleting ? () => {} : () => setBulkModal(null)}
        title={t('sessions.deleteSessionTitle', { count: selectedIds.size })}
        subtitle={t('sessions.deleteSessionSubtitle')}
        size="sm"
      >
        <div className="flex justify-end gap-2 pt-2">
          <button
            onClick={() => setBulkModal(null)}
            disabled={isDeleting}
            className="px-4 py-2 rounded-qm-md bg-qm-surface-light text-qm-text-secondary text-body-sm hover:bg-qm-surface-medium transition-colors disabled:opacity-50"
          >
            {t('actions.cancel', { ns: 'common' })}
          </button>
          <button
            onClick={handleBulkDelete}
            disabled={isDeleting}
            className="px-4 py-2 rounded-qm-md bg-qm-error text-white text-body-sm font-semibold hover:bg-qm-error/90 transition-colors disabled:opacity-50 flex items-center gap-1.5"
          >
            {isDeleting && <Loader2 size={14} className="animate-spin" />}
            {t('sessions.deleteSessionTitle', { count: selectedIds.size })}
          </button>
        </div>
      </Modal>

      {/* Delete all confirmation modal */}
      <Modal
        isOpen={bulkModal === 'all'}
        onClose={isDeleting ? () => {} : () => setBulkModal(null)}
        title={t('sessions.deleteAllTitle', { count: deletableSessions.length })}
        subtitle={t('sessions.deleteAllSubtitle')}
        size="sm"
      >
        <div className="flex justify-end gap-2 pt-2">
          <button
            onClick={() => setBulkModal(null)}
            disabled={isDeleting}
            className="px-4 py-2 rounded-qm-md bg-qm-surface-light text-qm-text-secondary text-body-sm hover:bg-qm-surface-medium transition-colors disabled:opacity-50"
          >
            {t('actions.cancel', { ns: 'common' })}
          </button>
          <button
            onClick={handleDeleteAll}
            disabled={isDeleting}
            className="px-4 py-2 rounded-qm-md bg-qm-error text-white text-body-sm font-semibold hover:bg-qm-error/90 transition-colors disabled:opacity-50 flex items-center gap-1.5"
          >
            {isDeleting && <Loader2 size={14} className="animate-spin" />}
            {t('sessions.deleteAllSessions')}
          </button>
        </div>
      </Modal>
    </div>
  )
}
