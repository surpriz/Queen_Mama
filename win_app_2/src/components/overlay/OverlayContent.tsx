import { useOverlayStore } from '@/stores/overlayStore'
import { useAppStore } from '@/stores/appStore'
import { PillHeader } from './PillHeader'
import { ExpandedContent } from './ExpandedContent'

export function OverlayContent() {
  const isExpanded = useOverlayStore((s) => s.isExpanded)

  return (
    <div className="flex flex-col h-full">
      {/* Collapsed: Pill header */}
      <PillHeader />

      {/* Expanded: Full content */}
      {isExpanded && <ExpandedContent />}
    </div>
  )
}
