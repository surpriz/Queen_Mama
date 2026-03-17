import { ArrowLeft, Download, Copy, Check, ChevronDown, CheckCircle, Clock, Circle } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useSessionStore } from '@/stores/sessionStore'
import { exportSession, type ExportFormat } from '@/services/session/sessionExport'
import { formatDate, formatDuration } from '@/lib/utils'

interface SessionDetailProps {
  sessionId: string
  onBack: () => void
}

export function SessionDetail({ sessionId, onBack }: SessionDetailProps) {
  const { t } = useTranslation('dashboard')
  const session = useSessionStore((s) => s.sessions.find((se) => se.id === sessionId))
  const [copied, setCopied] = useState(false)
  const [copiedSummary, setCopiedSummary] = useState(false)
  const [showExportMenu, setShowExportMenu] = useState(false)
  const exportMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
        setShowExportMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  if (!session) {
    return (
      <div className="p-6">
        <button onClick={onBack} className="text-body-sm text-qm-text-secondary hover:text-qm-text-primary">
          &larr; {t('sessionDetail.back')}
        </button>
        <p className="mt-4 text-qm-text-tertiary">{t('sessionDetail.sessionNotFound')}</p>
      </div>
    )
  }

  const duration = session.endTime
    ? (new Date(session.endTime).getTime() - new Date(session.startTime).getTime()) / 1000
    : null

  const handleCopy = () => {
    navigator.clipboard.writeText(exportSession(session, 'plaintext'))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleExport = (format: ExportFormat) => {
    const content = exportSession(session, format)
    const extMap: Record<ExportFormat, string> = {
      markdown: 'md',
      plaintext: 'txt',
      json: 'json',
      csv: 'csv',
    }
    const mimeMap: Record<ExportFormat, string> = {
      markdown: 'text/markdown',
      plaintext: 'text/plain',
      json: 'application/json',
      csv: 'text/csv',
    }
    const blob = new Blob([content], { type: mimeMap[format] })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${session.title}.${extMap[format]}`
    a.click()
    URL.revokeObjectURL(url)
    setShowExportMenu(false)
  }

  const syncBadge = () => {
    const status = session.syncStatus || 'local'
    switch (status) {
      case 'synced':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-green-500/15 text-green-400">
            <CheckCircle size={12} /> {t('status.synced', { ns: 'common' })}
          </span>
        )
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-yellow-500/15 text-yellow-400">
            <Clock size={12} /> {t('status.pending', { ns: 'common' })}
          </span>
        )
      case 'local':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-gray-500/15 text-gray-400">
            <Circle size={10} /> {t('status.local', { ns: 'common' })}
          </span>
        )
      default:
        return null
    }
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Gradient hero header */}
      <div className="p-6 bg-gradient-to-r from-qm-gradient-start/10 to-qm-gradient-end/10 border-b border-qm-border-subtle">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 rounded-qm-md hover:bg-qm-surface-hover text-qm-text-secondary hover:text-qm-text-primary transition-colors"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h2 className="text-title-sm font-semibold text-qm-text-primary">{session.title}</h2>
              {syncBadge()}
            </div>
            <p className="text-caption text-qm-text-tertiary">
              {formatDate(session.startTime)}
              {duration && ` · ${formatDuration(duration)}`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="p-2 rounded-qm-md hover:bg-qm-surface-hover text-qm-text-secondary transition-colors"
            >
              {copied ? <Check size={16} className="text-qm-success" /> : <Copy size={16} />}
            </button>
            <div className="relative" ref={exportMenuRef}>
              <button
                onClick={() => setShowExportMenu(!showExportMenu)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-qm-md bg-qm-surface-medium hover:bg-qm-surface-hover text-body-sm text-qm-text-secondary transition-colors"
              >
                <Download size={14} /> {t('sessionDetail.export')} <ChevronDown size={12} />
              </button>
              {showExportMenu && (
                <div className="absolute right-0 top-full mt-1 w-40 rounded-qm-md bg-qm-surface-medium border border-qm-border-subtle shadow-lg z-50 py-1">
                  <button
                    onClick={() => handleExport('markdown')}
                    className="w-full text-left px-3 py-1.5 text-body-sm text-qm-text-secondary hover:bg-qm-surface-hover transition-colors"
                  >
                    {t('sessionDetail.markdown')}
                  </button>
                  <button
                    onClick={() => handleExport('plaintext')}
                    className="w-full text-left px-3 py-1.5 text-body-sm text-qm-text-secondary hover:bg-qm-surface-hover transition-colors"
                  >
                    {t('sessionDetail.plainText')}
                  </button>
                  <button
                    onClick={() => handleExport('json')}
                    className="w-full text-left px-3 py-1.5 text-body-sm text-qm-text-secondary hover:bg-qm-surface-hover transition-colors"
                  >
                    {t('sessionDetail.json')}
                  </button>
                  <button
                    onClick={() => handleExport('csv')}
                    className="w-full text-left px-3 py-1.5 text-body-sm text-qm-text-secondary hover:bg-qm-surface-hover transition-colors"
                  >
                    {t('sessionDetail.csv')}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-6 space-y-6">
        {/* Summary */}
        {session.summary && (
          <div className="p-4 rounded-qm-lg bg-qm-surface-light border border-qm-border-subtle">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-label-md text-qm-text-secondary">{t('sessionDetail.summary')}</h3>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(session.summary!)
                  setCopiedSummary(true)
                  setTimeout(() => setCopiedSummary(false), 2000)
                }}
                className="p-1.5 rounded-qm-md hover:bg-qm-surface-hover text-qm-text-tertiary hover:text-qm-text-secondary transition-colors"
                title={t('sessionDetail.copySummary')}
              >
                {copiedSummary ? <Check size={14} className="text-qm-success" /> : <Copy size={14} />}
              </button>
            </div>
            <p className="text-body-md text-qm-text-primary leading-relaxed">{session.summary}</p>
          </div>
        )}

        {/* Transcript */}
        <div className="p-4 rounded-qm-lg bg-qm-surface-light border border-qm-border-subtle">
          <h3 className="text-label-md text-qm-text-secondary mb-2">{t('sessionDetail.transcript')}</h3>
          <p className="text-body-md text-qm-text-primary leading-relaxed whitespace-pre-wrap">
            {session.transcript || t('sessionDetail.noTranscript')}
          </p>
        </div>
      </div>
    </div>
  )
}
