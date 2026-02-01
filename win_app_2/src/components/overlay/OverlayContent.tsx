import { motion, AnimatePresence, LayoutGroup } from 'framer-motion'
import { useOverlayStore } from '@/stores/overlayStore'
import { PillHeader } from './PillHeader'
import { ExpandedContent } from './ExpandedContent'

export function OverlayContent() {
  const isExpanded = useOverlayStore((s) => s.isExpanded)

  return (
    <LayoutGroup>
      <motion.div
        layout
        className="flex flex-col h-full overlay-glass rounded-qm-xl shadow-qm-lg overflow-hidden"
        initial={false}
        animate={{
          height: isExpanded ? 400 : 44,
        }}
        transition={{
          type: 'spring',
          stiffness: 400,
          damping: 30,
        }}
      >
        {/* Collapsed: Pill header */}
        <PillHeader />

        {/* Expanded: Full content */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="flex-1 flex flex-col min-h-0"
            >
              <ExpandedContent />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </LayoutGroup>
  )
}
