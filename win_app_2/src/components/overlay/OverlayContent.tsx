import { useOverlayStore } from '@/stores/overlayStore'
import { PillHeader } from './PillHeader'
import { ExpandedContent } from './ExpandedContent'

export function OverlayContent() {
  const isExpanded = useOverlayStore((s) => s.isExpanded)

  return (
    <div className="flex flex-col h-full backdrop-blur-xl bg-[#1a1a2e]/85 border border-white/10 shadow-2xl rounded-2xl overflow-hidden">
      {/* Collapsed: Pill header */}
      <PillHeader />

      {/* Expanded: Full content */}
      {isExpanded && <ExpandedContent />}
    </div>
  )
}
