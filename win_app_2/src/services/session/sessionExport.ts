import type { Session } from '@/types/models'
import { formatDuration, formatDate } from '@/lib/utils'

export type ExportFormat = 'markdown' | 'plaintext' | 'json'

export function exportSession(session: Session, format: ExportFormat): string {
  switch (format) {
    case 'markdown':
      return exportMarkdown(session)
    case 'plaintext':
      return exportPlainText(session)
    case 'json':
      return exportJSON(session)
  }
}

function exportMarkdown(session: Session): string {
  const duration = session.endTime
    ? formatDuration(
        (new Date(session.endTime).getTime() - new Date(session.startTime).getTime()) / 1000,
      )
    : 'In progress'

  let md = `# ${session.title}\n\n`
  md += `**Date:** ${formatDate(session.startTime)}\n`
  md += `**Duration:** ${duration}\n\n`

  if (session.summary) {
    md += `## Summary\n\n${session.summary}\n\n`
  }

  if (session.actionItems.length > 0) {
    md += `## Action Items\n\n`
    session.actionItems.forEach((item) => {
      md += `- [ ] ${item}\n`
    })
    md += '\n'
  }

  if (session.transcript.trim()) {
    md += `## Transcript\n\n${session.transcript}\n`
  }

  return md
}

function exportPlainText(session: Session): string {
  const duration = session.endTime
    ? formatDuration(
        (new Date(session.endTime).getTime() - new Date(session.startTime).getTime()) / 1000,
      )
    : 'In progress'

  let text = `${session.title}\n`
  text += `Date: ${formatDate(session.startTime)}\n`
  text += `Duration: ${duration}\n\n`

  if (session.summary) {
    text += `Summary:\n${session.summary}\n\n`
  }

  if (session.actionItems.length > 0) {
    text += `Action Items:\n`
    session.actionItems.forEach((item, i) => {
      text += `${i + 1}. ${item}\n`
    })
    text += '\n'
  }

  if (session.transcript.trim()) {
    text += `Transcript:\n${session.transcript}\n`
  }

  return text
}

function exportJSON(session: Session): string {
  return JSON.stringify(session, null, 2)
}

/**
 * Export session to clipboard
 * Returns true if successful
 */
export async function exportToClipboard(session: Session, format: ExportFormat = 'markdown'): Promise<boolean> {
  try {
    const content = exportSession(session, format)
    await navigator.clipboard.writeText(content)
    return true
  } catch (error) {
    console.error('[SessionExport] Failed to copy to clipboard:', error)
    return false
  }
}

/**
 * Download session as file
 */
export function downloadSession(session: Session, format: ExportFormat): void {
  const content = exportSession(session, format)
  const mimeTypes: Record<ExportFormat, string> = {
    markdown: 'text/markdown',
    plaintext: 'text/plain',
    json: 'application/json',
  }
  const extensions: Record<ExportFormat, string> = {
    markdown: 'md',
    plaintext: 'txt',
    json: 'json',
  }

  const blob = new Blob([content], { type: mimeTypes[format] })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${session.title.replace(/[^a-z0-9]/gi, '_')}.${extensions[format]}`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
