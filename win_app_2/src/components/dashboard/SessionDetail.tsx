import { Download, Copy, Check, Globe, ChevronLeft, FileText, FileJson } from 'lucide-react'
import { useState, useEffect, useRef } from 'react'
import { useSessionStore } from '@/stores/sessionStore'
import { exportToClipboard, downloadSession, type ExportFormat } from '@/services/session/sessionExport'
import { openSessionOnWeb } from '@/services/auth/magicLinkService'
import { formatDate, formatDuration } from '@/lib/utils'

interface SessionDetailProps {
  sessionId: string
  onBack: () => void
}

export function SessionDetail({ sessionId, onBack }: SessionDetailProps) {
  const session = useSessionStore((s) => s.sessions.find((se) => se.id === sessionId))
  const [copied, setCopied] = useState(false)
  const [showExportMenu, setShowExportMenu] = useState(false)
  const exportMenuRef = useRef<HTMLDivElement>(null)

  // Close export menu on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
        setShowExportMenu(false)
      }
    }

    if (showExportMenu) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showExportMenu])

  if (!session) {
    return (
      <div className="p-6">
        <button onClick={onBack} className="text-body-sm text-qm-text-secondary hover:text-qm-text-primary">
          &larr; Back
        </button>
        <p className="mt-4 text-qm-text-tertiary">Session not found</p>
      </div>
    )
  }

  const duration = session.endTime
    ? (new Date(session.endTime).getTime() - new Date(session.startTime).getTime()) / 1000
    : null

  const handleCopy = async () => {
    const success = await exportToClipboard(session, 'markdown')
    if (success) {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleExport = (format: ExportFormat) => {
    downloadSession(session, format)
    setShowExportMenu(false)
  }

  const handleViewOnWeb = () => {
    openSessionOnWeb(session.id)
  }

  return (
    <div className="flex flex-col h-full p-6 overflow-y-auto">
      {/* Back button */}
      <button
        onClick={onBack}
        className="flex items-center gap-1 text-body-sm text-qm-text-secondary hover:text-qm-text-primary transition-colors mb-4 w-fit"
      >
        <ChevronLeft size={16} />
        Back to Sessions
      </button>

      {/* Header */}
      <div className="flex items-center justify-between gap-3 mb-6">
        <div>
          <h2 className="text-title-sm font-semibold text-qm-text-primary">{session.title}</h2>
          <p className="text-caption text-qm-text-tertiary">
            {formatDate(session.startTime)}
            {duration && ` · ${formatDuration(duration)}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* View on Web */}
          <button
            onClick={handleViewOnWeb}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-qm-md bg-qm-accent/10 hover:bg-qm-accent/20 text-body-sm text-qm-accent transition-colors"
            title="View on Web Dashboard"
          >
            <Globe size={14} />
            View on Web
          </button>

          {/* Copy to clipboard */}
          <button
            onClick={handleCopy}
            className="p-2 rounded-qm-md hover:bg-qm-surface-hover text-qm-text-secondary transition-colors"
            title="Copy to clipboard (Markdown)"
          >
            {copied ? <Check size={16} className="text-qm-success" /> : <Copy size={16} />}
          </button>

          {/* Export dropdown */}
          <div className="relative" ref={exportMenuRef}>
            <button
              onClick={() => setShowExportMenu(!showExportMenu)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-qm-md bg-qm-surface-medium hover:bg-qm-surface-hover text-body-sm text-qm-text-secondary transition-colors"
            >
              <Download size={14} /> Export
            </button>
            {showExportMenu && (
              <div className="absolute right-0 mt-1 w-40 py-1 rounded-qm-md bg-qm-surface-medium border border-qm-border-subtle shadow-lg z-10">
                <button
                  onClick={() => handleExport('markdown')}
                  className="flex items-center gap-2 w-full px-3 py-2 text-body-sm text-qm-text-primary hover:bg-qm-surface-hover transition-colors"
                >
                  <FileText size={14} />
                  Markdown (.md)
                </button>
                <button
                  onClick={() => handleExport('plaintext')}
                  className="flex items-center gap-2 w-full px-3 py-2 text-body-sm text-qm-text-primary hover:bg-qm-surface-hover transition-colors"
                >
                  <FileText size={14} />
                  Text (.txt)
                </button>
                <button
                  onClick={() => handleExport('json')}
                  className="flex items-center gap-2 w-full px-3 py-2 text-body-sm text-qm-text-primary hover:bg-qm-surface-hover transition-colors"
                >
                  <FileJson size={14} />
                  JSON (.json)
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Summary */}
      {session.summary && (
        <div className="mb-6 p-4 rounded-qm-lg bg-qm-surface-light border border-qm-border-subtle">
          <h3 className="text-label-md text-qm-text-secondary mb-2">Summary</h3>
          <p className="text-body-md text-qm-text-primary leading-relaxed">{session.summary}</p>
        </div>
      )}

      {/* Action Items */}
      {session.actionItems.length > 0 && (
        <div className="mb-6 p-4 rounded-qm-lg bg-qm-surface-light border border-qm-border-subtle">
          <h3 className="text-label-md text-qm-text-secondary mb-2">Action Items</h3>
          <ul className="space-y-1.5">
            {session.actionItems.map((item, i) => (
              <li key={i} className="flex items-start gap-2 text-body-sm text-qm-text-primary">
                <span className="text-qm-accent mt-0.5">•</span>
                {item}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Transcript */}
      <div className="p-4 rounded-qm-lg bg-qm-surface-light border border-qm-border-subtle">
        <h3 className="text-label-md text-qm-text-secondary mb-2">Transcript</h3>
        <p className="text-body-md text-qm-text-primary leading-relaxed whitespace-pre-wrap">
          {session.transcript || 'No transcript available'}
        </p>
      </div>
    </div>
  )
}
