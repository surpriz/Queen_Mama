import { useState } from 'react'
import { Download, Trash2, Check } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useOverlayStore } from '@/stores/overlayStore'
import { cn } from '@/lib/utils'

export function ActionBar() {
  const { t } = useTranslation('overlay')
  const responseHistory = useOverlayStore((s) => s.responseHistory)
  const clearHistory = useOverlayStore((s) => s.clearHistory)
  const streamingContent = useOverlayStore((s) => s.streamingContent)

  const [confirmClear, setConfirmClear] = useState(false)
  const [exportDone, setExportDone] = useState(false)

  const responseCount = streamingContent ? responseHistory.length + 1 : responseHistory.length

  const handleExport = async () => {
    if (!responseHistory.length) return

    const date = new Date()
    const dateStr = date.toLocaleDateString(undefined, {
      day: '2-digit', month: '2-digit', year: 'numeric',
    })
    const timeStr = date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })

    const lines: string[] = [
      `# Queen Mama — Session Export`,
      ``,
      `*${dateStr} ${timeStr}*`,
      ``,
      `---`,
      ``,
    ]

    ;[...responseHistory].reverse().forEach((entry, idx) => {
      const ts = new Date(entry.timestamp).toLocaleTimeString(undefined, {
        hour: '2-digit', minute: '2-digit', second: '2-digit',
      })
      lines.push(`## Response ${idx + 1}  ·  ${ts}`)
      if (entry.provider) lines.push(`*${entry.provider}*`)
      lines.push(``)
      lines.push(entry.content)
      lines.push(``)
      lines.push(`---`)
      lines.push(``)
    })

    const content = lines.join('\n')
    const defaultFileName = `queen-mama-export-${date.toISOString().slice(0, 10)}.md`

    const result = await window.electronAPI?.file?.saveText(defaultFileName, content)

    if (result && !result.canceled) {
      setExportDone(true)
      setTimeout(() => setExportDone(false), 2000)
    }
  }

  const handleClear = () => {
    if (!confirmClear) {
      setConfirmClear(true)
      setTimeout(() => setConfirmClear(false), 3000)
      return
    }
    clearHistory()
    setConfirmClear(false)
  }

  if (responseCount === 0) return null

  return (
    <div className="flex items-center justify-end gap-2 px-3 py-1.5 border-t border-qm-border-subtle">
      {/* Export button */}
      <button
        onClick={handleExport}
        className={cn(
          'flex items-center gap-1 px-2 py-1 text-[11px] transition-colors',
          exportDone
            ? 'text-qm-success'
            : 'text-qm-text-tertiary hover:text-qm-text-secondary',
        )}
        title={t('actionBar.export')}
      >
        {exportDone ? <Check size={12} /> : <Download size={12} />}
        {exportDone ? t('actionBar.exported') : t('actionBar.export')}
      </button>

      {/* Clear button — 2-step confirm */}
      <button
        onClick={handleClear}
        className={cn(
          'flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium transition-all',
          confirmClear
            ? 'bg-qm-error text-white animate-pulse'
            : 'text-qm-error bg-qm-error/10 hover:bg-qm-error/20',
        )}
        title={confirmClear ? t('actionBar.clearConfirm') : t('actionBar.clear')}
      >
        <Trash2 size={12} />
        {confirmClear ? t('actionBar.clearConfirm') : t('actionBar.clear')}
      </button>

      {/* Response counter */}
      <span className="text-[11px] text-qm-text-disabled tabular-nums">
        {responseCount}
      </span>
    </div>
  )
}
