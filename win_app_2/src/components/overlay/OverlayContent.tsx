import { useOverlayStore } from '@/stores/overlayStore'
import { PillHeader } from './PillHeader'
import { ExpandedContent } from './ExpandedContent'

export function OverlayContent() {
  const isExpanded = useOverlayStore((s) => s.isExpanded)

  return (
    <div className="flex flex-col h-full backdrop-blur-xl bg-[#1a1a2e]/85 border border-white/10 shadow-2xl rounded-2xl overflow-hidden">
      {/* Collapsed: Pill header */}
      <PillHeader />

      {/* Expanded: Full content with spring easing */}
      <div
        className="transition-[max-height,opacity] duration-300 overflow-hidden"
        style={{
          maxHeight: isExpanded ? 480 : 0,
          opacity: isExpanded ? 1 : 0,
          transitionTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
        }}
      >
        <ExpandedContent />
      </div>
    </div>
  )
}
