import type { Session } from '@/types/models'
import { formatDuration, formatDate } from '@/lib/utils'
import { useLicenseStore } from '@/stores/licenseStore'
import { Feature } from '@/types/auth'
import { createLogger } from '@/lib/logger'

const log = createLogger('SessionExport')

export type ExportFormat = 'markdown' | 'plaintext' | 'json'

export interface ExportOptions {
  includeTranscript?: boolean
  includeSummary?: boolean
  includeActionItems?: boolean
  includeMetadata?: boolean
}

const DEFAULT_OPTIONS: ExportOptions = {
  includeTranscript: true,
  includeSummary: true,
  includeActionItems: true,
  includeMetadata: true,
}

export function canExportFormat(format: ExportFormat): boolean {
  const licenseStore = useLicenseStore.getState()

  switch (format) {
    case 'plaintext':
      return true // FREE
    case 'markdown':
      return licenseStore.canUse(Feature.ExportMarkdown).type === 'allowed'
    case 'json':
      return licenseStore.canUse(Feature.ExportJson).type === 'allowed'
    default:
      return false
  }
}

export function getAvailableFormats(): ExportFormat[] {
  const formats: ExportFormat[] = ['plaintext']

  if (canExportFormat('markdown')) {
    formats.push('markdown')
  }
  if (canExportFormat('json')) {
    formats.push('json')
  }

  return formats
}

export function exportSession(
  session: Session,
  format: ExportFormat,
  options: ExportOptions = DEFAULT_OPTIONS
): string {
  if (!canExportFormat(format)) {
    log.warn(`Export format ${format} not available for current license`)
    throw new Error(`Export format "${format}" requires a PRO subscription`)
  }

  const opts = { ...DEFAULT_OPTIONS, ...options }

  switch (format) {
    case 'markdown':
      return exportMarkdown(session, opts)
    case 'plaintext':
      return exportPlainText(session, opts)
    case 'json':
      return exportJSON(session, opts)
  }
}

export async function exportSessionToFile(
  session: Session,
  format: ExportFormat,
  options: ExportOptions = DEFAULT_OPTIONS
): Promise<boolean> {
  try {
    const content = exportSession(session, format, options)
    const extension = getFileExtension(format)
    const fileName = sanitizeFileName(session.title) + extension

    // Use Electron's save dialog
    const result = await window.electronAPI?.dialog.showSaveDialog({
      title: 'Export Session',
      defaultPath: fileName,
      filters: getFileFilters(format),
    })

    if (result?.canceled || !result?.filePath) {
      return false
    }

    await window.electronAPI?.fs.writeFile(result.filePath, content)
    log.info(`Session exported to: ${result.filePath}`)
    return true
  } catch (error) {
    log.error('Export failed', error)
    throw error
  }
}

export function exportMultipleSessions(
  sessions: Session[],
  format: ExportFormat,
  options: ExportOptions = DEFAULT_OPTIONS
): string {
  if (!canExportFormat(format)) {
    throw new Error(`Export format "${format}" requires a PRO subscription`)
  }

  const opts = { ...DEFAULT_OPTIONS, ...options }

  switch (format) {
    case 'markdown':
      return sessions.map((s) => exportMarkdown(s, opts)).join('\n\n---\n\n')
    case 'plaintext':
      return sessions.map((s) => exportPlainText(s, opts)).join('\n\n========================================\n\n')
    case 'json':
      return JSON.stringify(sessions, null, 2)
  }
}

