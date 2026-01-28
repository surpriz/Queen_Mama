import { ArrowLeft, Download, Copy, Check } from 'lucide-react'
import { useState } from 'react'
import { useSessionStore } from '@/stores/sessionStore'
import { exportSession } from '@/services/session/sessionExport'
import { formatDate, formatDuration } from '@/lib/utils'

interface SessionDetailProps {
  sessionId: string
  onBack: () => void
}

export function SessionDetail({ sessionId, onBack }: SessionDetailProps) {
  const session = useSessionStore((s) => s.sessions.find((se) => se.id === sessionId))
  const [copied, setCopied] = useState(false)

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

  const handleCopy = () => {
    navigator.clipboard.writeText(exportSession(session, 'plaintext'))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleExport = (format: 'markdown' | 'plaintext' | 'json') => {
    const content = exportSession(session, format)
    const ext = format === 'markdown' ? 'md' : format === 'json' ? 'json' : 'txt'
    const blob = new Blob([content], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${session.title}.${ext}`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="flex flex-col h-full p-6 overflow-y-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={onBack}
          className="p-2 rounded-qm-md hover:bg-qm-surface-hover text-qm-text-secondary hover:text-qm-text-primary transition-colors"
        >
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1">
          <h2 className="text-title-sm font-semibold text-qm-text-primary">{session.title}</h2>
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
          <button
            onClick={() => handleExport('markdown')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-qm-md bg-qm-surface-medium hover:bg-qm-surface-hover text-body-sm text-qm-text-secondary transition-colors"
          >
            <Download size={14} /> Export
          </button>
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
