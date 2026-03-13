import { useEffect } from 'react'
import { useOverlayStore } from '@/stores/overlayStore'
import { PillHeader } from './PillHeader'
import { ExpandedContent } from './ExpandedContent'
import { cn } from '@/lib/utils'

export function OverlayContent() {
  const isExpanded = useOverlayStore((s) => s.isExpanded)

  // Sync Electron window size whenever expanded state changes
  useEffect(() => {
    console.log('[OverlayContent] isExpanded changed to:', isExpanded, '- calling setExpanded IPC')
    window.electronAPI?.overlay.setExpanded(isExpanded)
  }, [isExpanded])

  return (
    <div className="flex flex-col h-full backdrop-blur-xl bg-[#1a1a2e]/85 border border-white/10 shadow-2xl rounded-2xl overflow-hidden">
      {/* Collapsed: Pill header */}
      <PillHeader />

      {/* Expanded: Full content - flex-1 fills remaining height */}
      <div
        className={cn(
          'transition-[max-height,opacity] duration-300 overflow-hidden',
          isExpanded && 'flex-1 flex flex-col min-h-0',
        )}
        style={{
          maxHeight: isExpanded ? 9999 : 0,
          opacity: isExpanded ? 1 : 0,
          transitionTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
        }}
      >
        <ExpandedContent />
      </div>
    </div>
  )
}