function exportMarkdown(session: Session, options: ExportOptions): string {
  const duration = session.endTime
    ? formatDuration(
        (new Date(session.endTime).getTime() - new Date(session.startTime).getTime()) / 1000
      )
    : 'In progress'

  let md = `# ${session.title}\n\n`

  if (options.includeMetadata) {
    md += `**Date:** ${formatDate(session.startTime)}\n`
    md += `**Duration:** ${duration}\n`
    if (session.modeId) {
      md += `**Mode:** ${session.modeId}\n`
    }
    md += '\n'
  }

  if (options.includeSummary && session.summary) {
    md += `## Summary\n\n${session.summary}\n\n`
  }

  if (options.includeActionItems && (session.actionItems?.length ?? 0) > 0) {
    md += `## Action Items\n\n`
    const mdItems = session.actionItems || []
    mdItems.forEach((item: string) => {
      md += `- [ ] ${item}\n`
    })
    md += '\n'
  }

  if (options.includeTranscript && session.transcript.trim()) {
    md += `## Transcript\n\n${formatTranscriptMarkdown(session)}\n`
  }

  return md
}

function exportPlainText(session: Session, options: ExportOptions): string {
  const duration = session.endTime
    ? formatDuration(
        (new Date(session.endTime).getTime() - new Date(session.startTime).getTime()) / 1000
      )
    : 'In progress'

  let text = `${session.title}\n${'='.repeat(session.title.length)}\n\n`

  if (options.includeMetadata) {
    text += `Date: ${formatDate(session.startTime)}\n`
    text += `Duration: ${duration}\n\n`
  }

  if (options.includeSummary && session.summary) {
    text += `SUMMARY\n-------\n${session.summary}\n\n`
  }

  if (options.includeActionItems && (session.actionItems?.length ?? 0) > 0) {
    text += `ACTION ITEMS\n------------\n`
    const textItems = session.actionItems || []
    textItems.forEach((item: string, i: number) => {
      text += `${i + 1}. ${item}\n`
    })
    text += '\n'
  }

  if (options.includeTranscript && session.transcript.trim()) {
    text += `TRANSCRIPT\n----------\n${session.transcript}\n`
  }

  return text
}

function exportJSON(session: Session, options: ExportOptions): string {
  const exportData: Record<string, unknown> = {
    id: session.id,
    title: session.title,
    startTime: session.startTime,
    endTime: session.endTime,
  }

  if (options.includeMetadata) {
    exportData.modeId = session.modeId
    exportData.syncStatus = session.syncStatus
  }

  if (options.includeSummary) {
    exportData.summary = session.summary
  }

  if (options.includeActionItems) {
    exportData.actionItems = session.actionItems || []
  }

  if (options.includeTranscript) {
    exportData.transcript = session.transcript
    exportData.entries = session.entries || []
  }

  return JSON.stringify(exportData, null, 2)
}

function formatTranscriptMarkdown(session: Session): string {
  if (!session.entries || session.entries.length === 0) {
    return session.transcript
  }

  return session.entries
    .map((entry) => {
      const timestamp = new Date(entry.timestamp).toLocaleTimeString()
      const speaker = entry.speaker === 'user' ? '**You:**' : '**Assistant:**'
      return `[${timestamp}] ${speaker} ${entry.text}`
    })
    .join('\n\n')
}

function sanitizeFileName(name: string): string {
  return name
    .replace(/[<>:"/\\|?*]/g, '')
    .replace(/\s+/g, '_')
    .slice(0, 100)
}

function getFileExtension(format: ExportFormat): string {
  switch (format) {
    case 'markdown':
      return '.md'
    case 'plaintext':
      return '.txt'
    case 'json':
      return '.json'
  }
}

function getFileFilters(format: ExportFormat): Array<{ name: string; extensions: string[] }> {
  switch (format) {
    case 'markdown':
      return [{ name: 'Markdown', extensions: ['md'] }]
    case 'plaintext':
      return [{ name: 'Text Files', extensions: ['txt'] }]
    case 'json':
      return [{ name: 'JSON Files', extensions: ['json'] }]
  }
}

// Copy to clipboard utility
export async function copySessionToClipboard(
  session: Session,
  format: ExportFormat = 'plaintext'
): Promise<boolean> {
  try {
    const content = exportSession(session, format)
    await navigator.clipboard.writeText(content)
    log.info(`Session copied to clipboard (${format})`)
    return true
  } catch (error) {
    log.error('Copy to clipboard failed', error)
    return false
  }
}
