import { motion, AnimatePresence } from 'framer-motion'
import { Loader2 } from 'lucide-react'
import { useAppStore } from '@/stores/appStore'

interface FinalizationIndicatorProps {
  message?: string
}

export function FinalizationIndicator({ message = 'Generating summary...' }: FinalizationIndicatorProps) {
  const isFinalizingSession = useAppStore((s) => s.isFinalizingSession)

  return (
    <AnimatePresence>
      {isFinalizingSession && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.25, ease: 'easeInOut' }}
          className="px-3 py-2"
        >
          <div className="flex items-center gap-2.5 px-3 py-2 rounded-qm-md bg-qm-accent/10 border border-qm-accent/20">
            <Loader2 size={14} className="text-qm-accent animate-spin" />
            <span className="text-body-sm text-qm-text-secondary font-medium">
              {message}
            </span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
