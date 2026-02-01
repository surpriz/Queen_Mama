import { Monitor, Upload, Trash2 } from 'lucide-react'
import { useOverlayStore } from '@/stores/overlayStore'
import { useConfigStore } from '@/stores/configStore'
import { cn } from '@/lib/utils'

export function ActionBar() {
  const responseHistory = useOverlayStore((s) => s.responseHistory)
  const clearHistory = useOverlayStore((s) => s.clearHistory)
  const streamingContent = useOverlayStore((s) => s.streamingContent)

  // Screen only mode - when enabled, AI only uses screen content (no audio)
  const captureSystemAudio = useConfigStore((s) => s.captureSystemAudio)
  const captureMicrophone = useConfigStore((s) => s.captureMicrophone)
  const updateConfig = useConfigStore((s) => s.updateConfig)

  const isScreenOnly = !captureSystemAudio && !captureMicrophone

  const handleToggleScreenOnly = () => {
    if (isScreenOnly) {
      // Enable audio capture
      updateConfig({ captureSystemAudio: true, captureMicrophone: true })
    } else {
      // Disable audio capture (screen only)
      updateConfig({ captureSystemAudio: false, captureMicrophone: false })
    }
  }

  const handleExport = () => {
    // Export response history as text
    const content = responseHistory
      .map((r) => `[${new Date(r.timestamp).toLocaleTimeString()}] ${r.content}`)
      .join('\n\n')

    if (content) {
      navigator.clipboard.writeText(content)
      // Could also trigger a file download
    }
  }

  const handleClear = () => {
    clearHistory()
  }

  const responseCount = streamingContent ? responseHistory.length + 1 : responseHistory.length

  return (
    <div className="flex items-center justify-between px-3 py-2 border-t border-qm-border-subtle">
      {/* Left side - Screen only toggle */}
      <button
        onClick={handleToggleScreenOnly}
        className={cn(
          'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors',
          isScreenOnly
            ? 'bg-qm-accent/15 text-qm-accent'
            : 'text-qm-text-tertiary hover:text-qm-text-secondary hover:bg-qm-surface-light',
        )}
        title="Screen only mode - Disable audio capture"
      >
        <Monitor size={12} />
        Screen only
      </button>

      {/* Right side - Export, Clear, Counter */}
      <div className="flex items-center gap-2">
        {/* Export button */}
        <button
          onClick={handleExport}
          disabled={responseCount === 0}
          className="flex items-center gap-1 px-2 py-1 text-[11px] text-qm-text-tertiary hover:text-qm-text-secondary disabled:opacity-30 transition-colors"
          title="Export responses to clipboard"
        >
          <Upload size={12} />
          Export
        </button>

        {/* Clear button */}
        <button
          onClick={handleClear}
          disabled={responseCount === 0}
          className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium text-qm-error bg-qm-error/10 hover:bg-qm-error/20 disabled:opacity-30 transition-colors"
          title="Clear all responses"
        >
          <Trash2 size={12} />
          Clear
        </button>

        {/* Response counter */}
        {responseCount > 0 && (
          <span className="text-[11px] text-qm-text-disabled tabular-nums">
            {responseCount}
          </span>
        )}
      </div>
    </div>
  )
}
