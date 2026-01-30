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
